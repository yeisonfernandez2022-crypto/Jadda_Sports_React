/*
 * Transporter de correo con DOS vías bajo la MISMA interfaz de nodemailer:
 *
 *   1. API HTTPS de Brevo (BREVO_API_KEY) — para entornos sin salida SMTP
 *      (varios hostings/PaaS free bloquean los puertos 25/465/587): el
 *      correo de producción viaja por su API HTTP 443 (nada que pagar:
 *      300 correos/día gratis).
 *   2. SMTP de Gmail (EMAIL_USER + EMAIL_PASS) — desarrollo local, con
 *      "contraseña de aplicación" (no la contraseña normal de Google —
 *      requiere 2FA activado en la cuenta).
 *   3. Stub que solo registra (sin configuración alguna) — igual que antes,
 *      el arranque no depende del correo y ningún envío bloquea controladores.
 *
 * TODOS los módulos que envían correo ya llaman `transporter.sendMail({...})`
 * con formato nodemailer; el mapeo a Brevo vive aquí (from '"Nombre" <correo>',
 * destinatarios String/array, attachments Buffer → base64). Cada llamada captura
 * sus errores y NUNCA bloquea la petición del usuario.
 */

const fs = require("fs");
const nodemailer = require("nodemailer");

const API_BREVO = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_FROM_DEFAULT = process.env.EMAIL_FROM || "JADDA SPORTS";

// Sin timeout un envío colgado dejaría pendiente al controlador que espera el
// await (best-effort no puede permitirse minutos muertos): 20 s es generoso
// incluso para los correos de factura con PDF adjunto.
const TIMEOUT_BREVO_MS = 20000;

// nodemailer acepta: 'correo@x' | '"Nombre" <correo@x>' | 'Nombre <correo@x>' | {email, name?}
const parsearDireccion = (valor) => {
  if (!valor) return null;
  if (typeof valor === "object") {
    const email = String(valor.email || "").trim();
    if (!email) return null;
    return { email, name: valor.name ? String(valor.name).trim() : undefined };
  }
  const texto = String(valor).trim();
  if (!texto) return null;
  const cierre = texto.match(/^(.*)<\s*([^@\s]+@[^@\s]+)\s*>$/);
  if (cierre) {
    // '"Nombre" <correo@x>' → quita las comillas del nombre; '' → undefined
    const nombre = cierre[1].trim().replace(/^"+|"+$/g, "").trim();
    return { email: cierre[2].trim(), name: nombre || undefined };
  }
  return { email: texto, name: undefined };
};

// Divide por comas de "primer nivel" (fuera de comillas dobles): así
// 'a@b.com, c@d.com' se separa en dos direcciones y '"Perez, Juan" <jp@x>'
// (nombre con coma entre comillas) permanece entero.
const dividirPorComas = (texto) => {
  const partes = [];
  let parte = "";
  let enComillas = false;
  for (const caracter of texto) {
    if (caracter === '"') enComillas = !enComillas;
    if (caracter === "," && !enComillas) {
      partes.push(parte);
      parte = "";
    } else {
      parte += caracter;
    }
  }
  partes.push(parte);
  return partes;
};

// nodemailer acepta cadena, cadena separada por comas, o array de cadenas/objetos
const parsearDestinatarios = (valor) => {
  if (!valor) return [];
  const lista = Array.isArray(valor)
    ? valor.flatMap((elemento) =>
        typeof elemento === "string" ? dividirPorComas(elemento) : [elemento]
      )
    : dividirPorComas(String(valor));
  const resultado = [];
  for (const elemento of lista) {
    const direccion = parsearDireccion(elemento);
    if (direccion && direccion.email) resultado.push(direccion);
  }
  return resultado;
};

// Attachment de nodemailer → adjunto de Brevo ({name, content en base64}).
// En este backend siempre viaja un Buffer (el PDF de la factura), pero se
// soporta string (texto/codificación "base64") y path por compatibilidad.
const aAdjuntoBrevo = (archivo) => {
  if (!archivo) return null;
  let contenido = null;
  if (Buffer.isBuffer(archivo.content)) {
    contenido = archivo.content.toString("base64");
  } else if (typeof archivo.content === "string" && archivo.content.length) {
    contenido = archivo.encoding === "base64"
      ? archivo.content
      : Buffer.from(archivo.content).toString("base64");
  } else if (archivo.path) {
    try {
      contenido = fs.readFileSync(archivo.path).toString("base64");
    } catch {
      contenido = null;
    }
  }
  if (!contenido) return null;
  return { name: archivo.filename || archivo.name || "archivo", content: contenido };
};

// MailData nodemailer → cuerpo JSON de POST /v3/smtp/email (exportado para pruebas)
const formatarCorreoBrevo = (mailData = {}) => {
  const remitente = parsearDireccion(mailData.from) || {
    email: EMAIL_USER || "noreply@jaddasports.com",
    name: EMAIL_FROM_DEFAULT,
  };
  const cuerpo = {
    sender: remitente,
    to: parsearDestinatarios(mailData.to),
    subject: mailData.subject || "(sin asunto)",
  };
  const cc = parsearDestinatarios(mailData.cc);
  if (cc.length) cuerpo.cc = cc;
  const bcc = parsearDestinatarios(mailData.bcc);
  if (bcc.length) cuerpo.bcc = bcc;
  const respuesta = parsearDireccion(mailData.replyTo);
  if (respuesta) cuerpo.replyTo = respuesta;
  if (mailData.html) cuerpo.htmlContent = String(mailData.html);
  if (mailData.text) cuerpo.textContent = String(mailData.text);
  const adjuntos = Array.isArray(mailData.attachments)
    ? mailData.attachments.map(aAdjuntoBrevo).filter(Boolean)
    : [];
  if (adjuntos.length) cuerpo.attachment = adjuntos;
  return cuerpo;
};

const enviarPorBrevo = async (mailData) => {
  const cuerpo = formatarCorreoBrevo(mailData);
  if (!cuerpo.to.length) {
    throw new Error("Brevo: la petición no tiene destinatarios");
  }
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_BREVO_MS);
  try {
    const resp = await fetch(API_BREVO, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });
    const texto = await resp.text();
    if (!resp.ok) {
      throw new Error(`Brevo respondió ${resp.status}: ${texto.slice(0, 200)}`);
    }
    let datos = {};
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = {};
    }
    return {
      accepted: cuerpo.to.map((d) => d.email),
      rejected: [],
      messageId: datos.messageId || null,
    };
  } finally {
    clearTimeout(timer);
  }
};

// SMTP local: mismos tiempos de fallo rápido que antes (sin ellos un socket
// muerto de Gmail colgaba el envío durante minutos).
const transporteSmtp =
  EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: EMAIL_USER, pass: process.env.EMAIL_PASS },
        connectionTimeout: 10000, // abrir la conexión SMTP: máx 10 s
        greetingTimeout: 10000,   // saludo del servidor: máx 10 s
        socketTimeout: 20000      // socket inactivo en un envío: máx 20 s
      })
    : null;

const proveedorCorreo = () => (BREVO_API_KEY ? "brevo" : transporteSmtp ? "smtp" : "ninguno");

// La Interfaz EXACTA que consume todo el backend: (await) transporter.sendMail(opts)
const transporter = {
  async sendMail(mailData = {}) {
    const proveedor = proveedorCorreo();
    if (proveedor === "brevo") return enviarPorBrevo(mailData);
    if (proveedor === "smtp") return transporteSmtp.sendMail(mailData);
    console.warn('[MAIL] Correo NO enviado (sin BREVO_API_KEY ni EMAIL_USER/EMAIL_PASS):', mailData.subject || '(sin asunto)');
    return null;
  },
};

module.exports = transporter;
module.exports.proveedorCorreo = proveedorCorreo;       // diagnóstico (/health) y pruebas
module.exports.parsearDireccion = parsearDireccion;     // pruebas unitarias
module.exports.formatarCorreoBrevo = formatarCorreoBrevo; // pruebas unitarias

const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const transporter = require("../config/mailer");
const {
  plantillaCorreo,
  imagenComoDataUri,
} = require("../utils/correo");
const db = require("../config/db");

const ARCHIVO = path.join(__dirname, "..", "data", "newsletter.json");
const ARCHIVO_ESTADO = path.join(__dirname, "..", "data", "newsletter-estado.json");

fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });

const leerSuscritos = async () => {
  try {
    return JSON.parse(await readFile(ARCHIVO, "utf8"));
  } catch {
    return [];
  }
};

const guardarSuscritos = async (lista) => {
  await writeFile(ARCHIVO, JSON.stringify(lista, null, 2), "utf8");
};

const leerEstado = async () => {
  try {
    return JSON.parse(await readFile(ARCHIVO_ESTADO, "utf8"));
  } catch {
    return { ultimoEnvio: null, totalEnviados: 0 };
  }
};

const guardarEstado = async (estado) => {
  await writeFile(ARCHIVO_ESTADO, JSON.stringify(estado, null, 2), "utf8");
};

/** Escapa texto para evitar romper el HTML del correo (nombres con < > &). */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** POST /api/newsletter — Registra un correo en la lista de novedades. */
const suscribirNewsletter = async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, msg: "Correo inválido" });
  }
  try {
    const lista = await leerSuscritos();
    const normalizado = email.trim().toLowerCase();
    if (lista.some((s) => s.email === normalizado)) {
      return res.status(200).json({ ok: true, msg: "Ya estás suscrito" });
    }
    lista.push({ email: normalizado, fecha: new Date().toISOString() });
    await guardarSuscritos(lista);
    res.status(201).json({ ok: true, msg: "¡Suscripción exitosa!" });
  } catch (err) {
    console.error("Error al suscribir newsletter:", err);
    res.status(500).json({ ok: false, msg: "Error al suscribirse" });
  }
};

/** POST /api/newsletter/desuscribir — Quita un correo de la lista. */
const desuscribirNewsletter = async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, msg: "Falta el correo" });
  }
  try {
    const normalizado = email.trim().toLowerCase();
    const lista = await leerSuscritos();
    const nueva = lista.filter((s) => s.email !== normalizado);
    await guardarSuscritos(nueva);
    res.status(200).json({ ok: true, msg: "Te desuscribiste correctamente" });
  } catch (err) {
    console.error("Error al desuscribir newsletter:", err);
    res.status(500).json({ ok: false, msg: "Error al desuscribirse" });
  }
};

/** GET /api/newsletter/desuscribir?email=... — Página HTML para el link del correo. */
const desuscribirPagina = async (req, res) => {
  const { email } = req.query;
  if (email) {
    try {
      const lista = await leerSuscritos();
      await guardarSuscritos(lista.filter((s) => s.email !== email.trim().toLowerCase()));
    } catch (err) {
      console.error("Error al desuscribir por link:", err);
    }
  }
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Te desuscribiste de JADDA SPORTS</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;box-shadow:0 8px 30px rgba(2,6,23,.1)">
<div style="font-size:44px">👋</div>
<h1 style="font-size:20px;color:#0f172a;margin:14px 0 6px">Te desuscribiste de JADDA SPORTS</h1>
<p style="font-size:14px;color:#64748b;margin:0 0 20px">Ya no recibirás más novedades ni ofertas en tu correo. Si cambias de opinión, puedes volver a suscribirte desde nuestro <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}" style="color:#e63946">sitio web</a>.</p>
</div></body></html>`);
};

/** GET /api/newsletter/suscritos — Lista de suscritos (solo admin). */
const obtenerSuscritos = async (req, res) => {
  try {
    const lista = await leerSuscritos();
    const estado = await leerEstado();
    res.json({ ok: true, lista, total: lista.length, estado });
  } catch (err) {
    res.status(500).json({ ok: false, msg: "Error al leer suscritos" });
  }
};

/**
 * Consulta ofertas reales de la BD: productos con ID_DESCUENTO activo.
 * Devuelve 6 al azar con imagen y porcentaje de descuento.
 */
const obtenerOfertas = async () => {
  try {
    const [rows] = await db.query(`
      SELECT p.ID, p.NOMBRE, p.PRECIO, p.MARCA, d.PORCENTAJE,
             (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi
              WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN
      FROM PRODUCTOS p
      JOIN DESCUENTOS d ON p.ID_DESCUENTO = d.ID_DESCUENTO
      WHERE p.ID_DESCUENTO IS NOT NULL
        AND (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
        AND d.PORCENTAJE IS NOT NULL AND d.PORCENTAJE > 0
        AND (d.FECHA_FIN IS NULL OR d.FECHA_FIN >= CURDATE())
      ORDER BY RAND()
      LIMIT 6
    `);
    return rows || [];
  } catch (err) {
    console.error("Error consultando ofertas para newsletter:", err.message);
    return [];
  }
};

const PLANTILLAS = [
  {
    emoji: "🔥",
    titulo: "¡Ofertas que no te puedes perder!",
    subtitulo: "Descuentos reales en artículos deportivos originales",
    pitch:
      "En <b>JADDA SPORTS</b> somos la mejor página para comprar artículos deportivos: marcas originales, precios justos, envío gratis desde $200.000 y compras 100% seguras.",
    cta: "Ver todas las ofertas",
  },
  {
    emoji: "🏆",
    titulo: "Lo mejor en deportes, directo a tu correo",
    subtitulo: "Elige calidad sin pagar de más",
    pitch:
      "En <b>JADDA SPORTS</b> encuentras todo lo que necesitas para tu deporte favorito: calzado, ropa, balones y accesorios de las mejores marcas, con precios pensados para ti.",
    cta: "Explorar el catálogo",
  },
  {
    emoji: "⚽",
    titulo: "Novedades y descuentos exclusivos",
    subtitulo: "Solo para suscriptores como tú",
    pitch:
      "Ser parte de <b>JADDA SPORTS</b> tiene ventajas: te avisamos primero de las ofertas, las novedades y los productos más buscados por deportistas como tú.",
    cta: "Ver todas las ofertas",
  },
  {
    emoji: "💪",
    titulo: "¡Tu próxima compra deportiva espera!",
    subtitulo: "Hazte con lo mejor, al mejor precio",
    pitch:
      "En <b>JADDA SPORTS</b> cada pedido llega rápido y seguro a toda Colombia. Compra con total confianza y entrena con lo que usan los campeones.",
    cta: "Ver ofertas destacadas",
  },
];

/** Construye el HTML de las ofertas (miniaturas + precio con descuento). */
const htmlOfertas = (ofertas) => {
  if (!ofertas || ofertas.length === 0) {
    return `<p style="margin:0 0 10px">Descubre nuestro catálogo completo con cientos de artículos deportivos esperándote:</p>`;
  }
  return ofertas
    .map((o) => {
      const pct = Number(o.PORCENTAJE) || 0;
      const original = Number(o.PRECIO) || 0;
      const final = Math.round(original * (1 - pct / 100));
      const imagen = imagenComoDataUri(o.IMAGEN);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef2f7;vertical-align:middle">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
            <tr>
              <td style="width:64px;vertical-align:middle">
                <img src="${imagen}" alt="${esc(o.NOMBRE)}" width="52" height="52" style="border-radius:8px;object-fit:cover;display:block">
              </td>
              <td style="padding-left:12px;vertical-align:middle;font-size:13.5px;color:#334155">
                <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/producto/${o.ID}" style="color:#0f172a;font-weight:700;text-decoration:none;display:block">${esc(o.NOMBRE)}</a>
                <span style="color:#94a3b8;font-size:12px">${esc(o.MARCA)}</span>
              </td>
              <td style="text-align:right;vertical-align:middle;white-space:nowrap">
                <span style="text-decoration:line-through;color:#94a3b8;font-size:12px;display:block">$${original.toLocaleString("es-CO")}</span>
                <span style="color:#e63946;font-weight:800;font-size:15px">$${final.toLocaleString("es-CO")}</span>
                <span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;border-radius:6px;padding:1px 6px;margin-left:4px">-${pct}%</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");
};

/**
 * Núcleo del envío: arma el correo (ofertas reales + mensaje aleatorio) y lo
 * manda a TODOS los suscritos. Nunca lanza: los errores de SMTP se capturan
 * correo por correo para no romper el lote.
 */
const enviarNewsletterAhora = async () => {
  try {
    const suscritos = await leerSuscritos();
    const total = suscritos.length;
    if (total === 0) {
      return { ok: true, enviados: 0, suscritos: 0, tema: null, msg: "No hay suscritos" };
    }

    const ofertas = await obtenerOfertas();
    const plantilla = PLANTILLAS[Math.floor(Math.random() * PLANTILLAS.length)];

    const contenidos = [
      `<p style="margin:0 0 16px">${plantilla.pitch}</p>
       <p style="margin:0 0 6px;font-size:13px;color:#64748b;letter-spacing:1px;font-weight:700">OFERTAS DESTACADAS</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${htmlOfertas(ofertas)}</table>`,
    ];

    const notas = [
      "Elige entre cientos de productos deportivos con envío a toda Colombia.",
      "Envío gratis en compras desde $200.000. Pagos 100% seguros.",
      `Recibes este correo porque te suscribiste al boletín de JADDA SPORTS. Si ya no quieres recibir novedades, <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/api/newsletter/desuscribir?email=${encodeURIComponent("SU_CORREO")}" style="color:#e63946">desuscríbete aquí</a>.`,
    ];

    const html = plantillaCorreo({
      emoji: plantilla.emoji,
      titulo: plantilla.titulo,
      subtitulo: plantilla.subtitulo,
      saludo: "¡Hola! 😄",
      contenido: contenidos[0],
      botonTexto: plantilla.cta,
      botonEnlace: `${process.env.FRONTEND_URL || "http://localhost:5173"}/catalogo?descuento=true`,
      notas,
    });

    let enviados = 0;
    for (const s of suscritos) {
      try {
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER || "noreply@jaddasports.com"}>`,
          to: s.email,
          subject: plantilla.titulo,
          html: html.replace(
            encodeURIComponent("SU_CORREO"),
            encodeURIComponent(s.email)
          ),
        });
        enviados++;
      } catch (err) {
        console.error(`📧 Newsletter: falló el envío a ${s.email}:`, err.message);
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const estado = await leerEstado();
    estado.ultimoEnvio = new Date().toISOString();
    estado.totalEnviados = (Number(estado.totalEnviados) || 0) + enviados;
    estado.tema = plantilla.titulo;
    await guardarEstado(estado);

    console.log(`📧 Newsletter enviada: ${enviados}/${total} correos — "${plantilla.titulo}"`);
    return { ok: true, enviados, suscritos: total, tema: plantilla.titulo };
  } catch (err) {
    console.error("❌ Error general en newsletter:", err.message);
    return { ok: false, msg: err.message };
  }
};

/** POST /api/newsletter/enviar — Dispara un envío manual ahora (solo admin). */
const enviarAhora = async (req, res) => {
  const resultado = await enviarNewsletterAhora();
  if (!resultado.ok) {
    return res.status(500).json({ ok: false, msg: resultado.msg || "Error al enviar" });
  }
  res.json(resultado);
};

module.exports = {
  suscribirNewsletter,
  desuscribirNewsletter,
  desuscribirPagina,
  obtenerSuscritos,
  enviarNewsletterAhora,
  enviarAhora,
};
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');
const { plantillaCorreo } = require('../utils/correo');
const { crearNotificacion } = require('./notificacionController');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function limpia(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function slugBase(texto) {
  const base = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return base || 'vendedor';
}

async function generarUsuarioUnico(base) {
  for (let i = 0; i < 10; i++) {
    const usuario = `${base}.${Math.floor(1000 + Math.random() * 9000)}`;
    const [rows] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO = ?', [usuario]);
    if (rows.length === 0) return usuario;
  }
  return `${base}.${Date.now()}`;
}

function generarPasswordTemporal() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

/** Envía por correo el rechazo de una solicitud hecha sin iniciar sesión (no bloquea). */
function enviarRechazo(email, empresa, observacion) {
  const front = process.env.FRONTEND_URL || 'http://localhost:5173';
  return transporter.sendMail({
    from: process.env.EMAIL_USER ? `"JADDA SPORTS" <${process.env.EMAIL_USER}>` : '"JADDA SPORTS" <no-reply@jaddasports.com>',
    to: email,
    subject: 'Tu solicitud de vendedor no fue aprobada',
    html: plantillaCorreo({
      emoji: '📋',
      titulo: 'Solicitud de vendedor rechazada',
      subtitulo: `Hola, tu solicitud para "${empresa}" no fue aprobada.`,
      saludo: observacion
        ? 'Motivo:'
        : 'No se dieron más detalles. Puedes revisar los requisitos y volver a enviar tu solicitud.',
      contenido: observacion
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px">
             <p style="margin:0;font-size:14px;color:#7f1d1d">${observacion}</p>
           </div>`
        : '',
      botonTexto: 'Volver a intentar',
      botonEnlace: `${front}/ser-vendedor`,
      notas: [
        '🛍️ Puedes corregir los datos y enviar una nueva solicitud.',
        '⚖️ Todas las solicitudes se evalúan según las políticas de vendedor de Colombia.',
      ],
    }),
  });
}

/** Envía por correo las credenciales temporales al nuevo vendedor (no bloquea el proceso). */
function enviarCredenciales(email, usuario, password) {
  const front = process.env.FRONTEND_URL || 'http://localhost:5173';
  return transporter.sendMail({
    from: process.env.EMAIL_USER ? `"JADDA SPORTS" <${process.env.EMAIL_USER}>` : '"JADDA SPORTS" <no-reply@jaddasports.com>',
    to: email,
    subject: '🎉 ¡Bienvenido a JADDA SPORTS como vendedor!',
    html: plantillaCorreo({
      emoji: '🎉',
      titulo: '¡Felicidades, ya eres vendedor!',
      subtitulo: 'Tu solicitud para vender en JADDA SPORTS fue aprobada.',
      saludo: 'Estas son tus credenciales para iniciar sesión como vendedor:',
      contenido: `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px">
          <p style="margin:0 0 6px;font-size:13px"><strong>Correo de acceso:</strong> ${email}</p>
          <p style="margin:0;font-size:13px"><strong>Contraseña temporal:</strong> ${password}</p>
        </div>`,
      botonTexto: 'Ir a JADDA SPORTS',
      botonEnlace: front,
      notas: [
        '🔒 Al iniciar sesión deberás cambiar tu contraseña temporal.',
        '🛍️ Desde tu cuenta de vendedor podrás gestionar tus productos y ventas.',
        '⚠️ El incumplimiento de las políticas de vendedor puede llevar a la eliminación de la cuenta.',
      ],
    }),
  });
}

/** Registra la solicitud del formulario "Ser vendedor" (sin necesidad de sesión). */
const solicitarVendedor = async (req, res) => {
  const id_usuario = (req.user && (req.user.ID_USUARIO || req.user.id)) || null;
  const {
    nombre_empresa, nit, nombre_representante, email_empresa,
    telefono, departamento, ciudad, direccion, categorias, descripcion,
  } = req.body || {};

  const campoEmpresa = limpia(nombre_empresa);
  const campoNit = limpia(nit);
  const campoRep = limpia(nombre_representante);
  const campoEmail = limpia(email_empresa).toLowerCase();
  const campoTel = limpia(telefono);
  const campoDepto = limpia(departamento);
  const campoCiudad = limpia(ciudad);

  if (!campoEmpresa || campoEmpresa.length < 3 || campoEmpresa.length > 150) {
    return res.status(400).json({ ok: false, msg: 'El nombre de la empresa es obligatorio (mínimo 3 caracteres)' });
  }
  if (!/^\d{5,20}$/.test(campoNit)) {
    return res.status(400).json({ ok: false, msg: 'El NIT debe tener entre 5 y 20 dígitos' });
  }
  if (!campoRep || campoRep.length < 3) {
    return res.status(400).json({ ok: false, msg: 'El nombre del representante legal es obligatorio' });
  }
  if (!EMAIL_RE.test(campoEmail)) {
    return res.status(400).json({ ok: false, msg: 'El correo de la empresa no es válido' });
  }
  if (!/^[0-9+\-() ]{7,15}$/.test(campoTel)) {
    return res.status(400).json({ ok: false, msg: 'El teléfono debe tener entre 7 y 15 dígitos' });
  }
  if (!campoDepto) {
    return res.status(400).json({ ok: false, msg: 'Selecciona el departamento' });
  }
  if (!campoCiudad || campoCiudad.length < 2) {
    return res.status(400).json({ ok: false, msg: 'La ciudad es obligatoria' });
  }

  try {
    // Si hay sesión, bloquea el reenvío mientras la solicitud esté PENDIENTE/APROBADA
    const [existentes] = id_usuario
      ? await db.query(
          'SELECT ID_SOLICITUD, ESTADO FROM SOLICITUDES_VENDEDOR WHERE ID_USUARIO = ?',
          [id_usuario]
        )
      : [[]];
    if (existentes.length > 0 && existentes[0].ESTADO !== 'RECHAZADA') {
      const estado = existentes[0].ESTADO === 'APROBADA' ? 'aprobada' : 'en revisión';
      return res.status(400).json({ ok: false, msg: `Ya tienes una solicitud ${estado} — revisa tu correo` });
    }

    const [[nitExiste]] = await db.query(
      'SELECT COUNT(*) AS total FROM SOLICITUDES_VENDEDOR WHERE NIT = ? AND (? IS NULL OR ID_USUARIO <> ?)',
      [campoNit, id_usuario, id_usuario]
    );
    const [[nitVendedor]] = await db.query('SELECT COUNT(*) AS total FROM VENDEDORES WHERE NIT = ?', [campoNit]);
    if (Number(nitExiste.total) + Number(nitVendedor.total) > 0) {
      return res.status(409).json({ ok: false, msg: 'Este NIT ya tiene una solicitud registrada' });
    }

    const [[emailExiste]] = await db.query(
      'SELECT COUNT(*) AS total FROM SOLICITUDES_VENDEDOR WHERE EMAIL_EMPRESA = ? AND (? IS NULL OR ID_USUARIO <> ?)',
      [campoEmail, id_usuario, id_usuario]
    );
    const [[emailVendedor]] = await db.query('SELECT COUNT(*) AS total FROM VENDEDORES WHERE EMAIL_VENDEDOR = ?', [campoEmail]);
    if (Number(emailExiste.total) + Number(emailVendedor.total) > 0) {
      return res.status(409).json({ ok: false, msg: 'Este correo de empresa ya está registrado' });
    }

    const datos = [
      campoEmpresa, campoNit, campoRep, campoEmail, campoTel, campoDepto, campoCiudad,
      limpia(direccion) || null, limpia(categorias) || null, limpia(descripcion) || null,
    ];

    if (existentes.length > 0) {
      await db.query(
        `UPDATE SOLICITUDES_VENDEDOR SET
           NOMBRE_EMPRESA = ?, NIT = ?, NOMBRE_REPRESENTANTE = ?, EMAIL_EMPRESA = ?, TELEFONO = ?,
           DEPARTAMENTO = ?, CIUDAD = ?, DIRECCION = ?, CATEGORIAS = ?, DESCRIPCION = ?,
           ESTADO = 'PENDIENTE', OBSERVACION_ADMIN = NULL, FECHA_CREACION = NOW(), FECHA_PROCESADA = NULL
         WHERE ID_SOLICITUD = ?`,
        [...datos, existentes[0].ID_SOLICITUD]
      );
    } else {
      await db.query(
        `INSERT INTO SOLICITUDES_VENDEDOR
           (ID_USUARIO, NOMBRE_EMPRESA, NIT, NOMBRE_REPRESENTANTE, EMAIL_EMPRESA, TELEFONO,
            DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS, DESCRIPCION)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id_usuario, ...datos]
      );
    }

    res.status(201).json({
      ok: true,
      msg: 'Solicitud registrada. En un plazo máximo de 48 horas se verificará y, si se aprueba, recibirás por correo tus credenciales de vendedor.',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, msg: 'El NIT o el correo de empresa ya están registrados' });
    }
    console.error('Error al solicitar vendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al registrar la solicitud' });
  }
};

/** Devuelve la solicitud del usuario autenticado + su cuenta de vendedor si fue aprobada. */
const miSolicitud = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO || req.user.id;
  try {
    const [solicitudes] = await db.query(
      'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_USUARIO = ?',
      [id_usuario]
    );
    const solicitud = solicitudes[0] || null;
    const [vendedores] = solicitud
      ? await db.query(
          `SELECT v.*, u.USUARIO, u.DEBE_CAMBIAR_PASSWORD, u.EMAIL
           FROM VENDEDORES v
           JOIN USUARIOS u ON v.ID_USUARIO = u.ID_USUARIO
           WHERE v.ID_SOLICITUD = ?`,
          [solicitud.ID_SOLICITUD]
        )
      : [[]];
    res.json({ solicitud, vendedor: vendedores[0] || null });
  } catch (err) {
    console.error('Error al obtener solicitud:', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener la solicitud' });
  }
};

/** (Admin) Lista todas las solicitudes de vendedor con el solicitante (si inició sesión). */
const obtenerSolicitudes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*,
              u.NOMBRE_USUARIO AS SOLICITANTE_NOMBRE, u.EMAIL AS SOLICITANTE_EMAIL,
              v.ID_VENDEDOR AS VENDEDOR_ID, v.ESTADO AS VENDEDOR_ESTADO
       FROM SOLICITUDES_VENDEDOR s
       LEFT JOIN USUARIOS u ON s.ID_USUARIO = u.ID_USUARIO
       LEFT JOIN VENDEDORES v ON v.ID_SOLICITUD = s.ID_SOLICITUD
       ORDER BY s.ESTADO = 'PENDIENTE' DESC, s.FECHA_CREACION DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener solicitudes de vendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener las solicitudes' });
  }
};

/** (Admin) Aprueba o rechaza una solicitud. Al aprobar crea la cuenta de vendedor
 *  (correo de la empresa + contraseña temporal) y envía las credenciales por email. */
const procesarSolicitud = async (req, res) => {
  const id_solicitud = req.params.id;
  const { estado, observacion } = req.body || {};
  if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
    return res.status(400).json({ ok: false, msg: 'Estado inválido' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [sols] = await connection.query(
      'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE',
      [id_solicitud]
    );
    if (sols.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada' });
    }
    const sol = sols[0];
    if (sol.ESTADO !== 'PENDIENTE') {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: 'Esta solicitud ya fue procesada' });
    }

    if (estado === 'RECHAZADA') {
      await connection.query(
        "UPDATE SOLICITUDES_VENDEDOR SET ESTADO = 'RECHAZADA', OBSERVACION_ADMIN = ?, FECHA_PROCESADA = NOW() WHERE ID_SOLICITUD = ?",
        [observacion || null, id_solicitud]
      );
      await connection.commit();

      if (sol.ID_USUARIO) {
        await crearNotificacion({
          idUsuario: sol.ID_USUARIO,
          tipo: 'vendedor',
          titulo: 'Solicitud de vendedor rechazada',
          mensaje: observacion || `Tu solicitud para "${sol.NOMBRE_EMPRESA}" no fue aprobada. Puedes volver a intentarlo.`,
          ruta: '/ser-vendedor',
        });
      } else {
        enviarRechazo(sol.EMAIL_EMPRESA, sol.NOMBRE_EMPRESA, observacion).catch((e) =>
          console.error('Error al enviar correo de rechazo de vendedor:', e.message)
        );
      }
      return res.json({ ok: true, msg: 'Solicitud rechazada y notificada al solicitante' });
    }

    // --- APROBADA: crear cuenta de vendedor con credenciales temporales ---
    const [emailUsado] = await connection.query(
      'SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = ?',
      [sol.EMAIL_EMPRESA]
    );
    if (emailUsado.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        msg: `El correo ${sol.EMAIL_EMPRESA} ya está registrado en el sistema. Pide al solicitante que lo cambie en su formulario y vuelve a intentar.`,
      });
    }

    const passwordTemp = generarPasswordTemporal();
    const hashed = await bcrypt.hash(passwordTemp, 10);
    const usuarioUnico = await generarUsuarioUnico(`vendedor_${slugBase(sol.NOMBRE_EMPRESA)}`);

    const [insert] = await connection.query(
      `INSERT INTO USUARIOS
         (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, CONFIRMADO, AUTH_PROVIDER, DEBE_CAMBIAR_PASSWORD)
       VALUES (?, '', ?, ?, ?, CURDATE(), 6, 1, 'local', 1)`,
      [sol.NOMBRE_REPRESENTANTE, sol.EMAIL_EMPRESA, usuarioUnico, hashed]
    );
    const idVendedorUsuario = insert.insertId;

    await connection.query(
      `INSERT INTO VENDEDORES
         (ID_USUARIO, ID_SOLICITUD, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR, TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idVendedorUsuario, id_solicitud, sol.NOMBRE_EMPRESA, sol.NIT, sol.EMAIL_EMPRESA,
       sol.TELEFONO, sol.DEPARTAMENTO, sol.CIUDAD, sol.DIRECCION, sol.CATEGORIAS]
    );

    await connection.query(
      "UPDATE SOLICITUDES_VENDEDOR SET ESTADO = 'APROBADA', OBSERVACION_ADMIN = ?, FECHA_PROCESADA = NOW() WHERE ID_SOLICITUD = ?",
      [observacion || null, id_solicitud]
    );

    await connection.commit();

    // Envíos y notificaciones: nunca bloquean la respuesta
    enviarCredenciales(sol.EMAIL_EMPRESA, usuarioUnico, passwordTemp).catch((e) =>
      console.error('Error al enviar credenciales de vendedor:', e.message)
    );
    if (sol.ID_USUARIO) {
      await crearNotificacion({
        idUsuario: sol.ID_USUARIO,
        tipo: 'vendedor',
        titulo: '¡Solicitud aprobada!',
        mensaje: `Tus credenciales de vendedor fueron enviadas a ${sol.EMAIL_EMPRESA}.`,
        ruta: '/ser-vendedor',
      });
    }
    await crearNotificacion({
      idUsuario: idVendedorUsuario,
      tipo: 'vendedor',
      titulo: '¡Bienvenido a JADDA SPORTS!',
      mensaje: 'Cambia tu contraseña temporal en tu primer ingreso.',
      ruta: '/perfil/seguridad',
    });

    res.json({ ok: true, msg: 'Vendedor creado. Credenciales enviadas por correo.' });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error('Error al procesar solicitud de vendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al procesar la solicitud' });
  } finally {
    connection.release();
  }
};

module.exports = { solicitarVendedor, miSolicitud, obtenerSolicitudes, procesarSolicitud };

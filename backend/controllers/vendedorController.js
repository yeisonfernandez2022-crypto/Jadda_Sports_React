const db = require('../config/db');
const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');
const { plantillaCorreo } = require('../utils/correo');
const { crearNotificacion } = require('./notificacionController');
const { notificarCambioEstado } = require('../utils/estadoPedido');
const { registrarMovimientoStock } = require('../utils/movimientosStock');
const chatCtrl = require('./chatController');

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

/** Notifica SOLO a los administradores (una notificación por admin, no global). */
async function notificarAdmins({ tipo, titulo, mensaje, ruta }) {
  try {
    const [admins] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1');
    for (const a of admins) {
      await crearNotificacion({ idUsuario: a.ID_USUARIO, tipo, titulo, mensaje, ruta });
    }
  } catch (err) {
    console.error('Error al notificar a los administradores:', err);
  }
}

async function generarUsuarioUnico(base) {
  const corta = base.slice(0, 14);
  for (let i = 0; i < 10; i++) {
    const usuario = `${corta}.${Math.floor(1000 + Math.random() * 9000)}`;
    const [rows] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO = ?', [usuario]);
    if (rows.length === 0) return usuario;
  }
  return `${corta}.${Date.now().toString().slice(-4)}`;
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
      emoji: '�???',
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
        '�??�️ Puedes corregir los datos y enviar una nueva solicitud.',
        '�??️ Todas las solicitudes se evalúan según las políticas de vendedor de Colombia.',
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
    subject: '�??? ¡Bienvenido a JADDA SPORTS como vendedor!',
    html: plantillaCorreo({
      emoji: '�???',
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
        '�??? Al iniciar sesión deberás cambiar tu contraseña temporal.',
        '�??�️ Desde tu cuenta de vendedor podrás gestionar tus productos y ventas.',
        '�?�️ El incumplimiento de las políticas de vendedor puede llevar a la eliminación de la cuenta.',
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

  if (campoEmpresa && (campoEmpresa.length < 3 || campoEmpresa.length > 150)) {
    return res.status(400).json({ ok: false, msg: 'El nombre de la empresa debe tener entre 3 y 150 caracteres' });
  }
  if (campoNit && !/^\d{5,20}$/.test(campoNit)) {
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
      return res.status(400).json({ ok: false, msg: `Ya tienes una solicitud ${estado} �?? revisa tu correo` });
    }

    if (campoNit) {
      const [[nitExiste]] = await db.query(
        'SELECT COUNT(*) AS total FROM SOLICITUDES_VENDEDOR WHERE NIT = ? AND (? IS NULL OR ID_USUARIO <> ?)',
        [campoNit, id_usuario, id_usuario]
      );
      const [[nitVendedor]] = await db.query('SELECT COUNT(*) AS total FROM VENDEDORES WHERE NIT = ?', [campoNit]);
      if (Number(nitExiste.total) + Number(nitVendedor.total) > 0) {
        return res.status(409).json({ ok: false, msg: 'Este NIT ya tiene una solicitud registrada' });
      }
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
  if (estado === 'RECHAZADA' && !(observacion || '').trim()) {
    return res.status(400).json({ ok: false, msg: 'Debes indicar el motivo del rechazo' });
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
        [observacion.trim(), id_solicitud]
      );
      await connection.commit();

      // Correo de rechazo SIEMPRE: si el solicitante tiene cuenta se usa el
      // email de su usuario; si no, el correo de empresa del formulario.
      let correoRechazo = sol.EMAIL_EMPRESA;
      if (sol.ID_USUARIO) {
        try {
          const [[cuenta]] = await db.query(
            'SELECT EMAIL FROM USUARIOS WHERE ID_USUARIO = ?',
            [sol.ID_USUARIO]
          );
          if (cuenta?.EMAIL) correoRechazo = cuenta.EMAIL;
        } catch (e) {
          console.error('No se pudo obtener el correo del solicitante:', e.message);
        }
        await crearNotificacion({
          idUsuario: sol.ID_USUARIO,
          tipo: 'vendedor',
          titulo: 'Solicitud de vendedor rechazada',
          mensaje: `Motivo: ${observacion.trim()} Puedes corregir los datos y volver a intentarlo.`,
          ruta: '/ser-vendedor',
        }).catch((e) => console.error('Error al notificar rechazo de vendedor:', e.message));
      }
      if (EMAIL_RE.test(correoRechazo || '')) {
        enviarRechazo(correoRechazo, sol.NOMBRE_EMPRESA, observacion.trim()).catch((e) =>
          console.error('Error al enviar correo de rechazo de vendedor:', e.message)
        );
      }
      return res.json({ ok: true, msg: 'Solicitud rechazada. El motivo fue enviado al solicitante por correo.' });
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

// =============================================================================
// PANEL DEL VENDEDOR (mi tienda, mis productos, mis ventas, mi empresa)
// =============================================================================

const PRODUCTO_VISIBLE_SQL = '(p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = \'APROBADO\')';

/** Datos de la tienda del vendedor + estadísticas + últimas ventas + stock bajo. */
const miTienda = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_VENDEDOR = ?) AS productosPublicados,
         (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_VENDEDOR = ? AND p.ESTADO_PUBLICACION = 'PENDIENTE') AS productosPendientes,
         (SELECT COALESCE(SUM(dv.CANTIDAD), 0)
            FROM DETALLE_VENTAS dv JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
            JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
            WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS unidadesVendidas,
         (SELECT COUNT(DISTINCT dv.ID_VENTA)
            FROM DETALLE_VENTAS dv JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
            JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
            WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS totalVentas,
         (SELECT COALESCE(SUM(dv.SUBTOTAL), 0)
            FROM DETALLE_VENTAS dv JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
            JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
            WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS totalIngresos`,
      [vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR]
    );

    const [ultimasVentas] = await db.query(
      `SELECT v.ID_VENTA, v.REFERENCIA_PAGO, v.TOTAL, v.ESTADO, v.FECHA_VENTA,
              u.NOMBRE_USUARIO AS CLIENTE,
              (SELECT COUNT(*) FROM DETALLE_VENTAS dv WHERE dv.ID_VENTA = v.ID_VENTA) AS ARTICULOS
       FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       WHERE v.ESTADO <> 'CANCELADA'
       GROUP BY v.ID_VENTA
       ORDER BY v.FECHA_VENTA DESC
       LIMIT 8`,
      [vendedor.ID_VENDEDOR]
    );

    const [stockBajo] = await db.query(
      `SELECT p.ID, p.NOMBRE, pv.ID_VARIANTE, pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO, pv.STOCK
       FROM PRODUCTO_VARIANTES pv
       JOIN PRODUCTOS p ON p.ID = pv.ID_PRODUCTO AND p.ID_VENDEDOR = ?
       WHERE pv.STOCK <= 10
       ORDER BY pv.STOCK ASC
       LIMIT 10`,
      [vendedor.ID_VENDEDOR]
    );

    res.json({ vendedor, stats, ultimasVentas, stockBajo });
  } catch (err) {
    console.error('Error en miTienda:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar tu tienda' });
  }
};

/** Lista de productos del vendedor (con imagen, stock, categoría y estado). */
const misProductos = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const [productos] = await db.query(
      `SELECT p.ID, p.NOMBRE, p.MARCA, p.PRECIO, p.ID_DESCUENTO,
              p.ESTADO_PUBLICACION,
              c.NOMBRE_CATEGORIA AS CATEGORIA,
              pi.URL_IMAGEN AS IMAGEN,
              COALESCE(SUM(pv.STOCK), 0) AS STOCK,
              (SELECT COUNT(*) FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID) AS RESENA_COUNT
       FROM PRODUCTOS p
       LEFT JOIN CATEGORIAS c ON p.ID_CATEGORIA = c.ID_CATEGORIA
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON p.ID = pv.ID_PRODUCTO
       WHERE p.ID_VENDEDOR = ?
       GROUP BY p.ID, p.NOMBRE, p.MARCA, p.PRECIO, p.ID_DESCUENTO, p.ESTADO_PUBLICACION,
                c.NOMBRE_CATEGORIA, pi.URL_IMAGEN
       ORDER BY p.ID DESC`,
      [vendedor.ID_VENDEDOR]
    );
    res.json(productos);
  } catch (err) {
    console.error('Error en misProductos:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar tus productos' });
  }
};

/** Detalle completo de UN producto propio (para el formulario de edición). */
const obtenerProductoVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const id = req.params.id;
  try {
    const [producto] = await db.query(
      `SELECT * FROM PRODUCTOS WHERE ID = ? AND ID_VENDEDOR = ?`,
      [id, vendedor.ID_VENDEDOR]
    );
    if (producto.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Producto no encontrado o no te pertenece' });
    }
    const [imagenes] = await db.query(
      'SELECT URL_IMAGEN AS url, ORDEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ? ORDER BY ORDEN ASC',
      [id]
    );
    const [caracteristicas] = await db.query(
      'SELECT NOMBRE_ATRIBUTO, VALOR_ATRIBUTO FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?',
      [id]
    );
    const [variantes] = await db.query(
      'SELECT ID_VARIANTE, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?',
      [id]
    );
    res.json({ ...producto[0], IMAGENES: imagenes || [], CARACTERISTICAS: caracteristicas || [], VARIANTES: variantes || [] });
  } catch (err) {
    console.error('Error en obtenerProductoVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar el producto' });
  }
};

/** Crea un producto del vendedor (queda PENDIENTE hasta aprobación del admin). */
const crearProductoVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const { NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_DESCUENTO, IMAGENES, URL_IMAGEN, VARIANTES, CARACTERISTICAS } = req.body || {};
  if (!NOMBRE || !String(NOMBRE).trim() || !PRECIO) {
    return res.status(400).json({ ok: false, msg: 'Nombre y precio son obligatorios' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO PRODUCTOS
         (NOMBRE, PRECIO, ID_CATEGORIA, DESCRIPCION, MARCA, ID_PROVEEDOR, ID_DESCUENTO, ID_VENDEDOR, ESTADO_PUBLICACION)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'PENDIENTE')`,
      [String(NOMBRE).trim(), Number(PRECIO), Number(ID_CATEGORIA) || 1, DESCRIPCION || '',
       MARCA || 'Genérico', ID_DESCUENTO ? Number(ID_DESCUENTO) : null, vendedor.ID_VENDEDOR]
    );
    const id = result.insertId;

    const listaImagenes = Array.isArray(IMAGENES) && IMAGENES.length > 0
      ? IMAGENES.filter(Boolean)
      : (URL_IMAGEN ? [URL_IMAGEN] : []);
    for (let i = 0; i < listaImagenes.length; i++) {
      await db.query('INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, ?)', [id, listaImagenes[i], i + 1]);
    }
    if (Array.isArray(VARIANTES)) {
      for (const v of VARIANTES) {
        if (v.COLOR || v.NOMBRE_ATRIBUTO || v.ATRIBUTO) {
          await db.query(
            'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)',
            [id, v.COLOR || '�?nico', v.NOMBRE_ATRIBUTO || 'Talla', v.ATRIBUTO || '�?nico', Number(v.STOCK) || 0]
          );
        }
      }
    }
    if (Array.isArray(CARACTERISTICAS) && CARACTERISTICAS.length > 0) {
      for (const item of CARACTERISTICAS) {
        const nomAtrib = item.NOMBRE_ATRIBUTO || item.nombre_atributo || item.propiedad;
        const valAtrib = item.VALOR_ATRIBUTO || item.valor_atributo || item.valor;
        if (nomAtrib && valAtrib) {
          await db.query(
            'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)',
            [id, nomAtrib, valAtrib]
          );
        }
      }
    }

    await crearNotificacion({
      idUsuario: vendedor.ID_USUARIO,
      tipo: 'vendedor',
      titulo: 'Producto enviado a revisión',
      mensaje: `Tu producto "${String(NOMBRE).trim()}" quedó en revisión. El equipo de JADDA lo revisará en menos de 48 horas.`,
      ruta: '/vendedor/productos',
    });

    // Avisa al admin con el enlace directo a los productos por revisar
    await notificarAdmins({
      tipo: 'producto',
      titulo: '�??�️ Producto nuevo por revisar',
      mensaje: `${vendedor.NOMBRE_EMPRESA || 'Un vendedor'} publicó "${String(NOMBRE).trim()}". Apruébalo para que salga a la tienda.`,
      ruta: '/admin/productos?estado=PENDIENTE',
    });

    res.status(201).json({ ok: true, msg: 'Producto creado y enviado a revisión', id });
  } catch (err) {
    console.error('Error en crearProductoVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al guardar el producto' });
  }
};

/** Verifica que un producto le pertenezca al vendedor; devuelve el producto o null. */
async function productoPropio(id, idVendedor) {
  const [rows] = await db.query(
    'SELECT * FROM PRODUCTOS WHERE ID = ? AND ID_VENDEDOR = ?',
    [id, idVendedor]
  );
  return rows[0] || null;
}

/** Actualiza un producto propio (vuelve a PENDIENTE para re-aprobación). */
const actualizarProductoVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const id = req.params.id;
  const { NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_DESCUENTO, IMAGENES, URL_IMAGEN, VARIANTES, CARACTERISTICAS } = req.body || {};
  try {
    const producto = await productoPropio(id, vendedor.ID_VENDEDOR);
    if (!producto) {
      return res.status(404).json({ ok: false, msg: 'Producto no encontrado o no te pertenece' });
    }
    if (!NOMBRE || !String(NOMBRE).trim() || !PRECIO) {
      return res.status(400).json({ ok: false, msg: 'Nombre y precio son obligatorios' });
    }

    await db.query(
      `UPDATE PRODUCTOS
       SET NOMBRE = ?, MARCA = ?, PRECIO = ?, DESCRIPCION = ?, ID_CATEGORIA = ?, ID_DESCUENTO = ?,
           ESTADO_PUBLICACION = 'PENDIENTE'
       WHERE ID = ? AND ID_VENDEDOR = ?`,
      [String(NOMBRE).trim(), MARCA || 'Genérico', Number(PRECIO), DESCRIPCION || '',
       Number(ID_CATEGORIA) || 1, ID_DESCUENTO ? Number(ID_DESCUENTO) : null, id, vendedor.ID_VENDEDOR]
    );

    const listaImagenes = Array.isArray(IMAGENES) && IMAGENES.length > 0
      ? IMAGENES.filter(Boolean)
      : (URL_IMAGEN ? [URL_IMAGEN] : []);
    if (listaImagenes.length > 0) {
      await db.query('DELETE FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ?', [id]);
      for (let i = 0; i < listaImagenes.length; i++) {
        await db.query('INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, ?)', [id, listaImagenes[i], i + 1]);
      }
    }
    if (Array.isArray(VARIANTES)) {
      await db.query('DELETE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?', [id]);
      for (const v of VARIANTES) {
        if (v.COLOR || v.NOMBRE_ATRIBUTO || v.ATRIBUTO) {
          await db.query(
            'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)',
            [id, v.COLOR || '�?nico', v.NOMBRE_ATRIBUTO || 'Talla', v.ATRIBUTO || '�?nico', Number(v.STOCK) || 0]
          );
        }
      }
    }
    if (Array.isArray(CARACTERISTICAS)) {
      await db.query('DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', [id]);
      for (const item of CARACTERISTICAS) {
        const nomAtrib = item.NOMBRE_ATRIBUTO || item.nombre_atributo || item.propiedad;
        const valAtrib = item.VALOR_ATRIBUTO || item.valor_atributo || item.valor;
        if (nomAtrib && valAtrib) {
          await db.query(
            'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)',
            [id, nomAtrib, valAtrib]
          );
        }
      }
    }

    // Avisa al admin si el producto vuelve a revisión (venía aprobado/rechazado)
    if (producto.ESTADO_PUBLICACION && producto.ESTADO_PUBLICACION !== 'PENDIENTE') {
      await notificarAdmins({
        tipo: 'producto',
        titulo: '�??�️ Producto actualizado por revisar',
        mensaje: `${vendedor.NOMBRE_EMPRESA || 'Un vendedor'} actualizó "${String(NOMBRE).trim()}" y volvió a revisión.`,
        ruta: '/admin/productos?estado=PENDIENTE',
      });
    }

    res.json({ ok: true, msg: 'Producto actualizado. Volvió a revisión para re-aprobación.' });
  } catch (err) {
    console.error('Error en actualizarProductoVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar el producto' });
  }
};

/** Elimina un producto propio (solo si está PENDIENTE/RECHAZADO, para no romper ventas). */
const eliminarProductoVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const id = req.params.id;
  try {
    const producto = await productoPropio(id, vendedor.ID_VENDEDOR);
    if (!producto) {
      return res.status(404).json({ ok: false, msg: 'Producto no encontrado o no te pertenece' });
    }
    if (producto.ESTADO_PUBLICACION === 'APROBADO') {
      return res.status(400).json({ ok: false, msg: 'Un producto aprobado no puede eliminarse. Solicita al equipo de JADDA su retiro.' });
    }
    await db.query('DELETE FROM PRODUCTOS WHERE ID = ?', [id]);
    res.json({ ok: true, msg: 'Producto eliminado' });
  } catch (err) {
    console.error('Error en eliminarProductoVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al eliminar el producto' });
  }
};

/** Ventas que incluyen productos del vendedor (con sus ítems y datos de envío). */
const ventasVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const [ventas] = await db.query(
      `SELECT v.ID_VENTA, v.REFERENCIA_PAGO, v.TOTAL, v.ESTADO, v.FECHA_VENTA,
              u.NOMBRE_USUARIO AS CLIENTE, u.EMAIL AS EMAIL_CLIENTE,
              e.ESTADO_ENVIO, e.DIRECCION_ENVIO, e.CIUDAD, e.DEPARTAMENTO,
              e.BARRIO, e.TELEFONO_CONTACTO, e.OBSERVACIONES, e.FECHA_ENVIO
       FROM VENTAS v
       LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       WHERE EXISTS (
         SELECT 1 FROM DETALLE_VENTAS dv
         JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
         WHERE dv.ID_VENTA = v.ID_VENTA AND p.ID_VENDEDOR = ?
       )
       ORDER BY v.FECHA_VENTA DESC`,
      [vendedor.ID_VENDEDOR]
    );
    const [items] = await db.query(
      `SELECT dv.ID_VENTA, dv.ID_PRODUCTO, dv.CANTIDAD, dv.SUBTOTAL,
              p.NOMBRE, p.PRECIO, p.ID_VENDEDOR,
              pi.URL_IMAGEN AS IMAGEN,
              pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
       FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
       ORDER BY dv.ID_VENTA DESC`,
      [vendedor.ID_VENDEDOR]
    );
    const porVenta = {};
    for (const it of items) {
      (porVenta[it.ID_VENTA] = porVenta[it.ID_VENTA] || []).push(it);
    }
    res.json(ventas.map((v) => ({ ...v, items: porVenta[v.ID_VENTA] || [] })));
  } catch (err) {
    console.error('Error en ventasVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar tus ventas' });
  }
};

/** Valida que la venta incluya al menos un producto del vendedor autenticado.
 *  Devuelve el id de la venta o lanza el objeto de error listo para responder. */
const ventaDelVendedor = async (idVenta, vendedor) => {
  const [[venta]] = await db.query(
    `SELECT v.ID_VENTA FROM VENTAS v
     WHERE v.ID_VENTA = ?
       AND EXISTS (
         SELECT 1 FROM DETALLE_VENTAS dv
         JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
         WHERE dv.ID_VENTA = v.ID_VENTA AND p.ID_VENDEDOR = ?
       )`,
    [idVenta, vendedor.ID_VENDEDOR]
  );
  return venta || null;
};

/** El vendedor actualiza el estado del ENVÍO de una venta que incluye sus productos. */
const actualizarEnvioVenta = async (req, res) => {
  const vendedor = req.vendedor;
  const { estado_envio } = req.body || {};
  if (!estado_envio) {
    return res.status(400).json({ ok: false, msg: 'estado_envio es obligatorio' });
  }
  try {
    const venta = await ventaDelVendedor(req.params.id, vendedor);
    if (!venta) {
      return res.status(403).json({ ok: false, msg: 'Esta venta no incluye productos tuyos: no puedes gestionarla' });
    }
    const [[actual]] = await db.query('SELECT ESTADO_ENVIO FROM ENVIOS WHERE ID_VENTA = ?', [venta.ID_VENTA]);
    if (!actual) {
      return res.status(404).json({ ok: false, msg: 'Esta compra no tiene envío registrado' });
    }
    if (actual.ESTADO_ENVIO === estado_envio) {
      return res.json({ ok: true, msg: 'Estado de envío actualizado', sinCambios: true });
    }
    await db.query(
      "UPDATE ENVIOS SET ESTADO_ENVIO = ?, FECHA_ENTREGA = IF(? = 'ENTREGADO', NOW(), FECHA_ENTREGA) WHERE ID_VENTA = ?",
      [estado_envio, estado_envio, venta.ID_VENTA]
    );
    await notificarCambioEstado(venta.ID_VENTA, 'envio', estado_envio);
    res.json({ ok: true, msg: 'Estado de envío actualizado' });
  } catch (err) {
    console.error('Error en actualizarEnvioVenta:', err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar el estado del envío' });
  }
};

/** El vendedor actualiza el ESTADO de la VENTAS (PENDIENTE/CONFIRMADA/ENVIADA/COMPLETADA/CANCELADA). */
const actualizarEstadoVenta = async (req, res) => {
  const vendedor = req.vendedor;
  const ESTADOS_VALIDOS = ['PENDIENTE', 'CONFIRMADA', 'ENVIADA', 'COMPLETADA', 'CANCELADA'];
  const { estado } = req.body || {};
  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, msg: 'Estado inválido' });
  }
  try {
    const venta = await ventaDelVendedor(req.params.id, vendedor);
    if (!venta) {
      return res.status(403).json({ ok: false, msg: 'Esta venta no incluye productos tuyos: no puedes gestionarla' });
    }
    const [[actual]] = await db.query('SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ?', [venta.ID_VENTA]);
    if (actual.ESTADO === estado) {
      return res.json({ ok: true, msg: 'Estado actualizado', sinCambios: true });
    }
    await db.query('UPDATE VENTAS SET ESTADO = ? WHERE ID_VENTA = ?', [estado, venta.ID_VENTA]);
    await notificarCambioEstado(venta.ID_VENTA, 'venta', estado);
    res.json({ ok: true, msg: 'Estado actualizado' });
  } catch (err) {
    console.error('Error en actualizarEstadoVenta:', err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar el estado de la venta' });
  }
};

/** Devoluciones/reembolsos sobre productos del vendedor, con su chat de acuerdo. */
const devolucionesVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const [rows] = await db.query(
      `SELECT d.*, p.NOMBRE AS PRODUCTO_NOMBRE, pi.URL_IMAGEN AS IMAGEN,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.USUARIO AS USUARIO_LOGIN,
              c.ID_CHAT,
              (SELECT GROUP_CONCAT(RUTA SEPARATOR '|') FROM DEVOLUCIONES_EVIDENCIAS e WHERE e.ID_DEVOLUCION = d.ID_DEVOLUCION) AS EVIDENCIAS
       FROM DEVOLUCIONES d
       JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN USUARIOS u ON d.ID_USUARIO = u.ID_USUARIO
       LEFT JOIN CHAT c ON c.TIPO = 'DEVOLUCION' AND c.ID_CHAT = (
         SELECT c2.ID_CHAT FROM CHAT c2
         WHERE c2.TIPO = 'DEVOLUCION' AND c2.ID_DEVOLUCION = d.ID_DEVOLUCION
         ORDER BY (c2.PARTE = 'VENDEDOR') DESC, c2.ID_CHAT ASC LIMIT 1
       )
       ORDER BY FIELD(d.ESTADO, 'SOLICITADA', 'MAS_PRUEBAS', 'ESCALADA', 'APROBADA', 'RECHAZADA'), d.FECHA_CREACION DESC`,
      [vendedor.ID_VENDEDOR]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error en devolucionesVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar tus devoluciones' });
  }
};

const DECISIONES_DEV = {
  devolver: 'APROBADA',
  reembolsar: 'APROBADA',
  mas_pruebas: 'MAS_PRUEBAS',
  rechazar: 'RECHAZADA',
};

/** El vendedor decide una devolución de SU producto:
 *  - devolver   �— APROBADA + reingreso de stock
 *  - reembolsar �— APROBADA sin reingreso
 *  - mas_pruebas�— MAS_PRUEBAS (el chat sigue abierto)
 *  - rechazar   �— RECHAZADA con observación (el cliente puede escalar)
 *  Las solicitudes ya ESCALADAS las decide JADDA, no el vendedor. */
const procesarDevolucionVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const { id } = req.params;
  const body = req.body || {};
  const decision = DECISIONES_DEV[body.decision];
  if (!decision) {
    return res.status(400).json({ ok: false, msg: 'Decisión inválida: usa devolver, reembolsar, mas_pruebas o rechazar' });
  }
  const observacion = body.observacion == null ? null : String(body.observacion).trim();
  if ((decision === 'RECHAZADA' || decision === 'MAS_PRUEBAS') && !observacion) {
    return res.status(400).json({ ok: false, msg: 'Debes indicar el motivo en la observación' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[sol]] = await connection.query(
      `SELECT d.* FROM DEVOLUCIONES d
       JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       WHERE d.ID_DEVOLUCION = ? FOR UPDATE`,
      [vendedor.ID_VENDEDOR, id]
    );
    if (!sol) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada entre tus productos' });
    }
    if (!['SOLICITADA', 'MAS_PRUEBAS'].includes(sol.ESTADO)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: sol.ESTADO === 'ESCALADA'
        ? 'Esta solicitud fue escalada al equipo JADDA: ellos deciden el resultado'
        : `Esta solicitud ya fue procesada (${sol.ESTADO})` });
    }

    if (decision === 'APROBADA' && body.decision === 'devolver') {
      const [[variante]] = await connection.query(
        'SELECT MIN(ID_VARIANTE) AS ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?',
        [sol.ID_PRODUCTO]
      );
      if (!variante.ID_VARIANTE) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: 'El producto no tiene variantes para reingresar stock' });
      }
      await connection.query('UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK + ? WHERE ID_VARIANTE = ?', [sol.CANTIDAD, variante.ID_VARIANTE]);
      await registrarMovimientoStock({ conn: connection, idProducto: sol.ID_PRODUCTO, tipo: 'ENTRADA', cantidad: sol.CANTIDAD });
    }

    await connection.query(
      'UPDATE DEVOLUCIONES SET ESTADO = ?, OBSERVACION = ?, FECHA_PROCESADA = NOW() WHERE ID_DEVOLUCION = ?',
      [decision, observacion, id]
    );

    const titulos = { APROBADA: '�?? Solicitud aprobada por el vendedor', MAS_PRUEBAS: '�??? El vendedor necesita más pruebas', RECHAZADA: '�? Solicitud rechazada por el vendedor' };
    const textos = {
      APROBADA: `El vendedor aprobó tu ${sol.TIPO.toLowerCase()}. Coordinen los detalles en el chat.`,
      MAS_PRUEBAS: `El vendedor necesita más evidencias.${observacion ? ` Observación: ${observacion}` : ''}`,
      RECHAZADA: `El vendedor rechazó tu solicitud. Si no estás de acuerdo, abre el chat de la solicitud y escálala al equipo JADDA para que ellos decidan.${observacion ? ` Motivo: ${observacion}` : ''}`,
    };
    await crearNotificacion({
      idUsuario: sol.ID_USUARIO,
      tipo: 'devolucion',
      titulo: titulos[decision],
      mensaje: textos[decision],
      ruta: `/perfil/devolucion/${sol.ID_VENTA}`,
    });

    await connection.commit();

    // Solo la APROBACI�—N cierra el chat por acuerdo. El rechazo deja abierto el
    // espacio para que el cliente pueda escalar al equipo JADDA si no está de acuerdo.
    if (decision === 'APROBADA') {
      chatCtrl.cerrarChatDeDevolucion(
        id,
        `�?�� El vendedor aceptó la solicitud #${id}. Las unidades vuelven a inventario y el reembolso se coordina con JADDA.`
      );
    }

    res.json({ ok: true, msg: `Solicitud actualizada a ${decision}`, estado: decision });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error('Error en procesarDevolucionVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al procesar la devolución' });
  } finally {
    connection.release();
  }
};

/** Reportes del vendedor (RF-032/034 aplicados a su tienda):
 *  ingresos/pedidos/unidades de SUS productos por rango de fechas,
 *  serie agrupada por granularidad para la gráfica y ranking de más vendidos.
 *  Query: —desde=YYYY-MM-DD&hasta=YYYY-MM-DD&granularidad=dia|semana|mes|anio (default dia). */
const reportesVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const granularidadValida = (g) => ['dia','semana','mes','anio'].includes(g) ? g : 'dia';
  const getFormato = (gran) => {
    switch(gran) {
      case 'semana': return "DATE_FORMAT(DATE_SUB(v.FECHA_VENTA, INTERVAL WEEKDAY(v.FECHA_VENTA) DAY), '%Y-%m-%d')";
      case 'mes': return "DATE_FORMAT(v.FECHA_VENTA, '%Y-%m')";
      case 'anio': return "DATE_FORMAT(v.FECHA_VENTA, '%Y')";
      default: return "DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d')";
    }
  };
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const desde = fechaValida(req.query.desde) ? req.query.desde : hace30.toISOString().slice(0, 10);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy.toISOString().slice(0, 10);
    const granularidad = granularidadValida(req.query.granularidad);
    const desdeIni = `${desde} 00:00:00`;
    const hastaFin = `${hasta} 23:59:59`;

    // Solo los renglones de SUS productos; ventas CANCELADAS excluidas
    const base = `FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?`;
    const params = [vendedor.ID_VENDEDOR, desdeIni, hastaFin];

    const [[resumen]] = await db.query(
      `SELECT COUNT(DISTINCT dv.ID_VENTA) AS ordenes,
              COALESCE(SUM(dv.SUBTOTAL), 0) AS ingresos,
              COALESCE(SUM(dv.CANTIDAD), 0) AS unidades,
              COUNT(DISTINCT p.ID) AS productosVendidos
       ${base}`,
      params
    );

    const formato = getFormato(granularidad);
    const [serieRaw] = await db.query(
      `SELECT ${formato} AS dia,
              COUNT(DISTINCT dv.ID_VENTA) AS pedidos,
              COALESCE(SUM(dv.SUBTOTAL), 0) AS ingresos
       ${base}
       GROUP BY ${formato}
       ORDER BY dia ASC`,
      params
    );
    // Serie completa según granularidad
    const serieMap = new Map(serieRaw.map((s) => [String(s.dia), s]));
    const serie = [];
    if (granularidad === 'dia') {
      for (let d = new Date(desde); d <= new Date(hasta); d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, pedidos: Number(row.pedidos), ingresos: Number(row.ingresos) } : { dia: iso, pedidos: 0, ingresos: 0 });
      }
    } else if (granularidad === 'semana') {
      const start = new Date(desde); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = new Date(hasta);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, pedidos: Number(row.pedidos), ingresos: Number(row.ingresos) } : { dia: iso, pedidos: 0, ingresos: 0 });
      }
    } else if (granularidad === 'mes') {
      const start = new Date(desde); start.setDate(1);
      const end = new Date(hasta); end.setDate(1);
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const iso = d.toISOString().slice(0, 7);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, pedidos: Number(row.pedidos), ingresos: Number(row.ingresos) } : { dia: iso, pedidos: 0, ingresos: 0 });
      }
    } else {
      const startY = new Date(desde).getFullYear();
      const endY = new Date(hasta).getFullYear();
      for (let y = startY; y <= endY; y++) {
        const iso = String(y);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, pedidos: Number(row.pedidos), ingresos: Number(row.ingresos) } : { dia: iso, pedidos: 0, ingresos: 0 });
      }
    }

    const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 50);
    const [masVendidos] = await db.query(
      `SELECT p.ID, p.NOMBRE,
              (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi
               WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN,
              SUM(dv.CANTIDAD) AS unidades,
              SUM(dv.SUBTOTAL) AS ingresos,
              (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv
               WHERE pv.ID_PRODUCTO = p.ID) AS stock
       ${base}
       GROUP BY p.ID, p.NOMBRE
       ORDER BY unidades DESC, ingresos DESC
       LIMIT ${limite}`,
      params
    );

    const ordenesNum = Number(resumen.ordenes);
    const ingresosNum = Number(resumen.ingresos);

    res.json({
      desde,
      hasta,
      totalOrdenes: ordenesNum,
      totalIngresos: ingresosNum,
      totalUnidades: Number(resumen.unidades),
      productosVendidos: Number(resumen.productosVendidos),
      ticketPromedio: ordenesNum > 0 ? Math.round(ingresosNum / ordenesNum) : 0,
      serie: serie.map((s) => ({ dia: s.dia, pedidos: Number(s.pedidos), ingresos: Number(s.ingresos) })),
      masVendidos: masVendidos.map((m) => ({
        ID: m.ID,
        NOMBRE: m.NOMBRE,
        IMAGEN: m.IMAGEN,
        unidades: Number(m.unidades),
        ingresos: Number(m.ingresos),
        stock: Number(m.stock),
      })),
    });
  } catch (err) {
    console.error('Error en reportesVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al generar tus reportes' });
  }
};

/** Descarga del reporte del vendedor en Excel (.xlsx). */
const descargarReporteExcelVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const { generarReporteVendedorExcel } = require('../utils/reporteVendedorExcel');
    const buffer = await generarReporteVendedorExcel(vendedor.ID_VENDEDOR, req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-vendedor_${vendedor.ID_VENDEDOR}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error al generar el Excel del vendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al generar el reporte en Excel' });
  }
};

/** Descarga del reporte del vendedor en PDF ejecutivo. */
const descargarReportePdfVendedor = async (req, res) => {
  const vendedor = req.vendedor;
  try {
    const { generarReporteVendedorPdf } = require('../utils/reporteVendedorPdf');
    const buffer = await generarReporteVendedorPdf(vendedor.ID_VENDEDOR, req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-vendedor_${vendedor.ID_VENDEDOR}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error al generar el PDF del vendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error al generar el reporte en PDF' });
  }
};

/** Actualiza datos de la empresa (NIT y correo quedan bloqueados). */
const actualizarEmpresa = async (req, res) => {
  const vendedor = req.vendedor;
  const { TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION } = req.body || {};
  try {
    await db.query(
      `UPDATE VENDEDORES
       SET TELEFONO = ?, DEPARTAMENTO = ?, CIUDAD = ?, DIRECCION = ?
       WHERE ID_VENDEDOR = ?`,
      [TELEFONO || vendedor.TELEFONO, DEPARTAMENTO || vendedor.DEPARTAMENTO,
       CIUDAD || vendedor.CIUDAD, DIRECCION || vendedor.DIRECCION, vendedor.ID_VENDEDOR]
    );
    const [rows] = await db.query('SELECT * FROM VENDEDORES WHERE ID_VENDEDOR = ?', [vendedor.ID_VENDEDOR]);
    res.json({ ok: true, msg: 'Empresa actualizada', vendedor: rows[0] });
  } catch (err) {
    console.error('Error en actualizarEmpresa:', err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar la empresa' });
  }
};

module.exports = { solicitarVendedor, miSolicitud, obtenerSolicitudes, procesarSolicitud, miTienda, misProductos, obtenerProductoVendedor, crearProductoVendedor, actualizarProductoVendedor, eliminarProductoVendedor, ventasVendedor, actualizarEnvioVenta, actualizarEstadoVenta, devolucionesVendedor, procesarDevolucionVendedor, reportesVendedor, descargarReporteExcelVendedor, descargarReportePdfVendedor, actualizarEmpresa };



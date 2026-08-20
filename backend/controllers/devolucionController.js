/**
 * devolucionController: solicitudes de devolución y reembolso (RF-033 + UX 2026-08-17).
 * - Usuario: crea solicitud (uno o varios productos) sobre una venta ENTREGADA/COMPLETADA,
 *   con TIPO (DEVOLUCION | REEMBOLSO), descripción y evidencias (fotos/videos).
 * - Admin: 4 decisiones — aceptar devolución (reingresa stock), aceptar reembolso sin
 *   devolver, pedir más pruebas (MAS_PRUEBAS, reprocesable), rechazar (con observación).
 */
const db = require('../config/db');
const transporter = require('../config/mailer');
const fs = require('fs');
const path = require('path');
const { crearNotificacion } = require('./notificacionController');
const { plantillaCorreo } = require('../utils/correo');
const { registrarMovimientoStock } = require('../utils/movimientosStock');
const { claveDeReq } = require('../utils/carpetaUsuario');

const EVIDENCIAS_MAX = 8;
const VALIDAR_EVIDENCIA = (r) => typeof r === 'string' && r.startsWith('/images/devoluciones/');

/** Helper: inserta las evidencias de una solicitud (lista de rutas) */
async function insertarEvidencias(conn, idDevolucion, evidencias) {
  if (!Array.isArray(evidencias)) return;
  for (const ruta of evidencias) {
    if (!VALIDAR_EVIDENCIA(ruta)) continue;
    await conn.query(
      'INSERT INTO DEVOLUCIONES_EVIDENCIAS (ID_DEVOLUCION, TIPO, RUTA) VALUES (?, ?, ?)',
      [idDevolucion, /\.(mp4|webm|mov)$/i.test(ruta) ? 'video' : 'imagen', ruta]
    );
  }
}

/**
 * (Usuario autenticado) Crea una solicitud de devolución/reembolso.
 * Body nuevo: { id_venta, items: [{id_producto, cantidad}], tipo, motivo, descripcion, evidencias[] }
 * Body legacy: { id_venta, id_producto, cantidad, motivo } (app móvil).
 */
exports.solicitarDevolucion = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

  const { id_venta, tipo, motivo, descripcion, evidencias } = req.body || {};
  if (!id_venta) {
    return res.status(400).json({ ok: false, msg: "Faltan datos de la venta" });
  }

  const tipoTexto = ['DEVOLUCION', 'REEMBOLSO'].includes(tipo) ? tipo : 'DEVOLUCION';
  const motivoTexto = motivo == null ? null : String(motivo).trim();
  if (motivoTexto && motivoTexto.length > 500) {
    return res.status(400).json({ ok: false, msg: "El motivo no puede superar 500 caracteres" });
  }
  const descripcionTexto = descripcion == null ? null : String(descripcion).trim();
  if (descripcionTexto && descripcionTexto.length > 2000) {
    return res.status(400).json({ ok: false, msg: "La descripción no puede superar 2000 caracteres" });
  }
  const evid = Array.isArray(evidencias) ? evidencias.filter(VALIDAR_EVIDENCIA).slice(0, EVIDENCIAS_MAX) : [];

  // Normaliza items (nuevo formato multi-producto) o legacy (un producto)
  let items;
  if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
    items = req.body.items;
  } else if (req.body?.id_producto) {
    items = [{ id_producto: req.body.id_producto, cantidad: req.body.cantidad }];
  } else {
    return res.status(400).json({ ok: false, msg: "Selecciona al menos un producto" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS WHERE ID_VENTA = ? AND ID_CLIENTE = ? FOR UPDATE',
      [id_venta, idUsuario]
    );
    if (ventas.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Venta no encontrada o no te pertenece" });
    }
    if (ventas[0].ESTADO !== 'COMPLETADA') {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Solo puedes solicitar devolución de pedidos completados" });
    }
    // Regla de 3 días: si el pedido ya fue ENTREGADO, solo hay 3 días para pedir devolución.
    const [[envio]] = await connection.query(
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS WHERE ID_VENTA = ?',
      [id_venta]
    );
    if (envio?.ESTADO_ENVIO === 'ENTREGADO') {
      const entrega = envio.FECHA_ENTREGA || ventas[0].FECHA_VENTA;
      if (entrega && Date.now() - new Date(entrega).getTime() > 3 * 24 * 3600 * 1000) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: "El plazo de 3 días para pedir devolución ya venció" });
      }
    }

    const insertados = [];
    for (const item of items) {
      const idProducto = Number(item?.id_producto);
      const cantidadNum = Number(item?.cantidad);
      if (!Number.isInteger(idProducto) || idProducto < 1 || !Number.isInteger(cantidadNum) || cantidadNum < 1) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: "Producto o cantidad inválidos" });
      }

      const [detalles] = await connection.query(
        'SELECT CANTIDAD FROM DETALLE_VENTAS WHERE ID_VENTA = ? AND ID_PRODUCTO = ?',
        [id_venta, idProducto]
      );
      if (detalles.length === 0) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: "Uno de los productos no está en este pedido" });
      }

      const [yaSolicitadas] = await connection.query(
        `SELECT COALESCE(SUM(CANTIDAD), 0) AS total FROM DEVOLUCIONES
         WHERE ID_USUARIO = ? AND ID_VENTA = ? AND ID_PRODUCTO = ? AND ESTADO IN ('SOLICITADA', 'APROBADA', 'MAS_PRUEBAS')`,
        [idUsuario, id_venta, idProducto]
      );
      const disponible = detalles[0].CANTIDAD - yaSolicitadas[0].total;
      if (cantidadNum > disponible) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          msg: `Solo puedes devolver ${disponible} unidad(es) de uno de los productos en este pedido`,
        });
      }

      const [result] = await connection.query(
        `INSERT INTO DEVOLUCIONES (ID_USUARIO, ID_VENTA, ID_PRODUCTO, CANTIDAD, MOTIVO, DESCRIPCION, TIPO, ESTADO)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SOLICITADA')`,
        [idUsuario, id_venta, idProducto, cantidadNum, motivoTexto, descripcionTexto, tipoTexto]
      );
      await insertarEvidencias(connection, result.insertId, evid);
      insertados.push(result.insertId);
    }

    await connection.commit();
    res.status(201).json({ ok: true, msg: "Solicitud enviada. Nuestro equipo la revisará", ID_DEVOLUCIONES: insertados });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al solicitar devolución:", err);
    res.status(500).json({ ok: false, msg: "Error al solicitar la devolución" });
  } finally {
    connection.release();
  }
};

/**
 * (Usuario autenticado) Lista sus solicitudes de devolución.
 */
exports.misDevoluciones = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
  try {
    const [rows] = await db.query(
      `SELECT d.*, p.NOMBRE, pi.URL_IMAGEN AS IMAGEN,
              (SELECT GROUP_CONCAT(RUTA SEPARATOR '|') FROM DEVOLUCIONES_EVIDENCIAS e WHERE e.ID_DEVOLUCION = d.ID_DEVOLUCION) AS EVIDENCIAS
       FROM DEVOLUCIONES d
       JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE d.ID_USUARIO = ?
       ORDER BY d.FECHA_CREACION DESC`,
      [idUsuario]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener devoluciones:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener devoluciones" });
  }
};

/**
 * (Admin) Lista todas las solicitudes con cliente y producto.
 */
exports.todas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, u.NOMBRE_USUARIO, u.EMAIL, p.NOMBRE AS PRODUCTO_NOMBRE,
              pi.URL_IMAGEN AS IMAGEN, v.TOTAL AS VENTA_TOTAL,
              (SELECT GROUP_CONCAT(RUTA SEPARATOR '|') FROM DEVOLUCIONES_EVIDENCIAS e WHERE e.ID_DEVOLUCION = d.ID_DEVOLUCION) AS EVIDENCIAS
       FROM DEVOLUCIONES d
       JOIN USUARIOS u ON d.ID_USUARIO = u.ID_USUARIO
       JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID
       JOIN VENTAS v ON d.ID_VENTA = v.ID_VENTA
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       ORDER BY d.FECHA_CREACION DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener devoluciones:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener devoluciones" });
  }
};

const DECISIONES = {
  devolver: 'APROBADA',
  reembolsar: 'APROBADA',
  mas_pruebas: 'MAS_PRUEBAS',
  rechazar: 'RECHAZADA',
};

const TITULOS = {
  devolver: '✅ Devolución aprobada',
  reembolsar: '✅ Reembolso aprobado',
  mas_pruebas: '📋 Necesitamos más pruebas',
  rechazar: '❌ Solicitud rechazada',
};

const MENSAJES = {
  devolver: (obs) => `Tu devolución fue aprobada. Los artículos vuelven a stock y el reembolso se gestionará por el método de pago original.${obs ? ` Observación: ${obs}` : ''}`,
  reembolsar: (obs) => `Tu reembolso fue aprobado sin necesidad de devolver los productos. El dinero llegará por el método de pago original en unos días hábiles.${obs ? ` Observación: ${obs}` : ''}`,
  mas_pruebas: (obs) => `Necesitamos más evidencias para procesar tu solicitud.${obs ? ` Observación: ${obs}` : ''}`,
  rechazar: (obs) => `Tu solicitud fue rechazada.${obs ? ` Motivo: ${obs}` : ''}`,
};

/**
 * (Admin) Procesa una solicitud con 4 decisiones:
 * - devolver    → APROBADA + reingreso de stock (variante por defecto)
 * - reembolsar  → APROBADA sin reingreso de stock
 * - mas_pruebas → MAS_PRUEBAS (el cliente puede adjuntar más evidencias y volver a SOLICITADA)
 * - rechazar    → RECHAZADA con observación
 * Body legacy: { estado: 'APROBADA' | 'RECHAZADA' } sigue funcionando.
 */
exports.procesar = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  let decision = body.decision;
  if (!decision && body.estado) {
    decision = body.estado === 'APROBADA' ? 'devolver' : 'rechazar';
  }
  if (!DECISIONES[decision]) {
    return res.status(400).json({ ok: false, msg: "Decisión inválida: use devolver, reembolsar, mas_pruebas o rechazar" });
  }
  const observacion = body.observacion == null ? null : String(body.observacion).trim();
  if (observacion && observacion.length > 500) {
    return res.status(400).json({ ok: false, msg: "La observación no puede superar 500 caracteres" });
  }
  const estadoNuevo = DECISIONES[decision];

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [solicitudes] = await connection.query(
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? FOR UPDATE',
      [id]
    );
    if (solicitudes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Solicitud de devolución no encontrada" });
    }
    const sol = solicitudes[0];
    if (!['SOLICITADA', 'MAS_PRUEBAS'].includes(sol.ESTADO)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: `Esta solicitud ya fue procesada (${sol.ESTADO})` });
    }

    if (decision === 'devolver') {
      const [variantes] = await connection.query(
        'SELECT MIN(ID_VARIANTE) AS ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?',
        [sol.ID_PRODUCTO]
      );
      if (!variantes[0].ID_VARIANTE) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: "El producto no tiene variantes para reingresar stock" });
      }
      await connection.query(
        'UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK + ? WHERE ID_VARIANTE = ?',
        [sol.CANTIDAD, variantes[0].ID_VARIANTE]
      );
      // Registro detallado: el reingreso queda en MOVIMIENTOS_STOCK (RF-029)
      await registrarMovimientoStock({
        conn: connection,
        idProducto: sol.ID_PRODUCTO,
        tipo: 'ENTRADA',
        cantidad: sol.CANTIDAD,
      });
    }

    await connection.query(
      'UPDATE DEVOLUCIONES SET ESTADO = ?, OBSERVACION = ?, FECHA_PROCESADA = NOW() WHERE ID_DEVOLUCION = ?',
      [estadoNuevo, observacion, id]
    );

    await crearNotificacion({
      idUsuario: sol.ID_USUARIO,
      tipo: 'devolucion',
      titulo: TITULOS[decision],
      mensaje: MENSAJES[decision](observacion),
      ruta: '/perfil/compras',
    });

    await connection.commit();

    // Correo al cliente (nunca bloquea la operación del admin)
    try {
      const [usu] = await db.query(
        `SELECT EMAIL, NOMBRE_USUARIO FROM USUARIOS WHERE ID_USUARIO = ?`,
        [sol.ID_USUARIO]
      );
      const cliente = usu[0];
      if (cliente && cliente.EMAIL) {
        const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
        const aprobada = estadoNuevo === 'APROBADA';
        const titulo = aprobada ? "¡Solicitud aprobada!" : decision === 'mas_pruebas' ? "Necesitamos más pruebas" : "Solicitud rechazada";
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: cliente.EMAIL,
          subject: `${aprobada ? "✅" : "❌"} ${titulo} - JADDA SPORTS`,
          html: plantillaCorreo({
            emoji: aprobada ? "✅" : "❌",
            titulo,
            subtitulo: `Solicitud #${id}`,
            saludo: `Hola ${cliente.NOMBRE_USUARIO || "cliente"},`,
            contenido:
              `<p style="margin:0 0 6px">Tu solicitud de devolución <strong>#${id}</strong> ${aprobada ? 'fue aprobada' : decision === 'mas_pruebas' ? 'necesita más evidencias' : 'fue rechazada'}.</p>` +
              (observacion
                ? `<p style="font-size:13px;color:#475569;margin:0 0 6px">Observación del equipo: <strong>${observacion}</strong></p>`
                : '') +
              (aprobada
                ? `<p style="font-size:13px;color:#475569;margin:0">El reembolso se gestionará por el método de pago original en los próximos días hábiles.</p>`
                : `<p style="font-size:13px;color:#475569;margin:0">Puedes ver el detalle desde tu perfil.</p>`),
            botonTexto: "Ver mis compras",
            botonEnlace: `${frontend}/perfil/compras`,
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error al enviar email de devolución:", emailErr);
    }

    res.json({ ok: true, msg: `Solicitud actualizada a ${estadoNuevo}` });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al procesar devolución:", err);
    res.status(500).json({ ok: false, msg: "Error al procesar la devolución" });
  } finally {
    connection.release();
  }
};

/** Devuelve el estado de una solicitud verificando propiedad (usuario) */
async function solicitudDelUsuario(connection, id, idUsuario) {
  const [sols] = await connection.query(
    'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO = ? FOR UPDATE',
    [id, idUsuario]
  );
  return sols[0];
}

/**
 * (Usuario autenticado) Sube evidencias ANTES de crear la solicitud.
 * Multipart (multer ya guardó req.files en uploads/devoluciones/{USUARIO}/).
 * Devuelve las URLs para enviarlas después en POST /api/devoluciones.
 */
exports.subirEvidencias = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ ok: false, msg: "Selecciona al menos un archivo" });
  }
  const clave = claveDeReq(req);
  const urls = files.map((f) => `/images/devoluciones/${clave}/${f.filename}`);
  res.status(201).json({ ok: true, urls });
};

/**
 * (Usuario autenticado) Adjunta más evidencias a una solicitud en SOLICITADA/MAS_PRUEBAS.
 * Si estaba MAS_PRUEBAS vuelve a SOLICITADA para que el admin la reprocese.
 * Multipart (multer ya guardó req.files en uploads/devoluciones/{USUARIO}/).
 */
exports.agregarEvidencias = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
  const { id } = req.params;
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ ok: false, msg: "Selecciona al menos un archivo" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const sol = await solicitudDelUsuario(connection, id, idUsuario);
    if (!sol) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Solicitud no encontrada o no te pertenece" });
    }
    if (!['SOLICITADA', 'MAS_PRUEBAS'].includes(sol.ESTADO)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Esta solicitud ya fue resuelta" });
    }

    const [existentes] = await connection.query(
      'SELECT COUNT(*) AS n FROM DEVOLUCIONES_EVIDENCIAS WHERE ID_DEVOLUCION = ?',
      [id]
    );
    const maxNuevos = EVIDENCIAS_MAX - existentes[0].n;
    if (maxNuevos <= 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: `Máximo ${EVIDENCIAS_MAX} evidencias por solicitud` });
    }

    const clave = claveDeReq(req);
    const urls = [];
    for (const file of files.slice(0, maxNuevos)) {
      const ruta = `/images/devoluciones/${clave}/${file.filename}`;
      await connection.query(
        'INSERT INTO DEVOLUCIONES_EVIDENCIAS (ID_DEVOLUCION, TIPO, RUTA) VALUES (?, ?, ?)',
        [id, file.mimetype.startsWith('video/') ? 'video' : 'imagen', ruta]
      );
      urls.push(ruta);
    }

    if (sol.ESTADO === 'MAS_PRUEBAS') {
      await connection.query(
        "UPDATE DEVOLUCIONES SET ESTADO = 'SOLICITADA', FECHA_PROCESADA = NULL WHERE ID_DEVOLUCION = ?",
        [id]
      );
    }
    await connection.commit();
    res.status(201).json({ ok: true, msg: "Evidencias agregadas. Tu solicitud vuelve a revisión", urls });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al agregar evidencias:", err);
    res.status(500).json({ ok: false, msg: "Error al agregar evidencias" });
  } finally {
    connection.release();
  }
};

/**
 * (Usuario autenticado) Elimina una evidencia propia mientras la solicitud
 * siga en SOLICITADA o MAS_PRUEBAS (borra archivo de disco + fila).
 */
exports.eliminarEvidencia = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
  const { idEvidencia } = req.params;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [evs] = await connection.query(
      `SELECT e.ID_EVIDENCIA, e.RUTA, d.ESTADO
       FROM DEVOLUCIONES_EVIDENCIAS e
       JOIN DEVOLUCIONES d ON e.ID_DEVOLUCION = d.ID_DEVOLUCION
       WHERE e.ID_EVIDENCIA = ? AND d.ID_USUARIO = ? FOR UPDATE`,
      [idEvidencia, idUsuario]
    );
    if (evs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Evidencia no encontrada" });
    }
    if (!['SOLICITADA', 'MAS_PRUEBAS'].includes(evs[0].ESTADO)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Solo puedes eliminar evidencias de solicitudes en revisión" });
    }

    await connection.query('DELETE FROM DEVOLUCIONES_EVIDENCIAS WHERE ID_EVIDENCIA = ?', [idEvidencia]);
    await connection.commit();

    const rutaArchivo = evs[0].RUTA.replace(/^\/images\/devoluciones\//, '');
    const archivo = path.join(__dirname, '..', 'uploads', 'devoluciones', rutaArchivo);
    fs.unlink(archivo, () => {});

    res.json({ ok: true, msg: "Evidencia eliminada" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al eliminar evidencia:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar la evidencia" });
  } finally {
    connection.release();
  }
};
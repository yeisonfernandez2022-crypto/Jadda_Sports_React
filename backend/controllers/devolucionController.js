/**
 * devolucionController: solicitudes de devolución de productos (RF-033).
 * - Usuario: crea solicitud sobre productos de una venta COMPLETADA.
 * - Admin: aprueba/rechaza; al aprobar se reingresa el stock a la variante
 *   por defecto del producto y se notifica al cliente por campana in-app.
 */
const db = require('../config/db');
const transporter = require('../config/mailer');
const { crearNotificacion } = require('./notificacionController');
const { plantillaCorreo } = require('../utils/correo');

/**
 * (Usuario autenticado) Crea una solicitud de devolución.
 * Solo aplica a ventas COMPLETADAS, del propio usuario, y por una cantidad
 * menor o igual a la comprada (menos lo ya solicitado/aprobado).
 */
exports.solicitarDevolucion = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

  const { id_venta, id_producto, cantidad, motivo } = req.body || {};
  if (!id_venta || !id_producto) {
    return res.status(400).json({ ok: false, msg: "Faltan datos de la venta o el producto" });
  }
  const cantidadNum = Number(cantidad);
  if (!Number.isInteger(cantidadNum) || cantidadNum < 1) {
    return res.status(400).json({ ok: false, msg: "La cantidad debe ser un entero mayor a 0" });
  }
  const motivoTexto = motivo == null ? null : String(motivo).trim();
  if (motivoTexto && motivoTexto.length > 500) {
    return res.status(400).json({ ok: false, msg: "El motivo no puede superar 500 caracteres" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      'SELECT ID_VENTA, ESTADO FROM VENTAS WHERE ID_VENTA = ? AND ID_CLIENTE = ? FOR UPDATE',
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

    const [detalles] = await connection.query(
      'SELECT ID_DETALLE, CANTIDAD FROM DETALLE_VENTAS WHERE ID_VENTA = ? AND ID_PRODUCTO = ?',
      [id_venta, id_producto]
    );
    if (detalles.length === 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Ese producto no está en este pedido" });
    }

    const [yaSolicitadas] = await connection.query(
      `SELECT COALESCE(SUM(CANTIDAD), 0) AS total FROM DEVOLUCIONES
       WHERE ID_USUARIO = ? AND ID_VENTA = ? AND ID_PRODUCTO = ? AND ESTADO IN ('SOLICITADA', 'APROBADA')`,
      [idUsuario, id_venta, id_producto]
    );
    const disponible = detalles[0].CANTIDAD - yaSolicitadas[0].total;
    if (cantidadNum > disponible) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        msg: `Solo puedes devolver ${disponible} unidad(es) de este producto en este pedido`,
      });
    }

    const [result] = await connection.query(
      `INSERT INTO DEVOLUCIONES (ID_USUARIO, ID_VENTA, ID_PRODUCTO, CANTIDAD, MOTIVO, ESTADO)
       VALUES (?, ?, ?, ?, ?, 'SOLICITADA')`,
      [idUsuario, id_venta, id_producto, cantidadNum, motivoTexto]
    );

    await connection.commit();
    res.status(201).json({ ok: true, msg: "Solicitud de devolución enviada", ID_DEVOLUCION: result.insertId });
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
      `SELECT d.*, p.NOMBRE, pi.URL_IMAGEN AS IMAGEN
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
              pi.URL_IMAGEN AS IMAGEN, v.TOTAL AS VENTA_TOTAL
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

/**
 * (Admin) Procesa una solicitud: APROBADA → reingreso de stock a la variante
 * por defecto del producto; RECHAZADA → solo cambio de estado.
 * Ambas notifican al cliente por campana in-app.
 */
exports.procesar = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
    return res.status(400).json({ ok: false, msg: "Estado inválido: use APROBADA o RECHAZADA" });
  }

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
    if (sol.ESTADO !== 'SOLICITADA') {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: `Esta solicitud ya fue procesada (${sol.ESTADO})` });
    }

    if (estado === 'APROBADA') {
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
    }

    await connection.query(
      'UPDATE DEVOLUCIONES SET ESTADO = ?, FECHA_PROCESADA = NOW() WHERE ID_DEVOLUCION = ?',
      [estado, id]
    );

    await crearNotificacion({
      idUsuario: sol.ID_USUARIO,
      tipo: 'devolucion',
      titulo: estado === 'APROBADA' ? '✅ Devolución aprobada' : '❌ Devolución rechazada',
      mensaje:
        estado === 'APROBADA'
          ? `Tu solicitud de devolución #${id} fue aprobada. Los artículos vuelven a stock y el reembolso se gestionará por el método de pago original.`
          : `Tu solicitud de devolución #${id} fue rechazada. Si tienes dudas, escríbenos por contacto.`,
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
        const aprobada = estado === 'APROBADA';
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: cliente.EMAIL,
          subject: `${aprobada ? "✅" : "❌"} Tu devolución fue ${aprobada ? "aprobada" : "rechazada"} - JADDA SPORTS`,
          html: plantillaCorreo({
            emoji: aprobada ? "✅" : "❌",
            titulo: aprobada ? "¡Devolución aprobada!" : "Devolución rechazada",
            subtitulo: `Solicitud #${id}`,
            saludo: `Hola ${cliente.NOMBRE_USUARIO || "cliente"},`,
            contenido: aprobada
              ? `<p style="margin:0 0 6px">Tu solicitud de devolución <strong>#${id}</strong> fue aprobada.</p>
                 <p style="font-size:13px;color:#475569;margin:0">Los artículos vuelven al inventario y el reembolso se gestionará por el método de pago original en los próximos días hábiles.</p>`
              : `<p style="margin:0 0 6px">Tu solicitud de devolución <strong>#${id}</strong> fue rechazada.</p>
                 <p style="font-size:13px;color:#475569;margin:0">Si tienes dudas sobre el motivo, escríbenos desde la sección de contacto.</p>`,
            botonTexto: "Ver mis compras",
            botonEnlace: `${frontend}/perfil/compras`,
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error al enviar email de devolución:", emailErr);
    }

    res.json({ ok: true, msg: estado === 'APROBADA' ? "Devolución aprobada y stock reingresado" : "Devolución rechazada" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al procesar devolución:", err);
    res.status(500).json({ ok: false, msg: "Error al procesar la devolución" });
  } finally {
    connection.release();
  }
};

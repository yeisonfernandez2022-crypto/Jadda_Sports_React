const db = require('../config/db');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { notificarCambioEstado } = require('../utils/estadoPedido');
const { registrarMovimientoStock } = require('../utils/movimientosStock');
const {
  MOTIVO_REEMBOLSO_CANCELACION,
  fmtCOP,
  pagoConfirmadoEnVenta,
  ventaPagada,
  aprobarReembolsosCancelacion,
  notificarReembolsoAutomatico,
} = require('../utils/reembolsosCancelacion');

/** Obtiene el historial de compras del usuario autenticado.
 *  Hace JOIN con VENTAS, METODOS_PAGO y ENVIOS para traer todos los datos de cada venta.
 *  Luego, por cada venta, consulta DETALLE_VENTAS con JOIN a PRODUCTOS para incluir los productos comprados. */
const obtenerCompras = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;

  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO, v.DATOS_PAGO, v.CANCELADA_POR,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.OBSERVACIONES, e.ESTADO_ENVIO, e.COSTO_ENVIO, e.FECHA_ENTREGA,
              (SELECT GROUP_CONCAT(DISTINCT d.ESTADO) FROM DEVOLUCIONES d WHERE d.ID_VENTA = v.ID_VENTA) AS REEMBOLSO_ESTADOS,
              (SELECT GROUP_CONCAT(DISTINCT d.TIPO) FROM DEVOLUCIONES d WHERE d.ID_VENTA = v.ID_VENTA) AS DEVOLUCION_TIPOS
       FROM VENTAS v
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       WHERE v.ID_CLIENTE = ?
       ORDER BY v.FECHA_VENTA DESC`,
      [id_usuario]
    );

    const compras = [];

    for (const venta of rows) {
      const [detalles] = await db.query(
      `SELECT dv.ID_DETALLE, dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, dv.ID_VARIANTE,
              p.NOMBRE, p.ID, COALESCE(pi.URL_IMAGEN, '') AS IMAGEN,
              pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
       WHERE dv.ID_VENTA = ?`,
        [venta.ID_VENTA]
      );

      compras.push({
        ...venta,
        FECHA_VENTA: venta.FECHA_VENTA,
        TOTAL: Number(venta.TOTAL),
        PAGO_CONFIRMADO: pagoConfirmadoEnVenta(venta.DATOS_PAGO),
        productos: detalles
      });
    }

    res.json(compras);
  } catch (err) {
    console.error("Error al obtener compras:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener compras" });
  }
};

/** Obtiene una compra específica del usuario autenticado (para la página de éxito y refrescos). */
const obtenerCompraPorId = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO, v.DATOS_PAGO, v.CANCELADA_POR,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.OBSERVACIONES, e.ESTADO_ENVIO, e.COSTO_ENVIO, e.FECHA_ENTREGA,
              (SELECT GROUP_CONCAT(DISTINCT d.ESTADO) FROM DEVOLUCIONES d WHERE d.ID_VENTA = v.ID_VENTA) AS REEMBOLSO_ESTADOS,
              (SELECT GROUP_CONCAT(DISTINCT d.TIPO) FROM DEVOLUCIONES d WHERE d.ID_VENTA = v.ID_VENTA) AS DEVOLUCION_TIPOS
       FROM VENTAS v
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       WHERE v.ID_VENTA = ? AND v.ID_CLIENTE = ?`,
      [id_venta, id_usuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const venta = rows[0];

    const [detalles] = await db.query(
`SELECT dv.ID_DETALLE, dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, dv.ID_VARIANTE,
              p.NOMBRE, p.ID, COALESCE(pi.URL_IMAGEN, '') AS IMAGEN,
              pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
       WHERE dv.ID_VENTA = ?`,
      [id_venta]
    );

    const [[{ existe }]] = await db.query(
      `SELECT COUNT(*) AS existe FROM PLANES_USUARIO WHERE ID_VENTA = ?`,
      [id_venta]
    );

    res.json({
      ...venta,
      TOTAL: Number(venta.TOTAL),
      COSTO_ENVIO: Number(venta.COSTO_ENVIO || 0),
      PAGO_CONFIRMADO: pagoConfirmadoEnVenta(venta.DATOS_PAGO),
      planGenerado: existe > 0,
      productos: detalles,
    });
  } catch (err) {
    console.error("Error al obtener compra:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener compra" });
  }
};

/** Cancela una compra del usuario autenticado si aún es cancelable (COMPLETADA, PENDIENTE, CONFIRMADA o PENDIENTE_PAGO).
 *  - Transacción: libera el stock de cada variante comprada (RF-029/023) + registra
 *    ENTRADA en MOVIMIENTOS_STOCK; si algo falla, todo se revierte.
 *  - RN-010: si el envío ya salió del almacén (EN_CAMINO/ENTREGADO) no se cancela. */
const cancelarCompra = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT v.ESTADO, v.DATOS_PAGO, e.ESTADO_ENVIO, e.COSTO_ENVIO
       FROM VENTAS v
       LEFT JOIN ENVIOS e ON e.ID_VENTA = v.ID_VENTA
       WHERE v.ID_VENTA = ? AND v.ID_CLIENTE = ? FOR UPDATE`,
      [id_venta, id_usuario]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const estado = rows[0].ESTADO;
    const pagoConfirmado = ventaPagada(estado, rows[0].DATOS_PAGO);
    if (estado === "CANCELADA") {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Esta compra ya fue cancelada" });
    }
    // PENDIENTE_PAGO se cancela (no se pagó nunca; RF-023) — la pasarela
    // confirmará o expirará las demás.
    if (!["COMPLETADA", "PENDIENTE", "CONFIRMADA", "PENDIENTE_PAGO"].includes(estado)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Esta compra ya no se puede cancelar" });
    }

    // RN-010: solo se cancela si el paquete sigue en el almacén
    const estadoEnvio = rows[0].ESTADO_ENVIO;
    if (estadoEnvio === "EN_CAMINO" || estadoEnvio === "ENTREGADO") {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "El pedido ya salió del almacén y no puede cancelarse" });
    }

    // Devolución de stock: cada variante comprada vuelve al inventario (RF-023).
    // Se leen TODOS los renglones (también sin variante) para poder reembolsar
    // el valor de los productos.
    const [detalles] = await connection.query(
      `SELECT ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL
       FROM DETALLE_VENTAS
       WHERE ID_VENTA = ?`,
      [id_venta]
    );
    for (const det of detalles) {
      if (!det.ID_VARIANTE) continue;
      await connection.query(
        `UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK + ? WHERE ID_VARIANTE = ?`,
        [det.CANTIDAD, det.ID_VARIANTE]
      );
      await registrarMovimientoStock({
        conn: connection,
        idProducto: det.ID_PRODUCTO,
        tipo: 'ENTRADA',
        cantidad: det.CANTIDAD,
      });
    }

    await connection.query(
      `UPDATE VENTAS SET ESTADO = 'CANCELADA', CANCELADA_POR = 'CLIENTE' WHERE ID_VENTA = ?`,
      [id_venta]
    );
    await connection.query(`UPDATE ENVIOS SET ESTADO_ENVIO = 'CANCELADO' WHERE ID_VENTA = ?`, [id_venta]);

    // El pedido se canceló antes del despacho: si hubo cobro, el reembolso de
    // los productos y del envío se aprueba solo (sin pasar por el admin).
    const costoEnvio = Number(rows[0].COSTO_ENVIO || 0);
    const reembolso = pagoConfirmado && detalles.length > 0
      ? await aprobarReembolsosCancelacion(connection, {
          idUsuario: id_usuario,
          idVenta: id_venta,
          detalles,
          costoEnvio,
        })
      : null;

    await connection.commit();

    // Notificación (email + campana) fuera de la transacción; nunca bloquea
    try {
      await notificarCambioEstado(id_venta, "venta", "CANCELADA");
    } catch (notifErr) {
      console.error("Error al notificar cancelación:", notifErr);
    }
    if (reembolso && reembolso.total > 0) {
      await notificarReembolsoAutomatico(
        id_usuario,
        id_venta,
        reembolso.total,
        reembolso.costoEnvio
      );
    }

    // Campana admin — pedido cancelado (informativa; el reembolso ya quedó
    // aprobado y no requiere que el admin haga nada).
    try {
      const { crearNotificacion } = require('./notificacionController');
      await crearNotificacion({
        idUsuario: null,
        tipo: 'pedido',
        titulo: '🚫 Pedido cancelado',
        mensaje: reembolso && reembolso.total > 0
          ? `Pedido #${id_venta} fue cancelado por el cliente. Reembolso automático aprobado: ${fmtCOP(reembolso.total)}${reembolso.costoEnvio > 0 ? ' (incluye el costo de envío).' : '.'}`
          : `Pedido #${id_venta} fue cancelado por el cliente.`,
        ruta: '/admin/ordenes',
      });
    } catch (e) { console.error('Error noti cancel admin:', e.message); }

    res.json({
      ok: true,
      msg: reembolso && reembolso.total > 0
        ? `Compra cancelada. Reembolso de ${fmtCOP(reembolso.total)} aprobado automáticamente${reembolso.costoEnvio > 0 ? ' (incluye el costo de envío).' : '.'}`
        : "Compra cancelada",
      pagoConfirmado,
      reembolso: reembolso && reembolso.total > 0 ? reembolso : null,
    });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackErr) {}
    console.error("Error al cancelar compra:", err);
    res.status(500).json({ ok: false, msg: "Error al cancelar compra" });
  } finally {
    connection.release();
  }
};

/** Solicita el reembolso de una compra CANCELADA del usuario: crea una DEVOLUCIONES
 *  por cada producto del pedido (las revisa el admin en /admin/devoluciones). */
const solicitarReembolso = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      "SELECT ESTADO, DATOS_PAGO FROM VENTAS WHERE ID_VENTA = ? AND ID_CLIENTE = ? FOR UPDATE",
      [id_venta, id_usuario]
    );
    if (ventas.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    if (ventas[0].ESTADO !== "CANCELADA") {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Solo puedes solicitar reembolso de pedidos cancelados" });
    }
    const pagoConfirmado = pagoConfirmadoEnVenta(ventas[0].DATOS_PAGO);
    if (!pagoConfirmado) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        msg: "No registramos un pago confirmado para este pedido, así que no hay un cobro que reembolsar.",
      });
    }

    const [detalles] = await connection.query(
      "SELECT ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL FROM DETALLE_VENTAS WHERE ID_VENTA = ?",
      [id_venta]
    );
    if (detalles.length === 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "El pedido no tiene productos" });
    }

    const [envios] = await connection.query(
      "SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS WHERE ID_VENTA = ?",
      [id_venta]
    );
    const envioSalido = ['EN_CAMINO', 'ENTREGADO'].includes(envios[0]?.ESTADO_ENVIO);
    const costoEnvio = envioSalido ? 0 : Number(envios[0]?.COSTO_ENVIO || 0);

    // Una solicitud manual previa (p. ej. de una venta legacy cancelada) se
    // aprueba sola si es del mismo reembolso por cancelación. Cualquier otra
    // solicitud activa sigue su curso normal.
    const [activas] = await connection.query(
      `SELECT TIPO, MOTIVO, ESTADO FROM DEVOLUCIONES
       WHERE ID_VENTA = ? AND ID_USUARIO = ? AND ESTADO IN ('SOLICITADA', 'MAS_PRUEBAS', 'ESCALADA')`,
      [id_venta, id_usuario]
    );
    const solicitudDistinta = activas.some(
      (d) => d.TIPO !== 'REEMBOLSO' || d.MOTIVO !== MOTIVO_REEMBOLSO_CANCELACION
    );
    if (solicitudDistinta) {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Ya solicitaste un reembolso para este pedido" });
    }

    const reembolso = await aprobarReembolsosCancelacion(connection, {
      idUsuario: id_usuario,
      idVenta: id_venta,
      detalles,
      costoEnvio,
    });

    await connection.commit();
    if (reembolso.total > 0 && reembolso.filas > 0) {
      await notificarReembolsoAutomatico(
        id_usuario,
        id_venta,
        reembolso.total,
        reembolso.costoEnvio
      );
    }
    res.json({
      ok: true,
      msg: "Reembolso aprobado automáticamente",
      pagoConfirmado,
      reembolso: reembolso.total > 0 ? reembolso : null,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error("Error al solicitar reembolso:", err);
    res.status(500).json({ ok: false, msg: "Error al solicitar reembolso" });
  } finally {
    connection.release();
  }
};

/** Detalle del reembolso de una compra CANCELADA del usuario: datos de la venta +
 *  las solicitudes de reembolso (productos, cantidades, estados, fechas) y el total a devolver. */
const obtenerReembolso = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  try {
    const [ventas] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO, v.DATOS_PAGO,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.ESTADO_ENVIO, e.COSTO_ENVIO
       FROM VENTAS v
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON e.ID_VENTA = v.ID_VENTA
       WHERE v.ID_VENTA = ? AND v.ID_CLIENTE = ?`,
      [id_venta, id_usuario]
    );
    if (ventas.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const venta = ventas[0];

    const [reembolsos] = await db.query(
      `SELECT dv.ID_DEVOLUCION, dv.ID_PRODUCTO, dv.CANTIDAD, dv.MOTIVO, dv.TIPO, dv.ESTADO,
              dv.FECHA_CREACION, dv.FECHA_PROCESADA,
              p.NOMBRE, COALESCE(pi.URL_IMAGEN, '') AS IMAGEN,
              COALESCE(dt.PRECIO_UNITARIO, 0) AS PRECIO_UNITARIO,
              COALESCE(dt.SUBTOTAL, 0) AS SUBTOTAL
       FROM DEVOLUCIONES dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN (
         SELECT ID_VENTA, ID_PRODUCTO,
                SUM(CANTIDAD) AS CANTIDAD,
                SUM(SUBTOTAL) AS SUBTOTAL,
                SUM(SUBTOTAL) / NULLIF(SUM(CANTIDAD), 0) AS PRECIO_UNITARIO
         FROM DETALLE_VENTAS
         GROUP BY ID_VENTA, ID_PRODUCTO
       ) dt ON dt.ID_VENTA = dv.ID_VENTA AND dt.ID_PRODUCTO = dv.ID_PRODUCTO
       WHERE dv.ID_VENTA = ? AND dv.ID_USUARIO = ?
       ORDER BY dv.ID_DEVOLUCION`,
      [id_venta, id_usuario]
    );

    const totalProductos = reembolsos
      .filter((r) => r.ESTADO === 'APROBADA')
      .reduce(
        (sum, r) => sum + Number(r.PRECIO_UNITARIO) * Number(r.CANTIDAD),
        0
      );
    const pagoConfirmado = ventaPagada(venta.ESTADO, venta.DATOS_PAGO);
    const envioSalido = ['EN_CAMINO', 'ENTREGADO'].includes(venta.ESTADO_ENVIO);
    const tieneReembolsoAprobado = reembolsos.some((r) => r.ESTADO === 'APROBADA');
    const envioReembolsado =
      venta.ESTADO === 'CANCELADA' &&
      pagoConfirmado &&
      !envioSalido &&
      tieneReembolsoAprobado
        ? Number(venta.COSTO_ENVIO || 0)
        : 0;
    const totalReembolso = totalProductos + envioReembolsado;

    res.json({
      ...venta,
      TOTAL: Number(venta.TOTAL),
      COSTO_ENVIO: Number(venta.COSTO_ENVIO || 0),
      PAGO_CONFIRMADO: pagoConfirmado,
      automatico: reembolsos.length > 0 && reembolsos.every(
        (r) => r.TIPO === 'REEMBOLSO' && r.MOTIVO === MOTIVO_REEMBOLSO_CANCELACION
      ),
      totalProductos,
      envioSalido,
      envioReembolsado,
      totalReembolso,
      reembolsos,
    });
  } catch (err) {
    console.error("Error al obtener reembolso:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener el reembolso" });
  }
};

/** Actualiza la dirección de envío de una compra del usuario (si es cancelable). */
const actualizarDireccionCompra = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;
  const { direccion, barrio, ciudad, departamento, codigoPostal, telefono } = req.body || {};

  try {
    const [rows] = await db.query(
      `SELECT v.ESTADO FROM VENTAS v WHERE v.ID_VENTA = ? AND v.ID_CLIENTE = ?`,
      [id_venta, id_usuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    if (rows[0].ESTADO === "CANCELADA") {
      return res.status(400).json({ ok: false, msg: "No puedes editar la dirección de una compra cancelada" });
    }
    // VENTAS.ESTADO 'ENVIADA' (legado) también significa que el pedido salió:
    // aunque no tenga fila ENVIOS igual no se puede editar (2026-10-29).
    if (rows[0].ESTADO === "ENVIADA") {
      return res.status(400).json({ ok: false, msg: "No puedes editar la dirección porque el pedido ya está en camino" });
    }

    const [envios] = await db.query(
      `SELECT ESTADO_ENVIO FROM ENVIOS WHERE ID_VENTA = ?`,
      [id_venta]
    );
    if (envios[0]) {
      if (["EN_CAMINO", "ENTREGADO"].includes(envios[0].ESTADO_ENVIO)) {
        return res.status(400).json({ ok: false, msg: "No puedes editar la dirección porque el pedido ya salió del almacén" });
      }
      await db.query(
        `UPDATE ENVIOS SET DIRECCION_ENVIO = ?, BARRIO = ?, CIUDAD = ?, DEPARTAMENTO = ?, CODIGO_POSTAL = ?, TELEFONO_CONTACTO = ?
         WHERE ID_VENTA = ?`,
        [direccion || '', barrio || '', ciudad || '', departamento || '', codigoPostal || '', telefono || '', id_venta]
      );
    } else {
      // Venta sin fila ENVIOS (compra legada o flujo viejo): crearla para que
      // el tracking y el detalle tengan datos desde ya (2026-10-29).
      await db.query(
        `INSERT INTO ENVIOS (ID_VENTA, ESTADO_ENVIO, DIRECCION_ENVIO, BARRIO, CIUDAD, DEPARTAMENTO, CODIGO_POSTAL, TELEFONO_CONTACTO, COSTO_ENVIO)
         VALUES (?, 'PENDIENTE', ?, ?, ?, ?, ?, ?, 0)`,
        [id_venta, direccion || '', barrio || '', ciudad || '', departamento || '', codigoPostal || '', telefono || '']
      );
    }

    res.json({ ok: true, msg: "Dirección actualizada" });
  } catch (err) {
    console.error("Error al actualizar dirección de compra:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar dirección" });
  }
};

/** Genera y descarga la factura PDF de una compra del usuario autenticado (RF-021). */
const descargarFactura = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.COSTO_ENVIO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL
       FROM VENTAS v
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       WHERE v.ID_VENTA = ? AND v.ID_CLIENTE = ?`,
      [id_venta, id_usuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const venta = rows[0];

    const [detalles] = await db.query(
      `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, p.NOMBRE, pi.URL_IMAGEN
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE dv.ID_VENTA = ?`,
      [id_venta]
    );

    const pdf = await generarFacturaPdf({
      venta,
      usuario: {
        NOMBRE_USUARIO: venta.NOMBRE_USUARIO,
        APELLIDO_USUARIO: venta.APELLIDO_USUARIO,
        EMAIL: venta.EMAIL,
      },
      items: detalles,
      metodoPago: venta.METODO_PAGO,
      envio: venta,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="factura-${id_venta}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error al generar factura PDF:", err);
    res.status(500).json({ ok: false, msg: "Error al generar la factura" });
  }
};

module.exports = { obtenerCompras, obtenerCompraPorId, cancelarCompra, solicitarReembolso, obtenerReembolso, actualizarDireccionCompra, descargarFactura };

const db = require('../config/db');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { notificarCambioEstado } = require('../utils/estadoPedido');

/** Obtiene el historial de compras del usuario autenticado.
 *  Hace JOIN con VENTAS, METODOS_PAGO y ENVIOS para traer todos los datos de cada venta.
 *  Luego, por cada venta, consulta DETALLE_VENTAS con JOIN a PRODUCTOS para incluir los productos comprados. */
const obtenerCompras = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;

  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO, v.DATOS_PAGO,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.OBSERVACIONES, e.ESTADO_ENVIO
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
        `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL,
                p.NOMBRE, p.ID, COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
         FROM DETALLE_VENTAS dv
         INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
         LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
         WHERE dv.ID_VENTA = ?`,
        [venta.ID_VENTA]
      );

      compras.push({
        ...venta,
        FECHA_VENTA: venta.FECHA_VENTA,
        TOTAL: Number(venta.TOTAL),
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
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO, v.DATOS_PAGO,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.OBSERVACIONES, e.ESTADO_ENVIO, e.COSTO_ENVIO
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
      `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL,
              p.NOMBRE, p.ID, COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
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
      planGenerado: existe > 0,
      productos: detalles,
    });
  } catch (err) {
    console.error("Error al obtener compra:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener compra" });
  }
};

/** Cancela una compra del usuario autenticado si aún es cancelable (COMPLETADA o PENDIENTE). */
const cancelarCompra = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const id_venta = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ? AND ID_CLIENTE = ?`,
      [id_venta, id_usuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const estado = rows[0].ESTADO;
    if (estado === "CANCELADA") {
      return res.status(400).json({ ok: false, msg: "Esta compra ya fue cancelada" });
    }
    if (estado !== "COMPLETADA" && estado !== "PENDIENTE") {
      return res.status(400).json({ ok: false, msg: "Esta compra ya no se puede cancelar" });
    }

    await db.query(`UPDATE VENTAS SET ESTADO = 'CANCELADA' WHERE ID_VENTA = ?`, [id_venta]);
    await db.query(`UPDATE ENVIOS SET ESTADO_ENVIO = 'CANCELADO' WHERE ID_VENTA = ?`, [id_venta]);

    await notificarCambioEstado(id_venta, "venta", "CANCELADA");

    res.json({ ok: true, msg: "Compra cancelada" });
  } catch (err) {
    console.error("Error al cancelar compra:", err);
    res.status(500).json({ ok: false, msg: "Error al cancelar compra" });
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

    await db.query(
      `UPDATE ENVIOS SET DIRECCION_ENVIO = ?, BARRIO = ?, CIUDAD = ?, DEPARTAMENTO = ?, CODIGO_POSTAL = ?, TELEFONO_CONTACTO = ?
       WHERE ID_VENTA = ?`,
      [direccion || '', barrio || '', ciudad || '', departamento || '', codigoPostal || '', telefono || '', id_venta]
    );

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
      `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, p.NOMBRE
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
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

module.exports = { obtenerCompras, obtenerCompraPorId, cancelarCompra, actualizarDireccionCompra, descargarFactura };

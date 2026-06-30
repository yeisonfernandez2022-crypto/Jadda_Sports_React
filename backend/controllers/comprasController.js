const db = require('../config/db');

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

module.exports = { obtenerCompras };

const db = require('../config/db');

/** Obtiene todas las compras del sistema con datos del usuario, método de pago y envío.
 *  Luego, por cada venta, consulta DETALLE_VENTAS con JOIN a PRODUCTOS para incluir los productos.
 *  Solo accesible por administradores. */
const obtenerTodasLasCompras = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.ESTADO_ENVIO
       FROM VENTAS v
       INNER JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       ORDER BY v.FECHA_VENTA DESC`
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
        TOTAL: Number(venta.TOTAL),
        FECHA_VENTA: venta.FECHA_VENTA,
        productos: detalles
      });
    }

    res.json(compras);
  } catch (err) {
    console.error("Error al obtener compras:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener compras" });
  }
};

/** Actualiza el estado de una compra (VENTAS.ESTADO).
 *  Valida que el estado no esté vacío y retorna 404 si la venta no existe. */
const actualizarEstadoCompra = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ ok: false, msg: "Estado es obligatorio" });
  }

  try {
    const [result] = await db.query(
      "UPDATE VENTAS SET ESTADO = ? WHERE ID_VENTA = ?",
      [estado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }

    res.json({ ok: true, msg: "Estado actualizado" });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar estado" });
  }
};

/** Obtiene todos los usuarios del sistema con su rol (JOIN con ROLES).
 *  Ordena por FECHA_REGISTRO descendente. Solo accesible por administradores. */
const obtenerUsuarios = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.ID_USUARIO, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.USUARIO,
              u.TELEFONO, u.FECHA_REGISTRO, u.ID_ROL, u.CONFIRMADO, u.AUTH_PROVIDER,
              r.NOMBRE_ROL
       FROM USUARIOS u
       LEFT JOIN ROLES r ON u.ID_ROL = r.ID_ROL
       ORDER BY u.FECHA_REGISTRO DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error al obtener usuarios:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener usuarios" });
  }
};

/** Obtiene las estadísticas del dashboard administrativo.
 *  Ejecuta 4 consultas COUNT/SUM (productos, órdenes, usuarios, ingresos) y
 *  las 5 órdenes más recientes con datos del usuario. Retorna un objeto stats + ordenesRecientes. */
const obtenerDashboard = async (req, res) => {
  try {
    const [[{ totalProductos }]] = await db.query("SELECT COUNT(*) AS totalProductos FROM PRODUCTOS");
    const [[{ totalOrdenes }]] = await db.query("SELECT COUNT(*) AS totalOrdenes FROM VENTAS");
    const [[{ totalUsuarios }]] = await db.query("SELECT COUNT(*) AS totalUsuarios FROM USUARIOS");
    const [[{ totalIngresos }]] = await db.query("SELECT COALESCE(SUM(TOTAL), 0) AS totalIngresos FROM VENTAS WHERE ESTADO = 'COMPLETADA'");

    const [ordenesRecientes] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO
       FROM VENTAS v
       INNER JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       ORDER BY v.FECHA_VENTA DESC LIMIT 5`
    );

    res.json({
      stats: {
        totalProductos,
        totalOrdenes,
        totalUsuarios,
        totalIngresos: Number(totalIngresos)
      },
      ordenesRecientes
    });
  } catch (err) {
    console.error("Error al obtener dashboard:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener dashboard" });
  }
};

module.exports = { obtenerDashboard, obtenerTodasLasCompras, actualizarEstadoCompra, obtenerUsuarios };

const db = require('../config/db');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { notificarCambioEstado } = require('../utils/estadoPedido');

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

    await notificarCambioEstado(id, "venta", estado);

    res.json({ ok: true, msg: "Estado actualizado" });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar estado" });
  }
};

/** Actualiza el estado del ENVÍO de una compra (ENVIOS.ESTADO_ENVIO).
 *  Estados típicos: PENDIENTE, POR_EMPAQUETAR, EMPACADO, EN_CAMINO, ENTREGADO, CANCELADO. */
const actualizarEstadoEnvio = async (req, res) => {
  const { id } = req.params;
  const { estado_envio } = req.body;

  if (!estado_envio) {
    return res.status(400).json({ ok: false, msg: "estado_envio es obligatorio" });
  }

  try {
    const [result] = await db.query(
      "UPDATE ENVIOS SET ESTADO_ENVIO = ? WHERE ID_VENTA = ?",
      [estado_envio, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Compra sin envío registrado" });
    }

    await notificarCambioEstado(id, "envio", estado_envio);

    res.json({ ok: true, msg: "Estado de envío actualizado" });
  } catch (err) {
    console.error("Error al actualizar estado de envío:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar estado de envío" });
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

/** Genera la factura PDF de cualquier compra (RF-021). Solo accesible por administradores. */
const descargarFacturaAdmin = async (req, res) => {
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
       WHERE v.ID_VENTA = ?`,
      [id_venta]
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
    console.error("Error al generar factura PDF (admin):", err);
    res.status(500).json({ ok: false, msg: "Error al generar la factura" });
  }
};

/** Valida que una fecha sea YYYY-MM-DD (para los reportes). */
const fechaValida = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);

/**
 * RF-032: Reporte de ventas por rango de fechas (GET /api/admin/reportes/ventas).
 * Devuelve ingresos totales, cantidad de órdenes, ticket promedio, unidades
 * vendidas y la serie diaria (para el gráfico). Excluye ventas CANCELADAS.
 * Query params opcionales: desde=YYYY-MM-DD, hasta=YYYY-MM-DD (default: últimos 30 días).
 */
const reporteVentas = async (req, res) => {
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const desde = fechaValida(req.query.desde) ? req.query.desde : hace30.toISOString().slice(0, 10);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy.toISOString().slice(0, 10);
    const desdeIni = `${desde} 00:00:00`;
    const hastaFin = `${hasta} 23:59:59`;

    const [[resumen]] = await db.query(
      `SELECT COUNT(*) AS totalOrdenes,
              COALESCE(SUM(TOTAL), 0) AS totalIngresos,
              COALESCE(AVG(TOTAL), 0) AS ticketPromedio,
              (SELECT COALESCE(SUM(dv.CANTIDAD), 0)
               FROM DETALLE_VENTAS dv JOIN VENTAS v2 ON dv.ID_VENTA = v2.ID_VENTA
               WHERE v2.FECHA_VENTA BETWEEN ? AND ? AND v2.ESTADO <> 'CANCELADA') AS totalUnidades
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'`,
      [desdeIni, hastaFin, desdeIni, hastaFin]
    );

    const [serie] = await db.query(
      `SELECT DATE(FECHA_VENTA) AS dia, COUNT(*) AS ordenes, COALESCE(SUM(TOTAL), 0) AS ingresos
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'
       GROUP BY DATE(FECHA_VENTA)
       ORDER BY dia ASC`,
      [desdeIni, hastaFin]
    );

    res.json({
      desde,
      hasta,
      totalOrdenes: Number(resumen.totalOrdenes),
      totalIngresos: Number(resumen.totalIngresos),
      ticketPromedio: Math.round(Number(resumen.ticketPromedio)),
      totalUnidades: Number(resumen.totalUnidades),
      serie: serie.map((s) => ({ ...s, ordenes: Number(s.ordenes), ingresos: Number(s.ingresos) })),
    });
  } catch (err) {
    console.error("Error al generar reporte de ventas:", err);
    res.status(500).json({ ok: false, msg: "Error al generar el reporte de ventas" });
  }
};

/**
 * RF-034: Ranking de productos más vendidos (GET /api/admin/analytics/mas-vendidos).
 * Ordena por unidades facturadas (excluye ventas CANCELADAS) dentro del rango.
 * Query params opcionales: desde, hasta (default: últimos 30 días), limite (default 10, máx 50).
 */
const masVendidos = async (req, res) => {
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const desde = fechaValida(req.query.desde) ? req.query.desde : hace30.toISOString().slice(0, 10);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy.toISOString().slice(0, 10);
    const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 50);

    const [rows] = await db.query(
      `SELECT p.ID, p.NOMBRE,
              (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi
               WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN,
              SUM(dv.CANTIDAD) AS unidades,
              SUM(dv.SUBTOTAL) AS ingresos,
              (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv
               WHERE pv.ID_PRODUCTO = p.ID) AS stock
       FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
       GROUP BY p.ID, p.NOMBRE
       ORDER BY unidades DESC, ingresos DESC
       LIMIT ?`,
      [`${desde} 00:00:00`, `${hasta} 23:59:59`, limite]
    );

    res.json(rows.map((r) => ({ ...r, unidades: Number(r.unidades), ingresos: Number(r.ingresos), stock: Number(r.stock) })));
  } catch (err) {
    console.error("Error al obtener más vendidos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener los productos más vendidos" });
  }
};

module.exports = { obtenerDashboard, obtenerTodasLasCompras, actualizarEstadoCompra, actualizarEstadoEnvio, obtenerUsuarios, descargarFacturaAdmin, reporteVentas, masVendidos };

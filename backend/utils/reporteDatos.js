/**
 * Datos consolidados del reporte por rango de fechas.
 * Fuente única para el Excel (reporteExcel) y el PDF (reportePdf).
 */
const db = require('../config/db');

function fechaValida(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
}

/** Resuelve el rango efectivo (con defaults) sin consultar la BD. */
function resolverRango(query = {}) {
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    desde: fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10),
    hasta: fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10),
  };
}

async function obtenerDatosReporte(query = {}) {
  const { desde, hasta } = resolverRango(query);
  const desdeIni = `${desde} 00:00:00`;
  const hastaFin = `${hasta} 23:59:59`;

  // --- Ventas completas del rango (incluye CANCELADAS para los COUNTIF) ---
  const [ventas] = await db.query(
    `SELECT v.ID_VENTA,
            DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d') AS FECHA,
            COALESCE(u.NOMBRE_USUARIO, '(sin cuenta)') AS CLIENTE,
            COALESCE(mp.NOMBRE_METODO, '—') AS METODO,
            v.ESTADO,
            (SELECT COALESCE(SUM(dv.CANTIDAD), 0) FROM DETALLE_VENTAS dv WHERE dv.ID_VENTA = v.ID_VENTA) AS ARTICULOS,
            v.TOTAL
     FROM VENTAS v
     LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
     LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
     WHERE v.FECHA_VENTA BETWEEN ? AND ?
     ORDER BY v.FECHA_VENTA DESC`,
    [desdeIni, hastaFin]
  );

  const validas = ventas.filter((v) => v.ESTADO !== 'CANCELADA');
  const totalOrdenes = validas.length;
  const totalIngresos = validas.reduce((s, v) => s + Number(v.TOTAL || 0), 0);
  const totalUnidades = validas.reduce((s, v) => s + Number(v.ARTICULOS || 0), 0);
  const ticketPromedio = totalOrdenes ? Math.round(totalIngresos / totalOrdenes) : 0;
  const [[{ totalUsuarios }]] = await db.query(
    `SELECT COUNT(*) AS totalUsuarios FROM USUARIOS WHERE DATE(FECHA_REGISTRO) BETWEEN ? AND ?`,
    [desde, hasta]
  );

  // --- Más vendidos (top 50) ---
  const [masVendidos] = await db.query(
    `SELECT p.NOMBRE, SUM(dv.CANTIDAD) AS unidades, SUM(dv.SUBTOTAL) AS ingresos,
            (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv WHERE pv.ID_PRODUCTO = p.ID) AS stock
     FROM DETALLE_VENTAS dv
     JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
     JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
     WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
     GROUP BY p.ID, p.NOMBRE
     ORDER BY unidades DESC, ingresos DESC
     LIMIT 50`,
    [desdeIni, hastaFin]
  );

  // --- Serie diaria del rango (para gráficas) — completa con 0 para días sin ventas
  const [serieRaw] = await db.query(
    `SELECT DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d') AS dia,
            COUNT(DISTINCT v.ID_VENTA) AS ordenes,
            COALESCE(SUM(v.TOTAL), 0) AS ingresos,
            COALESCE(SUM(dv.CANTIDAD), 0) AS unidades
     FROM VENTAS v
     LEFT JOIN DETALLE_VENTAS dv ON dv.ID_VENTA = v.ID_VENTA
     WHERE v.FECHA_VENTA BETWEEN ? AND ? AND v.ESTADO <> 'CANCELADA'
     GROUP BY DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d')
     ORDER BY dia ASC`,
    [desdeIni, hastaFin]
  );
  const [usuariosRaw] = await db.query(
    `SELECT DATE_FORMAT(FECHA_REGISTRO, '%Y-%m-%d') AS dia, COUNT(*) AS nuevos
     FROM USUARIOS WHERE DATE(FECHA_REGISTRO) BETWEEN ? AND ? GROUP BY DATE_FORMAT(FECHA_REGISTRO, '%Y-%m-%d')`,
    [desde, hasta]
  );
  const serieMap = new Map(serieRaw.map((s) => [String(s.dia).slice(0, 10), s]));
  const usuariosMap = new Map(usuariosRaw.map((s) => [String(s.dia).slice(0, 10), Number(s.nuevos)]));
  const serie = [];
  for (let d = new Date(desde); d <= new Date(hasta); d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const row = serieMap.get(iso);
    serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos), unidades: Number(row.unidades || 0), nuevosUsuarios: usuariosMap.get(iso) || 0 } : { dia: iso, ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: usuariosMap.get(iso) || 0 });
  }

  // --- Usuarios registrados en el rango (+ su actividad del rango) ---
  const [usuarios] = await db.query(
    `SELECT CONCAT(u.NOMBRE_USUARIO, ' ', u.APELLIDO_USUARIO) AS NOMBRE,
            u.EMAIL, COALESCE(r.NOMBRE_ROL, 'Cliente') AS ROL,
            DATE_FORMAT(u.FECHA_REGISTRO, '%Y-%m-%d') AS REGISTRO,
            (SELECT COUNT(*) FROM VENTAS v WHERE v.ID_CLIENTE = u.ID_USUARIO AND v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?) AS COMPRAS,
            COALESCE((SELECT SUM(v.TOTAL) FROM VENTAS v WHERE v.ID_CLIENTE = u.ID_USUARIO AND v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?), 0) AS GASTADO
     FROM USUARIOS u
     LEFT JOIN ROLES r ON u.ID_ROL = r.ID_ROL
     WHERE u.FECHA_REGISTRO BETWEEN ? AND ?
     ORDER BY u.FECHA_REGISTRO DESC, u.ID_USUARIO DESC`,
    [desdeIni, hastaFin, desdeIni, hastaFin, desde, hasta]
  );

  // --- Vendedores con su desempeño dentro del rango ---
  const [vendedores] = await db.query(
    `SELECT ve.NOMBRE_EMPRESA,
            COALESCE(ve.EMAIL_VENDEDOR, '') AS EMAIL,
            (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_VENDEDOR = ve.ID_VENDEDOR) AS PRODUCTOS,
            COALESCE(SUM(dv.CANTIDAD), 0) AS UNIDADES,
            COALESCE(SUM(dv.SUBTOTAL), 0) AS INGRESOS
     FROM VENDEDORES ve
     LEFT JOIN PRODUCTOS p ON p.ID_VENDEDOR = ve.ID_VENDEDOR
     LEFT JOIN DETALLE_VENTAS dv ON dv.ID_PRODUCTO = p.ID
     LEFT JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA AND v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
     GROUP BY ve.ID_VENDEDOR, ve.NOMBRE_EMPRESA, ve.EMAIL_VENDEDOR
     ORDER BY INGRESOS DESC`,
    [desdeIni, hastaFin]
  );

  const normVentas = ventas.map((v) => ({
    ...v,
    ARTICULOS: Number(v.ARTICULOS || 0),
    TOTAL: Number(v.TOTAL || 0),
  }));
  const normVend = masVendidos.map((m) => ({
    ...m,
    unidades: Number(m.unidades),
    ingresos: Number(m.ingresos),
    stock: Number(m.stock),
  }));
  const normUsr = usuarios.map((u) => ({ ...u, COMPRAS: Number(u.COMPRAS), GASTADO: Number(u.GASTADO) }));
  const normVen = vendedores.map((x) => ({
    ...x,
    PRODUCTOS: Number(x.PRODUCTOS),
    UNIDADES: Number(x.UNIDADES),
    INGRESOS: Number(x.INGRESOS),
  }));
  const normSerie = serie.map((s) => ({ dia: s.dia, ordenes: Number(s.ordenes), ingresos: Number(s.ingresos), unidades: Number(s.unidades || 0), nuevosUsuarios: Number(s.nuevosUsuarios || 0) }));

  return { desde, hasta, ventas: normVentas, resumen: { totalOrdenes, totalIngresos, totalUnidades, ticketPromedio, totalUsuarios: Number(totalUsuarios) }, serie: normSerie, masVendidos: normVend, usuarios: normUsr, vendedores: normVen };
}

module.exports = { obtenerDatosReporte, resolverRango };

/**
 * reporteVendedorDatos.js — fuente única de datos para los reportes
 * descargables del VENDEDOR (Excel y PDF). Todo filtrado a SUS productos.
 * Las ventas canceladas se incluyen en el detalle (con su ESTADO) para que
 * las fórmulas del Excel puedan excluirlas; resumen/serie/mas-vendidos ya
 * vienen calculados sin canceladas.
 */
const db = require('../config/db');

const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);

function resolverRango(query = {}) {
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    desde: fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10),
    hasta: fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10),
  };
}

/** Datos completos del reporte para un vendedor y rango dados. */
async function obtenerReporteVendedor(idVendedor, desde, hasta) {
  const desdeIni = `${desde} 00:00:00`;
  const hastaFin = `${hasta} 23:59:59`;
  const base = `FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
       LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
       WHERE v.FECHA_VENTA BETWEEN ? AND ?`;
  const params = [idVendedor, desdeIni, hastaFin];

  // Empresa del vendedor para la portada
  const [[vendedor]] = await db.query(
    'SELECT NOMBRE_EMPRESA, NIT FROM VENDEDORES WHERE ID_VENDEDOR = ?',
    [idVendedor]
  );

  // Renglones de venta (detalle completo, incluye CANCELADAS con su estado)
  const [ventas] = await db.query(
    `SELECT dv.ID_VENTA,
            DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d %H:%i') AS FECHA,
            v.ESTADO,
            COALESCE(u.NOMBRE_USUARIO, 'Cliente') AS CLIENTE,
            p.NOMBRE AS PRODUCTO,
            CONCAT_WS(' · ', NULLIF(pv.COLOR, ''), CONCAT(NULLIF(pv.NOMBRE_ATRIBUTO, ''), ': ', NULLIF(pv.ATRIBUTO, ''))) AS VARIANTE,
            dv.CANTIDAD,
            dv.PRECIO_UNITARIO,
            dv.SUBTOTAL
     ${base}
     ORDER BY v.FECHA_VENTA DESC, dv.ID_VENTA DESC`,
    params
  );

  // Resumen (sin canceladas)
  const baseNoCancel = `${base} AND v.ESTADO <> 'CANCELADA'`;
  const [[resumen]] = await db.query(
    `SELECT COUNT(DISTINCT dv.ID_VENTA) AS ordenes,
            COALESCE(SUM(dv.SUBTOTAL), 0) AS ingresos,
            COALESCE(SUM(dv.CANTIDAD), 0) AS unidades,
            COUNT(DISTINCT dv.ID_PRODUCTO) AS productosVendidos
     ${baseNoCancel}`,
    params
  );
  const ordenesNum = Number(resumen.ordenes);
  const ingresosNum = Number(resumen.ingresos);
  const resumenFinal = {
    ordenes: ordenesNum,
    ingresos: ingresosNum,
    unidades: Number(resumen.unidades),
    productosVendidos: Number(resumen.productosVendidos),
    ticketPromedio: ordenesNum > 0 ? Math.round(ingresosNum / ordenesNum) : 0,
  };

  // Serie diaria (sin canceladas) — completa con 0 para días sin ventas del vendedor
  const [serieRaw] = await db.query(
    `SELECT DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d') AS dia,
            COUNT(DISTINCT dv.ID_VENTA) AS pedidos,
            COALESCE(SUM(dv.SUBTOTAL), 0) AS ingresos
     ${baseNoCancel}
     GROUP BY DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d')
     ORDER BY dia ASC`,
    params
  );
  const serieMapV = new Map(serieRaw.map((s) => [String(s.dia).slice(0, 10), s]));
  const serie = [];
  for (let d = new Date(desde); d <= new Date(hasta); d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const row = serieMapV.get(iso);
    serie.push(row ? { dia: iso, pedidos: Number(row.pedidos), ingresos: Number(row.ingresos) } : { dia: iso, pedidos: 0, ingresos: 0 });
  }

  // Más vendidos (sin canceladas)
  const limite = 15;
  const [masVendidos] = await db.query(
    `SELECT p.NOMBRE AS PRODUCTO,
            SUM(dv.CANTIDAD) AS unidades,
            SUM(dv.SUBTOTAL) AS ingresos,
            (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv WHERE pv.ID_PRODUCTO = p.ID) AS stock
     ${baseNoCancel}
     GROUP BY p.ID, p.NOMBRE
     ORDER BY unidades DESC, ingresos DESC
     LIMIT ${limite}`,
    params
  );

  const num = (arr, campos) => arr.map((r) => {
    const out = { ...r };
    for (const c of campos) out[c] = Number(r[c]) || 0;
    return out;
  });

  return {
    vendedor: vendedor || { NOMBRE_EMPRESA: 'Mi tienda', NIT: null },
    desde,
    hasta,
    resumen: resumenFinal,
    ventas: num(ventas, ['CANTIDAD', 'PRECIO_UNITARIO', 'SUBTOTAL']),
    serie: num(serie, ['pedidos', 'ingresos']).map((s) => ({ ...s, dia: String(s.dia).slice(0, 10) })),
    masVendidos: num(masVendidos, ['unidades', 'ingresos', 'stock']),
  };
}

module.exports = { obtenerReporteVendedor, resolverRango };

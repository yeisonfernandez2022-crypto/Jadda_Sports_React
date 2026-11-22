/**
 * Datos consolidados del reporte por rango de fechas.
 * Fuente única para el Excel (reporteExcel) y el PDF (reportePdf).
 *
 * El alcance determina el importe: "todo" usa VENTAS.TOTAL (incluye envío);
 * "jadda" y "tienda" suman únicamente los subtotales de sus líneas (sin envío).
 * Una fila por pedido: las canceladas se listan pero no suman métricas.
 */
const db = require('../config/db');
const {
  resolverAlcance, condicionAlcance, etiquetaAlcance,
} = require('./alcanceReporte');

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

/** Día ISO a partir de un DATETIME de MySQL (Date) o de un string ya formateado. */
function fechaISO(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(valor || '').slice(0, 10);
}

/** Resuelve y valida el alcance; para tienda consulta el nombre real. */
async function resolverAlcanceReporte(query = {}) {
  const alcance = resolverAlcance(query);
  if (alcance.error) {
    throw Object.assign(new Error(alcance.error), { statusCode: alcance.statusCode });
  }
  if (alcance.tipo === 'tienda') {
    const [tiendas] = await db.query(
      'SELECT ID_VENDEDOR, NOMBRE_EMPRESA FROM VENDEDORES WHERE ID_VENDEDOR = ?',
      [alcance.idVendedor]
    );
    if (tiendas.length === 0) {
      throw Object.assign(new Error('Tienda no encontrada'), { statusCode: 404 });
    }
    alcance.etiqueta = etiquetaAlcance(alcance, tiendas[0].NOMBRE_EMPRESA);
  }
  return alcance;
}

/** Pedidos del rango con una sola fila por venta y el importe del alcance. */
async function consultarPedidos(desdeIni, hastaFin, alcance) {
  const condicion = condicionAlcance(alcance, 'p');
  const importeSql = alcance.tipo === 'todo' ? 'v.TOTAL' : 'SUM(dv.SUBTOTAL)';
  const [pedidos] = await db.query(
    `SELECT v.ID_VENTA,
            v.FECHA_VENTA AS FECHA,
            COALESCE(u.NOMBRE_USUARIO, '(sin cuenta)') AS CLIENTE,
            COALESCE(mp.NOMBRE_METODO, '—') AS METODO,
            v.ESTADO,
            SUM(dv.CANTIDAD) AS ARTICULOS,
            ${importeSql} AS IMPORTE,
            v.TOTAL AS TOTAL
     FROM VENTAS v
     JOIN DETALLE_VENTAS dv ON dv.ID_VENTA = v.ID_VENTA
     JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
     LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
     LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
     WHERE v.FECHA_VENTA BETWEEN ? AND ? AND ${condicion.sql}
     GROUP BY v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, u.NOMBRE_USUARIO, mp.NOMBRE_METODO
     ORDER BY v.FECHA_VENTA DESC`,
    [desdeIni, hastaFin, ...condicion.params]
  );

  return pedidos.map((p) => ({
    ...p,
    FECHA: fechaISO(p.FECHA),
    ARTICULOS: Number(p.ARTICULOS || 0),
    IMPORTE: Number(p.IMPORTE || 0),
    TOTAL: Number(p.TOTAL || 0),
  }));
}

/** Serie diaria completa (con 0 en días sin ventas) a partir de los pedidos. */
function construirSerie(desde, hasta, pedidosValidos, usuariosRaw) {
  const acumulado = new Map();
  for (const p of pedidosValidos) {
    const actual = acumulado.get(p.FECHA) || { ordenes: 0, ingresos: 0, unidades: 0 };
    actual.ordenes += 1;
    actual.ingresos += p.IMPORTE;
    actual.unidades += p.ARTICULOS;
    acumulado.set(p.FECHA, actual);
  }
  const usuariosMap = new Map(usuariosRaw.map((u) => [String(u.dia).slice(0, 10), Number(u.nuevos)]));
  const serie = [];
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const acum = acumulado.get(iso);
    serie.push({
      dia: iso,
      ordenes: acum ? acum.ordenes : 0,
      ingresos: acum ? acum.ingresos : 0,
      unidades: acum ? acum.unidades : 0,
      nuevosUsuarios: usuariosMap.get(iso) || 0,
    });
  }
  return serie;
}

async function obtenerDatosReporte(query = {}) {
  const { desde, hasta } = resolverRango(query);
  const desdeIni = `${desde} 00:00:00`;
  const hastaFin = `${hasta} 23:59:59`;
  const alcance = await resolverAlcanceReporte(query);

  // --- Pedidos del rango (incluye CANCELADAS para listarlas) ---
  const ventas = await consultarPedidos(desdeIni, hastaFin, alcance);
  const validas = ventas.filter((v) => v.ESTADO !== 'CANCELADA');
  const totalOrdenes = validas.length;
  const totalIngresos = validas.reduce((s, v) => s + v.IMPORTE, 0);
  const totalUnidades = validas.reduce((s, v) => s + v.ARTICULOS, 0);
  const ticketPromedio = totalOrdenes ? Math.round(totalIngresos / totalOrdenes) : 0;

  const [[{ totalUsuarios }]] = await db.query(
    `SELECT COUNT(*) AS totalUsuarios FROM USUARIOS WHERE DATE(FECHA_REGISTRO) BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const condicion = condicionAlcance(alcance, 'p');

  // --- Más vendidos (top 50) del alcance ---
  const [masVendidos] = await db.query(
    `SELECT p.NOMBRE, SUM(dv.CANTIDAD) AS unidades, SUM(dv.SUBTOTAL) AS ingresos,
            (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv WHERE pv.ID_PRODUCTO = p.ID) AS stock
     FROM DETALLE_VENTAS dv
     JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
     JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
     WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ? AND ${condicion.sql}
     GROUP BY p.ID, p.NOMBRE
     ORDER BY unidades DESC, ingresos DESC
     LIMIT 50`,
    [desdeIni, hastaFin, ...condicion.params]
  );

  const [usuariosRaw] = await db.query(
    `SELECT DATE_FORMAT(FECHA_REGISTRO, '%Y-%m-%d') AS dia, COUNT(*) AS nuevos
     FROM USUARIOS WHERE DATE(FECHA_REGISTRO) BETWEEN ? AND ? GROUP BY DATE_FORMAT(FECHA_REGISTRO, '%Y-%m-%d')`,
    [desde, hasta]
  );
  const serie = construirSerie(desde, hasta, validas, usuariosRaw);

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

  // --- Vendedores con su desempeño dentro del rango (solo si el alcance lo permite) ---
  let vendedores = [];
  if (alcance.tipo !== 'jadda') {
    const filtroTienda = alcance.tipo === 'tienda' ? 'WHERE ve.ID_VENDEDOR = ?' : '';
    const paramsVendedores = alcance.tipo === 'tienda'
      ? [desdeIni, hastaFin, alcance.idVendedor]
      : [desdeIni, hastaFin];
    [vendedores] = await db.query(
      `SELECT ve.NOMBRE_EMPRESA,
              COALESCE(ve.EMAIL_VENDEDOR, '') AS EMAIL,
              (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_VENDEDOR = ve.ID_VENDEDOR) AS PRODUCTOS,
              COALESCE(SUM(CASE WHEN v.ID_VENTA IS NOT NULL THEN dv.CANTIDAD ELSE 0 END), 0) AS UNIDADES,
              COALESCE(SUM(CASE WHEN v.ID_VENTA IS NOT NULL THEN dv.SUBTOTAL ELSE 0 END), 0) AS INGRESOS
       FROM VENDEDORES ve
       LEFT JOIN PRODUCTOS p ON p.ID_VENDEDOR = ve.ID_VENDEDOR
       LEFT JOIN DETALLE_VENTAS dv ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA AND v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
       ${filtroTienda}
       GROUP BY ve.ID_VENDEDOR, ve.NOMBRE_EMPRESA, ve.EMAIL_VENDEDOR
       ORDER BY INGRESOS DESC`,
      paramsVendedores
    );
  }

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
  const normSerie = serie.map((s) => ({
    dia: s.dia,
    ordenes: Number(s.ordenes),
    ingresos: Number(s.ingresos),
    unidades: Number(s.unidades || 0),
    nuevosUsuarios: Number(s.nuevosUsuarios || 0),
  }));

  return {
    desde,
    hasta,
    alcance,
    ventas,
    resumen: {
      totalOrdenes,
      totalIngresos,
      totalUnidades,
      ticketPromedio,
      totalUsuarios: Number(totalUsuarios),
    },
    serie: normSerie,
    masVendidos: normVend,
    usuarios: normUsr,
    vendedores: normVen,
  };
}

/** Resumen ligero para el modal de descarga: solo pedidos del alcance. */
async function obtenerResumenReporte(query = {}) {
  const { desde, hasta } = resolverRango(query);
  const desdeIni = `${desde} 00:00:00`;
  const hastaFin = `${hasta} 23:59:59`;
  const alcance = await resolverAlcanceReporte(query);
  const pedidos = await consultarPedidos(desdeIni, hastaFin, alcance);
  const validas = pedidos.filter((p) => p.ESTADO !== 'CANCELADA');
  return {
    desde,
    hasta,
    alcance,
    ordenes: validas.length,
    unidades: validas.reduce((s, p) => s + p.ARTICULOS, 0),
    importe: validas.reduce((s, p) => s + p.IMPORTE, 0),
  };
}

module.exports = { obtenerDatosReporte, obtenerResumenReporte, resolverRango };

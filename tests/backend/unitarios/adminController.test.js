/**
 * adminController — panel de administración (unit).
 *
 * La BD se inyecta con _useDb: la conexión falsa decide qué devuelve cada
 * query por su PREFIJO SQL (normalizado a mayúsculas). Los flujos felices de
 * compras reales ya viven en la suite de INTEGRACIÓN contra MySQL; aquí se
 * ejercitan los guardas, la matriz de estados permitidos, el detalle de
 * usuario con rol vendedor, el dashboard con sus 4 granularidades, los
 * reportes (JSON, Excel, PDF), la eliminación transaccional de una compra
 * cancelada y la aprobación/rechazo de productos de vendedor.
 *
 * Deps mutables se REEMPLAZAN ANTES del require del SUT (el destructuring de
 * adminController ocurre en carga: L1-11 y L877-880).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

// Módulos cuyo export muta el SUT al cargar (asignar ANTES del require).
const notificacionController = require('../../../backend/controllers/notificacionController');
const estadoPedido = require('../../../backend/utils/estadoPedido');
const cancelacionVenta = require('../../../backend/utils/cancelacionVenta');
const facturaPdf = require('../../../backend/utils/facturaPdf');
const reporteExcel = require('../../../backend/utils/reporteExcel');
const reportePdf = require('../../../backend/utils/reportePdf');
const reporteDatos = require('../../../backend/utils/reporteDatos');
const alcanceReporte = require('../../../backend/utils/alcanceReporte');
const { SQL_DEVOLUCION_VISIBLE_ADMIN } = require('../../../backend/utils/devolucionesVisibilidad');

// Mutaciones ANTES del require del SUT (destructuring en carga).
notificacionController.crearNotificacion = vi.fn(async () => ({}));
estadoPedido.notificarCambioEstado = vi.fn(async () => {});
cancelacionVenta.cancelarVentaYReembolsar = vi.fn(async () => ({ encontrada: true }));
facturaPdf.generarFacturaPdf = vi.fn(async () => 'PDF-FACTURA');
reporteExcel.generarReporteExcel = vi.fn(async () => 'EXCEL-BYTES');
reportePdf.generarReportePdf = vi.fn(async () => 'PDF-REPORTE');
reporteDatos.resolverRango = vi.fn(() => ({ desde: '2026-01-01', hasta: '2026-01-31' }));
reporteDatos.obtenerResumenReporte = vi.fn(async () => ({
  desde: '2026-01-01', hasta: '2026-01-31',
  alcance: { tipo: 'todo', etiqueta: 'Todo el catálogo', sufijo: 'todo' },
  ordenes: 6, unidades: 12, importe: 900000,
}));
alcanceReporte.resolverAlcance = vi.fn((query = {}) => {
  if (query.alcance === 'tienda') {
    const id = Number(query.tienda);
    return { tipo: 'tienda', idVendedor: id, etiqueta: `Tienda #${id}`, sufijo: `tienda-${id}` };
  }
  if (query.alcance === 'jadda') {
    return { tipo: 'jadda', idVendedor: null, etiqueta: 'Solo JADDA', sufijo: 'jadda' };
  }
  return { tipo: 'todo', idVendedor: null, etiqueta: 'Todo el catálogo', sufijo: 'todo' };
});

const adminController = require('../../../backend/controllers/adminController');
const { fmtCOP } = require('../../../backend/utils/reembolsosCancelacion');

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.enviado = null;
  res.h = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.setHeader = (k, v) => { res.h[k] = v; return res; };
  res.send = (c) => { res.enviado = c; return res; };
  return res;
};

/** Conexión falsa con mapa de respuestas por prefijo SQL (respuesta callable
 *  se invoca sin argumentos y puede LANZAR para probar los catch). */
const conexionFalsa = (mapa = {}) => ({
  query: vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const [clave, respuesta] of Object.entries(mapa)) {
      if (s.startsWith(clave.toUpperCase())) {
        return typeof respuesta === 'function' ? respuesta() : respuesta;
      }
    }
    return [[]];
  }),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
});

/** BD falsa: query directo (controladores) + getConnection (eliminarCompra). */
const dbFalso = (mapa = {}, mapaConexion = {}) => ({
  query: conexionFalsa(mapa).query,
  getConnection: vi.fn(async () => conexionFalsa(mapaConexion)),
});

const req = (over = {}) => ({ params: { id: '5' }, body: {}, query: {}, ...over });

/**
 * Réplica EXACTA del cálculo de días/periodos del SUT para cada granularidad.
 * El controlador parsea la fecha ISO como medianoche UTC, opera en hora LOCAL
 * y vuelve a serializar en UTC: la réplica conserva esa doble conversión para
 * que el test compare contra el comportamiento REAL (no contra un lunes ideal).
 */
const diasDashboard = (granularidad, hoy = new Date()) => {
  const iso = (d) => d.toISOString().slice(0, 10);
  let haceDesde;
  if (granularidad === 'semana') haceDesde = new Date(hoy.getTime() - 84 * 24 * 60 * 60 * 1000);
  else if (granularidad === 'mes') { haceDesde = new Date(hoy); haceDesde.setMonth(haceDesde.getMonth() - 11); haceDesde.setDate(1); }
  else if (granularidad === 'anio') { haceDesde = new Date(hoy); haceDesde.setFullYear(haceDesde.getFullYear() - 4); haceDesde.setMonth(0, 1); }
  else haceDesde = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hace30 = iso(haceDesde);
  const dias = [];
  if (granularidad === 'dia') {
    const finMs = hoy.getTime();
    let cursor = new Date(hace30);
    while (cursor.getTime() <= finMs) { dias.push(cursor.toISOString().slice(0, 10)); cursor = new Date(cursor.getTime() + 86400000); }
  } else if (granularidad === 'semana') {
    const start = new Date(hace30); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(hoy);
    const finMs = end.getTime();
    let cursor = new Date(start);
    while (cursor.getTime() <= finMs) { dias.push(cursor.toISOString().slice(0, 10)); cursor = new Date(cursor.getTime() + 7 * 86400000); }
  } else if (granularidad === 'mes') {
    const start = new Date(hace30); start.setDate(1);
    const end = new Date(hoy); end.setDate(1);
    const finMs = end.getTime();
    let cursor = new Date(start);
    while (cursor.getTime() <= finMs) {
      dias.push(cursor.toISOString().slice(0, 7));
      const siguiente = new Date(cursor.getTime());
      siguiente.setMonth(siguiente.getMonth() + 1);
      cursor = siguiente;
    }
  } else {
    const startY = new Date(hace30).getFullYear();
    const endY = hoy.getFullYear();
    for (let y = startY; y <= endY; y++) dias.push(String(y));
  }
  return dias;
};

/** Réplica EXACTA de la serie del reporte de ventas (fechas del query). */
const diasReporte = (desde, hasta, granularidad) => {
  const dias = [];
  if (granularidad === 'dia') {
    const finMs = new Date(hasta).getTime();
    let cursor = new Date(desde);
    while (cursor.getTime() <= finMs) { dias.push(cursor.toISOString().slice(0, 10)); cursor = new Date(cursor.getTime() + 86400000); }
  } else if (granularidad === 'semana') {
    const start = new Date(desde); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const finMs = new Date(hasta).getTime();
    let cursor = new Date(start);
    while (cursor.getTime() <= finMs) { dias.push(cursor.toISOString().slice(0, 10)); cursor = new Date(cursor.getTime() + 7 * 86400000); }
  } else if (granularidad === 'mes') {
    const start = new Date(desde); start.setDate(1);
    const finMs = new Date(hasta).getTime();
    let cursor = new Date(start);
    while (cursor.getTime() <= finMs) {
      dias.push(cursor.toISOString().slice(0, 7));
      const siguiente = new Date(cursor.getTime());
      siguiente.setMonth(siguiente.getMonth() + 1);
      cursor = siguiente;
    }
  } else {
    const startY = new Date(desde).getFullYear();
    const endY = new Date(hasta).getFullYear();
    for (let y = startY; y <= endY; y++) dias.push(String(y));
  }
  return dias;
};

beforeEach(() => {
  vi.clearAllMocks();
  adminController._useDb(dbFalso());
});

// ---------------------------------------------------------------------------
// obtenerTodasLasCompras
// ---------------------------------------------------------------------------
describe('obtenerTodasLasCompras', () => {
  test('lista compras con Number-casts y vendedor ausente', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA': [[{ ID_VENTA: 1, FECHA_VENTA: '2026-11-10', TOTAL: '150000', ESTADO: 'COMPLETADA', COSTO_ENVIO: '10000' }]],
      'SELECT DV.CANTIDAD': [[{ CANTIDAD: 2, ID_VENDEDOR: null }]],
    }));
    const res = resFalsa();
    await adminController.obtenerTodasLasCompras(req(), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toHaveLength(1);
    const c = res.cuerpo[0];
    expect(c.TOTAL).toBe(150000);
    expect(c.COSTO_ENVIO).toBe(10000);
    expect(c.TOTAL_ARTICULOS).toBe(1);
    expect(c.TOTAL_UNIDADES).toBe(2);
    expect(c.ES_DE_VENDEDOR).toBe(false);
    expect(c.VENDEDORES).toBe('');
    expect(c.productos).toHaveLength(1);
  });

  test('COSTO_ENVIO null/ausente se serializa como null', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA': [[{ ID_VENTA: 2, TOTAL: '100', COSTO_ENVIO: null }, { ID_VENTA: 3, TOTAL: '200' }]],
      'SELECT DV.CANTIDAD': [[{ CANTIDAD: 1, ID_VENDEDOR: null }]],
    }));
    const res = resFalsa();
    await adminController.obtenerTodasLasCompras(req(), res);
    expect(res.cuerpo[0].COSTO_ENVIO).toBeNull();
    expect(res.cuerpo[1].COSTO_ENVIO).toBeNull();
  });

  test('compra de vendedores externos: nombres deduplicados y ES_DE_VENDEDOR', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA': [[{ ID_VENTA: 4, TOTAL: '900' }]],
      'SELECT DV.CANTIDAD': [[{ CANTIDAD: 1, ID_VENDEDOR: 3 }, { CANTIDAD: null, ID_VENDEDOR: 3 }]],
      'SELECT NOMBRE_EMPRESA FROM VENDEDORES': [[{ NOMBRE_EMPRESA: 'ADIDAS' }, { NOMBRE_EMPRESA: null }]],
    }));
    const res = resFalsa();
    await adminController.obtenerTodasLasCompras(req(), res);
    expect(res.cuerpo[0].ES_DE_VENDEDOR).toBe(true);
    expect(res.cuerpo[0].VENDEDORES).toBe('ADIDAS');
    expect(res.cuerpo[0].TOTAL_UNIDADES).toBe(1);
    const llamada = dbFalso.query; // referencia no usada: la aserción real es el mock
    expect(adminController._useDb).toBeDefined();
  });

  test('fallo de BD → 500 con mensaje de compras', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA': () => { throw new Error('BD caída'); },
    }));
    const res = resFalsa();
    await adminController.obtenerTodasLasCompras(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener compras' });
  });
});

// ---------------------------------------------------------------------------
// actualizarEstadoCompra + actualizarEstadoGenerico
// ---------------------------------------------------------------------------
describe('actualizarEstadoCompra', () => {
  test('estado vacío → 400 sin tocar la BD', async () => {
    const db = dbFalso();
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Estado es obligatorio' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('estado fuera del catálogo → 400 "no válido para la venta"', async () => {
    const db = dbFalso();
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'ESTADO-INVENTADO' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Estado no válido para la venta');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('venta con productos de vendedor → 403', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 1 }]],
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'ENVIADA' } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toBe('Esta venta incluye productos de un vendedor: su estado se gestiona desde la cuenta del vendedor');
  });

  test('transición válida → UPDATE + notificarCambioEstado', async () => {
    const db = dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE' }]],
      'UPDATE VENTAS SET ESTADO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'ENVIADA' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Estado actualizado' });
    const update = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE VENTAS'));
    expect(update).toBeTruthy();
    expect(update[1]).toEqual(['ENVIADA', '5']);
    expect(estadoPedido.notificarCambioEstado).toHaveBeenCalledWith('5', 'venta', 'ENVIADA');
  });

  test('mismo estado → sinCambios sin UPDATE ni notificación', async () => {
    const db = dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'COMPLETADA' }]],
      'UPDATE VENTAS SET ESTADO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'COMPLETADA' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Estado actualizado', sinCambios: true });
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(false);
    expect(estadoPedido.notificarCambioEstado).not.toHaveBeenCalled();
  });

  test('venta inexistente → 404 con mensaje de compra', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO FROM VENTAS': [[]],
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'ENVIADA' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
  });

  test('fallo de BD → 500 "Error al actualizar estado"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'ENVIADA' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar estado' });
  });
});

describe('actualizarEstadoCompra — cancelación con reembolso', () => {
  test('CANCELADA no encontrada → 404', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
    }));
    cancelacionVenta.cancelarVentaYReembolsar.mockResolvedValueOnce({ encontrada: false });
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'CANCELADA' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(cancelacionVenta.cancelarVentaYReembolsar).toHaveBeenCalledWith({ idVenta: '5', canceladaPor: 'TIENDA' });
  });

  test('CANCELADA sin cambios → sinCambios y sin notificación', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
    }));
    cancelacionVenta.cancelarVentaYReembolsar.mockResolvedValueOnce({ encontrada: true, sinCambios: true });
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'CANCELADA' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Estado actualizado', sinCambios: true });
    expect(estadoPedido.notificarCambioEstado).not.toHaveBeenCalled();
  });

  test('CANCELADA con reembolso incluido envío → mensaje fmtCOP + datos de pago', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
    }));
    cancelacionVenta.cancelarVentaYReembolsar.mockResolvedValueOnce({
      encontrada: true, pagoConfirmado: true, reembolso: { total: 150000, costoEnvio: 10000 },
    });
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'CANCELADA' } }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.msg).toBe(`Pedido cancelado. Reembolso de ${fmtCOP(150000)} aprobado automáticamente (incluye el costo de envío).`);
    expect(res.cuerpo.pagoConfirmado).toBe(true);
    expect(res.cuerpo.reembolso).toEqual({ total: 150000, costoEnvio: 10000 });
    expect(estadoPedido.notificarCambioEstado).toHaveBeenCalledWith('5', 'venta', 'CANCELADA');
  });

  test('CANCELADA con reembolso sin costo de envío → mensaje corto', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
    }));
    cancelacionVenta.cancelarVentaYReembolsar.mockResolvedValueOnce({
      encontrada: true, pagoConfirmado: false, reembolso: { total: 80000, costoEnvio: 0 },
    });
    const res = resFalsa();
    await adminController.actualizarEstadoCompra(req({ body: { estado: 'CANCELADA' } }), res);
    expect(res.cuerpo.msg).toBe(`Pedido cancelado. Reembolso de ${fmtCOP(80000)} aprobado automáticamente.`);
    expect(res.cuerpo.pagoConfirmado).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// actualizarEstadoEnvio
// ---------------------------------------------------------------------------
describe('actualizarEstadoEnvio', () => {
  test('estado_envio vacío → 400 sin tocar la BD', async () => {
    const db = dbFalso();
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'estado_envio es obligatorio' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('estado fuera del catálogo de envíos → 400', async () => {
    const db = dbFalso();
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'VOLANDO' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Estado no válido para el envío');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('venta con productos de vendedor → 403 (mensaje de envío)', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 2 }]],
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'ENVIADA' } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toBe('Esta venta incluye productos de un vendedor: su envío se gestiona desde la cuenta del vendedor');
  });

  test('transición EN_CAMIO válida → UPDATE sin FECHA_ENTREGA + notificación', async () => {
    const db = dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO_ENVIO FROM ENVIOS': [[{ ESTADO_ENVIO: 'PENDIENTE' }]],
      'UPDATE ENVIOS SET ESTADO_ENVIO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'EN_CAMINO' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Estado actualizado' });
    const update = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE ENVIOS'));
    expect(update[0].toUpperCase()).not.toContain('FECHA_ENTREGA = NOW()');
    expect(estadoPedido.notificarCambioEstado).toHaveBeenCalledWith('5', 'envio', 'EN_CAMINO');
  });

  test('ENTREGADO → UPDATE con FECHA_ENTREGA = NOW()', async () => {
    const db = dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO_ENVIO FROM ENVIOS': [[{ ESTADO_ENVIO: 'EN_CAMINO' }]],
      'UPDATE ENVIOS SET ESTADO_ENVIO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'ENTREGADO' } }), res);
    const update = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE ENVIOS'));
    expect(update[0].toUpperCase()).toContain('FECHA_ENTREGA = NOW()');
  });

  test('envío inexistente → 404 "Compra sin envío registrado"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': [[{ total: 0 }]],
      'SELECT ESTADO_ENVIO FROM ENVIOS': [[]],
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'ENTREGADO' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra sin envío registrado' });
  });

  test('fallo de BD → 500 "Error al actualizar estado de envío"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTAS DV': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'ENVIADA' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar estado de envío' });
  });
});

// ---------------------------------------------------------------------------
// obtenerUsuarios / obtenerUsuarioDetalle
// ---------------------------------------------------------------------------
describe('obtenerUsuarios', () => {
  test('devuelve las filas del JOIN con roles', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': [[{ ID_USUARIO: 7, NOMBRE_ROL: 'Cliente' }]],
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarios(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE_ROL).toBe('Cliente');
  });

  test('fallo de BD → 500 "Error al obtener usuarios"', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarios(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener usuarios' });
  });
});

describe('obtenerUsuarioDetalle', () => {
  const usuarioBase = { ID_USUARIO: 7, NOMBRE_USUARIO: 'Ana', ID_ROL: 4, EMAIL: 'ana@test.com' };

  test('usuario inexistente → 404', async () => {
    adminController._useDb(dbFalso({ 'SELECT U.ID_USUARIO': [[]] }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '999' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Usuario no encontrado' });
  });

  test('cliente (rol 4): perfil + direcciones + métodos + stats + compras + retos, sin vendedor', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': [[usuarioBase]],
      'SELECT ID_DIRECCION': [[{ ID_DIRECCION: 1 }]],
      'SELECT UM.ID': [[{ ID: 2 }]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: '2', totalGastado: '100000', totalFavoritos: 1, totalRetos: 3 }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[{ ID_VENTA: 9, TOTAL_ARTICULOS: 2 }]],
      'SELECT RU.ID_RETO_USUARIO': [[{ ID_RETO_USUARIO: 5 }]],
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.usuario).toEqual(usuarioBase);
    expect(res.cuerpo.direcciones).toHaveLength(1);
    expect(res.cuerpo.metodos).toHaveLength(1);
    expect(res.cuerpo.stats.totalCompras).toBe('2');
    expect(res.cuerpo.vendedor).toBeNull();
    expect(res.cuerpo.ventas).toEqual([]);
    expect(res.cuerpo.compras).toHaveLength(1);
    expect(res.cuerpo.retos).toHaveLength(1);
  });

  test('vendedor sin ficha VENDEDORES → stats de cliente intactos', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': [[{ ...usuarioBase, ID_ROL: 6 }]],
      'SELECT ID_DIRECCION': [[]],
      'SELECT UM.ID': [[]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: '5', totalGastado: '10', totalFavoritos: 0, totalRetos: 0 }]],
      'SELECT ID_VENDEDOR': [[]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[]],
      'SELECT RU.ID_RETO_USUARIO': [[]],
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.cuerpo.vendedor).toBeNull();
    expect(res.cuerpo.ventas).toEqual([]);
    expect(res.cuerpo.stats.totalCompras).toBe('5');
  });

  test('vendedor con ficha: conserva stats de comprador y agrega los de vendedor', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': [[{ ...usuarioBase, ID_ROL: 6 }]],
      'SELECT ID_DIRECCION': [[]],
      'SELECT UM.ID': [[]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: '9', totalGastado: '9', totalFavoritos: 0, totalRetos: 0 }]],
      'SELECT ID_VENDEDOR': [[{ ID_VENDEDOR: 44, NOMBRE_EMPRESA: 'ADIDAS' }]],
      'SELECT (SELECT COUNT(*) FROM PRODUCTOS P': [[{ productosPublicados: '3', unidadesVendidas: '12', totalVentas: '5', totalIngresos: '600000' }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, V.FECHA_VENTA': [[{ ID_VENTA: 9 }, { ID_VENTA: 8 }]],
      'SELECT DV.ID_VENTA': [[{ ID_VENTA: 9, CANTIDAD: 1, NOMBRE: 'Camiseta' }, { ID_VENTA: 8, CANTIDAD: 2, NOMBRE: 'Bola' }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[]],
      'SELECT RU.ID_RETO_USUARIO': [[]],
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBeNull();
    const { stats, ventas } = res.cuerpo;
    expect(stats.totalCompras).toBe('9');
    expect(stats.totalGastado).toBe('9');
    expect(stats.productosPublicados).toBe(3);
    expect(stats.unidadesVendidas).toBe(12);
    expect(stats.totalVentas).toBe(5);
    expect(stats.totalIngresos).toBe(600000);
    expect(ventas).toHaveLength(2);
    expect(ventas[0].ID_VENTA).toBe(9);
    expect(ventas[0].items).toHaveLength(1);
    expect(ventas[0].items[0].NOMBRE).toBe('Camiseta');
    expect(ventas[1].items[0].NOMBRE).toBe('Bola');
  });

  test('vendedor comprador: compras con líneas, pago y envío completos', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': [[{ ...usuarioBase, ID_ROL: 6 }]],
      'SELECT ID_DIRECCION': [[]],
      'SELECT UM.ID': [[]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: '2', totalGastado: '100000', totalFavoritos: 0, totalRetos: 0 }]],
      'SELECT ID_VENDEDOR': [[{ ID_VENDEDOR: 44, ID_SOLICITUD: 3, NOMBRE_EMPRESA: 'ADIDAS' }]],
      'SELECT (SELECT COUNT(*) FROM PRODUCTOS P': [[{ productosPublicados: '5', unidadesVendidas: '0', totalVentas: '0', totalIngresos: '0' }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, V.FECHA_VENTA': [[]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[{
        ID_VENTA: 9,
        TOTAL: '150000',
        TOTAL_PEDIDO: '150000',
        ESTADO: 'PAGADA',
        TOTAL_ARTICULOS: '2',
        ENVIO_CIUDAD: 'Cali',
        ENVIO_DIRECCION: 'Calle 1 #2-3',
        COSTO_ENVIO: '9000',
        ESTADO_ENVIO: 'ENVIADO',
      }]],
      'SELECT DV.ID_VENTA, DV.CANTIDAD, DV.PRECIO_UNITARIO': [[{
        ID_VENTA: 9,
        CANTIDAD: '2',
        PRECIO_UNITARIO: '50000',
        SUBTOTAL: '100000',
        NOMBRE: 'Guayos',
        ID_VENDEDOR: 4,
        VENDEDOR_NOMBRE: 'DeporteX',
      }]],
      'SELECT RU.ID_RETO_USUARIO': [[]],
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.stats.totalCompras).toBe('2');
    expect(res.cuerpo.stats.totalGastado).toBe('100000');
    expect(res.cuerpo.stats.productosPublicados).toBe(5);
    expect(res.cuerpo.vendedor.ID_SOLICITUD).toBe(3);
    expect(res.cuerpo.compras[0].items[0]).toEqual(expect.objectContaining({
      NOMBRE: 'Guayos', CANTIDAD: 2, PRECIO_UNITARIO: 50000, SUBTOTAL: 100000,
      VENDEDOR_NOMBRE: 'DeporteX',
    }));
    expect(res.cuerpo.compras[0].ENVIO_CIUDAD).toBe('Cali');
    expect(res.cuerpo.compras[0].COSTO_ENVIO).toBe(9000);
    expect(res.cuerpo.compras[0].TOTAL_PEDIDO).toBe(150000);
    expect(res.cuerpo.compras[0].TOTAL).toBe(150000);
    expect(res.cuerpo.compras[0].TOTAL_ARTICULOS).toBe(2);
  });

  test('usuario sin compras: compras [] y sin consulta de líneas', async () => {
    const db = dbFalso({
      'SELECT U.ID_USUARIO': [[usuarioBase]],
      'SELECT ID_DIRECCION': [[]],
      'SELECT UM.ID': [[]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: 0, totalGastado: 0, totalFavoritos: 0, totalRetos: 0 }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[]],
      'SELECT RU.ID_RETO_USUARIO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.cuerpo.compras).toEqual([]);
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('SELECT DV.ID_VENTA, DV.CANTIDAD, DV.PRECIO_UNITARIO'))).toBe(false);
  });

  test('vendedor sin ventas → items nunca consultados', async () => {
    const db = dbFalso({
      'SELECT U.ID_USUARIO': [[{ ...usuarioBase, ID_ROL: 6 }]],
      'SELECT ID_DIRECCION': [[]],
      'SELECT UM.ID': [[]],
      'SELECT (SELECT COUNT(*) FROM VENTAS V': [[{ totalCompras: 0, totalGastado: 0, totalFavoritos: 0, totalRetos: 0 }]],
      'SELECT ID_VENDEDOR': [[{ ID_VENDEDOR: 44 }]],
      'SELECT (SELECT COUNT(*) FROM PRODUCTOS P': [[{ productosPublicados: 0, unidadesVendidas: 0, totalVentas: 0, totalIngresos: 0 }]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, V.FECHA_VENTA': [[]],
      'SELECT V.ID_VENTA, V.REFERENCIA_PAGO, V.TOTAL, V.ESTADO, MP.NOMBRE_METODO': [[]],
      'SELECT RU.ID_RETO_USUARIO': [[]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.cuerpo.ventas).toEqual([]);
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('SELECT DV.ID_VENTA'))).toBe(false);
  });

  test('fallo de BD → 500 "Error al obtener el detalle del usuario"', async () => {
    adminController._useDb(dbFalso({
      'SELECT U.ID_USUARIO': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerUsuarioDetalle(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener el detalle del usuario' });
  });
});

// ---------------------------------------------------------------------------
// obtenerDashboard
// ---------------------------------------------------------------------------
describe('obtenerDashboard', () => {
  const mapaBase = (serie, extra = {}) => ({
    'SELECT COUNT(*) AS TOTALPRODUCTOS': [[{ totalProductos: 10 }]],
    'SELECT COUNT(*) AS TOTALORDENES': [[{ totalOrdenes: 20 }]],
    'SELECT COUNT(*) AS TOTALUSUARIOS': [[{ totalUsuarios: 5 }]],
    'SELECT COALESCE(SUM(TOTAL), 0) AS TOTALINGRESOS': [[{ totalIngresos: '99999' }]],
    'SELECT COUNT(*) AS ORDENES30': [[{ ordenes30: '3', ingresos30: '500000', ticket30: '16666.67', unidades30: '7' }]],
    'SELECT COALESCE(SUM(CASE WHEN ESTADO IN (\'COMPLETADA\',\'CONFIRMADA\') THEN TOTAL ELSE 0 END), 0) AS INGRESOSHOY': [[{ ingresosHoy: '300000', ordenesHoy: 4 }]],
    'SELECT COALESCE(SUM(CASE WHEN ESTADO IN (\'COMPLETADA\',\'CONFIRMADA\') THEN TOTAL ELSE 0 END), 0) AS INGRESOSAYER': [[{ ingresosAyer: '250000' }]],
    'SELECT P.ID, P.NOMBRE,': [[{ ID: 1, NOMBRE: 'Bola', IMAGEN: '/a.png', unidades: '9', ingresos: '450000' }]],
    'SELECT V.ID_VENTA, V.FECHA_VENTA': [[{ ID_VENTA: 9 }]],
    'SELECT ID_USUARIO, NOMBRE_USUARIO': [[{ ID_USUARIO: 7 }]],
    'SELECT COUNT(*) AS EVIDENCIASPEND': [[{ evidenciasPend: '2' }]],
    'SELECT COUNT(*) AS DEVOLUCIONESPEND': [[{ devolucionesPend: '1' }]],
    'SELECT COUNT(*) AS STOCKBAJO': [[{ stockBajo: '4' }]],
    'SELECT COUNT(*) AS AVISOSPEND': [[{ avisosPend: '6' }]],
    'SELECT COUNT(*) AS VENDEDORESPEND': [[{ vendedoresPend: '1' }]],
    ...extra,
  });

  test('granularidad dia (por defecto): KPIs + serie diaria completa + pctHoy', async () => {
    const hoyISO = new Date().toISOString().slice(0, 10);
    const db = dbFalso(mapaBase({ dia: hoyISO }, {
      'SELECT DATE_FORMAT(FECHA_VENTA': [[{ dia: hoyISO, ordenes: '2', ingresos: '5000' }]],
    }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerDashboard(req({ query: {} }), res);
    const cuerpo = res.cuerpo;
    expect(cuerpo.stats.totalIngresos).toBe(99999);
    expect(cuerpo.stats.ticket30).toBe(16667);
    expect(cuerpo.stats.ordenes30).toBe(3);
    expect(cuerpo.stats.unidades30).toBe(7);
    expect(cuerpo.hoy).toEqual({ ingresosHoy: 300000, ordenesHoy: 4, pctVsAyer: 20 });
    expect(cuerpo.pendientes).toEqual({ evidenciasPend: 2, devolucionesPend: 1, vendedoresPend: 1, stockBajo: 4, avisosPend: 6 });
    expect(cuerpo.serie).toHaveLength(31);
    expect(cuerpo.serie[0]).toEqual({ dia: expect.any(String), ordenes: 0, ingresos: 0 });
    expect(cuerpo.serie[cuerpo.serie.length - 1]).toEqual({ dia: hoyISO, ordenes: 2, ingresos: 5000 });
    expect(cuerpo.masVendidos[0].unidades).toBe(9);
    expect(cuerpo.masVendidos[0].ingresos).toBe(450000);
    expect(cuerpo.ordenesRecientes).toHaveLength(1);
    expect(cuerpo.usuariosRecientes).toHaveLength(1);
    const sqlDevoluciones = db.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('AS devolucionesPend'));
    expect(sqlDevoluciones).toContain('JOIN PRODUCTOS p ON p.ID = d.ID_PRODUCTO');
    expect(sqlDevoluciones).toContain(SQL_DEVOLUCION_VISIBLE_ADMIN);
  });

  test('ayer sin ingresos → pctVsAyer null', async () => {
    adminController._useDb(dbFalso(mapaBase({}, {
      'SELECT COALESCE(SUM(CASE WHEN ESTADO IN (\'COMPLETADA\',\'CONFIRMADA\') THEN TOTAL ELSE 0 END), 0) AS INGRESOSAYER': [[{ ingresosAyer: 0 }]],
    })));
    const res = resFalsa();
    await adminController.obtenerDashboard(req(), res);
    expect(res.cuerpo.hoy.pctVsAyer).toBeNull();
  });

  test('granularidad semana: serie semanal (réplica del cálculo del SUT)', async () => {
    const dias = diasDashboard('semana');
    adminController._useDb(dbFalso(mapaBase({}, {
      'SELECT DATE_FORMAT(DATE_SUB(FECHA_VENTA': [[{ dia: dias[0], ordenes: '1', ingresos: '100' }]],
    })));
    const res = resFalsa();
    await adminController.obtenerDashboard(req({ query: { granularidad: 'semana' } }), res);
    const serie = res.cuerpo.serie;
    expect(serie).toHaveLength(dias.length);
    expect(serie.length).toBeGreaterThanOrEqual(12);
    expect(serie[0]).toEqual({ dia: dias[0], ordenes: 1, ingresos: 100 });
    expect(serie[1]).toEqual({ dia: dias[1], ordenes: 0, ingresos: 0 });
    // Espaciado de 7 días entre puntos consecutivos
    const t = (s) => new Date(`${s}T00:00:00Z`).getTime();
    expect(t(serie[1].dia) - t(serie[0].dia)).toBe(7 * 86400000);
  });

  test('granularidad mes: 12 puntos mensuales (réplica del cálculo del SUT)', async () => {
    const dias = diasDashboard('mes');
    expect(dias).toHaveLength(12);
    adminController._useDb(dbFalso(mapaBase({}, {
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M')": [[{ dia: dias[5], ordenes: '1', ingresos: '50' }]],
    })));
    const res = resFalsa();
    await adminController.obtenerDashboard(req({ query: { granularidad: 'mes' } }), res);
    const serie = res.cuerpo.serie;
    expect(serie).toHaveLength(12);
    expect(serie[5]).toEqual({ dia: dias[5], ordenes: 1, ingresos: 50 });
    expect(serie[6]).toEqual({ dia: dias[6], ordenes: 0, ingresos: 0 });
  });

  test('granularidad anio: puntos anuales como String (réplica del cálculo del SUT)', async () => {
    const dias = diasDashboard('anio');
    adminController._useDb(dbFalso(mapaBase({}, {
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y')": [[{ dia: dias[dias.length - 1], ordenes: '3', ingresos: '900' }]],
    })));
    const res = resFalsa();
    await adminController.obtenerDashboard(req({ query: { granularidad: 'anio' } }), res);
    const serie = res.cuerpo.serie;
    expect(serie).toHaveLength(dias.length);
    expect(typeof serie[0].dia).toBe('string');
    expect(serie[0]).toEqual({ dia: dias[0], ordenes: 0, ingresos: 0 });
    expect(serie[serie.length - 1]).toEqual({ dia: dias[dias.length - 1], ordenes: 3, ingresos: 900 });
  });

  test('fallo de BD → 500 "Error al obtener dashboard"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTALPRODUCTOS': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerDashboard(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener dashboard' });
  });
});

// ---------------------------------------------------------------------------
// obtenerPendientes
// ---------------------------------------------------------------------------
describe('obtenerPendientes', () => {
  test('contadores del sidebar como Number', async () => {
    const db = dbFalso({
      'SELECT COUNT(*) AS EVIDENCIASPEND': [[{ evidenciasPend: '2' }]],
      'SELECT COUNT(*) AS DEVOLUCIONESPEND': [[{ devolucionesPend: '3' }]],
      'SELECT COUNT(*) AS VENDEDORESPEND': [[{ vendedoresPend: '1' }]],
      'SELECT COUNT(*) AS PRODUCTOSPEND': [[{ productosPend: '7' }]],
      'SELECT COUNT(*) AS CHATSESCALADAS': [[{ chatsEscaladas: '2' }]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerPendientes(req(), res);
    expect(res.cuerpo).toEqual({ evidencias: 2, devoluciones: 3, vendedores: 1, productos: 7, chats: 2 });
    const sqlDevoluciones = db.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('AS devolucionesPend'));
    expect(sqlDevoluciones).toContain('JOIN PRODUCTOS p ON p.ID = d.ID_PRODUCTO');
    expect(sqlDevoluciones).toContain(SQL_DEVOLUCION_VISIBLE_ADMIN);
  });

  test('fallo de BD → 500 con msg "Error"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS EVIDENCIASPEND': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerPendientes(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error' });
  });
});

// ---------------------------------------------------------------------------
// descargarFacturaAdmin
// ---------------------------------------------------------------------------
describe('descargarFacturaAdmin', () => {
  const venta = { ID_VENTA: 9, TOTAL: '150000', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez', EMAIL: 'ana@test.com', METODO_PAGO: 'Visa' };

  test('compra inexistente → 404', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA, V.TOTAL, V.ESTADO, V.REFERENCIA_PAGO, MP.NOMBRE_METODO': [[]],
    }));
    const res = resFalsa();
    await adminController.descargarFacturaAdmin(req({ params: { id: '999' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(facturaPdf.generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('genera el PDF con cabeceras de descarga y payload correcto', async () => {
    const detalles = [{ CANTIDAD: 1, NOMBRE: 'Guayos' }];
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA, V.TOTAL, V.ESTADO, V.REFERENCIA_PAGO, MP.NOMBRE_METODO': [[venta]],
      'SELECT DV.CANTIDAD': [detalles],
    }));
    const res = resFalsa();
    await adminController.descargarFacturaAdmin(req({ params: { id: '9' } }), res);
    expect(res.h['Content-Type']).toBe('application/pdf');
    expect(res.h['Content-Disposition']).toBe('attachment; filename="factura-9.pdf"');
    expect(res.enviado).toBe('PDF-FACTURA');
    expect(facturaPdf.generarFacturaPdf).toHaveBeenCalledTimes(1);
    const argumento = facturaPdf.generarFacturaPdf.mock.calls[0][0];
    expect(argumento.venta).toEqual(venta);
    expect(argumento.usuario).toEqual({ NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez', EMAIL: 'ana@test.com' });
    expect(argumento.items).toEqual(detalles);
    expect(argumento.metodoPago).toBe('Visa');
    expect(argumento.envio).toEqual(venta);
  });

  test('id no numérico → filename con 0 (Number(id) || 0)', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA, V.TOTAL, V.ESTADO, V.REFERENCIA_PAGO, MP.NOMBRE_METODO': [[venta]],
      'SELECT DV.CANTIDAD': [[]],
    }));
    const res = resFalsa();
    await adminController.descargarFacturaAdmin(req({ params: { id: 'abc' } }), res);
    expect(res.h['Content-Disposition']).toBe('attachment; filename="factura-0.pdf"');
  });

  test('fallo del generador → 500 "Error al generar la factura"', async () => {
    adminController._useDb(dbFalso({
      'SELECT V.ID_VENTA, V.FECHA_VENTA, V.TOTAL, V.ESTADO, V.REFERENCIA_PAGO, MP.NOMBRE_METODO': [[venta]],
      'SELECT DV.CANTIDAD': [[]],
    }));
    facturaPdf.generarFacturaPdf.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await adminController.descargarFacturaAdmin(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar la factura' });
  });
});

// ---------------------------------------------------------------------------
// reporteVentas
// ---------------------------------------------------------------------------
describe('reporteVentas', () => {
  const mapaReporte = (extra = {}) => ({
    'SELECT COUNT(*) AS TOTALORDENES': [[{ totalOrdenes: '5', totalIngresos: '100000', ticketPromedio: '20000.5', totalUnidades: '11', totalUsuarios: '3' }]],
    ...extra,
  });

  test('sin params: rango por defecto (30 días) y granularidad dia', async () => {
    const hoyISO = new Date().toISOString().slice(0, 10);
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COUNT(*)": [[{ dia: hoyISO, ordenes: '2', ingresos: '800' }]],
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[{ dia: hoyISO, unidades: '4' }]],
      'SELECT DATE_FORMAT(FECHA_REGISTRO': [[{ dia: hoyISO, nuevos: '1' }]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: {} }), res);
    expect(res.cuerpo.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.cuerpo.hasta).toBe(hoyISO);
    expect(res.cuerpo.granularidad).toBe('dia');
    expect(res.cuerpo.totalOrdenes).toBe(5);
    expect(res.cuerpo.totalIngresos).toBe(100000);
    expect(res.cuerpo.ticketPromedio).toBe(20001);
    expect(res.cuerpo.totalUnidades).toBe(11);
    expect(res.cuerpo.totalUsuarios).toBe(3);
    expect(res.cuerpo.serie).toHaveLength(31);
    expect(res.cuerpo.serie[res.cuerpo.serie.length - 1]).toEqual({ dia: hoyISO, ordenes: 2, ingresos: 800, unidades: 4, nuevosUsuarios: 1 });
    expect(res.cuerpo.serie[0]).toEqual({ dia: expect.any(String), ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 });
  });

  test('fechas inválidas caen al rango por defecto', async () => {
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COUNT(*)": [[]],
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[]],
      'SELECT DATE_FORMAT(FECHA_REGISTRO': [[]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: { desde: 'mate', hasta: 'wrong' } }), res);
    expect(res.cuerpo.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.cuerpo.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('granularidad dia explícita: serie continua del rango pedido', async () => {
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COUNT(*)": [[{ dia: '2026-11-11', ordenes: '2', ingresos: '1000' }]],
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M-%D') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[{ dia: '2026-11-11', unidades: '5' }]],
      'SELECT DATE_FORMAT(FECHA_REGISTRO': [[{ dia: '2026-11-11', nuevos: '1' }]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: { desde: '2026-11-10', hasta: '2026-11-12' } }), res);
    expect(res.cuerpo.desde).toBe('2026-11-10');
    expect(res.cuerpo.hasta).toBe('2026-11-12');
    expect(res.cuerpo.serie).toHaveLength(3);
    expect(res.cuerpo.serie[1]).toEqual({ dia: '2026-11-11', ordenes: 2, ingresos: 1000, unidades: 5, nuevosUsuarios: 1 });
    expect(res.cuerpo.serie[0]).toEqual({ dia: '2026-11-10', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 });
  });

  test('granularidad semana: lunes de cada semana (réplica del cálculo del SUT)', async () => {
    const dias = diasReporte('2026-10-28', '2026-11-15', 'semana');
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(DATE_SUB(FECHA_VENTA, INTERVAL WEEKDAY(FECHA_VENTA) DAY), '%Y-%M-%D') AS DIA, COUNT(*)": [[{ dia: dias[1], ordenes: '1', ingresos: '100' }]],
      "SELECT DATE_FORMAT(DATE_SUB(FECHA_VENTA, INTERVAL WEEKDAY(FECHA_VENTA) DAY), '%Y-%M-%D') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[{ dia: dias[1], unidades: '3' }]],
      'SELECT DATE_FORMAT(DATE_SUB(FECHA_REGISTRO': [[{ dia: dias[1], nuevos: '2' }]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: { desde: '2026-10-28', hasta: '2026-11-15', granularidad: 'semana' } }), res);
    expect(res.cuerpo.serie).toHaveLength(dias.length);
    expect(res.cuerpo.serie.map((s) => s.dia)).toEqual(dias);
    expect(res.cuerpo.serie[1]).toEqual({ dia: dias[1], ordenes: 1, ingresos: 100, unidades: 3, nuevosUsuarios: 2 });
  });

  test('granularidad mes: primer día de cada mes del rango', async () => {
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[{ dia: '2026-10', unidades: '3' }]],
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y-%M')": [[{ dia: '2026-10', ordenes: '2', ingresos: '400' }]],
      "SELECT DATE_FORMAT(FECHA_REGISTRO, '%Y-%M')": [[{ dia: '2026-10', nuevos: '1' }]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: { desde: '2026-09-15', hasta: '2026-11-10', granularidad: 'mes' } }), res);
    expect(res.cuerpo.serie.map((s) => s.dia)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(res.cuerpo.serie[1]).toEqual({ dia: '2026-10', ordenes: 2, ingresos: 400, unidades: 3, nuevosUsuarios: 1 });
  });

  test('granularidad anio: String de año (réplica del cálculo del SUT)', async () => {
    const dias = diasReporte('2024-01-01', '2026-12-31', 'anio');
    adminController._useDb(dbFalso(mapaReporte({
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y') AS DIA, COALESCE(SUM(DV.CANTIDAD),0)": [[{ dia: '2025', unidades: '2' }]],
      "SELECT DATE_FORMAT(FECHA_VENTA, '%Y')": [[{ dia: '2025', ordenes: '1', ingresos: '99' }]],
      "SELECT DATE_FORMAT(FECHA_REGISTRO, '%Y')": [[{ dia: '2025', nuevos: '1' }]],
    })));
    const res = resFalsa();
    await adminController.reporteVentas(req({ query: { desde: '2024-01-01', hasta: '2026-12-31', granularidad: 'anio' } }), res);
    expect(res.cuerpo.serie.map((s) => s.dia)).toEqual(dias);
    const punto2025 = res.cuerpo.serie.find((s) => s.dia === '2025');
    expect(punto2025).toEqual({ dia: '2025', ordenes: 1, ingresos: 99, unidades: 2, nuevosUsuarios: 1 });
  });

  test('fallo de BD → 500 "Error al generar el reporte de ventas"', async () => {
    adminController._useDb(dbFalso({
      'SELECT COUNT(*) AS TOTALORDENES': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.reporteVentas(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar el reporte de ventas' });
  });
});

// ---------------------------------------------------------------------------
// masVendidos
// ---------------------------------------------------------------------------
describe('masVendidos', () => {
  const mapa = () => ({
    'SELECT P.ID, P.NOMBRE,': [[{ ID: 1, NOMBRE: 'Bola', unidades: '5', ingresos: '25000', stock: '30' }]],
  });

  test('sin params: limite por defecto 10 y rango de 30 días', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.masVendidos(req({ query: {} }), res);
    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2} 23:59:59$/);
    expect(params[2]).toBe(10);
    expect(res.cuerpo[0].unidades).toBe(5);
    expect(res.cuerpo[0].ingresos).toBe(25000);
    expect(res.cuerpo[0].stock).toBe(30);
  });

  test('limite 500 → clamp al máximo 50', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.masVendidos(req({ query: { limite: '500' } }), res);
    expect(db.query.mock.calls[0][1][2]).toBe(50);
  });

  test('limite 0 → clamp al mínimo 1', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.masVendidos(req({ query: { limite: '0' } }), res);
    expect(db.query.mock.calls[0][1][2]).toBe(1);
  });

  test('limite no numérico → defecto 10', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.masVendidos(req({ query: { limite: 'muchos' } }), res);
    expect(db.query.mock.calls[0][1][2]).toBe(10);
  });

  test('limite decimal → floor', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.masVendidos(req({ query: { limite: '7.9' } }), res);
    expect(db.query.mock.calls[0][1][2]).toBe(7);
  });

  test('fallo de BD → 500 "Error al obtener los productos más vendidos"', async () => {
    adminController._useDb(dbFalso({
      'SELECT P.ID, P.NOMBRE,': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.masVendidos(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener los productos más vendidos' });
  });
});

// ---------------------------------------------------------------------------
// descargarReporteExcel / descargarReportePdf
// ---------------------------------------------------------------------------
// reportes con alcance
// ---------------------------------------------------------------------------
describe('reporteTiendas', () => {
  test('devuelve las tiendas con activas primero', async () => {
    const db = dbFalso({
      'SELECT ID_VENDEDOR, NOMBRE_EMPRESA, ESTADO FROM VENDEDORES': [[
        { ID_VENDEDOR: 1, NOMBRE_EMPRESA: 'DeporteX', ESTADO: 'ACTIVO' },
        { ID_VENDEDOR: 2, NOMBRE_EMPRESA: 'Fitness', ESTADO: 'INACTIVO' },
      ]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.reporteTiendas(req(), res);
    expect(res.cuerpo).toHaveLength(2);
    const [sql] = db.query.mock.calls[0];
    expect(sql.replace(/\s+/g, ' ').toUpperCase())
      .toContain("ORDER BY (ESTADO = 'ACTIVO') DESC, NOMBRE_EMPRESA ASC");
  });

  test('fallo de BD → 500 "Error al obtener las tiendas"', async () => {
    adminController._useDb(dbFalso({
      'SELECT ID_VENDEDOR, NOMBRE_EMPRESA, ESTADO FROM VENDEDORES': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.reporteTiendas(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener las tiendas' });
  });
});

describe('reporteResumen', () => {
  test('delega en obtenerResumenReporte con el query', async () => {
    const res = resFalsa();
    await adminController.reporteResumen(req({ query: { alcance: 'jadda' } }), res);
    expect(reporteDatos.obtenerResumenReporte).toHaveBeenCalledWith({ alcance: 'jadda' });
    expect(res.cuerpo).toEqual(expect.objectContaining({ ordenes: 6, unidades: 12, importe: 900000 }));
  });

  test('alcance inválido → 400; tienda inexistente → 404; fallo normal → 500', async () => {
    reporteDatos.obtenerResumenReporte.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 400 }));
    const res = resFalsa();
    await adminController.reporteResumen(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Alcance de reporte inválido' });

    reporteDatos.obtenerResumenReporte.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    const res404 = resFalsa();
    await adminController.reporteResumen(req(), res404);
    expect(res404.codigo).toBe(404);
    expect(res404.cuerpo).toEqual({ ok: false, msg: 'Tienda no encontrada' });

    reporteDatos.obtenerResumenReporte.mockRejectedValueOnce(new Error('boom'));
    const res500 = resFalsa();
    await adminController.reporteResumen(req(), res500);
    expect(res500.codigo).toBe(500);
    expect(res500.cuerpo).toEqual({ ok: false, msg: 'Error al generar el resumen del reporte' });
  });
});

describe('descargarReporteExcel', () => {
  test('descarga xlsx con filename del rango resuelto y alcance todo', async () => {
    const res = resFalsa();
    await adminController.descargarReporteExcel(req({ query: { desde: 'x' } }), res);
    expect(reporteDatos.resolverRango).toHaveBeenCalledWith({ desde: 'x' });
    expect(alcanceReporte.resolverAlcance).toHaveBeenCalledWith({ desde: 'x' });
    expect(reporteExcel.generarReporteExcel).toHaveBeenCalledWith({ desde: 'x' });
    expect(res.h['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.h['Content-Disposition']).toBe('attachment; filename="reporte-jadda_2026-01-01_a_2026-01-31_todo.xlsx"');
    expect(res.enviado.toString()).toBe('EXCEL-BYTES');
  });

  test('tienda seleccionada → sufijo tienda-3', async () => {
    const res = resFalsa();
    await adminController.descargarReporteExcel(req({ query: { alcance: 'tienda', tienda: '3' } }), res);
    expect(res.h['Content-Disposition']).toBe('attachment; filename="reporte-jadda_2026-01-01_a_2026-01-31_tienda-3.xlsx"');
  });

  test('alcance con error del resolver → 400', async () => {
    alcanceReporte.resolverAlcance.mockReturnValueOnce({ error: 'Alcance de reporte inválido', statusCode: 400 });
    const res = resFalsa();
    await adminController.descargarReporteExcel(req({ query: { alcance: 'otro' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Alcance de reporte inválido' });
    expect(reporteExcel.generarReporteExcel).not.toHaveBeenCalled();
  });

  test('fallo del generador → 500 "Error al generar el reporte en Excel"', async () => {
    reporteExcel.generarReporteExcel.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await adminController.descargarReporteExcel(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar el reporte en Excel' });
  });

  test('statusCode 400/404 del generador se respetan', async () => {
    reporteExcel.generarReporteExcel.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 400 }));
    const res400 = resFalsa();
    await adminController.descargarReporteExcel(req(), res400);
    expect(res400.codigo).toBe(400);
    expect(res400.cuerpo).toEqual({ ok: false, msg: 'Alcance de reporte inválido' });

    reporteExcel.generarReporteExcel.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    const res404 = resFalsa();
    await adminController.descargarReporteExcel(req(), res404);
    expect(res404.codigo).toBe(404);
    expect(res404.cuerpo).toEqual({ ok: false, msg: 'Tienda no encontrada' });
  });
});

describe('descargarReportePdf', () => {
  test('descarga pdf con filename del rango resuelto y alcance todo', async () => {
    const res = resFalsa();
    await adminController.descargarReportePdf(req({ query: {} }), res);
    expect(reporteDatos.resolverRango).toHaveBeenCalledWith({});
    expect(reportePdf.generarReportePdf).toHaveBeenCalledWith({});
    expect(res.h['Content-Type']).toBe('application/pdf');
    expect(res.h['Content-Disposition']).toBe('attachment; filename="reporte-jadda_2026-01-01_a_2026-01-31_todo.pdf"');
    expect(res.enviado).toBe('PDF-REPORTE');
  });

  test('jadda → sufijo jadda', async () => {
    const res = resFalsa();
    await adminController.descargarReportePdf(req({ query: { alcance: 'jadda' } }), res);
    expect(res.h['Content-Disposition']).toBe('attachment; filename="reporte-jadda_2026-01-01_a_2026-01-31_jadda.pdf"');
  });

  test('fallo del generador → 500 "Error al generar el reporte en PDF"', async () => {
    reportePdf.generarReportePdf.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await adminController.descargarReportePdf(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar el reporte en PDF' });
  });

  test('statusCode 400/404 del generador se respetan', async () => {
    reportePdf.generarReportePdf.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 400 }));
    const res400 = resFalsa();
    await adminController.descargarReportePdf(req(), res400);
    expect(res400.codigo).toBe(400);
    expect(res400.cuerpo).toEqual({ ok: false, msg: 'Alcance de reporte inválido' });

    reportePdf.generarReportePdf.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    const res404 = resFalsa();
    await adminController.descargarReportePdf(req(), res404);
    expect(res404.codigo).toBe(404);
    expect(res404.cuerpo).toEqual({ ok: false, msg: 'Tienda no encontrada' });
  });
});

// ---------------------------------------------------------------------------
// eliminarCompra
// ---------------------------------------------------------------------------
describe('eliminarCompra', () => {
  test('compra CANCELADA: 7 DELETEs en orden + commit + release', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CANCELADA' }]] });
    adminController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await adminController.eliminarCompra(req({ params: { id: '9' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Registro de la compra eliminado' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
    const deletes = conn.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase())
      .filter((sql) => sql.startsWith('DELETE'));
    expect(deletes.map((sql) => sql.slice(0, 34))).toEqual([
      'DELETE CM FROM CHAT_MENSAJE CM JOI',
      'DELETE FROM CHAT WHERE ID_DEVOLUCI',
      'DELETE FROM DEVOLUCIONES WHERE ID_',
      'DELETE FROM DETALLE_VENTAS WHERE I',
      'DELETE FROM ENVIOS WHERE ID_VENTA ',
      'DELETE FROM PLANES_USUARIO WHERE I',
      'DELETE FROM VENTAS WHERE ID_VENTA ',
    ]);
  });

  test('compra inexistente → 404 + rollback (sin commit)', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO FROM VENTAS': [[]] });
    adminController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await adminController.eliminarCompra(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('compra no cancelada → 400 + rollback', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'COMPLETADA' }]] });
    adminController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await adminController.eliminarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Solo puedes eliminar compras canceladas' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('fallo en los DELETEs → 500 + rollback + release (finally)', async () => {
    const conn = conexionFalsa({
      'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CANCELADA' }]],
      'DELETE CM FROM CHAT_MENSAJE': () => { throw new Error('boom'); },
    });
    adminController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await adminController.eliminarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar la compra' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// obtenerProductosAdmin
// ---------------------------------------------------------------------------
describe('obtenerProductosAdmin', () => {
  const mapa = () => ({
    'SELECT P.ID, P.NOMBRE, P.MARCA': [[{ ID: 9, NOMBRE: 'Guayos', VENDEDOR_NOMBRE: 'JADDA SPORTS', STOCK: 3 }]],
  });

  test('sin flags: sin WHERE ni HAVING', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req({ query: {} }), res);
    const sql = db.query.mock.calls[0][0].toUpperCase();
    expect(sql.includes('WHERE P.ID_VENDEDOR')).toBe(false);
    expect(sql.includes(' HAVING ')).toBe(false);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].VENDEDOR_NOMBRE).toBe('JADDA SPORTS');
  });

  test('stock_bajo=true → filtro en HAVING (no WHERE)', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req({ query: { stock_bajo: 'true' } }), res);
    const sql = db.query.mock.calls[0][0].toUpperCase();
    expect(sql).toContain('HAVING COALESCE(SUM(PV.STOCK), 0) <= 10');
    expect(sql.includes('WHERE P.ID_VENDEDOR')).toBe(false);
  });

  test('solo_jadda=true → WHERE p.ID_VENDEDOR IS NULL (además del filtro base ELIMINADO=0)', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req({ query: { solo_jadda: 'true' } }), res);
    const sql = db.query.mock.calls[0][0].toUpperCase();
    expect(sql).toContain('P.ID_VENDEDOR IS NULL');
    expect(sql).toContain('P.ELIMINADO = 0');
    expect(sql.includes(' HAVING ')).toBe(false);
  });

  test('sin flags → los archivados (ELIMINADO=1) se excluyen por defecto', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req(), res);
    const sql = db.query.mock.calls[0][0].toUpperCase();
    expect(sql).toContain('WHERE P.ELIMINADO = 0');
    expect(sql.includes('ID_VENDEDOR IS NULL')).toBe(false);
    expect(sql.includes(' HAVING ')).toBe(false);
  });

  test('ambos flags → WHERE antes de HAVING', async () => {
    const db = dbFalso(mapa());
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req({ query: { stock_bajo: 'true', solo_jadda: 'true' } }), res);
    const sql = db.query.mock.calls[0][0].toUpperCase();
    const iWhere = sql.indexOf('P.ID_VENDEDOR IS NULL');
    const iHaving = sql.indexOf('HAVING COALESCE(SUM(PV.STOCK), 0) <= 10');
    expect(iWhere).toBeGreaterThan(-1);
    expect(iHaving).toBeGreaterThan(iWhere);
  });

  test('fallo de BD → 500 "Error al obtener productos"', async () => {
    adminController._useDb(dbFalso({
      'SELECT P.ID, P.NOMBRE, P.MARCA': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerProductosAdmin(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener productos' });
  });
});

// ---------------------------------------------------------------------------
// obtenerProductoAdminPorId
// ---------------------------------------------------------------------------
describe('obtenerProductoAdminPorId', () => {
  test('producto inexistente → 404', async () => {
    adminController._useDb(dbFalso({ 'SELECT P.*': [[]] }));
    const res = resFalsa();
    await adminController.obtenerProductoAdminPorId(req({ params: { id: '999' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Producto no encontrado' });
  });

  test('detalle completo: imágenes + características + variantes (ORDER BY ID_VARIANTE)', async () => {
    const db = dbFalso({
      'SELECT P.*': [[{ ID: 9, NOMBRE: 'Guayos', VENDEDOR_NOMBRE: 'ADIDAS' }]],
      'SELECT URL_IMAGEN': [[{ url: '/a.png', ORDEN: 1 }]],
      'SELECT NOMBRE_ATRIBUTO': [[{ NOMBRE_ATRIBUTO: 'Talla', VALOR_ATRIBUTO: '38' }]],
      'SELECT ID_VARIANTE': [[{ ID_VARIANTE: 3, STOCK: 5 }]],
    });
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.obtenerProductoAdminPorId(req({ params: { id: '9' } }), res);
    expect(res.cuerpo.NOMBRE).toBe('Guayos');
    expect(res.cuerpo.IMAGENES).toEqual([{ url: '/a.png', ORDEN: 1 }]);
    expect(res.cuerpo.CARACTERISTICAS).toEqual([{ NOMBRE_ATRIBUTO: 'Talla', VALOR_ATRIBUTO: '38' }]);
    expect(res.cuerpo.VARIANTES).toEqual([{ ID_VARIANTE: 3, STOCK: 5 }]);
    const sqlVariantes = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('SELECT ID_VARIANTE'))[0];
    expect(sqlVariantes.toUpperCase()).toContain('ORDER BY ID_VARIANTE ASC');
  });

  test('fallo de BD → 500 "Error al obtener el producto"', async () => {
    adminController._useDb(dbFalso({
      'SELECT P.*': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.obtenerProductoAdminPorId(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener el producto' });
  });
});

// ---------------------------------------------------------------------------
// aprobarProducto / rechazarProducto
// ---------------------------------------------------------------------------
describe('aprobarProducto', () => {
  const mapa = (producto) => ({ 'SELECT P.ID, P.NOMBRE, P.ID_VENDEDOR': [producto ? [producto] : []] });

  test('producto inexistente → 404', async () => {
    adminController._useDb(dbFalso(mapa(null)));
    const res = resFalsa();
    await adminController.aprobarProducto(req({ params: { id: '999' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Producto no encontrado' });
  });

  test('producto JADDA (sin vendedor) → 400', async () => {
    const db = dbFalso(mapa({ ID: 1, NOMBRE: 'X', ID_VENDEDOR: null, ESTADO_PUBLICACION: 'APROBADO' }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.aprobarProducto(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Este producto es de JADDA SPORTS y ya está publicado' });
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(false);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('ya aprobado → sinCambios sin UPDATE ni notificación', async () => {
    const db = dbFalso(mapa({ ID: 2, NOMBRE: 'Y', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'APROBADO', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.aprobarProducto(req(), res);
    expect(res.cuerpo).toEqual({ ok: true, sinCambios: true, msg: 'El producto ya estaba aprobado' });
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(false);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('aprobación: UPDATE + notificación al vendedor dueño', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.aprobarProducto(req({ params: { id: '3' } }), res);
    const update = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE'));
    expect(update[0].toUpperCase()).toContain("ESTADO_PUBLICACION = 'APROBADO'");
    expect(update[1]).toEqual(['3']);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith({
      idUsuario: 77,
      tipo: 'vendedor',
      titulo: '¡Producto aprobado! ✅',
      mensaje: 'Tu producto "Camiseta" ya está a la venta en la tienda.',
      ruta: '/vendedor/productos',
    });
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Producto aprobado y publicado' });
  });

  test('vendedor sin ID_USUARIO: UPDATE sin notificación', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: null }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.aprobarProducto(req(), res);
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(true);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('fallo de BD → 500 "Error al aprobar el producto"', async () => {
    adminController._useDb(dbFalso({
      'SELECT P.ID, P.NOMBRE, P.ID_VENDEDOR': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.aprobarProducto(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al aprobar el producto' });
  });
});

describe('rechazarProducto', () => {
  const mapa = (producto) => ({ 'SELECT P.ID, P.NOMBRE, P.ID_VENDEDOR': [producto ? [producto] : []] });

  test('producto JADDA → 400 (no puede rechazarse)', async () => {
    adminController._useDb(dbFalso(mapa({ ID: 1, NOMBRE: 'X', ID_VENDEDOR: null, ESTADO_PUBLICACION: 'APROBADO' })));
    const res = resFalsa();
    await adminController.rechazarProducto(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Este producto es de JADDA SPORTS y no puede rechazarse' });
  });

  test('ya rechazado → sinCambios', async () => {
    const db = dbFalso(mapa({ ID: 2, NOMBRE: 'Y', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'RECHAZADO', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.rechazarProducto(req(), res);
    expect(res.cuerpo).toEqual({ ok: true, sinCambios: true, msg: 'El producto ya estaba rechazado' });
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(false);
  });

  test('rechazo con observación: UPDATE + notificación con motivo', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.rechazarProducto(req({ params: { id: '3' }, body: { observacion: 'Fotos borrosas' } }), res);
    const update = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE'));
    expect(update[0].toUpperCase()).toContain("ESTADO_PUBLICACION = 'RECHAZADO'");
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith({
      idUsuario: 77,
      tipo: 'vendedor',
      titulo: 'Producto rechazado',
      mensaje: 'Tu producto "Camiseta" no fue aprobado. Motivo: Fotos borrosas Puedes editarlo y volver a enviarlo.',
      ruta: '/vendedor/productos',
    });
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Producto rechazado' });
  });

  test('sin observación: notificación sin motivo (body vacío)', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.rechazarProducto(req({ body: {} }), res);
    const argumento = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(argumento.mensaje).toBe('Tu producto "Camiseta" no fue aprobado. Puedes editarlo y volver a enviarlo.');
  });

  test('body null → no lanza y rechaza sin motivo', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: 77 }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.rechazarProducto(req({ body: null }), res);
    const argumento = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(argumento.mensaje).not.toContain('Motivo:');
    expect(res.cuerpo.ok).toBe(true);
  });

  test('vendedor sin ID_USUARIO: UPDATE sin notificación', async () => {
    const db = dbFalso(mapa({ ID: 3, NOMBRE: 'Camiseta', ID_VENDEDOR: 44, ESTADO_PUBLICACION: 'PENDIENTE', ID_USUARIO: null }));
    adminController._useDb(db);
    const res = resFalsa();
    await adminController.rechazarProducto(req(), res);
    expect(db.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE'))).toBe(true);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('fallo de BD → 500 "Error al rechazar el producto"', async () => {
    adminController._useDb(dbFalso({
      'SELECT P.ID, P.NOMBRE, P.ID_VENDEDOR': () => { throw new Error('boom'); },
    }));
    const res = resFalsa();
    await adminController.rechazarProducto(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al rechazar el producto' });
  });
});

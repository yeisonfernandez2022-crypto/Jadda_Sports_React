/**
 * comprasController — historial, cancelación y reembolsos del cliente (unit).
 *
 * Este controlador NO expone _useDb: importa el pool real de config/db. La BD
 * falsa se logra mutando las PROPIEDADES del singleton (db.query / db.getConnection)
 * ANTES del require del SUT — vi.mock no intercepta en este setup CJS (lección
 * de la suite; ver cancelacionVenta.test.js).
 *
 * Los flujos felices con MySQL real viven en la suite de INTEGRACIÓN; aquí se
 * ejercitan los guardas y caminos de error: 404 de compras ajenas, estados no
 * cancelables, envío salido del almacén (RN-010), items sin variante (continue),
 * rollback en fallos, y el reembolso automático cuando hubo cobro confirmado.
 * fmtCOP / ventaPagada / pagoConfirmadoEnVenta se usan REALES (asserts exactos).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');
const estadoPedido = require('../../../backend/utils/estadoPedido');
const movimientosStock = require('../../../backend/utils/movimientosStock');
const reembolsosCancelacion = require('../../../backend/utils/reembolsosCancelacion');
const facturaPdf = require('../../../backend/utils/facturaPdf');
const notificacionController = require('../../../backend/controllers/notificacionController');

// Mutaciones ANTES del require del SUT (destructuring en carga L3-13).
estadoPedido.notificarCambioEstado = vi.fn(async () => {});
movimientosStock.registrarMovimientoStock = vi.fn(async () => {});
reembolsosCancelacion.aprobarReembolsosCancelacion = vi.fn(async () => ({ total: 160000, costoEnvio: 10000, filas: 2 }));
reembolsosCancelacion.notificarReembolsoAutomatico = vi.fn(async () => {});
facturaPdf.generarFacturaPdf = vi.fn(async () => 'PDF-FACTURA');
notificacionController.crearNotificacion = vi.fn(async () => ({ ok: true }));

const comprasController = require('../../../backend/controllers/comprasController');
const { fmtCOP, MOTIVO_REEMBOLSO_CANCELACION } = reembolsosCancelacion;

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

/** Conexión falsa con mapa por prefijo SQL; respuesta callable puede lanzar. */
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
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

const req = (over = {}) => ({
  user: { ID_USUARIO: 7 },
  params: { id: '9' },
  body: {},
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Pool real: mutación de propiedades del singleton compartido con el SUT.
  db.query = vi.fn(async () => [[]]);
  db.getConnection = vi.fn(async () => conexionFalsa());
});

// ---------------------------------------------------------------------------
// obtenerCompras
// ---------------------------------------------------------------------------
describe('obtenerCompras', () => {
  test('lista ventas con casts y PAGO_CONFIRMADO real por venta', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) {
        return [[
          { ID_VENTA: 9, TOTAL: '160000', DATOS_PAGO: '{"estado":"APPROVED"}' },
          { ID_VENTA: 8, TOTAL: '50000', DATOS_PAGO: null },
        ]];
      }
      if (s.startsWith('SELECT DV.ID_DETALLE')) return [[{ ID_DETALLE: 1, CANTIDAD: 2 }]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerCompras(req(), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toHaveLength(2);
    expect(res.cuerpo[0].TOTAL).toBe(160000);
    expect(res.cuerpo[0].PAGO_CONFIRMADO).toBe(true);
    expect(res.cuerpo[1].PAGO_CONFIRMADO).toBe(false);
    expect(res.cuerpo[0].productos).toEqual([{ ID_DETALLE: 1, CANTIDAD: 2 }]);
  });

  test('DATOS_PAGO con estado fallido → PAGO_CONFIRMADO false', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[{ ID_VENTA: 9, DATOS_PAGO: '{"estado":"DECLINADA"}' }]];
      if (s.startsWith('SELECT DV.ID_DETALLE')) return [[]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerCompras(req(), res);
    expect(res.cuerpo[0].PAGO_CONFIRMADO).toBe(false);
  });

  test('fallo de BD → 500 "Error al obtener compras"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await comprasController.obtenerCompras(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener compras' });
  });
});

// ---------------------------------------------------------------------------
// obtenerCompraPorId
// ---------------------------------------------------------------------------
describe('obtenerCompraPorId', () => {
  const venta = { ID_VENTA: 9, TOTAL: '160000', COSTO_ENVIO: '10000', DATOS_PAGO: '{"estado":"APPROVED"}' };

  test('compra ajena o inexistente → 404', async () => {
    db.query = vi.fn(async () => [[]]);
    const res = resFalsa();
    await comprasController.obtenerCompraPorId(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
  });

  test('feliz: casts, planGenerado y productos', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[venta]];
      if (s.startsWith('SELECT DV.ID_DETALLE')) return [[{ ID_DETALLE: 1 }]];
      if (s.startsWith('SELECT COUNT(*) AS EXISTE FROM PLANES_USUARIO')) return [[{ existe: 1 }]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerCompraPorId(req(), res);
    expect(res.cuerpo.TOTAL).toBe(160000);
    expect(res.cuerpo.COSTO_ENVIO).toBe(10000);
    expect(res.cuerpo.PAGO_CONFIRMADO).toBe(true);
    expect(res.cuerpo.planGenerado).toBe(true);
    expect(res.cuerpo.productos).toEqual([{ ID_DETALLE: 1 }]);
  });

  test('sin plan y sin costo de envío → planGenerado false y COSTO_ENVIO 0', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[{ ...venta, COSTO_ENVIO: null }]];
      if (s.startsWith('SELECT DV.ID_DETALLE')) return [[]];
      if (s.startsWith('SELECT COUNT(*) AS EXISTE FROM PLANES_USUARIO')) return [[{ existe: 0 }]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerCompraPorId(req(), res);
    expect(res.cuerpo.planGenerado).toBe(false);
    expect(res.cuerpo.COSTO_ENVIO).toBe(0);
  });

  test('fallo de BD → 500 "Error al obtener compra"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await comprasController.obtenerCompraPorId(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener compra' });
  });
});

// ---------------------------------------------------------------------------
// cancelarCompra — guardas
// ---------------------------------------------------------------------------
describe('cancelarCompra — guardas', () => {
  test('compra ajena o inexistente → 404 + rollback', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('ya CANCELADA → 400 "Esta compra ya fue cancelada"', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'CANCELADA', DATOS_PAGO: null, ESTADO_ENVIO: 'PENDIENTE' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta compra ya fue cancelada');
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('estado no cancelable (ENVIADA) → 400 "ya no se puede cancelar"', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'ENVIADA', DATOS_PAGO: null, ESTADO_ENVIO: null }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta compra ya no se puede cancelar');
  });

  test('envío EN_CAMINO → 400 "salió del almacén" (RN-010)', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'COMPLETADA', DATOS_PAGO: '{"estado":"APPROVED"}', ESTADO_ENVIO: 'EN_CAMINO' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El pedido ya salió del almacén y no puede cancelarse');
  });

  test('envío ENTREGADO → 400 igual', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'COMPLETADA', DATOS_PAGO: '{"estado":"APPROVED"}', ESTADO_ENVIO: 'ENTREGADO' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El pedido ya salió del almacén y no puede cancelarse');
  });

  test('fallo de BD en el SELECT → 500 + rollback + release', async () => {
    const conn = conexionFalsa({ 'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': () => { throw new Error('boom'); } });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al cancelar compra' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// cancelarCompra — transacción y post-commit
// ---------------------------------------------------------------------------
describe('cancelarCompra — transacción', () => {
  const baseOk = {
    'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'PENDIENTE', DATOS_PAGO: null, ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: '10000' }]],
    'SELECT ID_PRODUCTO, ID_VARIANTE': [
      [
        { ID_PRODUCTO: 4, ID_VARIANTE: null, CANTIDAD: 1, PRECIO_UNITARIO: 50000, SUBTOTAL: 50000 },
        { ID_PRODUCTO: 5, ID_VARIANTE: 9, CANTIDAD: 2, PRECIO_UNITARIO: 25000, SUBTOTAL: 50000 },
      ],
    ],
  };

  test('item sin ID_VARIANTE → continue (solo la variante recibe stock)', async () => {
    const conn = conexionFalsa({ ...baseOk, 'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    const updates = conn.query.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('UPDATE PRODUCTO_VARIANTES'));
    expect(updates).toHaveLength(1);
    expect(updates[0][1]).toEqual([2, 9]);
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalledTimes(1);
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalledWith({ conn, idProducto: 5, tipo: 'ENTRADA', cantidad: 2 });
    expect(res.cuerpo.pagoConfirmado).toBe(false);
  });

  test('PENDIENTE sin cobro: cancela, sin reembolso y campana plana', async () => {
    const conn = conexionFalsa({ ...baseOk, 'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Compra cancelada', pagoConfirmado: false, reembolso: null });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(reembolsosCancelacion.aprobarReembolsosCancelacion).not.toHaveBeenCalled();
    expect(reembolsosCancelacion.notificarReembolsoAutomatico).not.toHaveBeenCalled();
    expect(estadoPedido.notificarCambioEstado).toHaveBeenCalledWith('9', 'venta', 'CANCELADA');
    const updateVenta = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE VENTAS SET ESTADO'));
    expect(updateVenta[1]).toEqual(['9']);
    const updateEnvio = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE ENVIOS SET ESTADO_ENVIO'));
    expect(updateEnvio[1]).toEqual(['9']);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: null, tipo: 'pedido', titulo: '🚫 Pedido cancelado', ruta: '/admin/ordenes',
    }));
    const campana = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(campana.mensaje).toBe('Pedido #9 fue cancelado por el cliente.');
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('COMPLETADA pagada: reembolso automático con envío + notificarReembolsoAutomatico', async () => {
    const conn = conexionFalsa({
      'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'COMPLETADA', DATOS_PAGO: '{"estado":"APPROVED"}', ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: '10000' }]],
      'SELECT ID_PRODUCTO, ID_VARIANTE': [[{ ID_PRODUCTO: 5, ID_VARIANTE: 9, CANTIDAD: 2, PRECIO_UNITARIO: 25000, SUBTOTAL: 50000 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.cuerpo.msg).toBe(`Compra cancelada. Reembolso de ${fmtCOP(160000)} aprobado automáticamente (incluye el costo de envío).`);
    expect(res.cuerpo.pagoConfirmado).toBe(true);
    expect(res.cuerpo.reembolso).toEqual({ total: 160000, costoEnvio: 10000, filas: 2 });
    expect(reembolsosCancelacion.aprobarReembolsosCancelacion).toHaveBeenCalledWith(conn, {
      idUsuario: 7, idVenta: '9', detalles: [{ ID_PRODUCTO: 5, ID_VARIANTE: 9, CANTIDAD: 2, PRECIO_UNITARIO: 25000, SUBTOTAL: 50000 }], costoEnvio: 10000,
    });
    expect(reembolsosCancelacion.notificarReembolsoAutomatico).toHaveBeenCalledWith(7, '9', 160000, 10000);
    const campana = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(campana.mensaje).toBe(`Pedido #9 fue cancelado por el cliente. Reembolso automático aprobado: ${fmtCOP(160000)} (incluye el costo de envío).`);
  });

  test('reembolso sin costo de envío → mensaje corto y campana corta', async () => {
    reembolsosCancelacion.aprobarReembolsosCancelacion.mockImplementationOnce(async () => ({ total: 150000, costoEnvio: 0, filas: 1 }));
    const conn = conexionFalsa({
      'SELECT V.ESTADO, V.DATOS_PAGO, E.ESTADO_ENVIO': [[{ ESTADO: 'COMPLETADA', DATOS_PAGO: '{"estado":"APPROVED"}', ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: null }]],
      'SELECT ID_PRODUCTO, ID_VARIANTE': [[{ ID_PRODUCTO: 5, ID_VARIANTE: 9, CANTIDAD: 1, PRECIO_UNITARIO: 150000, SUBTOTAL: 150000 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.cuerpo.msg).toBe(`Compra cancelada. Reembolso de ${fmtCOP(150000)} aprobado automáticamente.`);
    expect(reembolsosCancelacion.aprobarReembolsosCancelacion).toHaveBeenCalledWith(conn, expect.objectContaining({ costoEnvio: 0 }));
    const campana = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(campana.mensaje).toBe(`Pedido #9 fue cancelado por el cliente. Reembolso automático aprobado: ${fmtCOP(150000)}.`);
  });

  test('notificarCambioEstado lanza → no bloquea la respuesta', async () => {
    estadoPedido.notificarCambioEstado.mockImplementationOnce(async () => { throw new Error('correo caído'); });
    const conn = conexionFalsa({ ...baseOk, 'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.msg).toBe('Compra cancelada');
  });

  test('campana admin lanza → no bloquea la respuesta', async () => {
    notificacionController.crearNotificacion.mockImplementationOnce(async () => { throw new Error('campana caída'); });
    const conn = conexionFalsa({ ...baseOk, 'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
  });

  test('fallo en el UPDATE de stock → 500 + rollback', async () => {
    const conn = conexionFalsa({
      ...baseOk,
      'UPDATE PRODUCTO_VARIANTES SET STOCK': () => { throw new Error('boom'); },
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.cancelarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al cancelar compra' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// solicitarReembolso
// ---------------------------------------------------------------------------
describe('solicitarReembolso', () => {
  const ventaCancelada = { ESTADO: 'CANCELADA', DATOS_PAGO: '{"estado":"APPROVED"}' };
  const baseOk = {
    'SELECT ESTADO, DATOS_PAGO FROM VENTAS': [[ventaCancelada]],
    'SELECT ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL FROM DETALLE_VENTAS': [[{ ID_PRODUCTO: 5, CANTIDAD: 2, PRECIO_UNITARIO: 25000, SUBTOTAL: 50000 }]],
    'SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS': [[{ ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: '10000' }]],
    'SELECT TIPO, MOTIVO, ESTADO FROM DEVOLUCIONES': [[]],
  };

  test('compra ajena → 404', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO, DATOS_PAGO FROM VENTAS': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('no cancelada → 400 "Solo puedes solicitar reembolso de pedidos cancelados"', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO, DATOS_PAGO FROM VENTAS': [[{ ESTADO: 'COMPLETADA', DATOS_PAGO: '{"estado":"APPROVED"}' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo puedes solicitar reembolso de pedidos cancelados');
  });

  test('sin pago confirmado → 400 "No registramos un pago confirmado..."', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO, DATOS_PAGO FROM VENTAS': [[{ ESTADO: 'CANCELADA', DATOS_PAGO: null }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('No registramos un pago confirmado para este pedido, así que no hay un cobro que reembolsar.');
  });

  test('pedido sin productos → 400 "El pedido no tiene productos"', async () => {
    const conn = conexionFalsa({ ...baseOk, 'SELECT ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL FROM DETALLE_VENTAS': [[]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El pedido no tiene productos');
  });

  test('solicitud distinta activa → 400 "Ya solicitaste un reembolso para este pedido"', async () => {
    const conn = conexionFalsa({ ...baseOk, 'SELECT TIPO, MOTIVO, ESTADO FROM DEVOLUCIONES': [[{ TIPO: 'DEVOLUCION', MOTIVO: 'Otro motivo', ESTADO: 'SOLICITADA' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Ya solicitaste un reembolso para este pedido');
  });

  test('solicitud previa del MISMO reembolso automático no bloquea', async () => {
    const conn = conexionFalsa({ ...baseOk, 'SELECT TIPO, MOTIVO, ESTADO FROM DEVOLUCIONES': [[{ TIPO: 'REEMBOLSO', MOTIVO: MOTIVO_REEMBOLSO_CANCELACION, ESTADO: 'SOLICITADA' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.ok).toBe(true);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('feliz: reembolso aprobado automático con envío no salido', async () => {
    const conn = conexionFalsa(baseOk);
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Reembolso aprobado automáticamente', pagoConfirmado: true, reembolso: { total: 160000, costoEnvio: 10000, filas: 2 } });
    expect(reembolsosCancelacion.aprobarReembolsosCancelacion).toHaveBeenCalledWith(conn, {
      idUsuario: 7, idVenta: '9', detalles: baseOk['SELECT ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL FROM DETALLE_VENTAS'][0], costoEnvio: 10000,
    });
    expect(reembolsosCancelacion.notificarReembolsoAutomatico).toHaveBeenCalledWith(7, '9', 160000, 10000);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('envío salido (EN_CAMINO) → costoEnvio 0 en el cálculo', async () => {
    const conn = conexionFalsa({ ...baseOk, 'SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS': [[{ ESTADO_ENVIO: 'EN_CAMINO', COSTO_ENVIO: '10000' }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(reembolsosCancelacion.aprobarReembolsosCancelacion).toHaveBeenCalledWith(conn, expect.objectContaining({ costoEnvio: 0 }));
    expect(res.cuerpo.ok).toBe(true);
  });

  test('reembolso con total 0 o sin filas → sin notificarReembolsoAutomatico, reembolso null', async () => {
    reembolsosCancelacion.aprobarReembolsosCancelacion.mockImplementationOnce(async () => ({ total: 0, costoEnvio: 0, filas: 0 }));
    const conn = conexionFalsa(baseOk);
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(reembolsosCancelacion.notificarReembolsoAutomatico).not.toHaveBeenCalled();
    expect(res.cuerpo.reembolso).toBeNull();
  });

  test('fallo de BD → 500 + rollback', async () => {
    const conn = conexionFalsa({ 'SELECT ESTADO, DATOS_PAGO FROM VENTAS': () => { throw new Error('boom'); } });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await comprasController.solicitarReembolso(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al solicitar reembolso' });
    expect(conn.rollback).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// obtenerReembolso
// ---------------------------------------------------------------------------
describe('obtenerReembolso', () => {
  test('compra ajena → 404', async () => {
    db.query = vi.fn(async () => [[]]);
    const res = resFalsa();
    await comprasController.obtenerReembolso(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
  });

  test('feliz: totalProductos + envío reembolsado + automatico', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) {
        return [[{ ID_VENTA: 9, TOTAL: '160000', ESTADO: 'CANCELADA', DATOS_PAGO: '{"estado":"APPROVED"}', ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: '10000' }]];
      }
      if (s.startsWith('SELECT DV.ID_DEVOLUCION')) {
        return [[{ ID_DEVOLUCION: 1, ESTADO: 'APROBADA', PRECIO_UNITARIO: '50000', CANTIDAD: 2, TIPO: 'REEMBOLSO', MOTIVO: MOTIVO_REEMBOLSO_CANCELACION }]];
      }
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerReembolso(req(), res);
    expect(res.cuerpo.totalProductos).toBe(100000);
    expect(res.cuerpo.envioSalido).toBe(false);
    expect(res.cuerpo.envioReembolsado).toBe(10000);
    expect(res.cuerpo.totalReembolso).toBe(110000);
    expect(res.cuerpo.automatico).toBe(true);
    expect(res.cuerpo.PAGO_CONFIRMADO).toBe(true);
  });

  test('sin reembolsos aprobados: envío no cuenta y automatico false', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) {
        return [[{ ID_VENTA: 9, TOTAL: '160000', ESTADO: 'CANCELADA', DATOS_PAGO: null, ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: '10000' }]];
      }
      if (s.startsWith('SELECT DV.ID_DEVOLUCION')) {
        return [[{ ID_DEVOLUCION: 1, ESTADO: 'SOLICITADA', PRECIO_UNITARIO: '50000', CANTIDAD: 2, TIPO: 'DEVOLUCION', MOTIVO: 'Otro' }]];
      }
      return [[]];
    });
    const res = resFalsa();
    await comprasController.obtenerReembolso(req(), res);
    expect(res.cuerpo.totalProductos).toBe(0);
    expect(res.cuerpo.envioReembolsado).toBe(0);
    expect(res.cuerpo.totalReembolso).toBe(0);
    expect(res.cuerpo.automatico).toBe(false);
  });

  test('fallo de BD → 500 "Error al obtener el reembolso"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await comprasController.obtenerReembolso(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener el reembolso' });
  });
});

// ---------------------------------------------------------------------------
// actualizarDireccionCompra
// ---------------------------------------------------------------------------
describe('actualizarDireccionCompra', () => {
  const body = { direccion: 'Calle 1', barrio: 'Centro', ciudad: 'Cali', departamento: 'Valle', codigoPostal: '76001', telefono: '3001112233' };

  test('compra ajena → 404', async () => {
    db.query = vi.fn(async () => [[]]);
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
  });

  test('cancelada → 400 "No puedes editar la dirección de una compra cancelada"', async () => {
    db.query = vi.fn(async () => [[{ ESTADO: 'CANCELADA' }]]);
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('No puedes editar la dirección de una compra cancelada');
  });

  test('venta ENVIADA (legado) → 400 "ya está en camino"', async () => {
    db.query = vi.fn(async () => [[{ ESTADO: 'ENVIADA' }]]);
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('No puedes editar la dirección porque el pedido ya está en camino');
  });

  test('envío EN_CAMINO → 400 "salió del almacén"', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ESTADO FROM VENTAS')) return [[{ ESTADO: 'PENDIENTE' }]];
      if (s.startsWith('SELECT ESTADO_ENVIO FROM ENVIOS')) return [[{ ESTADO_ENVIO: 'EN_CAMINO' }]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('No puedes editar la dirección porque el pedido ya salió del almacén');
  });

  test('con envío existente → UPDATE de la dirección', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ESTADO FROM VENTAS')) return [[{ ESTADO: 'PENDIENTE' }]];
      if (s.startsWith('SELECT ESTADO_ENVIO FROM ENVIOS')) return [[{ ESTADO_ENVIO: 'PENDIENTE' }]];
      return [[]];
    });
    db.query = dbq;
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req({ body }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Dirección actualizada' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE ENVIOS SET DIRECCION_ENVIO'));
    expect(update[1]).toEqual(['Calle 1', 'Centro', 'Cali', 'Valle', '76001', '3001112233', '9']);
  });

  test('sin fila ENVIOS → INSERT con PENDIENTE y costo 0', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ESTADO FROM VENTAS')) return [[{ ESTADO: 'PENDIENTE' }]];
      if (s.startsWith('SELECT ESTADO_ENVIO FROM ENVIOS')) return [[]];
      return [[]];
    });
    db.query = dbq;
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req({ body }), res);
    expect(res.cuerpo.ok).toBe(true);
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO ENVIOS'));
    expect(insert[1]).toEqual(['9', 'Calle 1', 'Centro', 'Cali', 'Valle', '76001', '3001112233']);
  });

  test('body vacío: campos por defecto (|| \'\')', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ESTADO FROM VENTAS')) return [[{ ESTADO: 'PENDIENTE' }]];
      if (s.startsWith('SELECT ESTADO_ENVIO FROM ENVIOS')) return [[{ ESTADO_ENVIO: 'PENDIENTE' }]];
      return [[]];
    });
    db.query = dbq;
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE ENVIOS SET DIRECCION_ENVIO'));
    expect(update[1]).toEqual(['', '', '', '', '', '', '9']);
  });

  test('fallo de BD → 500 "Error al actualizar dirección"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await comprasController.actualizarDireccionCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar dirección' });
  });
});

// ---------------------------------------------------------------------------
// descargarFactura
// ---------------------------------------------------------------------------
describe('descargarFactura', () => {
  const venta = { ID_VENTA: 9, TOTAL: '160000', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez', EMAIL: 'ana@test.com', METODO_PAGO: 'Visa' };

  test('compra ajena → 404', async () => {
    db.query = vi.fn(async () => [[]]);
    const res = resFalsa();
    await comprasController.descargarFactura(req(), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Compra no encontrada' });
    expect(facturaPdf.generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('feliz: PDF con cabeceras y payload', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[venta]];
      if (s.startsWith('SELECT DV.CANTIDAD, DV.PRECIO_UNITARIO')) return [[{ CANTIDAD: 1, NOMBRE: 'Guayos' }]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.descargarFactura(req(), res);
    expect(res.h['Content-Type']).toBe('application/pdf');
    expect(res.h['Content-Disposition']).toBe('attachment; filename="factura-9.pdf"');
    expect(res.enviado).toBe('PDF-FACTURA');
    const argumento = facturaPdf.generarFacturaPdf.mock.calls[0][0];
    expect(argumento.venta).toEqual(venta);
    expect(argumento.usuario).toEqual({ NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez', EMAIL: 'ana@test.com' });
    expect(argumento.items).toEqual([{ CANTIDAD: 1, NOMBRE: 'Guayos' }]);
    expect(argumento.metodoPago).toBe('Visa');
    expect(argumento.envio).toEqual(venta);
  });

  test('id no numérico → filename factura-0.pdf', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[venta]];
      if (s.startsWith('SELECT DV.CANTIDAD, DV.PRECIO_UNITARIO')) return [[]];
      return [[]];
    });
    const res = resFalsa();
    await comprasController.descargarFactura(req({ params: { id: 'abc' } }), res);
    expect(res.h['Content-Disposition']).toBe('attachment; filename="factura-0.pdf"');
  });

  test('fallo del generador → 500 "Error al generar la factura"', async () => {
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT V.ID_VENTA, V.FECHA_VENTA')) return [[venta]];
      if (s.startsWith('SELECT DV.CANTIDAD, DV.PRECIO_UNITARIO')) return [[]];
      return [[]];
    });
    facturaPdf.generarFacturaPdf.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await comprasController.descargarFactura(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar la factura' });
  });
});

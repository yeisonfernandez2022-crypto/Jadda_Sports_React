/**
 * pagosController — suite unitaria del ciclo Wompi COMPLETO.
 *
 * La BD se inyecta con exports._useDb (patrón P7/P10) y las dependencias
 * (utils/pagos, mailer, notificaciones, factura) se MUTAN ANTES de requerir
 * el SUT — los destructures del controller capturan esas referencias.
 *
 * NOTA DE INFRA (lección de la suite): vi.mock NO intercepta en este setup
 * de Vitest con archivos CJS (authRoutes/planController evitan vi.mock por
 * eso: inyección + mutación previa al require del SUT es el patrón que
 * funciona — esto incluye NO usar `import` en el archivo).
 */

const { vi, beforeEach, describe, test, expect } = (() => {
  // globals: true — vi/describe/test/expect ya son globales; este IIFE es
  // solo documental para quien lea sin el contexto del config.
  return globalThis;
})();

const pagos = require('../../../backend/utils/pagos');
const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');
const facturaPdf = require('../../../backend/utils/facturaPdf');
const correo = require('../../../backend/utils/correo');
const validarCorreoMod = require('../../../backend/utils/validarCorreo');
const movimientos = require('../../../backend/utils/movimientosStock');

/** Mutaciones ANTES del require del SUT (los destructures las capturan). */
const pagosFalso = {
  gatewayActivo: vi.fn(() => true),
  esAmbientePruebas: vi.fn(() => true),
  urlCheckoutWompi: vi.fn(() => 'https://checkout.wompi.co/p/?public-key=pub_test'),
  nuevaReferenciaSimulada: vi.fn((id) => `SIMW-${id}-test`),
  resultadoSimulacion: vi.fn((numero) => (String(numero).endsWith('1111') ? 'DECLINED' : 'APPROVED')),
  marcaTarjeta: vi.fn(() => 'visa'),
  vencimientoValido: vi.fn((v) => /^\d{2}\/\d{2}$/.test(v || '')),
  pagoVencido: vi.fn(() => false),
  esVentaSimulada: vi.fn((ref) => String(ref || '').startsWith('SIMW-')),
  fechaSimulacionDeReferencia: vi.fn(() => null),
  buscarTransaccionesPorReferencia: vi.fn(async () => []),
  obtenerTransaccionWompi: vi.fn(async () => null),
  verificarEventosWompi: vi.fn(() => true),
};
Object.assign(pagos, pagosFalso);
const MINUTOS_EXPIRACION = pagos.MINUTOS_EXPIRACION;
const SEGUNDOS_SIMULACION = pagos.SEGUNDOS_SIMULACION;
mailer.sendMail = vi.fn(async () => ({}));
notificacionController.crearNotificacion = vi.fn(async () => ({}));
facturaPdf.generarFacturaPdf = vi.fn(async () => Buffer.from('%PDF'));
correo.plantillaCorreo = vi.fn(() => '<html>correo</html>');
correo.escaparHtml = vi.fn((s) => s);
validarCorreoMod.correoValido = vi.fn((v) => /.+@.+\..+/.test(v || ''));
movimientos.registrarMovimientoStock = vi.fn(async () => ({}));

// AHORA sí: el SUT carga con las dependencias ya mutadas
const pagosController = require('../../../backend/controllers/pagosController');

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.get = vi.fn();
  return res;
};

/** BD falsa por SQL-prefix: cada "SELECT ID_VENTA..." etc. devuelve su fila. */
function dbFalsa(mapa = {}) {
  const operaciones = [];
  const connFalsa = {
    query: vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      operaciones.push(s);
      if (s.startsWith('SELECT ESTADO FROM VENTAS') && s.includes('FOR UPDATE')) {
        return [[{ ESTADO: 'PENDIENTE_PAGO' }]];
      }
      if (s.startsWith('SELECT ID_VARIANTE') || s.startsWith('SELECT ID_PRODUCTO')) return mapa.conn?.items ?? mapa.items ?? [[]];
      return [[]];
    }),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  return {
    operaciones,
    conn: connFalsa,
    query: vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      operaciones.push(s);
      if (s.startsWith('SELECT ESTADO FROM VENTAS') && !s.includes('FOR UPDATE')) {
        return [[{ ESTADO: mapa.estadoTrasConfirmar ?? 'CONFIRMADA' }]];
      }
      if (s.startsWith('SELECT ID_PRODUCTO')) return mapa.items ?? [[]];
      for (const [clave, respuesta] of Object.entries(mapa)) {
        if (clave === 'conn') continue;
        if (s.startsWith(clave.toUpperCase())) return typeof respuesta === 'function' ? respuesta(params) : respuesta;
      }
      if (s.startsWith('SELECT P.ID, P.NOMBRE, P.ID_VENDEDOR')) return [[]]; // vendedores de los items
      return [{}];
    }),
    getConnection: vi.fn(async () => connFalsa),
  };
}

const USER = { ID_USUARIO: 7 };
const ventaPendiente = { ID_VENTA: 15, ID_CLIENTE: 7, TOTAL: 120000, ESTADO: 'PENDIENTE_PAGO', REFERENCIA_PAGO: 'JADDA-15-x', FECHA_EXPIRA_PAGO: '2030-01-01', DATOS_PAGO: null, EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez', ID_METODO: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  pagosFalso.gatewayActivo.mockReturnValue(true);
  pagosFalso.esAmbientePruebas.mockReturnValue(true);
  pagosFalso.pagoVencido.mockReturnValue(false);
  pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([]);
  pagosFalso.obtenerTransaccionWompi.mockResolvedValue(null);
  pagosFalso.verificarEventosWompi.mockReturnValue(true);
  pagosFalso.fechaSimulacionDeReferencia.mockReturnValue(null);
  pagosFalso.urlCheckoutWompi.mockReturnValue('https://checkout.wompi.co/p/?public-key=pub_test');
  mailer.sendMail = vi.fn(async () => ({}));
});

describe('configPagos', () => {
  test('activo + sandbox → gateway wompi y pruebas true', () => {
    const res = resFalsa();
    pagosController.configPagos({}, res);
    expect(res.cuerpo).toEqual({ ok: true, gateway: 'wompi', pruebas: true });
  });

  test('pasarela apagada → gateway null (el front no muestra Wompi)', () => {
    pagosFalso.gatewayActivo.mockReturnValue(false);
    const res = resFalsa();
    pagosController.configPagos({}, res);
    expect(res.cuerpo.gateway).toBeNull();
    expect(res.cuerpo.pruebas).toBe(false);
  });
});

describe('crearSesionPago', () => {
  test('pasarela apagada → 400', async () => {
    pagosFalso.gatewayActivo.mockReturnValue(false);
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 1 }, user: USER }, res);
    expect(res.codigo).toBe(400);
  });

  test('idVenta inválido → 400', async () => {
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 'x' }, user: USER }, res);
    expect(res.codigo).toBe(400);
  });

  test.each([
    [null, 'Pedido no encontrado'],
    [{ ...ventaPendiente, ID_CLIENTE: 99 }, 'Pedido no encontrado'],
    [{ ...ventaPendiente, ESTADO: 'CONFIRMADA' }, 'ya está pagado'],
    [{ ...ventaPendiente, ESTADO: 'CANCELADA' }, 'fue cancelado'],
    [{ ...ventaPendiente, ESTADO: 'COMPLETADA' }, 'en estado COMPLETADA'],
  ])('guard de dueño y estado → 400/404 (%j)', async (fila, mensaje) => {
    const db = dbFalsa({ 'SELECT V.*': [[fila]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 15 }, user: USER }, res);
    expect([400, 404]).toContain(res.codigo);
    expect(res.cuerpo.message).toContain(mensaje);
  });

  test('venta pendiente propia: renueva referencia y devuelve URL de checkout', async () => {
    const db = dbFalsa({
      'SELECT V.*': [[ventaPendiente]],
      'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 1 }],
      'SELECT TITULAR': [[]],
      'SELECT DIRECCION_ENVIO': [[]],
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.referencia).toMatch(/^JADDA-15-/);
    expect(res.cuerpo.urlCheckout).toContain('checkout.wompi.co');
  });

  test('la venta dejó de estar pendiente en el UPDATE → 409 (carrera de reintentos)', async () => {
    const db = dbFalsa({
      'SELECT V.*': [[ventaPendiente]],
      'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 0 }],
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 15 }, user: USER }, res);
    expect(res.codigo).toBe(409);
  });

  test('fallo armando la URL → 500 con mensaje amable', async () => {
    pagosFalso.urlCheckoutWompi.mockImplementationOnce(() => { throw new Error('llaves malas'); });
    const db = dbFalsa({
      'SELECT V.*': [[ventaPendiente]],
      'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 1 }],
      'SELECT TITULAR': [[]],
      'SELECT DIRECCION_ENVIO': [[]],
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.crearSesionPago({ body: { idVenta: 15 }, user: USER }, res);
    expect(res.codigo).toBe(500);
  });
});

describe('simularPago (sandbox)', () => {
  const bodyOk = { idVenta: 15, numero: '4242424242424242', titular: 'Probe Sim', vencimiento: '12/30' };

  test('sin sandbox → 400', async () => {
    pagosFalso.gatewayActivo.mockReturnValue(false);
    const res = resFalsa();
    await pagosController.simularPago({ body: bodyOk, user: USER }, res);
    expect(res.codigo).toBe(400);
  });

  test('validaciones: número corto, sin titular, vencimiento inválida → 400', async () => {
    const db = dbFalsa({});
    pagosController._useDb(db);
    const res1 = resFalsa();
    await pagosController.simularPago({ body: { ...bodyOk, numero: '123' }, user: USER }, res1);
    expect(res1.codigo).toBe(400);
    const res2 = resFalsa();
    await pagosController.simularPago({ body: { ...bodyOk, titular: '' }, user: USER }, res2);
    expect(res2.codigo).toBe(400);
    const res3 = resFalsa();
    await pagosController.simularPago({ body: { ...bodyOk, vencimiento: '2029' }, user: USER }, res3);
    expect(res3.codigo).toBe(400);
  });

  test('cobro aprobado: referencia SIMW- y el número completo NUNCA se guarda', async () => {
    const db = dbFalsa({ 'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 1 }] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.simularPago({ body: bodyOk, user: USER }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.referencia).toMatch(/^SIMW-15-/);
    expect(res.cuerpo.resultado).toBe('APPROVED');
    const updateCall = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE VENTAS'));
    expect(JSON.stringify(updateCall?.[1] ?? [])).not.toContain('4242424242424242');
  });

  test('tarjeta terminada en 1111 → DECLINED (el pull la cancela/reintenta)', async () => {
    const db = dbFalsa({ 'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 1 }] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.simularPago({ body: { ...bodyOk, numero: '4111111111111111' }, user: USER }, res);
    expect(res.cuerpo.resultado).toBe('DECLINED');
  });

  test('la venta ya no está pendiente → 409', async () => {
    const db = dbFalsa({ 'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 0 }] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.simularPago({ body: bodyOk, user: USER }, res);
    expect(res.codigo).toBe(409);
  });
});

describe('estadoVenta (pull)', () => {
  test('idVenta inválido → 400; venta ajena → 404', async () => {
    const db = dbFalsa({});
    pagosController._useDb(db);
    const res1 = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 'x' }, user: USER }, res1);
    expect(res1.codigo).toBe(400);
    const res2 = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 999 }, user: USER }, res2);
    expect(res2.codigo).toBe(404);
  });

  test('venta ya confirmada → estado directo sin consultar Wompi', async () => {
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[{ ...ventaPendiente, ESTADO: 'CONFIRMADA' }]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(res.cuerpo.transaccion).toBeNull();
  });

  test('pasarela apagada con venta pendiente → transaccion null (modo legacy)', async () => {
    pagosFalso.gatewayActivo.mockReturnValue(false);
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO');
    expect(res.cuerpo.transaccion).toBeNull();
  });

  test('sin referencia y VENCIDA → cancela (reingresa stock) y responde CANCELADA', async () => {
    pagosFalso.pagoVencido.mockReturnValue(true);
    const db = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE': [[{ ...ventaPendiente, REFERENCIA_PAGO: null }]],
      conn: { items: [[{ ID_VARIANTE: 5, ID_PRODUCTO: 1, CANTIDAD: 1 }]] },
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('CANCELADA');
    expect(db.conn.query.mock.calls.some((c) => String(c[0]).includes('PRODUCTO_VARIANTES'))).toBe(true);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Pedido cancelado ⏰' }));
  });

  test('simulada EN ESPERA → transacción PENDING (el front muestra el reloj)', async () => {
    pagosFalso.fechaSimulacionDeReferencia.mockReturnValue(new Date());
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[{ ...ventaPendiente, REFERENCIA_PAGO: 'SIMW-15-test' }]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO');
    expect(res.cuerpo.transaccion.status).toBe('PENDING');
  });

  test('simulada DECLINED (pasado el reloj) → estado DECLINADA y la venta sigue pendiente', async () => {
    pagosFalso.fechaSimulacionDeReferencia.mockReturnValue(new Date(Date.now() - 60000));
    const db = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE': [[{ ...ventaPendiente, REFERENCIA_PAGO: 'SIMW-15-test', DATOS_PAGO: JSON.stringify({ simulacion: true, resultado: 'DECLINED' }) }]],
      estadoTrasConfirmar: 'PENDIENTE_PAGO',
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('DECLINADA');
    expect(res.cuerpo.transaccion.status).toBe('DECLINED');
  });

  test('simulada APPROVED (pasado el reloj) → confirma: notificaciones + factura + correo', async () => {
    pagosFalso.fechaSimulacionDeReferencia.mockReturnValue(new Date(Date.now() - 60000));
    const db = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE': [[{ ...ventaPendiente, REFERENCIA_PAGO: 'SIMW-15-test', DATOS_PAGO: JSON.stringify({ simulacion: true, resultado: 'APPROVED', brand: 'visa', last4: '4242' }) }]],
      'SELECT V.*': [[ventaPendiente]],
      'SELECT P.NOMBRE AS NOMBRE': [[{ NOMBRE: 'Guayos', CANTIDAD: 1, PRECIO_UNITARIO: 120000, SUBTOTAL: 120000, ID_PRODUCTO: 1, URL_IMAGEN: '/x.png' }]],
      estadoTrasConfirmar: 'CONFIRMADA',
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ titulo: '¡Pago confirmado! 🛒' }));
    expect(facturaPdf.generarFacturaPdf).toHaveBeenCalled();
    expect(mailer.sendMail).toHaveBeenCalled();
  });

  test('transacción real APPROVED confirma; monto distinto NO confirma (advertencia)', async () => {
    const tx = { id: 'tx1', reference: 'JADDA-15-x', amount_in_cents: 12000000, status: 'APPROVED', payment_method: { type: 'CARD' }, created_at: '2026-01-01' };
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([tx]);
    const db = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]],
      estadoTrasConfirmar: 'CONFIRMADA',
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');

    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([{ ...tx, amount_in_cents: 999 }]);
    const db2 = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]],
      estadoTrasConfirmar: 'PENDIENTE_PAGO',
    });
    pagosController._useDb(db2);
    const res2 = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res2);
    expect(res2.cuerpo.estado).toBe('PENDIENTE_PAGO');
    expect(res2.cuerpo.advertencia).toContain('monto distinto');
  });

  test('VOIDED → cancela; DECLINED vigente → DECLINADA reintentable; DECLINED vencida → CANCELADA', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([{ id: 'tx2', reference: 'JADDA-15-x', amount_in_cents: 12000000, status: 'VOIDED' }]);
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('CANCELADA');

    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([{ id: 'tx3', reference: 'JADDA-15-x', amount_in_cents: 12000000, status: 'DECLINED', status_message: 'Número no válido' }]);
    const db2 = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]] });
    pagosController._useDb(db2);
    const res2 = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res2);
    expect(res2.cuerpo.estado).toBe('DECLINADA');
    expect(res2.cuerpo.transaccion.mensaje).toBe('Número no válido');

    pagosFalso.pagoVencido.mockReturnValue(true);
    const db3 = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]] });
    pagosController._useDb(db3);
    const res3 = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res3);
    expect(res3.cuerpo.estado).toBe('CANCELADA');
  });

  test('sin transacción y vigente → sigue PENDIENTE_PAGO (el front re-polléa)', async () => {
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE': [[ventaPendiente]] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.estadoVenta({ params: { idVenta: 15 }, user: USER }, res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO');
    expect(res.cuerpo.transaccion).toBeNull();
  });
});

describe('webhookWompi', () => {
  const evento = (over = {}) => ({
    event: 'transaction.updated',
    data: { transaction: { id: 'tx-ext-1', reference: 'JADDA-15-x', status: 'APPROVED', amount_in_cents: 12000000 } },
    signature: { checksum: 'abc123' },
    ...over,
  });

  test('firma inválida → 403 + registro FIRMA_INVALIDA', async () => {
    pagosFalso.verificarEventosWompi.mockReturnValue(false);
    const db = dbFalsa({});
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento(), get: vi.fn() }, res);
    expect(res.codigo).toBe(403);
    expect(db.query.mock.calls.some((c) => String(c[0]).includes('FIRMA_INVALIDA'))).toBe(true);
  });

  test('evento no-transaction → 200 ignorado sin consultar Wompi', async () => {
    const db = dbFalsa({ 'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento({ event: 'token.updated' }), get: vi.fn() }, res);
    expect(res.cuerpo.estado).toBe('ignorado');
  });

  test('evento válido: re-consulta la transacción y CONFIRMA la venta', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue({ id: 'tx-ext-1', reference: 'JADDA-15-x', status: 'APPROVED', amount_in_cents: 12000000, payment_method: { type: 'CARD' } });
    const db = dbFalsa({
      'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }],
      'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[ventaPendiente]],
      estadoTrasConfirmar: 'CONFIRMADA',
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento(), get: vi.fn() }, res);
    expect(res.cuerpo.estado).toBe('procesado');
  });

  test('transacción que la API no confirma → 200 sin actuar (nunca se confía en el payload)', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue(null);
    const db = dbFalsa({ 'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }] });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento(), get: vi.fn() }, res);
    expect(res.cuerpo.estado).toBe('transaccion_no_verificada');
  });

  test('venta no encontrada por la referencia → 200 venta_no_encontrada (Wompi no reintenta)', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue({ id: 'tx-ext-2', reference: 'JADDA-404-x', status: 'APPROVED' });
    const db = dbFalsa({
      'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }],
      'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[]],
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento(), get: vi.fn() }, res);
    expect(res.cuerpo.estado).toBe('venta_no_encontrada');
  });

  test('evento duplicado (affectedRows 0) se procesa igual pero marca duplicado_procesado', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue({ id: 'tx-ext-1', reference: 'JADDA-15-x', status: 'APPROVED', amount_in_cents: 12000000 });
    const db = dbFalsa({
      'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 0 }],
      'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[ventaPendiente]],
      estadoTrasConfirmar: 'CONFIRMADA',
    });
    pagosController._useDb(db);
    const res = resFalsa();
    await pagosController.webhookWompi({ body: evento(), get: vi.fn() }, res);
    expect(res.cuerpo.estado).toBe('duplicado_procesado');
  });
});

describe('expirarVentasPendientes (job)', () => {
  test('cancela las vencidas y cuenta; las ya-canceladas no cuentan', async () => {
    const db = dbFalsa({
      'SELECT ID_VENTA, ID_CLIENTE FROM VENTAS': [[{ ID_VENTA: 1, ID_CLIENTE: 7 }, { ID_VENTA: 2, ID_CLIENTE: 8 }]],
    });
    let conteo = 0;
    db.conn.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.includes('SELECT ESTADO FROM VENTAS') && s.includes('FOR UPDATE')) {
        conteo += 1;
        return conteo === 1 ? [[{ ESTADO: 'PENDIENTE_PAGO' }]] : [[{ ESTADO: 'CANCELADA' }]];
      }
      if (s.startsWith('SELECT ID_VARIANTE') || s.startsWith('SELECT ID_PRODUCTO')) return [[{ ID_VARIANTE: 5, ID_PRODUCTO: 1, CANTIDAD: 1 }]];
      return [[]];
    });
    pagosController._useDb(db);
    const r = await pagosController.expirarVentasPendientes();
    expect(r.revisadas).toBe(2);
    expect(r.expiradas).toBe(1);
  });

  test('sin vencidas → 0/0', async () => {
    const db = dbFalsa({ 'SELECT ID_VENTA, ID_CLIENTE FROM VENTAS': [[]] });
    pagosController._useDb(db);
    const r = await pagosController.expirarVentasPendientes();
    expect(r).toEqual({ expiradas: 0, revisadas: 0 });
  });
});

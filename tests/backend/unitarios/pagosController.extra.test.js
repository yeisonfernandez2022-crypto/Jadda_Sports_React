/**
 * pagosController — caminos que la suite base (pagosController.test.js) no
 * cubre: el comparador de transacciones por fecha (pull con ≥2 transacciones
 * de la misma referencia), los guardas de confirmarPagoWompi (fila
 * desaparecida, duplicado, ignorado, UPDATE ID_METODO tolerante), los estados
 * residuales del pull (ERROR, PENDING desconocido, sin transacción vencida,
 * sin referencia vigente), la simulación con DATOS_PAGO corrupto, las
 * tolerancias de notificarVentaConfirmada (DATOS_PAGO objeto, medio
 * desconocido, correo inválido, PDF y notificaciones que fallan), los catch
 * del webhook (registro, vinculación, duplicado) y el job con cancelación
 * fallida. Suite NUEVA: la base no se edita.
 * Deps destructuradas en carga se mutan ANTES del require; `pagos` se
 * reemplaza por Object.assign (el controller lo usa como módulo).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const pagos = require('../../../backend/utils/pagos');
const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');
const facturaPdf = require('../../../backend/utils/facturaPdf');
const correo = require('../../../backend/utils/correo');
const validarCorreoMod = require('../../../backend/utils/validarCorreo');
const movimientos = require('../../../backend/utils/movimientosStock');
const numeroPedidoMod = require('../../../backend/utils/numeroPedido');

/** Mutaciones ANTES del require del SUT (los destructures las capturan). */
const pagosFalso = {
  gatewayActivo: vi.fn(() => true),
  esAmbientePruebas: vi.fn(() => true),
  urlCheckoutWompi: vi.fn(() => 'https://checkout.wompi.co/p/?public-key=pub_test'),
  nuevaReferenciaSimulada: vi.fn((id) => `SIMW-${id}-test`),
  resultadoSimulacion: vi.fn(() => 'APPROVED'),
  marcaTarjeta: vi.fn(() => 'visa'),
  vencimientoValido: vi.fn(() => true),
  pagoVencido: vi.fn(() => false),
  esVentaSimulada: vi.fn((ref) => String(ref || '').startsWith('SIMW-')),
  fechaSimulacionDeReferencia: vi.fn(() => null),
  buscarTransaccionesPorReferencia: vi.fn(async () => []),
  obtenerTransaccionWompi: vi.fn(async () => null),
  verificarEventosWompi: vi.fn(() => true),
};
Object.assign(pagos, pagosFalso);
facturaPdf.generarFacturaPdf = vi.fn(async () => Buffer.from('%PDF'));
correo.plantillaCorreo = vi.fn(() => '<html>correo</html>');
correo.escaparHtml = vi.fn((s) => s);
validarCorreoMod.correoValido = vi.fn((v) => /.+@.+\..+/.test(v || ''));
movimientos.registrarMovimientoStock = vi.fn(async () => ({}));
numeroPedidoMod.numeroPedido = vi.fn(() => 12345678);
mailer.sendMail = vi.fn(async () => ({}));
notificacionController.crearNotificacion = vi.fn(async () => ({}));

// AHORA sí: el SUT carga con las dependencias ya mutadas
const pagosController = require('../../../backend/controllers/pagosController');
const { estadoVenta, webhookWompi, expirarVentasPendientes, crearSesionPago, simularPago } = pagosController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.get = vi.fn();
  return res;
};

const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) {
        const r = rutas[clave];
        return typeof r === 'function' ? r(params) : r;
      }
    }
    return defecto ? defecto(params) : [[]];
  });
};

const montar = ({ pool = {}, conn = {}, poolDefecto, connDefecto } = {}) => {
  const connFalso = {
    query: dbDe(conn, connDefecto),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(),
  };
  pagosController._useDb({ query: dbDe(pool, poolDefecto), getConnection: vi.fn(async () => connFalso) });
  return { conn: connFalso };
};

const USER = { ID_USUARIO: 7 };
const req = (over = {}) => ({
  user: USER, params: {}, body: {}, get: vi.fn(), ...over,
});

const ventaPendiente = (over = {}) => ({
  ID_VENTA: 15, ID_CLIENTE: 7, TOTAL: 120000, ESTADO: 'PENDIENTE_PAGO',
  REFERENCIA_PAGO: 'JADDA-15-x', FECHA_EXPIRA_PAGO: '2030-01-01', FECHA_VENTA: '2026-01-01',
  DATOS_PAGO: null, EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gómez',
  ID_METODO: 2, DIRECCION_ENVIO: 'Cra 1 #2-3', CIUDAD: 'Bogota', BARRIO: 'Centro',
  DEPARTAMENTO: 'Cundinamarca', TELEFONO_CONTACTO: '3001112233', COSTO_ENVIO: 5000,
  ...over,
});

const transaccionTx = (over = {}) => ({
  id: 'tx-1', reference: 'JADDA-15-x', status: 'APPROVED', amount_in_cents: 12000000,
  payment_method: { type: 'CARD' }, created_at: '2026-01-01T10:00:00Z', status_message: null,
  ...over,
});

const ITEMS = [{ ID_VARIANTE: 5, ID_PRODUCTO: 10, CANTIDAD: 2 }];
const ITEM_NOTI = [{ NOMBRE: 'Guayos', CANTIDAD: 1, PRECIO_UNITARIO: '50000', SUBTOTAL: '50000', ID_PRODUCTO: 10, URL_IMAGEN: null }];

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
  facturaPdf.generarFacturaPdf.mockImplementation(async () => Buffer.from('%PDF'));
  correo.plantillaCorreo.mockImplementation(() => '<html>correo</html>');
  correo.escaparHtml.mockImplementation((s) => s);
  validarCorreoMod.correoValido.mockImplementation((v) => /.+@.+\..+/.test(v || ''));
  movimientos.registrarMovimientoStock.mockImplementation(async () => ({}));
  numeroPedidoMod.numeroPedido.mockImplementation(() => 12345678);
  mailer.sendMail.mockImplementation(async () => ({}));
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
});

describe('crearSesionPago / simularPago — guardas residuales', () => {
  test('simularPago con sandbox activo pero idVenta inválido → 400', async () => {
    const res = resFalsa();
    await simularPago(req({ body: { idVenta: 0, numero: '4111111111111111', titular: 'Ana' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, message: 'idVenta inválido' });
  });

  test('correo del perfil inválido → la sesión usa el correo sintético pago<id>@ejemplo.com', async () => {
    montar({
      pool: {
        'SELECT V.*, U.EMAIL': [[ventaPendiente({ EMAIL: 'no-es-correo' })]],
        'UPDATE VENTAS SET REFERENCIA_PAGO': [{ affectedRows: 1 }],
      },
    });
    const res = resFalsa();
    await crearSesionPago(req({ body: { idVenta: 15 } }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(pagosFalso.urlCheckoutWompi.mock.calls[0][0].correo).toBe('pago15@ejemplo.com');
  });
});

describe('estadoVenta — pull sin transacción o con estados residuales', () => {
  test('sin REFERENCIA_PAGO y vigente → sigue PENDIENTE_PAGO sin consultar Wompi', async () => {
    montar({ pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente({ REFERENCIA_PAGO: null })]] } });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'PENDIENTE_PAGO', transaccion: null });
    expect(pagosFalso.buscarTransaccionesPorReferencia).not.toHaveBeenCalled();
  });

  test('transacciones múltiples de la MISMA referencia → gana la MÁS NUEVA por created_at', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([
      transaccionTx({ id: 'tx-vieja', created_at: '2026-01-01T10:00:00Z' }),
      transaccionTx({ id: 'tx-nueva', created_at: '2026-01-02T10:00:00Z' }),
    ]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'CONFIRMADA', transaccion: expect.objectContaining({ id: 'tx-nueva' }) });
  });

  test('transacción APPROVED y refresco vacío → estado de fallback = ESTADO de la venta', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    const { conn } = montar({
      pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO'); // refresco [[]] → fallback venta.ESTADO
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(res.cuerpo.transaccion.id).toBe('tx-1');
  });

  test('sin transacción y VENCIDA → cancela la venta (reingresa stock) y responde CANCELADA', async () => {
    pagosFalso.pagoVencido.mockReturnValue(true);
    const { conn } = montar({
      pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] },
      conn: {
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
        'SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD': [[ITEMS[0]]],
        'UPDATE VENTAS SET ESTADO': [{ affectedRows: 1 }],
        'UPDATE ENVIOS SET ESTADO_ENVIO': [{ affectedRows: 1 }],
      },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'CANCELADA', transaccion: null });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(movimientos.registrarMovimientoStock).toHaveBeenCalledWith(expect.objectContaining({ idProducto: 10, tipo: 'ENTRADA', cantidad: 2 }));
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.titulo).toBe('Pedido cancelado ⏰');
    expect(notif.ruta).toBe('/perfil/compra/15');
  });

  test('estado ERROR de la pasarela y vigente → DECLINADA (reintentable)', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx({ status: 'ERROR' })]);
    montar({ pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] } });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'DECLINADA', transaccion: expect.objectContaining({ id: 'tx-1' }) });
  });

  test('estado desconocido (PENDING) y VENCIDA → CANCELADA', async () => {
    pagosFalso.pagoVencido.mockReturnValue(true);
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx({ status: 'PENDING' })]);
    montar({
      pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] },
      conn: {
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
        'SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD': [[]],
        'UPDATE VENTAS SET ESTADO': [{ affectedRows: 1 }],
        'UPDATE ENVIOS SET ESTADO_ENVIO': [{ affectedRows: 1 }],
      },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CANCELADA');
  });

  test('estado desconocido (PENDING) y vigente → sigue PENDIENTE_PAGO', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx({ status: 'PENDING' })]);
    montar({ pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] } });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO');
  });

  test('simulada con DATOS_PAGO corrupto → parse tolerado, aprueba y confirma', async () => {
    pagosFalso.fechaSimulacionDeReferencia.mockReturnValue(new Date(Date.now() - 60000));
    const { conn } = montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente({ REFERENCIA_PAGO: 'SIMW-15-abc', DATOS_PAGO: '{no-json' })]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'CONFIRMADA', transaccion: expect.objectContaining({ status: 'APPROVED' }) });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});

describe('estadoVenta — guardas de confirmarPagoWompi', () => {
  test('la fila desapareció al bloquear (FOR UPDATE []) → sin confirmar, estado del refresco', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    const { conn } = montar({
      pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] },
      conn: { 'SELECT ESTADO FROM VENTAS': [[]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('PENDIENTE_PAGO');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('ya CONFIRMADA al bloquear → duplicado sin reenviar avisos', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('CANCELADA al bloquear → ignorado (no revive la venta)', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CANCELADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CANCELADA' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CANCELADA');
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('UPDATE ID_METODO rechaza → se tolera y la confirmación sigue (medio CARD)', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    const { conn } = montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: {
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
        'UPDATE VENTAS SET ID_METODO': async () => { throw new Error('fk caída'); },
      },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});

describe('cancelarVentaWompi y notificarVentaConfirmada — fallos tolerados', () => {
  test('UPDATE de cancelación rechaza → rollback y el pull RECHAZA (express 5 captura)', async () => {
    pagosFalso.pagoVencido.mockReturnValue(true);
    const { conn } = montar({
      pool: { 'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]] },
      conn: {
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
        'SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD': [[]],
        'UPDATE VENTAS SET ESTADO': async () => { throw new Error('boom'); },
      },
    });
    const res = resFalsa();
    await expect(estadoVenta(req({ params: { idVenta: '15' } }), res)).rejects.toThrow('boom');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('venta no encontrada al notificar → el confirm devuelve el estado del refresco igual', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(mailer.sendMail).not.toHaveBeenCalled(); // SELECT v.* → [] → notificar termina temprano
  });

  test('DATOS_PAGO objeto + medio desconocido se conserva + correo inválido → sin correo y envío GRATIS', async () => {
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT V.*, U.NOMBRE_USUARIO': [[ventaPendiente({ DATOS_PAGO: { pasarela: 'wompi', medio: 'CARD-DESCONOCIDO' }, EMAIL: 'no-es-correo', COSTO_ENVIO: 0 })]],
        'SELECT P.NOMBRE AS NOMBRE': [[ITEM_NOTI[0]]],
        'SELECT DISTINCT V.ID_USUARIO': [[]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(notificacionController.crearNotificacion.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mailer.sendMail).not.toHaveBeenCalled(); // correo inválido → bloque if (correo) falso
  });

  test('correo válido + costo de envío → factura con adjunto, medio y avisos (aunque las notifs rechacen)', async () => {
    notificacionController.crearNotificacion.mockImplementation(async () => { throw new Error('notif caída'); });
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT V.*, U.NOMBRE_USUARIO': [[ventaPendiente({ DATOS_PAGO: '{"pasarela":"wompi","medio":"PSE"}' })]],
        'SELECT P.NOMBRE AS NOMBRE': [[ITEM_NOTI[0]]],
        'SELECT DISTINCT V.ID_USUARIO': [[{ ID_USUARIO: 8, NOMBRE_EMPRESA: 'Tienda' }]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    const correoEnviado = mailer.sendMail.mock.calls[0][0];
    expect(correoEnviado.to).toBe('ana@test.com');
    expect(correoEnviado.attachments).toHaveLength(1);
    expect(correo.plantillaCorreo.mock.calls[0][0].contenido).toContain('Envío: $5.000');
  });

  test('PDF rechaza → el correo NO sale (mismo try) y la venta sigue confirmada', async () => {
    facturaPdf.generarFacturaPdf.mockImplementation(async () => { throw new Error('pdf caído'); });
    pagosFalso.buscarTransaccionesPorReferencia.mockResolvedValue([transaccionTx()]);
    montar({
      pool: {
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO': [[ventaPendiente()]],
        'SELECT V.*, U.NOMBRE_USUARIO': [[ventaPendiente({ DATOS_PAGO: '{"medio":"CARD"}' })]],
        'SELECT P.NOMBRE AS NOMBRE': [[ITEM_NOTI[0]]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await estadoVenta(req({ params: { idVenta: '15' } }), res);
    expect(res.cuerpo.estado).toBe('CONFIRMADA');
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(notificacionController.crearNotificacion).toHaveBeenCalled(); // avisos OK, solo falló el adjunto
  });
});

describe('webhookWompi — catch y duplicados', () => {
  const EVENTO = () => ({ event: 'transaction.updated', data: { transaction: { id: 'tx-9' } }, signature: { checksum: 'chk-1' } });

  test('evento con data.id (sin transaction) → idExterno resuelto y sin transacción en la API', async () => {
    montar({ pool: { 'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }] } });
    const res = resFalsa();
    await webhookWompi(req({ body: { event: 'transaction.updated', data: { id: 'tx-9' }, signature: { checksum: 'chk' } } }), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'transaccion_no_verificada' });
    expect(pagosFalso.obtenerTransaccionWompi).toHaveBeenCalledWith('tx-9');
  });

  test('registro del evento con FIRMA_INVALIDA rechaza → 403 igualmente', async () => {
    pagosFalso.verificarEventosWompi.mockReturnValue(false);
    montar({ pool: { 'INSERT IGNORE INTO PAGOS_EVENTOS': async () => { throw new Error('tabla llena'); } } });
    const res = resFalsa();
    await webhookWompi(req({ body: EVENTO() }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo).toEqual({ ok: false, message: 'Firma inválida' });
  });

  test('registro RECIBIDO rechaza → se tolera y se sigue con el pull a la API', async () => {
    montar({ pool: { 'INSERT IGNORE INTO PAGOS_EVENTOS': async () => { throw new Error('bd caída'); } } });
    const res = resFalsa();
    await webhookWompi(req({ body: EVENTO() }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'transaccion_no_verificada' });
  });

  test('evento DUPLICADO (affectedRows 0) con APPROVED → confirma la venta y responde duplicado_procesado', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue(transaccionTx({ id: 'tx-9' }));
    const { conn } = montar({
      pool: {
        'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 0 }],
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[ventaPendiente()]],
        'UPDATE PAGOS_EVENTOS SET ID_VENTA': [{ affectedRows: 1 }],
        'SELECT V.*, U.NOMBRE_USUARIO': [[]],
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await webhookWompi(req({ body: EVENTO() }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'duplicado_procesado' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('VOIDED por webhook → cancela la venta (reingresa stock) y responde procesado', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue(transaccionTx({ id: 'tx-9', status: 'VOIDED' }));
    const { conn } = montar({
      pool: {
        'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }],
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[ventaPendiente()]],
        'UPDATE PAGOS_EVENTOS SET ID_VENTA': [{ affectedRows: 1 }],
      },
      conn: {
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
        'SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD': [[ITEMS[0]]],
        'UPDATE VENTAS SET ESTADO': [{ affectedRows: 1 }],
        'UPDATE ENVIOS SET ESTADO_ENVIO': [{ affectedRows: 1 }],
      },
    });
    const res = resFalsa();
    await webhookWompi(req({ body: EVENTO() }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'procesado' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(movimientos.registrarMovimientoStock).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ENTRADA', cantidad: 2 }));
  });

  test('vincular evento↔venta rechaza → se tolera y la confirmación sigue', async () => {
    pagosFalso.obtenerTransaccionWompi.mockResolvedValue(transaccionTx({ id: 'tx-9' }));
    const { conn } = montar({
      pool: {
        'INSERT IGNORE INTO PAGOS_EVENTOS': [{ affectedRows: 1 }],
        'SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO': [[ventaPendiente()]],
        'UPDATE PAGOS_EVENTOS SET ID_VENTA': async () => { throw new Error('bd caída'); },
        'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'CONFIRMADA' }]],
      },
      conn: { 'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]] },
    });
    const res = resFalsa();
    await webhookWompi(req({ body: EVENTO() }), res);
    expect(res.cuerpo).toEqual({ ok: true, estado: 'procesado' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});

describe('expirarVentasPendientes (job) — canceladas y fallos', () => {
  const RUTAS_JOB = () => ({
    'SELECT ID_VENTA, ID_CLIENTE FROM VENTAS': [[{ ID_VENTA: 15, ID_CLIENTE: 7 }]],
    'SELECT ESTADO FROM VENTAS': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
    'SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD': [[ITEMS[0]]],
    'UPDATE VENTAS SET ESTADO': [{ affectedRows: 1 }],
    'UPDATE ENVIOS SET ESTADO_ENVIO': [{ affectedRows: 1 }],
  });

  test('venta cancelada con éxito → expiradas 1 de 1', async () => {
    const { conn } = montar({ pool: RUTAS_JOB(), conn: RUTAS_JOB() });
    const resumen = await expirarVentasPendientes();
    expect(resumen).toEqual({ expiradas: 1, revisadas: 1 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(notificacionController.crearNotificacion).toHaveBeenCalled();
  });

  test('cancelación que rechaza → el job la tolera y cuenta 0', async () => {
    montar({
      pool: RUTAS_JOB(),
      conn: {
        ...RUTAS_JOB(),
        'UPDATE VENTAS SET ESTADO': async () => { throw new Error('boom'); },
      },
    });
    const resumen = await expirarVentasPendientes();
    expect(resumen).toEqual({ expiradas: 0, revisadas: 1 });
  });
});

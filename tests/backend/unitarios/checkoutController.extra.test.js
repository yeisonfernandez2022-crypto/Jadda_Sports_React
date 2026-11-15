/**
 * checkoutController — caminos que la suite base (checkoutController.test.js)
 * y la integración no cubren: validarYCalcularCupon (fn completa: inexistente,
 * mínimo, vigencia, RETO-), el bloque FOR UPDATE dentro de la transacción
 * (orden de locks, agregación por variante, fila ausente, stock real y guard
 * del UPDATE), el cupón RETO- con bloqueo/revalidación, pagoDetalle (los 3
 * formatos), la vía Wompi (PENDIENTE_PAGO + ventana) y las tolerancias del
 * post-pago (notificaciones, PDF, correo). Suite NUEVA: la base no se edita.
 * Deps destructuradas en carga (gatewayActivo, generarFacturaPdf,
 * registrarMovimientoStock, numeroPedido, crearNotificacion) se mutan ANTES
 * del require; calcularCostoEnvio y correoValido quedan REALES.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const pagos = require('../../../backend/utils/pagos');
const facturaPdf = require('../../../backend/utils/facturaPdf');
const movimientosStock = require('../../../backend/utils/movimientosStock');
const numeroPedidoMod = require('../../../backend/utils/numeroPedido');
const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

// destructuring en carga → mutar ANTES del require del SUT
pagos.gatewayActivo = vi.fn(() => false);
facturaPdf.generarFacturaPdf = vi.fn(async () => Buffer.from('%PDF-fake'));
movimientosStock.registrarMovimientoStock = vi.fn(async () => {});
numeroPedidoMod.numeroPedido = vi.fn(() => 12345678);
notificacionController.crearNotificacion = vi.fn(async () => ({}));
mailer.sendMail = vi.fn(async () => ({ accepted: true }));

const checkoutController = require('../../../backend/controllers/checkoutController');
const { procesarCompra } = checkoutController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) return rutas[clave];
    }
    return defecto ? defecto() : [[]];
  });
};

const connDe = (rutas = {}, defecto) => ({
  query: dbDe(rutas, defecto),
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

const normaliza = (sql) => sql.replace(/\s+/g, ' ').toUpperCase();

// Fila del carrito: variante 5, $50.000 × 2 → subtotal 100.000 (envío 10.000)
const itemCarrito = (over = {}) => ({
  ID_CARRITO: 1, ID_PRODUCTO: 10, CANTIDAD: 2, ID_VARIANTE: 5,
  PRECIO: 50000, NOMBRE: 'Guayos', URL_IMAGEN: '/i.png', STOCK: 10,
  ID_DESCUENTO: null, ID_VENDEDOR: null, DESCUENTO_PORCENTAJE: null, ...over,
});

const cuponRow = (over = {}) => ({
  ID_DESCUENTO: 8, DESCRIPCION: 'CUPON-10', PORCENTAJE: 10,
  FECHA_INICIO: null, FECHA_FIN: null, USADO: 0, MONTO_MINIMO: null, ...over,
});

// Rutas de la transacción feliz (1 item con variante; sin cupón)
const rutasTransaccion = () => ({
  'SELECT C.ID_CARRITO': [[itemCarrito()]],
  'SELECT STOCK FROM PRODUCTO_VARIANTES': [[{ STOCK: 10 }]],
  'INSERT INTO VENTAS': [{ insertId: 42 }],
  'INSERT INTO DETALLE_VENTAS': [{ insertId: 1 }],
  'UPDATE PRODUCTO_VARIANTES SET STOCK': [{ affectedRows: 1 }],
  'INSERT INTO ENVIOS': [{ insertId: 1 }],
  'DELETE FROM CARRITO': [{ affectedRows: 1 }],
  'SELECT DISTINCT P.ID_CATEGORIA': [[{ ID_CATEGORIA: 1 }]],
  'SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA': [[{ ID_PLANTILLA: 3, TITULO: 'Plan Base' }]],
  'INSERT IGNORE INTO PLANES_USUARIO': [{ affectedRows: 1 }],
});

const montar = (rutasConn = {}, defectoConn) => {
  const conn = connDe(rutasConn, defectoConn);
  const poolQuery = dbDe({
    'SELECT V.ID_USUARIO, V.NOMBRE_EMPRESA': [[{ ID_USUARIO: 8, NOMBRE_EMPRESA: 'Tienda X' }]],
  });
  checkoutController._useDb({ query: poolQuery, getConnection: vi.fn(async () => conn) });
  return { conn, poolQuery };
};

const req = (bodyOver = {}, userOver = {}) => ({
  user: { ID_USUARIO: 7, ID_ROL: 4, EMAIL: 'comprador@test.com', ...userOver },
  body: {
    metodoPago: 'credito', cuponCodigo: '', nombre: 'Ana Perez',
    correo: 'ana@t.co', telefono: '3001234567', direccion: 'Cra 45 # 23-12',
    barrio: 'Centro', ciudad: 'Zipaquira', departamento: 'Cundinamarca',
    codigoPostal: '123456', observaciones: '', ...bodyOver,
  },
});

const insertVentasDe = (conn) => conn.query.mock.calls.find(([sql]) => normaliza(sql).startsWith('INSERT INTO VENTAS'));

beforeEach(() => {
  vi.clearAllMocks();
  pagos.gatewayActivo.mockImplementation(() => false);
  facturaPdf.generarFacturaPdf.mockImplementation(async () => Buffer.from('%PDF-fake'));
  movimientosStock.registrarMovimientoStock.mockImplementation(async () => {});
  numeroPedidoMod.numeroPedido.mockImplementation(() => 12345678);
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
  mailer.sendMail.mockImplementation(async () => ({ accepted: true }));
});

describe('cupón (validarYCalcularCupon)', () => {
  test('cupón inexistente → 400 exacto, SIN rollback (aún no hay transacción) y con release', async () => {
    const { conn } = montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'NOPE' }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El cupón "NOPE" no existe.' });
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('mínimo no alcanzado → 400 con el string exacto de moneda es-CO', async () => {
    const { conn } = montar({
      'SELECT C.ID_CARRITO': [[itemCarrito()]],
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow({ DESCRIPCION: 'CUPON-MIN', MONTO_MINIMO: 150000 })]],
    });
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'CUPON-MIN' }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El cupón CUPON-MIN requiere una compra mínima de $150.000 (tu carrito suma $100.000).' });
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('cupón vigente → descuento 10% en el total y UPDATE USADO (rama no-RETO)', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow()]],
      'UPDATE DESCUENTOS SET USADO = 1': [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'CUPON-10' }), res);
    expect(res.cuerpo).toEqual({ ok: true, ventaId: 42, referencia: expect.stringMatching(/^SIM_/), planGenerado: true, envio: 10000 });
    const [, params] = insertVentasDe(conn);
    expect(params).toEqual([7, 100000, 'COMPLETADA', 3, expect.stringMatching(/^SIM_/), null]); // 100000 - 10000 + 10000
    const upd = conn.query.mock.calls.find(([sql]) => normaliza(sql).startsWith('UPDATE DESCUENTOS'));
    expect(upd[0]).not.toContain('AND USADO = 0'); // no-RETO: guard simple
    expect(upd[1]).toEqual([8]);
    expect(mailer.sendMail.mock.calls[0][0].html).toContain('Descuento: <strong>-$10.000</strong>');
  });

  test('cupón expirado → se ignora sin error y sin UPDATE USADO (total completo)', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow({ FECHA_FIN: '2020-01-01' })]],
    });
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'VIEJO' }), res);
    expect(res.cuerpo.ok).toBe(true);
    const [, params] = insertVentasDe(conn);
    expect(params[1]).toBe(110000); // sin descuento
    expect(conn.query.mock.calls.some(([sql]) => normaliza(sql).startsWith('UPDATE DESCUENTOS'))).toBe(false);
  });

  test('cupón aún no vigente → se ignora (FECHA_INICIO futura)', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow({ FECHA_INICIO: '2099-01-01' })]],
    });
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'FUTURO' }), res);
    const [, params] = insertVentasDe(conn);
    expect(params[1]).toBe(110000);
  });

  test('RETO- ya marcado usado en el SELECT → se ignora sin descuento (yaUsado)', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow({ DESCRIPCION: 'RETO-VIEJO', USADO: 1 })]],
    });
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-VIEJO' }), res);
    expect(res.cuerpo.ok).toBe(true);
    const [, params] = insertVentasDe(conn);
    expect(params[1]).toBe(110000);
    expect(conn.query.mock.calls.some(([sql]) => normaliza(sql).startsWith('UPDATE DESCUENTOS'))).toBe(false);
  });
});

describe('cupón RETO- (bloqueo FOR UPDATE dentro de la transacción)', () => {
  const rutasReto = (extra = {}) => ({
    ...rutasTransaccion(),
    'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE': [[cuponRow({ DESCRIPCION: 'RETO-ABC' })]],
    'SELECT USADO FROM DESCUENTOS': [[{ USADO: 0 }]],
    'SELECT COUNT(*) AS N FROM RETOS_USUARIOS': [[{ N: 1 }]],
    'UPDATE DESCUENTOS SET USADO = 1 WHERE ID_DESCUENTO = ? AND USADO = 0': [{ affectedRows: 1 }],
    ...extra,
  });

  test('feliz: revalida bloqueado, verifica propiedad y marca con guard', async () => {
    const { conn } = montar(rutasReto());
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-ABC' }), res);
    expect(res.cuerpo.ok).toBe(true);
    const marca = conn.query.mock.calls.find(([sql]) => normaliza(sql).startsWith('UPDATE DESCUENTOS'));
    expect(marca[0]).toContain('AND USADO = 0');
    expect(marca[1]).toEqual([8]);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('otro comprador lo consumió primero (USADO=1 al bloquear) → 400 exacto + rollback', async () => {
    const { conn } = montar(rutasReto({ 'SELECT USADO FROM DESCUENTOS': [[{ USADO: 1 }]] }));
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-ABC' }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Este cupón de reto ya fue usado (otra compra lo consumió primero). Completa otro reto para recibir uno nuevo.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('fila del cupón desapareció al bloquear → mismo 400 (guard de revalidación)', async () => {
    const { conn } = montar(rutasReto({ 'SELECT USADO FROM DESCUENTOS': [[]] }));
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-ABC' }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toContain('ya fue usado');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('cupón de OTRO usuario → 403 "no pertenece a tu cuenta"', async () => {
    const { conn } = montar(rutasReto({ 'SELECT COUNT(*) AS N FROM RETOS_USUARIOS': [[{ N: 0 }]] }));
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-ABC' }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo).toEqual({ error: 'Este cupón de reto no pertenece a tu cuenta.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('marca con affectedRows 0 (carrera) → 400 exacto + rollback', async () => {
    const { conn } = montar(rutasReto({
      'UPDATE DESCUENTOS SET USADO = 1 WHERE ID_DESCUENTO = ? AND USADO = 0': [{ affectedRows: 0 }],
    }));
    const res = resFalsa();
    await procesarCompra(req({ cuponCodigo: 'RETO-ABC' }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El cupón de reto acaba de ser usado por otra compra. Intenta de nuevo sin cupón.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });
});

describe('FOR UPDATE: bloqueo y revalidación de stock', () => {
  test('locks en orden ASC de ID_VARIANTE aunque el carrito venga desordenado (evita deadlocks)', async () => {
    const { conn } = montar({
      'SELECT C.ID_CARRITO': [[
        itemCarrito({ ID_VARIANTE: 9, CANTIDAD: 1, PRECIO: 20000, NOMBRE: 'Guante', STOCK: 5 }),
        itemCarrito({ ID_VARIANTE: 3, CANTIDAD: 1, PRECIO: 30000, NOMBRE: 'Balon', STOCK: 5 }),
      ]],
      'SELECT STOCK FROM PRODUCTO_VARIANTES': [[{ STOCK: 5 }]],
      'SELECT DISTINCT P.ID_CATEGORIA': [[{ ID_CATEGORIA: 1 }]],
      'SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA': [[{ ID_PLANTILLA: 3 }]],
    }, () => [{ insertId: 42, affectedRows: 1 }]);
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    const forUpdate = conn.query.mock.calls
      .filter(([sql]) => normaliza(sql).startsWith('SELECT STOCK FROM PRODUCTO_VARIANTES'))
      .map(([, params]) => params[0]);
    expect(forUpdate).toEqual([3, 9]);
  });

  test('misma variante en 2 filas del carrito: UN lock y cantidad AGREGADA contra el stock real', async () => {
    const { conn } = montar({
      'SELECT C.ID_CARRITO': [[
        itemCarrito({ ID_CARRITO: 1, CANTIDAD: 1, STOCK: 1 }),
        itemCarrito({ ID_CARRITO: 2, CANTIDAD: 1, STOCK: 1 }),
      ]],
      'SELECT STOCK FROM PRODUCTO_VARIANTES': [[{ STOCK: 1 }]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo).toEqual({ error: 'El producto "Guayos" solo tiene 1 unidades en este momento (pediste 2) — otro comprador las tomó primero. Ajusta la cantidad e intenta de nuevo.' });
    expect(conn.query.mock.calls.filter(([sql]) => normaliza(sql).startsWith('SELECT STOCK FROM PRODUCTO_VARIANTES'))).toHaveLength(1);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('variante eliminada entre el carrito y la transacción → 400 exacto', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT STOCK FROM PRODUCTO_VARIANTES': [[]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: '"Guayos" ya no está disponible en la variante elegida. Actualiza tu carrito.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('stock llegó a 0 → 409 "se agotó en este momento"', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT STOCK FROM PRODUCTO_VARIANTES': [[{ STOCK: 0 }]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo).toEqual({ error: 'El producto "Guayos" se agotó en este momento. Quítalo del carrito para continuar.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('stock bajó pero no a 0 → 409 con las unidades reales y el pedido', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT STOCK FROM PRODUCTO_VARIANTES': [[{ STOCK: 1 }]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo.error).toBe('El producto "Guayos" solo tiene 1 unidades en este momento (pediste 2) — otro comprador las tomó primero. Ajusta la cantidad e intenta de nuevo.');
  });

  test('guard del UPDATE (affectedRows 0) → 409 "El stock cambió mientras se procesaba"', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [{ affectedRows: 0 }],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo).toEqual({ error: 'El stock de "Guayos" cambió mientras se procesaba tu compra. Intenta de nuevo.' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(movimientosStock.registrarMovimientoStock).not.toHaveBeenCalled();
  });
});

describe('post-pago: pagoDetalle, Wompi y tolerancias', () => {
  test('credito con número: detalle •••• con los últimos 4 y DATOS_PAGO tokenizado (sin cvv/numero)', async () => {
    const { conn } = montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ paymentData: { numero: '4111 1111 1111 1111', cvv: '123', titular: 'Ana Perez', token: 'tok-1', last4: '1111', brand: 'VISA', cuotas: 1 } }), res);
    expect(res.cuerpo.ok).toBe(true);
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.to).toBe('ana@t.co');
    expect(correo.html).toContain('Ana Perez •••• 1111');
    expect(correo.attachments).toHaveLength(1);
    expect(correo.attachments[0].filename).toBe('factura-compra-42.pdf');
    const [, params] = insertVentasDe(conn);
    const datos = JSON.parse(params[5]);
    expect(datos).toMatchObject({ token: 'tok-1', last4: '1111', brand: 'VISA', cuotas: 1 });
    expect(datos.numero).toBeUndefined(); // numero y cvv NO se persisten
    expect(datos.cvv).toBeUndefined();
  });

  test('debito: usa last4 directo cuando viene tokenizado', async () => {
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ metodoPago: 'debito', paymentData: { last4: '4242', titular: 'Bob Marley' } }), res);
    expect(mailer.sendMail.mock.calls[0][0].html).toContain('Bob Marley •••• 4242');
  });

  test('nequi: detalle por teléfono', async () => {
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ metodoPago: 'nequi', paymentData: { telefono: '3001234567' } }), res);
    expect(mailer.sendMail.mock.calls[0][0].html).toContain('Teléfono: 3001234567');
  });

  test('pse: detalle por banco', async () => {
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ metodoPago: 'pse', paymentData: { banco: 'Bancolombia' } }), res);
    expect(mailer.sendMail.mock.calls[0][0].html).toContain('Banco: Bancolombia');
  });

  test('vía Wompi activa → venta PENDIENTE_PAGO con ventana, SIN post-pago (ni notifs/PDF/correo)', async () => {
    pagos.gatewayActivo.mockImplementation(() => true);
    const { conn } = montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ metodoPago: 'wompi' }), res);
    expect(res.cuerpo).toEqual({ ok: true, ventaId: 42, referencia: expect.stringMatching(/^SIM_/), planGenerado: true, envio: 10000 });
    const [sql, params] = insertVentasDe(conn);
    expect(normaliza(sql)).toContain('FECHA_EXPIRA_PAGO');
    expect(params).toEqual([7, 110000, 'PENDIENTE_PAGO', 16, expect.stringMatching(/^SIM_/), null, pagos.MINUTOS_EXPIRACION]);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
    expect(facturaPdf.generarFacturaPdf).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalledWith(expect.objectContaining({ idProducto: 10, tipo: 'SALIDA', cantidad: 2 }));
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('venta de vendedor: notificación por db.query del POOL (no de la conexión)', async () => {
    const { conn, poolQuery } = montar({
      ...rutasTransaccion(),
      'SELECT C.ID_CARRITO': [[itemCarrito({ ID_VENDEDOR: 3 })]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(poolQuery).toHaveBeenCalledTimes(1);
    expect(poolQuery.mock.calls[0][1]).toEqual([10]);
    expect(conn.query.mock.calls.some(([sql]) => normaliza(sql).startsWith('SELECT V.ID_USUARIO'))).toBe(false);
    const vendedor = notificacionController.crearNotificacion.mock.calls.map((c) => c[0]).find((n) => n.tipo === 'vendedor');
    expect(vendedor).toEqual({ idUsuario: 8, tipo: 'vendedor', titulo: '¡Tienes una nueva venta! 🎉', mensaje: expect.stringContaining('Tienda X'), ruta: '/vendedor/ventas' });
  });

  test('falla la consulta de vendedores (pool) → se tolera y la venta sigue 200', async () => {
    const conn = connDe(rutasTransaccion());
    checkoutController._useDb({ query: vi.fn(async () => { throw new Error('pool caído'); }), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('las notificaciones que RECHAZAN no bloquean la venta', async () => {
    notificacionController.crearNotificacion.mockImplementation(async () => { throw new Error('notif caída'); });
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test('falla el PDF adjunto → el correo sale SIN attachments y la venta sigue 200', async () => {
    facturaPdf.generarFacturaPdf.mockImplementation(async () => { throw new Error('pdf caído'); });
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.ok).toBe(true);
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.attachments).toEqual([]);
  });

  test('correo del body inválido → factura al correo de la cuenta', async () => {
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ correo: 'no-es-correo' }), res);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('comprador@test.com');
  });

  test('correo del body Y de la cuenta inválidos → la venta continúa sin correo', async () => {
    montar(rutasTransaccion());
    const res = resFalsa();
    await procesarCompra(req({ correo: 'no-es-correo' }, { EMAIL: null }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('subtotal ≥ 800.000 → envío GRATIS (0)', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT C.ID_CARRITO': [[itemCarrito({ PRECIO: 400000 })]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.envio).toBe(0);
    const [, params] = insertVentasDe(conn);
    expect(params[1]).toBe(800000);
    expect(mailer.sendMail.mock.calls[0][0].html).toContain('Envío: <strong>GRATIS</strong>');
  });

  test('plan por categoría sin plantilla → fallback a la primera plantilla', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA': [[]],
      'SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES ORDER BY ID_PLANTILLA': [[{ ID_PLANTILLA: 1 }]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.planGenerado).toBe(true);
    const fallback = conn.query.mock.calls.filter(([sql]) => normaliza(sql).startsWith('INSERT IGNORE INTO PLANES_USUARIO'));
    expect(fallback).toHaveLength(1);
    expect(fallback[0][1]).toEqual([7, 42, 1]);
  });

  test('sin plantillas en absoluto → planGenerado false y correo sin aviso de plan', async () => {
    const { conn } = montar({
      ...rutasTransaccion(),
      'SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA': [[]],
      'SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES ORDER BY ID_PLANTILLA': [[]],
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.cuerpo.planGenerado).toBe(false);
    expect(conn.query.mock.calls.some(([sql]) => normaliza(sql).startsWith('INSERT IGNORE INTO PLANES_USUARIO'))).toBe(false);
    expect(mailer.sendMail.mock.calls[0][0].html).not.toContain('plan de entrenamiento');
  });

  test('error a mitad de la transacción → rollback + 500 "Error al procesar la compra" + release', async () => {
    const conn = {
      query: vi.fn(async (sql) => {
        const s = normaliza(sql);
        if (s.startsWith('SELECT C.ID_CARRITO')) return [[itemCarrito()]];
        if (s.startsWith('SELECT STOCK FROM PRODUCTO_VARIANTES')) return [[{ STOCK: 10 }]];
        if (s.startsWith('INSERT INTO VENTAS')) throw new Error('boom');
        return [{ insertId: 1, affectedRows: 1 }];
      }),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
    };
    checkoutController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al procesar la compra' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('rollback que TAMBIÉN rechaza en el catch → 500 igualmente (sin unhandled)', async () => {
    const conn = {
      query: vi.fn(async (sql) => {
        const s = normaliza(sql);
        if (s.startsWith('SELECT C.ID_CARRITO')) return [[itemCarrito()]];
        if (s.startsWith('SELECT STOCK FROM PRODUCTO_VARIANTES')) return [[{ STOCK: 10 }]];
        if (s.startsWith('INSERT INTO VENTAS')) throw new Error('boom');
        return [{ insertId: 1, affectedRows: 1 }];
      }),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => { throw new Error('rollback caído'); }),
      release: vi.fn(),
    };
    checkoutController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.error).toBe('Error al procesar la compra');
  });
});

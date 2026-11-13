/**
 * checkoutController — guardas de entrada y caminos de error (unit).
 *
 * La BD se inyecta con _useDb: la conexión falsa decide qué devuelve cada
 * query por su SQL. Los flujos FELICES de checkout (concurrencia FOR UPDATE,
 * cupón RETO-) ya viven en la suite de INTEGRACIÓN contra MySQL real; aquí se
 * prueban las validaciones y errores que el flujo feliz no alcanza:
 * autenticación, rol vendedor, contraseña temporal, método de pago,
 * dirección-correo, carrito vacío y stock insuficiente.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

// mutaciones ANTES del require del SUT (destructuring en carga)
mailer.sendMail = vi.fn(async () => ({}));
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const checkoutController = require('../../../backend/controllers/checkoutController');
const { procesarCompra } = checkoutController;

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

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

const req = (over = {}) => ({
  user: { ID_USUARIO: 7, ID_ROL: 4, EMAIL: 'comprador@test.com' },
  body: {
    metodoPago: 'credito',
    nombre: 'Probe Checkout',
    direccion: 'Cra 45 # 23-12',
    ciudad: 'Zipaquirá',
    departamento: 'Cundinamarca',
    telefono: '3001112233',
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  checkoutController._useDb({ getConnection: vi.fn(async () => conexionFalsa()) });
});

describe('procesarCompra — guardas de entrada', () => {
  test('sin sesión → 401', async () => {
    const res = resFalsa();
    await procesarCompra({ user: {}, body: {} }, res);
    expect(res.codigo).toBe(401);
  });

  test('vendedor → 403 (no compra en la tienda)', async () => {
    const res = resFalsa();
    await procesarCompra({ user: { ID_USUARIO: 9, ID_ROL: 6 }, body: {} }, res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.error).toContain('vendedores no pueden comprar');
  });

  test('contraseña temporal pendiente → 403', async () => {
    const res = resFalsa();
    await procesarCompra({ user: { ID_USUARIO: 7, ID_ROL: 4, DEBE_CAMBIAR_PASSWORD: 1 }, body: {} }, res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.error).toContain('cambiar tu contraseña');
  });

  test('método de pago inválido → 400', async () => {
    const res = resFalsa();
    await procesarCompra(req({ body: { metodoPago: 'pagar-con-oros' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toContain('Método de pago no válido');
  });

  test('dirección que es un correo → 400 (doble validación del checkout)', async () => {
    const res = resFalsa();
    await procesarCompra(req({ body: { metodoPago: 'credito', direccion: 'comprador@test.com' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toContain('no puede ser un correo electrónico');
  });

  test('carrito vacío → 400 con mensaje del checkout', async () => {
    checkoutController._useDb({ getConnection: vi.fn(async () => conexionFalsa({ 'SELECT C.ID_CARRITO': [[]] })) });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(JSON.stringify(res.cuerpo)).toContain('arrito');
  });

  test('stock insuficiente → 400 con el mensaje por producto', async () => {
    checkoutController._useDb({
      getConnection: vi.fn(async () => conexionFalsa({
        'SELECT C.ID_CARRITO': [[{ ID_CARRITO: 1, ID_PRODUCTO: 1, CANTIDAD: 5, ID_VARIANTE: 2, PRECIO: 100000, NOMBRE: 'Guayos', URL_IMAGEN: '/x.png', STOCK: 2, ID_DESCUENTO: null, ID_VENDEDOR: null }]],
      })),
    });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(400);
    expect(JSON.stringify(res.cuerpo)).toContain('Guayos');
  });

  test('fallo de BD en la transacción → 500 con rollback ejecutado', async () => {
    const conn = {
      query: vi.fn(async (sql) => {
        const s = sql.toUpperCase();
        if (s.startsWith('SELECT C.ID_CARRITO')) throw new Error('BD caída');
        return [[]];
      }),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    checkoutController._useDb({ getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarCompra(req(), res);
    expect(res.codigo).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});

/**
 * cuponesController — validación y listado de cupones (unit).
 *
 * BD inyectada con _useDb (mapa por prefijo SQL). Se cubren: el 401 sin
 * sesión de listarParaCheckout, el mapeo de tienda/personales (porcentaje
 * numérico, monto_minimo null, usado/expirado, reto_titulo), y validarCupon
 * con sus 6 salidas: 400 sin código, 404 no encontrado, cupón RETO- sin
 * sesión (401) o ajeno (403), vigencia futura/pasada (400) y feliz.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const cuponesController = require('../../../backend/controllers/cuponesController');
const { listarParaCheckout, validarCupon } = cuponesController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ user: null, body: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  cuponesController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('listarParaCheckout', () => {
  test('sin sesión → 401 "Debes iniciar sesión"', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    cuponesController._useDb(db);
    const res = resFalsa();
    await listarParaCheckout(req(), res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('mapea tienda y personales (números, usado, expirado, reto_titulo)', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith("SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_FIN, MONTO_MINIMO FROM DESCUENTOS WHERE DESCRIPCION NOT LIKE 'RETO")) {
        return [[{ ID_DESCUENTO: 1, DESCRIPCION: 'BLACKFRIDAY', PORCENTAJE: '20', FECHA_FIN: '2099-01-01', MONTO_MINIMO: null }]];
      }
      if (s.startsWith('SELECT D.ID_DESCUENTO')) {
        return [[{
          ID_DESCUENTO: 9, DESCRIPCION: 'RETO-ABC123', PORCENTAJE: '5', FECHA_FIN: '2020-01-01',
          MONTO_MINIMO: '100000', USADO: 1, RETO_TITULO: 'Completa 10 km',
        }]];
      }
      return [[]];
    });
    cuponesController._useDb({ query: dbq });
    const res = resFalsa();
    await listarParaCheckout(req({ user: { ID_USUARIO: 7 } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.tienda).toEqual([{
      codigo: 'BLACKFRIDAY', porcentaje: 20, monto_minimo: null, fecha_fin: '2099-01-01',
      usado: false, expirado: false, reto_titulo: null,
    }]);
    expect(res.cuerpo.personales).toEqual([{
      codigo: 'RETO-ABC123', porcentaje: 5, monto_minimo: 100000, fecha_fin: '2020-01-01',
      usado: true, expirado: true, reto_titulo: 'Completa 10 km',
    }]);
  });

  test('fallo de BD → 500 "Error al cargar los cupones"', async () => {
    cuponesController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await listarParaCheckout(req({ user: { ID_USUARIO: 7 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al cargar los cupones' });
  });
});

describe('validarCupon', () => {
  test('sin código → 400 "Código de cupón requerido"', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    cuponesController._useDb(db);
    const res = resFalsa();
    await validarCupon(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Código de cupón requerido' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('cupón inexistente → 404 "Cupón no encontrado"', async () => {
    cuponesController._useDb({ query: vi.fn(async () => [[]]) });
    const res = resFalsa();
    await validarCupon(req({ body: { codigo: 'NOEXISTE' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Cupón no encontrado' });
  });

  test('RETO- sin sesión → 401 (cupón personal)', async () => {
    cuponesController._useDb({ query: vi.fn(async () => [[{ DESCRIPCION: 'RETO-ABC123' }]]) });
    const res = resFalsa();
    await validarCupon(req({ body: { codigo: 'RETO-ABC123' } }), res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo.msg).toBe('Los cupones de reto son personales: inicia sesión con la cuenta que completó el reto.');
  });

  test('RETO- ajeno (N=0) → 403 "no pertenece a tu cuenta"', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_DESCUENTO, DESCRIPCION')) return [[{ DESCRIPCION: 'RETO-ABC123' }]];
      if (s.startsWith('SELECT COUNT(*) AS N FROM RETOS_USUARIOS')) return [[{ N: 0 }]];
      return [[]];
    });
    cuponesController._useDb({ query: dbq });
    const res = resFalsa();
    await validarCupon(req({ user: { ID_USUARIO: 7 }, body: { codigo: 'RETO-ABC123' } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toBe('Este cupón de reto no pertenece a tu cuenta: es personal e intransferible.');
  });

  test('RETO- propio (N=1) → sigue a la vigencia y responde ok', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_DESCUENTO, DESCRIPCION')) return [[{ ID_DESCUENTO: 9, DESCRIPCION: 'RETO-ABC123', PORCENTAJE: '5', FECHA_FIN: '2099-12-31', MONTO_MINIMO: null }]];
      if (s.startsWith('SELECT COUNT(*) AS N FROM RETOS_USUARIOS')) return [[{ N: 1 }]];
      return [[]];
    });
    cuponesController._useDb({ query: dbq });
    const res = resFalsa();
    await validarCupon(req({ user: { ID_USUARIO: 7 }, body: { codigo: 'RETO-ABC123' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({
      ok: true,
      descuento: { id: 9, descripcion: 'RETO-ABC123', porcentaje: 5, monto_minimo: null, fecha_fin: '2099-12-31' },
    });
  });

  test('FECHA_INICIO futura → 400 "El cupón aún no está vigente"', async () => {
    cuponesController._useDb({ query: vi.fn(async () => [[{ DESCRIPCION: 'FUTURO', FECHA_INICIO: '2099-01-01' }]]) });
    const res = resFalsa();
    await validarCupon(req({ body: { codigo: 'FUTURO' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'El cupón aún no está vigente' });
  });

  test('FECHA_FIN pasada → 400 "El cupón ha expirado"', async () => {
    cuponesController._useDb({ query: vi.fn(async () => [[{ DESCRIPCION: 'VIEJO', FECHA_FIN: '2020-01-01' }]]) });
    const res = resFalsa();
    await validarCupon(req({ body: { codigo: 'VIEJO' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'El cupón ha expirado' });
  });

  test('fallo de BD → 500 "Error al validar cupón"', async () => {
    cuponesController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await validarCupon(req({ body: { codigo: 'X' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al validar cupón' });
  });
});

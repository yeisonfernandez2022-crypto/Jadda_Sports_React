/**
 * historialController — historial de navegación (unit).
 *
 * BD inyectada con _useDb (mapa por prefijo SQL). Se cubren: lista limitada a
 * 30, el upsert (UPDATE si ya existe / INSERT si es nuevo), el flag de
 * privacidad GUARDAR_HISTORIAL=0 (respuesta omitido:true), la purga de los
 * registros que exceden 30 y el borrado total con el conteo de eliminados.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const historialController = require('../../../backend/controllers/historialController');
const { obtenerHistorial, guardarHistorial, eliminarHistorial } = historialController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ user: { ID_USUARIO: 7 }, params: {}, body: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  historialController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('obtenerHistorial', () => {
  test('devuelve filas con productos', async () => {
    historialController._useDb({ query: vi.fn(async () => [[{ ID_HISTORIAL: 1, NOMBRE: 'Bola' }]]) });
    const res = resFalsa();
    await obtenerHistorial(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE).toBe('Bola');
  });

  test('fallo de BD → 500 "Error al obtener historial"', async () => {
    historialController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerHistorial(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener historial' });
  });
});

describe('guardarHistorial', () => {
  test('sin id_producto → 400', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    historialController._useDb(db);
    const res = resFalsa();
    await guardarHistorial(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'ID del producto es obligatorio' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('privacidad GUARDAR_HISTORIAL=0 → 200 omitido:true', async () => {
    historialController._useDb({ query: vi.fn(async () => [[{ GUARDAR_HISTORIAL: 0 }]]) });
    const res = resFalsa();
    await guardarHistorial(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ ok: true, omitido: true, msg: 'Historial desactivado por privacidad' });
  });

  test('producto ya visitado → UPDATE FECHA_VISTO y 201', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT GUARDAR_HISTORIAL FROM USUARIOS')) return [[{ GUARDAR_HISTORIAL: 1 }]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? AND ID_PRODUCTO')) return [[{ ID_HISTORIAL: 5 }]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? ORDER BY FECHA_VISTO')) return [[{ ID_HISTORIAL: 5 }], { ID_HISTORIAL: 4 }];
      return [[]];
    });
    historialController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarHistorial(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Historial guardado' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE HISTORIAL SET FECHA_VISTO'));
    expect(update[1]).toEqual([5]);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('DELETE FROM HISTORIAL'))).toBe(false);
  });

  test('producto nuevo → INSERT y 201', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT GUARDAR_HISTORIAL FROM USUARIOS')) return [[{ GUARDAR_HISTORIAL: 1 }]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? AND ID_PRODUCTO')) return [[]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? ORDER BY FECHA_VISTO')) return [[{ ID_HISTORIAL: 5 }]];
      return [[]];
    });
    historialController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarHistorial(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(201);
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO HISTORIAL'));
    expect(insert[1]).toEqual([7, 3]);
  });

  test('más de 30 registros → DELETE de los sobrantes', async () => {
    const filas = Array.from({ length: 32 }, (_, i) => ({ ID_HISTORIAL: 100 - i }));
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT GUARDAR_HISTORIAL FROM USUARIOS')) return [[{ GUARDAR_HISTORIAL: 1 }]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? AND ID_PRODUCTO')) return [[{ ID_HISTORIAL: 50 }]];
      if (s.startsWith('SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? ORDER BY FECHA_VISTO')) return [filas];
      return [[]];
    });
    historialController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarHistorial(req({ body: { id_producto: 3 } }), res);
    const del = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('DELETE FROM HISTORIAL'));
    expect(del[1]).toEqual([70, 69]);
  });

  test('fallo de BD → 500 "Error al guardar historial"', async () => {
    historialController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await guardarHistorial(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al guardar historial' });
  });
});

describe('eliminarHistorial', () => {
  test('borra todo y reporta el conteo de eliminados', async () => {
    const dbq = vi.fn(async () => [{ affectedRows: 4 }]);
    historialController._useDb({ query: dbq });
    const res = resFalsa();
    await eliminarHistorial(req(), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Historial borrado', eliminados: 4 });
    expect(dbq.mock.calls[0][0].toUpperCase().startsWith('DELETE FROM HISTORIAL')).toBe(true);
    expect(dbq.mock.calls[0][1]).toEqual([7]);
  });

  test('fallo de BD → 500 "Error al borrar historial"', async () => {
    historialController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await eliminarHistorial(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al borrar historial' });
  });
});

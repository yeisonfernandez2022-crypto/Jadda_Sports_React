/**
 * planController — caminos que la suite base (planController.test.js) no
 * cubre: generarPlan COMPLETO (nunca invocado por integración), el parseo
 * de CONTENIDO/DIAS inválidos (parsearJson catch), el filtro de días no
 * finitos en marcarDia y los 500 de BD. Suite NUEVA: la base no se edita.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const SUT = require('../../../backend/controllers/planController');

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generarPlan — planes por categoría de una venta (P1-P4)', () => {
  test('feliz: 2 categorías, una sin plantilla se salta, la otra se inserta', async () => {
    const dbq = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT P.ID_CATEGORIA FROM DETALLE_VENTAS')) return [[{ ID_CATEGORIA: 1 }, { ID_CATEGORIA: 2 }, { ID_CATEGORIA: 1 }]];
      if (s.startsWith('SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES')) {
        return params[0] === 1 ? [[{ ID_PLANTILLA: 11 }]] : [[]]; // cat 2 sin plantilla
      }
      if (s.startsWith('SELECT ID_PLAN FROM PLANES_USUARIO')) return [[]];
      return [{ insertId: 30 }];
    });
    SUT._useDb({ query: dbq });
    const res = resFalsa();
    await SUT.generarPlan({ user: { ID_USUARIO: 7 }, body: { id_venta: 88 } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Plan(es) generado(s)' });
    const inserts = dbq.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PLANES_USUARIO'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual([7, 88, 11]);
  });

  test('plan ya existente para la venta → continue sin INSERT', async () => {
    const dbq = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT P.ID_CATEGORIA FROM DETALLE_VENTAS')) return [[{ ID_CATEGORIA: 1 }]];
      if (s.startsWith('SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES')) return [[{ ID_PLANTILLA: 11 }]];
      if (s.startsWith('SELECT ID_PLAN FROM PLANES_USUARIO')) return [[{ ID_PLAN: 30 }]];
      return [{ insertId: 31 }];
    });
    SUT._useDb({ query: dbq });
    const res = resFalsa();
    await SUT.generarPlan({ user: { ID_USUARIO: 7 }, body: { id_venta: 88 } }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PLANES_USUARIO'))).toBe(false);
  });

  test('venta sin productos → 200 sin consultar plantillas', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT P.ID_CATEGORIA FROM DETALLE_VENTAS')) return [[]];
      return [[]];
    });
    SUT._useDb({ query: dbq });
    const res = resFalsa();
    await SUT.generarPlan({ user: { ID_USUARIO: 7 }, body: { id_venta: 88 } }, res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Plan(es) generado(s)' });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('SELECT ID_PLANTILLA'))).toBe(false);
  });

  test('fallo de BD → 500 "Error al generar plan"', async () => {
    SUT._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await SUT.generarPlan({ user: { ID_USUARIO: 7 }, body: { id_venta: 88 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar plan' });
  });
});

describe('parseo de JSON inválido (parsearJson catch) y filtros de marcarDia', () => {
  test('misPlanes: CONTENIDO y DIAS con JSON inválido caen a los valores por defecto', async () => {
    const dbq = vi.fn(async () => [[
      { ID_PLAN: 1, CONTENIDO: '{no-es-json', DIAS_COMPLETADOS: 'tampoco' },
      { ID_PLAN: 2, CONTENIDO: { nivel: 'avanzado' }, DIAS_COMPLETADOS: [2, 4] },
    ]]);
    SUT._useDb({ query: dbq });
    const res = resFalsa();
    await SUT.misPlanes({ user: { ID_USUARIO: 7 } }, res);
    expect(res.cuerpo[0].CONTENIDO).toBe('{no-es-json'); // catch → default (el valor original)
    expect(res.cuerpo[0].DIAS_COMPLETADOS).toEqual([]); // catch → [] (Array.isArray de [])
    expect(res.cuerpo[1].CONTENIDO).toEqual({ nivel: 'avanzado' }); // no string → valor tal cual
    expect(res.cuerpo[1].DIAS_COMPLETADOS).toEqual([2, 4]); // ya era array → sin tocar
  });

  test('marcarDia: días no finitos se descartan y CONTENIDO inválido da total 0', async () => {
    const dbq = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT PU.ID_PLAN')) return [[{ ID_PLAN: 5, CONTENIDO: '{roto' }]];
      return [{ affectedRows: 1 }];
    });
    SUT._useDb({ query: dbq });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 7 }, params: { id_plan: '5' }, body: { dias_completados: ['x', 3, 'y', 1.5] } }, res);
    expect(res.cuerpo.progreso).toBe('2/0'); // totalDias 0 → completado igual
    expect(res.cuerpo.completado).toBe(true);
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE PLANES_USUARIO'));
    expect(JSON.parse(update[1][1])).toEqual([3, 1.5]);
  });

  test('marcarDia: fallo de BD → 500 "Error al marcar día"', async () => {
    SUT._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 7 }, params: { id_plan: '5' }, body: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al marcar día' });
  });

  test('_importarProgreso: mapa inválido → 0 sin tocar la BD', async () => {
    const db = { query: vi.fn(async () => [{ affectedRows: 1 }]) };
    SUT._useDb(db);
    expect(await SUT._importarProgreso(null)).toBe(0);
    expect(await SUT._importarProgreso('no-mapa')).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });
});

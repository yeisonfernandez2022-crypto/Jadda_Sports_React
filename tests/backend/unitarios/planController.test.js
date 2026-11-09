/**
 * Progreso de planes en MySQL (P10) — el avance DIAS_COMPLETADOS debe vivir
 * en la FILA del usuario (PLANES_USUARIO), no en backend/data/planes-progreso.json
 * (Render borra el disco en cada redeploy). Igual que el P7 de newsletter, se
 * inyecta una BD falsa con exports._useDb para probar sin tirar contra MySQL.
 */
const SUT = require('../../../backend/controllers/planController');

const construirDb = () => {
  const db = { operaciones: [] };
  db.query = vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ');
    db.operaciones.push(s);
    // misPlanes: el JOIN de los planes del usuario
    if (s.includes('pp.DESCRIPCION AS PLAN_DESC')) {
      return [
        [
          { ID_PLAN: 1, ID_USUARIO: 7, CONTENIDO: '[]', DIAS_COMPLETADOS: '[1,3]' },
          { ID_PLAN: 2, ID_USUARIO: 7, CONTENIDO: '[]', DIAS_COMPLETADOS: null },
        ],
      ];
    }
    // marcarDia: buscar el plan del usuario (CONTENIDO + dueño)
    if (s.includes('pp.CONTENIDO FROM PLANES_USUARIO')) {
      return [[]];
    }
    return [{}];
  });
  return db;
};

const resFalsa = () => {
  const res = {};
  res.status = (codigo) => { res.codigo = codigo; return res; };
  res.json = (cuerpo) => { res.cuerpo = cuerpo; return res; };
  return res;
};
const reqPlanes = (usuario = { ID_USUARIO: 7 }) => ({ user: usuario });

describe('planController — progreso de planes persistido por usuario en BD', () => {
  it('misPlanes devuelve DIAS_COMPLETADOS desde la fila PLANES_USUARIO (parseado a array)', async () => {
    const db = construirDb();
    SUT._useDb(db);
    const res = resFalsa();
    await SUT.misPlanes(reqPlanes(), res);
    expect(res.cuerpo).toHaveLength(2);
    expect(res.cuerpo[0].DIAS_COMPLETADOS).toEqual([1, 3]);
    expect(res.cuerpo[1].DIAS_COMPLETADOS).toEqual([]); // null → []
  });

  it('marcarDia guarda el progreso en la MISMA fila (un UPDATE con COMPLETADO y DIAS_COMPLETADOS)', async () => {
    const db = construirDb();
    SUT._useDb(db);
    let suelta = null;
    db.query = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.startsWith('SELECT')) {
        return [[
          { ID_PLAN: 5, ID_USUARIO: 7, CONTENIDO: JSON.stringify(['Día A', 'Día B', 'Día C']) },
        ]];
      }
      if (s.startsWith('UPDATE')) suelta = params;
      return [{ affectedRows: 1 }];
    });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 7 }, params: { id_plan: '5' }, body: { dias_completados: [1, 2] } }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.completado).toBe(false);
    expect(res.cuerpo.progreso).toBe('2/3');
    expect(suelta).toBeTruthy();
    expect(suelta[0]).toBe(0); // COMPLETADO = 0 (2 de 3 días)
    expect(suelta[2]).toBe('5'); // clave de la fila del PLAN del usuario
    expect(JSON.parse(suelta[1])).toEqual([1, 2]);
    expect(db.operaciones.filter((o) => o.includes('DIAS_COMPLETADOS')).length).toBe(1);
  });

  it('marcarDia marca COMPLETADO=1 cuando el array cubre todos los días', async () => {
    const db = construirDb();
    SUT._useDb(db);
    let captura = null;
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.startsWith('SELECT')) {
        return [[
          { ID_PLAN: 5, ID_USUARIO: 7, CONTENIDO: JSON.stringify(['Día A', 'Día B', 'Día C']) },
        ]];
      }
      if (s.startsWith('UPDATE')) captura = s;
      return [{ affectedRows: 1 }];
    });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 7 }, params: { id_plan: '5' }, body: { dias_completados: [0, 1, 2] } }, res);
    expect(res.cuerpo.completado).toBe(true);
    expect(res.cuerpo.progreso).toBe('3/3');
  });

  it('marcarDia normaliza a array: body no-array se guarda como []', async () => {
    const db = construirDb();
    SUT._useDb(db);
    let suelta = null;
    db.query = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.startsWith('SELECT')) {
        return [[
          { ID_PLAN: 5, ID_USUARIO: 7, CONTENIDO: JSON.stringify(['Día A', 'Día B']) },
        ]];
      }
      if (s.startsWith('UPDATE')) suelta = params;
      return [{ affectedRows: 1 }];
    });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 7 }, params: { id_plan: '5' }, body: { dias_completados: 'x' } }, res);
    expect(res.cuerpo.progreso).toBe('0/2');
    expect(JSON.parse(suelta[1])).toEqual([]);
  });

  it('marcarDia de un plan ajeno → 404 y sin UPDATE', async () => {
    const db = construirDb();
    SUT._useDb(db);
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.startsWith('SELECT')) return [[]];
      return [{ affectedRows: 0 }];
    });
    const res = resFalsa();
    await SUT.marcarDia({ user: { ID_USUARIO: 99 }, params: { id_plan: '5' }, body: {} }, res);
    expect(res.codigo).toBe(404);
    expect(db.operaciones.filter((o) => o.startsWith('UPDATE')).length).toBe(0);
  });

  it('_importarProgreso cuenta solo filas REALMENTE rellenadas (affectedRows)', async () => {
    const db = construirDb();
    SUT._useDb(db);
    db.query = vi.fn(async () => [{ affectedRows: 0 }]); // todas las filas ya tenían progreso
    const n = await SUT._importarProgreso({ 5: [1] });
    expect(n).toBe(0);
  });

  it('_importarProgreso rellena SOLO filas sin progreso (legado planes-progreso.json, idempotente)', async () => {
    const db = construirDb();
    SUT._useDb(db);
    const capturas = [];
    db.query = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.includes('DIAS_COMPLETADOS IS NULL')) capturas.push(params);
      return [{ affectedRows: 1 }];
    });
    const n = await SUT._importarProgreso({ 5: [1, 2], 8: [], foo: [1] });
    expect(n).toBe(2); // foo se salta; 2 planes legítimos
    expect(capturas.length).toBe(2);
    expect(capturas[0]).toEqual(['[1,2]', 5]);
    expect(capturas[1]).toEqual(['[]', 8]);
    expect(db.operaciones.every((o) => o.includes('DIAS_COMPLETADOS IS NULL'))).toBe(true);
  });
});

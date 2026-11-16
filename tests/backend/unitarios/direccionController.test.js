/**
 * direccionController — direcciones de envío del cliente (unit).
 *
 * BD inyectada con _useDb (mapa por prefijo SQL). Se cubren: listado, creación
 * con validaciones (campos obligatorios, la dirección nunca es un correo) y
 * desmarcado de otras principales, actualización con 404 ajeno, eliminación
 * y los 500 de BD.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const direccionController = require('../../../backend/controllers/direccionController');
const { obtenerDirecciones, crearDireccion, actualizarDireccion, eliminarDireccion } = direccionController;

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
  direccionController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('obtenerDirecciones', () => {
  test('devuelve filas', async () => {
    direccionController._useDb({ query: vi.fn(async () => [[{ ID_DIRECCION: 1, CIUDAD: 'Cali' }]]) });
    const res = resFalsa();
    await obtenerDirecciones(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].CIUDAD).toBe('Cali');
  });

  test('fallo de BD → 500 "Error al obtener direcciones"', async () => {
    direccionController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerDirecciones(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener direcciones' });
  });
});

describe('crearDireccion', () => {
  test('faltan campos obligatorios → 400', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    direccionController._useDb(db);
    const res = resFalsa();
    await crearDireccion(req({ body: { direccion: 'Cra 1', ciudad: 'Cali' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Dirección, ciudad y departamento son obligatorios');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('dirección con @ (correo) → 400 con sugerencia', async () => {
    const res = resFalsa();
    await crearDireccion(req({ body: { direccion: 'ana@test.com', ciudad: 'Cali', departamento: 'Valle' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('no puede ser un correo electrónico');
  });

  test('es_principal: desmarca las otras y marca la nueva', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('INSERT INTO DIRECCIONES')) return [{ insertId: 3 }];
      return [[]];
    });
    direccionController._useDb({ query: dbq });
    const res = resFalsa();
    await crearDireccion(req({ body: { direccion: 'Cra 1 # 2-3', ciudad: 'Cali', departamento: 'Valle', es_principal: true } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Dirección creada', id: 3 });
    const desmarcar = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE DIRECCIONES SET ES_PRINCIPAL = 0 WHERE ID_USUARIO = ?'));
    expect(desmarcar[1]).toEqual([7]);
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DIRECCIONES'));
    expect(insert[1]).toEqual([7, 'Cra 1 # 2-3', null, 'Cali', 'Valle', null, null, 1, null]);
  });

  test('sin es_principal → INSERT con 0 y sin desmarcar', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('INSERT INTO DIRECCIONES')) return [{ insertId: 4 }];
      return [[]];
    });
    direccionController._useDb({ query: dbq });
    const res = resFalsa();
    await crearDireccion(req({ body: { direccion: 'Cra 5', ciudad: 'Cali', departamento: 'Valle', barrio: 'Centro', etiqueta: 'Casa' } }), res);
    expect(res.cuerpo.id).toBe(4);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE DIRECCIONES'))).toBe(false);
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DIRECCIONES'));
    expect(insert[1]).toEqual([7, 'Cra 5', 'Centro', 'Cali', 'Valle', null, null, 0, 'Casa']);
  });

  test('fallo de BD → 500 "Error al crear dirección"', async () => {
    direccionController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await crearDireccion(req({ body: { direccion: 'Cra 5', ciudad: 'Cali', departamento: 'Valle' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al crear dirección' });
  });
});

describe('actualizarDireccion', () => {
  test('ajena o inexistente → 404', async () => {
    direccionController._useDb({ query: vi.fn(async () => [[]]) });
    const res = resFalsa();
    await actualizarDireccion(req({ params: { id_direccion: '1' }, body: {} }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Dirección no encontrada' });
  });

  test('dirección con @ → 400', async () => {
    direccionController._useDb({ query: vi.fn(async () => [[{ ID_DIRECCION: 1 }]]) });
    const res = resFalsa();
    await actualizarDireccion(req({ params: { id_direccion: '1' }, body: { direccion: 'x@y.com' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('no puede ser un correo electrónico');
  });

  test('es_principal: desmarca solo las otras (ID_DIRECCION !=) y actualiza', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_DIRECCION FROM DIRECCIONES')) return [[{ ID_DIRECCION: 1 }]];
      return [[]];
    });
    direccionController._useDb({ query: dbq });
    const res = resFalsa();
    await actualizarDireccion(req({ params: { id_direccion: '1' }, body: { direccion: 'Cra 9', ciudad: 'Cali', departamento: 'Valle', es_principal: true } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Dirección actualizada' });
    const desmarcar = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE DIRECCIONES SET ES_PRINCIPAL = 0 WHERE ID_USUARIO = ? AND ID_DIRECCION != ?'));
    expect(desmarcar[1]).toEqual([7, '1']);
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE DIRECCIONES SET DIRECCION = ?'));
    expect(update[1]).toEqual(['Cra 9', null, 'Cali', 'Valle', null, null, 1, null, '1', 7]);
  });

  test('fallo de BD → 500 "Error al actualizar dirección"', async () => {
    direccionController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await actualizarDireccion(req({ params: { id_direccion: '1' }, body: {} }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar dirección' });
  });
});

describe('eliminarDireccion', () => {
  test('ajena → 404', async () => {
    direccionController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await eliminarDireccion(req({ params: { id_direccion: '1' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Dirección no encontrada' });
  });

  test('eliminada → 200', async () => {
    direccionController._useDb({ query: vi.fn(async () => [{ affectedRows: 1 }]) });
    const res = resFalsa();
    await eliminarDireccion(req({ params: { id_direccion: '1' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Dirección eliminada' });
  });

  test('fallo de BD → 500 "Error al eliminar dirección"', async () => {
    direccionController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await eliminarDireccion(req({ params: { id_direccion: '1' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar dirección' });
  });
});

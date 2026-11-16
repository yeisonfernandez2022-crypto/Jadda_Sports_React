/**
 * favoritosController — lista de deseos (unit).
 *
 * BD inyectada con _useDb (mapa por prefijo SQL). Se cubren los tres caminos
 * CRUD (listar, agregar con detección de duplicado, eliminar con 404 ajeno)
 * y los 500 de BD en cada uno.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const favoritosController = require('../../../backend/controllers/favoritosController');
const { obtenerFavoritos, agregarFavorito, eliminarFavorito } = favoritosController;

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
  favoritosController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('obtenerFavoritos', () => {
  test('devuelve filas', async () => {
    favoritosController._useDb({ query: vi.fn(async () => [[{ ID_FAVORITO: 1, NOMBRE: 'Bola' }]]) });
    const res = resFalsa();
    await obtenerFavoritos(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE).toBe('Bola');
  });

  test('fallo de BD → 500 "Error al obtener favoritos"', async () => {
    favoritosController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerFavoritos(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener favoritos' });
  });
});

describe('agregarFavorito', () => {
  test('sin id_producto → 400', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    favoritosController._useDb(db);
    const res = resFalsa();
    await agregarFavorito(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'ID del producto es obligatorio' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('duplicado → 400 "El producto ya está en favoritos"', async () => {
    favoritosController._useDb({ query: vi.fn(async () => [[{ ID_FAVORITO: 1 }]]) });
    const res = resFalsa();
    await agregarFavorito(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El producto ya está en favoritos');
  });

  test('nuevo → INSERT y 201', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_FAVORITO FROM FAVORITOS')) return [[]];
      return [[]];
    });
    favoritosController._useDb({ query: dbq });
    const res = resFalsa();
    await agregarFavorito(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Producto agregado a favoritos' });
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO FAVORITOS'));
    expect(insert[1]).toEqual([7, 3]);
  });

  test('fallo de BD → 500 "Error al agregar favorito"', async () => {
    favoritosController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await agregarFavorito(req({ body: { id_producto: 3 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al agregar favorito' });
  });
});

describe('eliminarFavorito', () => {
  test('ajeno o inexistente → 404 "Favorito no encontrado"', async () => {
    favoritosController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await eliminarFavorito(req({ params: { id_favorito: '1' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Favorito no encontrado' });
  });

  test('eliminado → 200 con params del dueño', async () => {
    const dbq = vi.fn(async () => [{ affectedRows: 1 }]);
    favoritosController._useDb({ query: dbq });
    const res = resFalsa();
    await eliminarFavorito(req({ params: { id_favorito: '2' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Favorito eliminado' });
    expect(dbq.mock.calls[0][1]).toEqual(['2', 7]);
  });

  test('fallo de BD → 500 "Error al eliminar favorito"', async () => {
    favoritosController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await eliminarFavorito(req({ params: { id_favorito: '1' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar favorito' });
  });
});

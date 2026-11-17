/**
 * bannerController — CRUD de banners de la portada (unit).
 *
 * BD inyectada con _useDb. Se cubren: listado público (activos) y admin
 * (todos), validaciones de creación/edición (400), 404 al editar/eliminar un
 * ID ajeno, 400 de ID inválido y los 500 de BD en cada camino.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const bannerController = require('../../../backend/controllers/bannerController');
const { listarPublicos, listarTodos, crearBanner, editarBanner, eliminarBanner } = bannerController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ params: {}, body: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  bannerController._useDb({ query: vi.fn(async () => [[]]) });
  // Medidor fingido: los tests de CRUD con medidas válidas (1757×432) no
  // descargan ni leen archivos reales; los casos de dimensiones lo sobreescriben.
  bannerController._useMedidas({
    obtenerMedidasImagen: vi.fn(async () => ({ ancho: 1757, alto: 432 })),
  });
});

describe('listarPublicos', () => {
  test('devuelve solo los activos ordenados', async () => {
    const dbq = vi.fn(async () => [[{ ID_BANNER: 2, IMAGEN: 'a.png', TEXTO_ALT: 'hola', ORDEN: 1 }]]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await listarPublicos(req(), res);
    expect(res.codigo).toBeNull(); // 200 implícito
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].IMAGEN).toBe('a.png');
    expect(dbq.mock.calls[0][0]).toMatch(/WHERE ACTIVO = 1 ORDER BY ORDEN/);
  });

  test('fallo de BD → 500 "Error al cargar los banners"', async () => {
    bannerController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await listarPublicos(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al cargar los banners' });
  });
});

describe('listarTodos', () => {
  test('devuelve inactivos también (admin)', async () => {
    const dbq = vi.fn(async () => [[
      { ID_BANNER: 1, ACTIVO: 1 },
      { ID_BANNER: 2, ACTIVO: 0 },
    ]]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await listarTodos(req(), res);
    expect(res.cuerpo).toHaveLength(2);
    expect(dbq.mock.calls[0][0]).not.toMatch(/WHERE ACTIVO/);
    expect(dbq.mock.calls[0][0]).toMatch(/SELECT ACTIVO, FECHA_CREACION|ACTIVO/);
  });

  test('fallo de BD → 500', async () => {
    bannerController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await listarTodos(req(), res);
    expect(res.codigo).toBe(500);
  });
});

describe('crearBanner', () => {
  test('sin IMAGEN → 400 y sin tocar la BD', async () => {
    const dbq = vi.fn(async () => [[]]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await crearBanner(req({ body: { TEXTO_ALT: 'x' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/obligatoria/i);
    expect(dbq).not.toHaveBeenCalled();
  });

  test('IMAGEN > 500 y TEXTO_ALT > 200 → 400', async () => {
    const res1 = resFalsa();
    await crearBanner(req({ body: { IMAGEN: 'x'.repeat(501) } }), res1);
    expect(res1.codigo).toBe(400);

    const res2 = resFalsa();
    await crearBanner(req({ body: { IMAGEN: 'a.png', TEXTO_ALT: 'y'.repeat(201) } }), res2);
    expect(res2.codigo).toBe(400);
  });

  test('ORDEN no numérico/negativo → 400', async () => {
    const r1 = resFalsa();
    await crearBanner(req({ body: { IMAGEN: 'a.png', ORDEN: 'abc' } }), r1);
    const r2 = resFalsa();
    await crearBanner(req({ body: { IMAGEN: 'a.png', ORDEN: -1 } }), r2);
    expect(r1.codigo).toBe(400);
    expect(r2.codigo).toBe(400);
  });

  test('válido → INSERT con valores saneados y 201 con idBanner', async () => {
    const dbq = vi.fn(async () => [{ insertId: 9 }]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await crearBanner(req({ body: { IMAGEN: '  https://cdn/x.png  ', TEXTO_ALT: '  Banner  ', ORDEN: '3' } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Banner creado', idBanner: 9 });
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO BANNERS'));
    expect(insert[1]).toEqual(['https://cdn/x.png', 'Banner', 3, 1]);
  });

  test('sin ACTIVO se crea activo por defecto; ACTIVO falsy guarda 0', async () => {
    const dbq = vi.fn(async () => [{ insertId: 1 }]);
    bannerController._useDb({ query: dbq });
    await crearBanner(req({ body: { IMAGEN: 'a.png', ORDEN: 1, ACTIVO: 0 } }), resFalsa());
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO BANNERS'));
    expect(insert[1][3]).toBe(0);
  });

  test('fallo de BD → 500 "Error al crear el banner"', async () => {
    bannerController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await crearBanner(req({ body: { IMAGEN: 'a.png', ORDEN: 1 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al crear el banner' });
  });
});

describe('editarBanner', () => {
  test('ID inválido → 400 sin tocar la BD', async () => {
    const dbq = vi.fn(async () => [[]]);
    bannerController._useDb({ query: dbq });
    for (const id of ['abc', '0', '-2']) {
      const res = resFalsa();
      await editarBanner(req({ params: { id }, body: { IMAGEN: 'a.png', ORDEN: 1 } }), res);
      expect(res.codigo).toBe(400);
    }
    expect(dbq).not.toHaveBeenCalled();
  });

  test('payload inválido → 400', async () => {
    const res = resFalsa();
    await editarBanner(req({ params: { id: '1' }, body: { ORDEN: 1 } }), res);
    expect(res.codigo).toBe(400);
  });

  test('ajeno o inexistente → 404 "Banner no encontrado"', async () => {
    bannerController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await editarBanner(req({ params: { id: '55' }, body: { IMAGEN: 'a.png', ORDEN: 2, ACTIVO: 1 } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Banner no encontrado' });
  });

  test('válido → UPDATE con el id saneado y 200', async () => {
    const dbq = vi.fn(async () => [{ affectedRows: 1 }]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await editarBanner(req({ params: { id: '4' }, body: { IMAGEN: 'nueva.png', TEXTO_ALT: 'Ya', ORDEN: 2, ACTIVO: true } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Banner actualizado' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE BANNERS'));
    expect(update[1]).toEqual(['nueva.png', 'Ya', 2, 1, 4]);
  });

  test('fallo de BD → 500', async () => {
    bannerController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await editarBanner(req({ params: { id: '4' }, body: { IMAGEN: 'a.png', ORDEN: 2 } }), res);
    expect(res.codigo).toBe(500);
  });
});

describe('validación de dimensiones (proporción 1757:432 ±3 %, ancho mínimo 1200)', () => {
  const cuerpoValido = { IMAGEN: 'https://cdn/banner.png', TEXTO_ALT: 'ok', ORDEN: 1, ACTIVO: 1 };

  test('imagen ilegible → 400 sin insertar', async () => {
    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => null) });
    const dbq = vi.fn(async () => [{ insertId: 1 }]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await crearBanner(req({ body: cuerpoValido }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/No se pudieron leer las dimensiones/);
    expect(dbq).not.toHaveBeenCalled();
  });

  test('demasiado pequeña (ancho < 1200) → 400 con medidas detectadas', async () => {
    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => ({ ancho: 800, alto: 196 })) });
    const res = resFalsa();
    await crearBanner(req({ body: cuerpoValido }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('800');
    expect(res.cuerpo.msg).toContain('196');
    expect(res.cuerpo.msg).toContain('demasiado pequeña');
    expect(res.cuerpo.msg).toContain('mínimo es 1200');
  });

  test('proporción equivocada → 400 con la sugerencia', async () => {
    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => ({ ancho: 1757, alto: 800 })) });
    const res = resFalsa();
    await crearBanner(req({ body: cuerpoValido }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/proporción del carrusel/);
    expect(res.cuerpo.msg).toMatch(/1200×295/);
  });

  test('en el borde de la tolerancia: 1200×295 pasa, 1200×305 no', async () => {
    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => ({ ancho: 1200, alto: 295 })) });
    const resOk = resFalsa();
    await crearBanner(req({ body: cuerpoValido }), resOk);
    expect(resOk.codigo).toBe(201);

    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => ({ ancho: 1200, alto: 305 })) });
    const resMal = resFalsa();
    await crearBanner(req({ body: cuerpoValido }), resMal);
    expect(resMal.codigo).toBe(400);
  });

  test('la misma regla aplica al EDITAR: UPDATE no se ejecuta', async () => {
    bannerController._useMedidas({ obtenerMedidasImagen: vi.fn(async () => ({ ancho: 500, alto: 500 })) });
    const dbq = vi.fn(async () => [{ affectedRows: 1 }]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await editarBanner(req({ params: { id: '4' }, body: cuerpoValido }), res);
    expect(res.codigo).toBe(400);
    expect(dbq).not.toHaveBeenCalled();
  });
});

describe('eliminarBanner', () => {
  test('ID inválido → 400 sin tocar la BD', async () => {
    const dbq = vi.fn(async () => [[]]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await eliminarBanner(req({ params: { id: 'xyz' } }), res);
    expect(res.codigo).toBe(400);
    expect(dbq).not.toHaveBeenCalled();
  });

  test('inexistente → 404', async () => {
    bannerController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await eliminarBanner(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Banner no encontrado' });
  });

  test('eliminado → 200, DELETE con el id', async () => {
    const dbq = vi.fn(async () => [{ affectedRows: 1 }]);
    bannerController._useDb({ query: dbq });
    const res = resFalsa();
    await eliminarBanner(req({ params: { id: '7' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Banner eliminado' });
    const del = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('DELETE FROM BANNERS'));
    expect(del[1]).toEqual([7]);
  });

  test('fallo de BD → 500', async () => {
    bannerController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await eliminarBanner(req({ params: { id: '7' } }), res);
    expect(res.codigo).toBe(500);
  });
});

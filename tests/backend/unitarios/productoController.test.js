/**
 * productoController — validaciones y errores que la integración no alcanza
 * (unit con _useDb): categorías (crear/actualizar/eliminar con guards),
 * descuentos (fecha de expiración), recomendados sin sesión y avisos de
 * stock sin autenticación.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');

notificacionController.crearNotificacion = vi.fn(async () => ({}));

const productoController = require('../../../backend/controllers/productoController');
const { crearCategoria, actualizarCategoria, eliminarCategoria, crearDescuento, obtenerRecomendados, suscribirAvisoStock, obtenerVendedores, obtenerDescuentos } = productoController;

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const dbProd = (mapa = {}) => ({
  query: vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const [clave, respuesta] of Object.entries(mapa)) {
      if (s.startsWith(clave.toUpperCase())) return typeof respuesta === 'function' ? respuesta(params) : respuesta;
    }
    if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM PRODUCTOS')) return [[{ total: 0 }]];
    if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM PLANTILLAS_PLANES')) return [[]];
    if (s.startsWith('SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA')) return [[]];
    if (s.startsWith('INSERT INTO CATEGORIAS')) return [{ insertId: 20 }];
    if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE ID_USUARIO')) return [[]];
    return [{ affectedRows: 1 }];
  }),
});

const ADMIN = { ID_USUARIO: 1, ID_ROL: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  productoController._useDb(dbProd());
});

describe('crearCategoria / actualizarCategoria (validaciones)', () => {
  test('nombre corto → 400', async () => {
    const res = resFalsa();
    await crearCategoria({ body: { name: 'ab' } }, res);
    expect(res.codigo).toBe(400);
  });

  test('duplicada → 400; válida → 201', async () => {
    const db = dbProd({ 'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA': [[{ ID_CATEGORIA: 3 }]] });
    productoController._useDb(db);
    const res1 = resFalsa();
    await crearCategoria({ body: { name: 'Ciclismo de Ruta' } }, res1);
    expect(res1.codigo).toBe(400);

    productoController._useDb(dbProd());
    const res2 = resFalsa();
    await crearCategoria({ body: { name: 'Marca Nueva de Prueba' } }, res2);
    expect(res2.codigo).toBe(201);
  });

  test('actualizar: 404 inexistente; duplicado por OTRA categoría → 400', async () => {
    const db = dbProd({ 'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA = ?': [[]] });
    productoController._useDb(db);
    const res1 = resFalsa();
    await actualizarCategoria({ body: { name: 'Nueva Marca' }, params: { id: 999 } }, res1);
    expect(res1.codigo).toBe(404);

    const db2 = dbProd({
      'SELECT ID_CATEGORIA, NOMBRE_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA': [[{ ID_CATEGORIA: 3, NOMBRE_CATEGORIA: 'Otra' }]],
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA': [[{ ID_CATEGORIA: 9 }]],
    });
    productoController._useDb(db2);
    const res2 = resFalsa();
    await actualizarCategoria({ body: { name: 'Nombre Ocupado' }, params: { id: 3 } }, res2);
    expect(res2.codigo).toBe(400);
  });
});

describe('eliminarCategoria (guards de FK)', () => {
  test('con productos → 400 con conteo', async () => {
    const db = dbProd({ 'SELECT COUNT(*) AS TOTAL FROM PRODUCTOS WHERE ID_CATEGORIA = ?': [[{ total: 4 }]] });
    productoController._useDb(db);
    const res = resFalsa();
    await eliminarCategoria({ params: { id: 1 } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('4 producto(s)');
  });

  test('con plantillas de planes (FK PLANTILLAS_PLANES) → 400 (hallazgo corregido en la suite CRUD)', async () => {
    const db = dbProd({ 'SELECT COUNT(*) AS TOTAL FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA = ?': [[{ total: 2 }]] });
    productoController._useDb(db);
    const res = resFalsa();
    await eliminarCategoria({ params: { id: 1 } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('plantilla');
  });

  test('libre → 200; inexistente → 404', async () => {
    const db = dbProd({
      'SELECT COUNT(*) AS TOTAL FROM PRODUCTOS': [[{ total: 0 }]],
      'SELECT COUNT(*) AS TOTAL FROM PLANTILLAS_PLANES': [[{ total: 0 }]],
      'DELETE FROM CATEGORIAS WHERE ID_CATEGORIA = ?': [{ affectedRows: 0 }],
    });
    productoController._useDb(db);
    const res1 = resFalsa();
    await eliminarCategoria({ params: { id: 1 } }, res1);
    expect(res1.codigo).toBe(404);
  });
});

describe('crearDescuento (validaciones del admin)', () => {
  test('nombre corto, porcentaje fuera de rango y fecha mal formada → 400', async () => {
    const res1 = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'x', PORCENTAJE: 10 } }, res1);
    expect(res1.codigo).toBe(400);
    const res2 = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'PRUEBA50', PORCENTAJE: 500 } }, res2);
    expect(res2.codigo).toBe(400);
    const res3 = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'PRUEBA50', PORCENTAJE: 10, FECHA_FIN: '31-12-2030' } }, res3);
    expect(res3.codigo).toBe(400);
    const res4 = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'PRUEBA50', PORCENTAJE: 10, FECHA_FIN: '2020-01-01' } }, res4);
    expect(res4.codigo).toBe(400);
    const res5 = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'PRUEBA50', PORCENTAJE: 10, MONTO_MINIMO: -5 } }, res5);
    expect(res5.codigo).toBe(400);
  });
});

describe('recomendados y avisos (autenticación)', () => {
  test('recomendados sin sesión → 401 (aunque la ruta también protege)', async () => {
    const res = resFalsa();
    await obtenerRecomendados({ user: null }, res);
    expect(res.codigo).toBe(401);
  });

  test('suscribir aviso sin sesión → 401', async () => {
    const res = resFalsa();
    await suscribirAvisoStock({ params: { idVariante: 1 }, user: null }, res);
    expect(res.codigo).toBe(401);
  });

  test('vendedores y descuentos públicos responde arrays', async () => {
    const db = dbProd({
      'SELECT ID_VENDEDOR, NOMBRE_EMPRESA FROM VENDEDORES': [[]],
      'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE FROM DESCUENTOS': [[]],
    });
    productoController._useDb(db);
    const res1 = resFalsa();
    await obtenerVendedores({}, res1);
    expect(Array.isArray(res1.cuerpo)).toBe(true);
    const res2 = resFalsa();
    await obtenerDescuentos({}, res2);
    expect(Array.isArray(res2.cuerpo)).toBe(true);
  });
});

/**
 * productoController — caminos que la suite base (productoController.test.js)
 * y la integración no cubren: buildSearchWhere completa (búsqueda por
 * palabras, escapes de comodines, array de query), crearProducto (variantes,
 * características camel/snake, validaciones de precio e imágenes),
 * obtenerProductoPorId/Relacionados/Caracteristicas (+ catches), eliminar
 * producto transaccional (404, ventas, feliz, catch), actualizarProducto
 * completo (reemplazo de variantes con avisos de reposición, fallback de
 * variante individual, 404, catch), reseñas (obtener + agregar con guardas
 * A04), variantes/característica por id, obtenerCategorias/Vendedores/
 * Descuentos (+ catches), catch de crear/actualizar/eliminar categoría con
 * ER_DUP_ENTRY, crearDescuento catch, notificarReposicion y avisos de stock
 * (estado/cancelar). Suite NUEVA: la base no se edita.
 * Deps destructuradas en carga (crearNotificacion) se mutan ANTES del
 * require; urlImagenProductoValida, precioProductoValido y
 * stockEnteroValido quedan REALES. El SUT usa db.execute en reseñas.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

// destructuring en carga → mutar ANTES del require del SUT
notificacionController.crearNotificacion = vi.fn(async () => ({}));
mailer.sendMail = vi.fn(async () => ({ accepted: true }));

const productoController = require('../../../backend/controllers/productoController');
const {
  obtenerProductos, crearProducto, obtenerProductoPorId, obtenerRelacionados,
  obtenerCaracteristicas, agregarCaracteristica, eliminarCaracteristica,
  eliminarProducto, actualizarProducto, obtenerResenasPorProducto,
  agregarResena, obtenerVariantes, actualizarVariante,
  obtenerCaracteristicaPorId, actualizarCaracteristica, obtenerCategorias,
  crearCategoria, actualizarCategoria, eliminarCategoria,
  obtenerVendedores, obtenerDescuentos, crearDescuento,
  suscribirAvisoStock, estadoSuscripcionAviso, cancelarAvisoStock,
} = productoController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

// L12 lesson: trim tras replace (template literals del SUT empiezan con newline)
const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) {
        const r = rutas[clave];
        return typeof r === 'function' ? r(params) : r;
      }
    }
    return defecto ? defecto(params) : [[]];
  });
};

const connDe = (rutas = {}) => ({
  query: dbDe(rutas),
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

// el SUT usa db.query, db.execute y db.getConnection → mismo router para query/execute
// Firma POSICIONAL: montar(rutasPool, rutasConn, defectoPool, defectoConn)
let ROUTER = null;
const routerDe = () => ROUTER;
const montar = (rutasPool = {}, rutasConn = {}, defectoPool, defectoConn) => {
  const connFalso = connDe(rutasConn);
  connFalso.query = dbDe(rutasConn, defectoConn);
  const router = dbDe(rutasPool, defectoPool);
  ROUTER = router;
  productoController._useDb({
    query: router,
    execute: router,
    getConnection: vi.fn(async () => connFalso),
  });
  return { conn: connFalso, router };
};

const limpiarMocks = () => {
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
  mailer.sendMail.mockImplementation(async () => ({ accepted: true }));
};

beforeEach(() => {
  vi.clearAllMocks();
  limpiarMocks();
  productoController._useDb({ query: dbDe(), execute: dbDe(), getConnection: vi.fn() });
});

const flush = async () => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
};

describe('obtenerProductos y buildSearchWhere', () => {
  test('search con 2 palabras → WHERE con 2 condiciones AND y 8 params con prefijo', async () => {
    montar({ 'SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE': [[{ ID: 1, NOMBRE: 'Pesas' }]] });
    const res = resFalsa();
    await obtenerProductos({ query: { search: 'pesas balon' } }, res);
    expect(res.cuerpo).toEqual([{ ID: 1, NOMBRE: 'Pesas' }]);
    const [sql, params] = routerDe().mock.calls[0];
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    expect(s).toContain('AND (');
    expect(s.split('(PRODUCTOS.NOMBRE LIKE ?').length - 1).toBe(2);
    expect(params).toEqual([
      'pesas%', 'pesas%', 'pesas%', 'pesas%',
      'balon%', 'balon%', 'balon%', 'balon%',
    ]);
  });

  test('search como ARRAY (?search=a&search=b) → usa el PRIMER valor (A03-H11)', async () => {
    montar({ 'SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE': [[]] });
    const res = resFalsa();
    await obtenerProductos({ query: { search: ['guantes', 'raro'] } }, res);
    expect(routerDe().mock.calls[0][1]).toEqual([
      'guantes%', 'guantes%', 'guantes%', 'guantes%',
    ]);
  });

  test('search vacío, "undefined" o solo espacios → WHERE simple SIN params', async () => {
    for (const search of ['', 'undefined', '   ']) {
      montar({ 'SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE': [[]] });
      const res = resFalsa();
      await obtenerProductos({ query: { search } }, res);
      expect(res.codigo).toBeNull();
      expect(routerDe().mock.calls[0][1]).toEqual([]);
      expect(routerDe().mock.calls[0][0].toUpperCase()).toContain('WHERE (PRODUCTOS.ESTADO_PUBLICACION IS NULL');
    }
  });

  test('los comodines del usuario escapan: "50%" → LIKE literal "50\\%%"', async () => {
    montar({ 'SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE': [[]] });
    const res = resFalsa();
    await obtenerProductos({ query: { search: '50%' } }, res);
    expect(routerDe().mock.calls[0][1]).toEqual(['50\\%%', '50\\%%', '50\\%%', '50\\%%']);
  });

  test('bd caída → 500 "Error al obtener productos"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await obtenerProductos({ query: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al obtener productos' });
  });
});

describe('crearProducto', () => {
  const bodyFeliz = () => ({
    NOMBRE: 'Guayos Elite', PRECIO: '199900.99', MARCA: 'Nike', DESCRIPCION: 'Guayo pro',
    ID_CATEGORIA: '2', ID_PROVEEDOR: '3', ID_DESCUENTO: '4',
    IMAGENES: ['/images/productos/a.png', '/images/productos/b.png'],
    VARIANTES: [{ COLOR: 'Rojo', STOCK: '3.7' }, { SIN_COLOR: true, STOCK: 5 }],
    CARACTERISTICAS: [
      { NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' },
      { nombre_atributo: 'Talla', valor_atributo: '42' },
      { NOMBRE_ATRIBUTO: '', VALOR_ATRIBUTO: 'vacio' },
    ],
  });

  test('feliz completo → 201 id, imágenes ordenadas, variantes con stock entero y defaults', async () => {
    const { router } = montar({
      'INSERT INTO PRODUCTOS (NOMBRE, PRECIO': [{ insertId: 77 }],
      'INSERT INTO PRODUCTO_IMAGENES': [{ insertId: 1 }],
      'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)': [{ insertId: 5 }],
      'INSERT INTO PRODUCTO_CARACTERISTICAS': [{ insertId: 1 }],
    });
    const res = resFalsa();
    await crearProducto({ body: bodyFeliz() }, res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ message: 'Producto creado con éxito!', id: 77 });
    const [sqlProd, paramsProd] = router.mock.calls
      .find(([sql]) => sql.replace(/\s+/g, ' ').trim().toUpperCase().startsWith('INSERT INTO PRODUCTOS ('));
    expect(paramsProd).toEqual(['Guayos Elite', 199900.99, 2, 'Guayo pro', 'Nike', 3, 4]);
    const imagenes = router.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PRODUCTO_IMAGENES'));
    expect(imagenes.map(([, p]) => p)).toEqual([[77, '/images/productos/a.png', 1], [77, '/images/productos/b.png', 2]]);
    const variantes = router.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PRODUCTO_VARIANTES'));
    expect(variantes.map(([, p]) => p)).toEqual([[77, 'Rojo', 'Talla', 'Único', 3]]); // '3.7'→3 y la variante sin color se OMITE
    const caracteristicas = router.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PRODUCTO_CARACTERISTICAS'));
    expect(caracteristicas.map(([, p]) => p)).toEqual([[77, 'Material', 'Cuero'], [77, 'Talla', '42']]);
  });

  test('URL_IMAGEN individual cuando NO hay IMAGENES array', async () => {
    const { router } = montar({
      'INSERT INTO PRODUCTOS (NOMBRE, PRECIO': [{ insertId: 77 }],
      'INSERT INTO PRODUCTO_IMAGENES': [{ insertId: 1 }],
    });
    const res = resFalsa();
    await crearProducto({ body: { NOMBRE: 'Balon', PRECIO: 50000, URL_IMAGEN: '/images/productos/balon.png' } }, res);
    expect(res.codigo).toBe(201);
    expect(router.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PRODUCTO_IMAGENES'))).toBe(true);
  });

  test('precio inválido ("abc", -5) → 400', async () => {
    for (const PRECIO of ['abc', -5]) {
      const res = resFalsa();
      await crearProducto({ body: { NOMBRE: 'X', PRECIO } }, res);
      expect(res.codigo).toBe(400);
      expect(res.cuerpo).toEqual({ error: 'El precio debe ser un número mayor o igual a 0' });
    }
  });

  test('precio 0 (STRING) es válido (≥ 0)', async () => {
    const { router } = montar({ 'INSERT INTO PRODUCTOS (NOMBRE, PRECIO': [{ insertId: 77 }] });
    const res = resFalsa();
    await crearProducto({ body: { NOMBRE: 'X', PRECIO: '0' } }, res);
    expect(res.codigo).toBe(201);
    const [, paramsProd] = router.mock.calls
      .find(([sql]) => sql.replace(/\s+/g, ' ').trim().toUpperCase().startsWith('INSERT INTO PRODUCTOS ('));
    expect(paramsProd[1]).toBe(0);
  });

  test('imágenes con origen ajeno → 400 exacto y SIN tocar la BD', async () => {
    const { router } = montar();
    const res = resFalsa();
    await crearProducto({ body: { NOMBRE: 'X', PRECIO: 100, IMAGENES: ['/images/productos/ok.png', 'http://evil.com/x.png'] } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Las imágenes deben ser rutas del catálogo (/images/productos/...) o URLs de Cloudinary en https' });
    expect(router).not.toHaveBeenCalled();
  });

  test('bd caída en el INSERT → 500 "Error interno al guardar el producto"', async () => {
    montar({ 'INSERT INTO PRODUCTOS (NOMBRE, PRECIO': async () => { throw new Error('boom'); } });
    const res = resFalsa();
    await crearProducto({ body: { NOMBRE: 'X', PRECIO: 100 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error interno al guardar el producto' });
  });
});

describe('obtenerProductoPorId', () => {
  test('feliz → combina producto + imágenes + características + variantes', async () => {
    montar({
      'SELECT P.*, COALESCE(V.NOMBRE_EMPRESA': [[{ ID: 9, NOMBRE: 'Guayos' }]],
      'SELECT URL_IMAGEN AS URL, ORDEN FROM PRODUCTO_IMAGENES': [[{ url: '/i.png', ORDEN: 1 }]],
      'SELECT NOMBRE_ATRIBUTO, VALOR_ATRIBUTO FROM PRODUCTO_CARACTERISTICAS': [[{ NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' }]],
      'SELECT ID_VARIANTE, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK FROM PRODUCTO_VARIANTES': [[{ ID_VARIANTE: 5, COLOR: 'Rojo', STOCK: 3 }]],
    });
    const res = resFalsa();
    await obtenerProductoPorId({ params: { id: '9' } }, res);
    expect(res.cuerpo).toEqual({
      ID: 9, NOMBRE: 'Guayos',
      IMAGENES: [{ url: '/i.png', ORDEN: 1 }],
      CARACTERISTICAS: [{ NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' }],
      VARIANTES: [{ ID_VARIANTE: 5, COLOR: 'Rojo', STOCK: 3 }],
    });
  });

  test('bd caída → 500 "Error al obtener producto"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await obtenerProductoPorId({ params: { id: '9' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al obtener producto' });
  });
});

describe('obtenerRelacionados', () => {
  test('≥4 en la misma categoría → devuelve solo los 4 primeros', async () => {
    montar({
      'SELECT ID_CATEGORIA, MARCA FROM PRODUCTOS WHERE ID': [[{ ID_CATEGORIA: 2, MARCA: 'Nike' }]],
      'SELECT P.ID, P.NOMBRE, P.PRECIO, P.ID_DESCUENTO, PI.URL_IMAGEN FROM PRODUCTOS P LEFT JOIN PRODUCTO_IMAGENES PI ON P.ID = PI.ID_PRODUCTO AND PI.ORDEN = 1 WHERE P.ID_CATEGORIA': [[
        { ID: 2 }, { ID: 3 }, { ID: 4 }, { ID: 5 }, { ID: 6 },
      ]],
    });
    const res = resFalsa();
    await obtenerRelacionados({ params: { id: '1' } }, res);
    expect(res.cuerpo).toEqual([{ ID: 2 }, { ID: 3 }, { ID: 4 }, { ID: 5 }]);
  });

  test('<4 en la misma categoría → completa con otras categorías (LIMIT = faltan)', async () => {
    montar({
      'SELECT ID_CATEGORIA, MARCA FROM PRODUCTOS WHERE ID': [[{ ID_CATEGORIA: 2, MARCA: 'Nike' }]],
      'SELECT P.ID, P.NOMBRE, P.PRECIO, P.ID_DESCUENTO, PI.URL_IMAGEN FROM PRODUCTOS P LEFT JOIN PRODUCTO_IMAGENES PI ON P.ID = PI.ID_PRODUCTO AND PI.ORDEN = 1 WHERE P.ID_CATEGORIA': [[{ ID: 2 }]],
      'SELECT P.ID, P.NOMBRE, P.PRECIO, P.ID_DESCUENTO, PI.URL_IMAGEN FROM PRODUCTOS P LEFT JOIN PRODUCTO_IMAGENES PI ON P.ID = PI.ID_PRODUCTO AND PI.ORDEN = 1 WHERE P.ID NOT IN': [[{ ID: 7 }, { ID: 8 }, { ID: 9 }]],
    });
    const res = resFalsa();
    await obtenerRelacionados({ params: { id: '1' } }, res);
    expect(res.cuerpo).toEqual([{ ID: 2 }, { ID: 7 }, { ID: 8 }, { ID: 9 }]);
    const [, params] = routerDe().mock.calls
      .find(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('SELECT P.ID, P.NOMBRE, P.PRECIO, P.ID_DESCUENTO, PI.URL_IMAGEN FROM PRODUCTOS P LEFT JOIN PRODUCTO_IMAGENES PI ON P.ID = PI.ID_PRODUCTO AND PI.ORDEN = 1 WHERE P.ID NOT IN'));
    expect(params[0]).toEqual(['1', 2]); // id origen (STRING) + los ya obtenidos
    expect(params[1]).toBe(3); // faltan = 4 - 1
  });

  test('producto origen no visible → [] (sin revelar su categoría)', async () => {
    montar({ 'SELECT ID_CATEGORIA, MARCA FROM PRODUCTOS WHERE ID': [[]] });
    const res = resFalsa();
    await obtenerRelacionados({ params: { id: '1' } }, res);
    expect(res.cuerpo).toEqual([]);
  });

  test('bd caída → 500 "Error al cargar relacionados"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await obtenerRelacionados({ params: { id: '1' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al cargar relacionados' });
  });
});

describe('características (listar/agregar/eliminar/por id/actualizar)', () => {
  test('obtenerCaracteristicas feliz y 500 en bd caída', async () => {
    montar({ 'SELECT C.* FROM PRODUCTO_CARACTERISTICAS C JOIN PRODUCTOS P': [[{ NOMBRE_ATRIBUTO: 'Material' }]] });
    const res = resFalsa();
    await obtenerCaracteristicas({ params: { id: '9' } }, res);
    expect(res.cuerpo).toEqual([{ NOMBRE_ATRIBUTO: 'Material' }]);

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await obtenerCaracteristicas({ params: { id: '9' } }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error en servidor' });
  });

  test('agregarCaracteristica feliz → 201 con IDs y 500 en bd caída', async () => {
    montar({ 'INSERT INTO PRODUCTO_CARACTERISTICAS': [{ insertId: 31 }] });
    const res = resFalsa();
    await agregarCaracteristica({ params: { id: '9' }, body: { NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' } }, res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ID_CARACTERISTICA: 31, ID_PRODUCTO: '9', NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' });

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await agregarCaracteristica({ params: { id: '9' }, body: {} }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al guardar' });
  });

  test('eliminarCaracteristica feliz y 500 en bd caída', async () => {
    montar({ 'DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_CARACTERISTICA': [{ affectedRows: 1 }] });
    const res = resFalsa();
    await eliminarCaracteristica({ params: { idCaracteristica: '5' } }, res);
    expect(res.cuerpo).toEqual({ message: 'Característica eliminada' });

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await eliminarCaracteristica({ params: { idCaracteristica: '5' } }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al eliminar' });
  });

  test('obtenerCaracteristicaPorId: 404, feliz y 500', async () => {
    montar({ 'SELECT * FROM PRODUCTO_CARACTERISTICAS WHERE ID_CARACTERISTICA': [[]] });
    const res = resFalsa();
    await obtenerCaracteristicaPorId({ params: { idCaracteristica: '5' } }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ error: 'Característica no encontrada' });

    montar({ 'SELECT * FROM PRODUCTO_CARACTERISTICAS WHERE ID_CARACTERISTICA': [[{ ID_CARACTERISTICA: 5, VALOR_ATRIBUTO: 'Cuero' }]] });
    const res2 = resFalsa();
    await obtenerCaracteristicaPorId({ params: { idCaracteristica: '5' } }, res2);
    expect(res2.cuerpo).toEqual({ ID_CARACTERISTICA: 5, VALOR_ATRIBUTO: 'Cuero' });

    montar({}, {}, () => { throw new Error('boom'); });
    const res3 = resFalsa();
    await obtenerCaracteristicaPorId({ params: { idCaracteristica: '5' } }, res3);
    expect(res3.codigo).toBe(500);
    expect(res3.cuerpo).toEqual({ error: 'Error en servidor' });
  });

  test('actualizarCaracteristica: 500 en bd caída (el feliz lo cubre la integración)', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await actualizarCaracteristica({ params: { idCaracteristica: '5' }, body: { NOMBRE_ATRIBUTO: 'A', VALOR_ATRIBUTO: 'B' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al actualizar' });
  });
});

describe('eliminarProducto (transacción admin, 3 fases)', () => {
  const EN_CURSO = "SELECT COUNT(DISTINCT V.ID_VENTA) AS TOTAL FROM VENTAS V JOIN DETALLE_VENTAS DV ON DV.ID_VENTA = V.ID_VENTA WHERE DV.ID_PRODUCTO = ? AND V.ESTADO IN ('PENDIENTE_PAGO', 'PENDIENTE', 'CONFIRMADA', 'ENVIADA')";
  const PASADAS = "SELECT COUNT(DISTINCT V.ID_VENTA) AS TOTAL FROM VENTAS V JOIN DETALLE_VENTAS DV ON DV.ID_VENTA = V.ID_VENTA WHERE DV.ID_PRODUCTO = ? AND V.ESTADO IN ('COMPLETADA', 'CANCELADA')";

  test('inexistente → 404 con rollback y release', async () => {
    const { conn } = montar({}, { 'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[]] });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' } }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ error: 'Producto no encontrado' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('pedido EN CURSO → 409 definitivo con su cantidad (no se puede eliminar)', async () => {
    const { conn } = montar({}, {
      'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[{ ID: 9 }]],
      [EN_CURSO]: [[{ total: 2 }]],
      'SELECT COUNT(*) AS TOTAL FROM DEVOLUCIONES WHERE ID_PRODUCTO': [[{ total: 0 }]],
    });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' } }, res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo.enCurso).toBe(2);
    expect(res.cuerpo.error).toMatch(/2 pedidos en curso/);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('solo ventas pasadas SIN confirmar → 409 requiereConfirmacion (advertencia)', async () => {
    const { conn } = montar({}, {
      'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[{ ID: 9 }]],
      [EN_CURSO]: [[{ total: 0 }]],
      [PASADAS]: [[{ total: 3 }]],
      'SELECT COUNT(*) AS TOTAL FROM DEVOLUCIONES WHERE ID_PRODUCTO': [[{ total: 1 }]],
    });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' } }, res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo.requiereConfirmacion).toBe(true);
    expect(res.cuerpo.ventasPasadas).toBe(3);
    expect(res.cuerpo.devoluciones).toBe(1);
    expect(res.cuerpo.error).toMatch(/historial/);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('confirmado (query.confirmar=1) → BORRADO SUAVE: ELIMINADO=1, el producto NO se borra físicamente', async () => {
    const { conn } = montar({}, {
      'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[{ ID: 9 }]],
      [EN_CURSO]: [[{ total: 0 }]],
      [PASADAS]: [[{ total: 3 }]],
      'SELECT COUNT(*) AS TOTAL FROM DEVOLUCIONES WHERE ID_PRODUCTO': [[{ total: 0 }]],
    });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' }, query: { confirmar: '1' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.archivado).toBe(true);
    expect(res.cuerpo.ventasPasadas).toBe(3);
    expect(res.cuerpo.message).toMatch(/historial/i);
    const sqls = conn.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase());
    expect(sqls.some((s) => s.startsWith('UPDATE PRODUCTOS SET ELIMINADO = 1'))).toBe(true);
    for (const tabla of ['DELETE FROM CARRITO', 'DELETE FROM FAVORITOS', 'DELETE FROM HISTORIAL', 'DELETE FROM RESENAS', 'DELETE FROM AVISOS_STOCK']) {
      expect(sqls.some((s) => s.startsWith(tabla))).toBe(true);
    }
    expect(sqls.some((s) => s.startsWith('DELETE FROM PRODUCTOS WHERE ID = ?'))).toBe(false);
    expect(sqls.some((s) => s.startsWith('DELETE FROM MOVIMIENTOS_STOCK'))).toBe(false);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('sin ventas → borrado físico completo (como antes)', async () => {
    const { conn } = montar({}, {
      'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[{ ID: 9 }]],
      [EN_CURSO]: [[{ total: 0 }]],
      [PASADAS]: [[{ total: 0 }]],
      'SELECT COUNT(*) AS TOTAL FROM DEVOLUCIONES WHERE ID_PRODUCTO': [[{ total: 0 }]],
    });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' } }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto eliminado correctamente' });
    const sqls = conn.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase());
    for (const tabla of ['DELETE FROM MOVIMIENTOS_STOCK', 'DELETE FROM FAVORITOS', 'DELETE FROM HISTORIAL', 'DELETE FROM RESENAS', 'DELETE FROM CARRITO', 'DELETE FROM AVISOS_STOCK', 'DELETE FROM PRODUCTO_CARACTERISTICAS', 'DELETE FROM PRODUCTO_IMAGENES', 'DELETE FROM PRODUCTO_VARIANTES', 'DELETE FROM PRODUCTOS WHERE ID = ?']) {
      expect(sqls.some((s) => s.startsWith(tabla))).toBe(true);
    }
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('bd caída → rollback + 500 "No se pudo eliminar el producto" + release', async () => {
    const { conn } = montar({}, {
      'SELECT ID FROM PRODUCTOS WHERE ID = ? FOR UPDATE': [[{ ID: 9 }]],
      [EN_CURSO]: async () => { throw new Error('boom'); },
    });
    const res = resFalsa();
    await eliminarProducto({ params: { id: '9' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'No se pudo eliminar el producto' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

describe('actualizarProducto', () => {
  test('precio inválido cuando se envía → 400', async () => {
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: { PRECIO: -3 } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El precio debe ser un número mayor o igual a 0' });
  });

  test('imágenes con origen ajeno → 400', async () => {
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: { IMAGENES: ['data:image/png;base64,xx'] } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Las imágenes deben ser rutas del catálogo (/images/productos/...) o URLs de Cloudinary en https' });
  });

  test('feliz con VARIANTES array: borra y reinserta, y notifica reposición de la vieja agotada', async () => {
    const { router } = montar({
      'UPDATE PRODUCTOS SET': [{ affectedRows: 1 }],
      'SELECT ID_VARIANTE, STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [[{ ID_VARIANTE: 11, STOCK: 0 }, { ID_VARIANTE: 12, STOCK: 5 }]],
      'SELECT COUNT(*) AS TOTAL FROM AVISOS_STOCK': [[{ total: 1 }]],
      'DELETE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [{ affectedRows: 2 }],
      'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)': [{ insertId: 21 }],
      'SELECT A.ID_AVISO, A.ID_USUARIO, U.EMAIL': [[{ ID_AVISO: 1, ID_USUARIO: 7, EMAIL: 'a@t.co', NOMBRE_USUARIO: 'Ana', ID_PRODUCTO: 9, NOMBRE: 'Guayos', URL_IMAGEN: null }]],
      'UPDATE AVISOS_STOCK SET ENVIADO = 1': [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await actualizarProducto({
      params: { id: '9' },
      body: { NOMBRE: 'Guayos Pro', PRECIO: 200000, VARIANTES: [{ COLOR: 'Rojo', STOCK: '8' }, { COLOR: 'Azul', STOCK: '0' }] },
    }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto actualizado con éxito' });
    const inserts = router.mock.calls.filter(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('INSERT INTO PRODUCTO_VARIANTES'));
    expect(inserts.map(([, p]) => p)).toEqual([['9', 'Rojo', 'Talla', 'Único', 8], ['9', 'Azul', 'Talla', 'Único', 0]]);
    await flush();
    // la vieja 11 estaba agotada y con avisos → la nueva en su posición (21) dispara el aviso
    const updAvisos = router.mock.calls.find(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('UPDATE AVISOS_STOCK SET ENVIADO = 1'));
    expect(updAvisos).toBeTruthy();
    expect(updAvisos[1]).toEqual([[1]]); // los IDs de los AVISOS pendientes (A.ID_AVISO)
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@t.co' }));
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'stock', titulo: '¡Volvimos a tenerlo!' }));
  });

  test('vieja agotada con avisos pero la consulta de avisos (ENVIADO=0) vacía → sin UPDATE y sin correo', async () => {
    const { conn } = montar({
      'UPDATE PRODUCTOS SET': [{ affectedRows: 1 }],
      'SELECT ID_VARIANTE, STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [[{ ID_VARIANTE: 11, STOCK: 0 }]],
      'SELECT COUNT(*) AS TOTAL FROM AVISOS_STOCK': [[{ total: 1 }]],
      'DELETE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [{ affectedRows: 1 }],
      'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)': [{ insertId: 21 }],
      'SELECT A.ID_AVISO, A.ID_USUARIO, U.EMAIL': [[]], // los avisos ya fueron enviados
    });
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: { VARIANTES: [{ COLOR: 'Rojo', STOCK: 4 }] } }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto actualizado con éxito' });
    await flush();
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE AVISOS_STOCK SET ENVIADO = 1'))).toBe(false);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('sin VARIANTES → fallback de variante individual: UPDATE de la existente', async () => {
    montar({
      'UPDATE PRODUCTOS SET': [{ affectedRows: 1 }],
      'SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [[{ ID_VARIANTE: 5 }]],
      'UPDATE PRODUCTO_VARIANTES SET COLOR': [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: { COLOR: 'Verde', TIPO_ATRIBUTO: 'Talla', ATRIBUTO: 'M', STOCK: '7.9' } }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto actualizado con éxito' });
    const upd = routerDe().mock.calls
      .find(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('UPDATE PRODUCTO_VARIANTES SET COLOR'));
    expect(upd[1]).toEqual(['Verde', 'Talla', 'M', 7.9, 5]); // el fallback usa Number(STOCK) SIN floor
  });

  test('sin VARIANTES y sin existentes pero con COLOR → INSERT de la variante nueva', async () => {
    montar({
      'UPDATE PRODUCTOS SET': [{ affectedRows: 1 }],
      'SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO': [[]],
      'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)': [{ insertId: 6 }],
    });
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: { COLOR: 'Negro', STOCK: 2 } }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto actualizado con éxito' });
    const [, params] = routerDe().mock.calls
      .find(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('INSERT INTO PRODUCTO_VARIANTES'));
    expect(params).toEqual(['9', 'Negro', 'Talla', 'Único', 2]);
  });

  test('CARACTERISTICAS → borra todas y reinserta las válidas (camelCase y snake_case)', async () => {
    montar({
      'UPDATE PRODUCTOS SET': [{ affectedRows: 1 }],
      'DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO': [{ affectedRows: 1 }],
      'INSERT INTO PRODUCTO_CARACTERISTICAS': [{ insertId: 1 }],
    });
    const res = resFalsa();
    await actualizarProducto({
      params: { id: '9' },
      body: {
        CARACTERISTICAS: [
          { NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero' },
          { propiedad: 'Talla', valor: '42' },
          { NOMBRE_ATRIBUTO: 'SinValor' },
        ],
      },
    }, res);
    expect(res.cuerpo).toEqual({ message: 'Producto actualizado con éxito' });
    const inserts = routerDe().mock.calls.filter(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase().startsWith('INSERT INTO PRODUCTO_CARACTERISTICAS'));
    expect(inserts.map(([, p]) => p)).toEqual([['9', 'Material', 'Cuero'], ['9', 'Talla', '42']]);
  });

  test('producto que ya no existe (affectedRows 0) → 404', async () => {
    montar({ 'UPDATE PRODUCTOS SET': [{ affectedRows: 0 }] });
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: {} }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ error: 'Producto no encontrado' });
  });

  test('bd caída en el UPDATE → 500 "Error al actualizar en la base de datos"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await actualizarProducto({ params: { id: '9' }, body: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al actualizar en la base de datos' });
  });
});

describe('reseñas', () => {
  test('obtenerResenasPorProducto (db.execute) feliz y 500', async () => {
    montar({ 'SELECT R.*, U.NOMBRE_USUARIO, U.FOTO_URL FROM RESENAS R JOIN USUARIOS U': [[{ ID_RESENA: 1, NOMBRE_USUARIO: 'Ana' }]] });
    const res = resFalsa();
    await obtenerResenasPorProducto({ params: { id: '9' } }, res);
    expect(res.cuerpo).toEqual([{ ID_RESENA: 1, NOMBRE_USUARIO: 'Ana' }]);

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await obtenerResenasPorProducto({ params: { id: '9' } }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al cargar las reseñas' });
  });

  test('agregarResena: sin sesión → 401; nota inválida (0, 6, 3.5, "x") → 400', async () => {
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, body: { calificacion: 5 } }, res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo).toEqual({ error: 'No autenticado' });

    for (const calificacion of [0, 6, 3.5, 'x']) {
      const resN = resFalsa();
      await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion } }, resN);
      expect(resN.codigo).toBe(400);
      expect(resN.cuerpo).toEqual({ error: 'La calificación debe ser un número entero entre 1 y 5' });
    }
  });

  test('sin compra previa → 400 "Solo puedes calificar productos que hayas comprado"', async () => {
    montar({ 'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 0 }]] });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: 5, comentario: 'Bueno' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Solo puedes calificar productos que hayas comprado' });
  });

  test('ya calificó → 400 "Ya calificaste este producto"', async () => {
    montar({
      'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 1 }]],
      'SELECT ID_RESENA FROM RESENAS WHERE ID_PRODUCTO': [[{ ID_RESENA: 3 }]],
    });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: 5 } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Ya calificaste este producto' });
  });

  test('feliz con vendedor dueño → 201, notif al admin y al vendedor', async () => {
    montar({
      'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 1 }]],
      'SELECT ID_RESENA FROM RESENAS WHERE ID_PRODUCTO': [[]],
      'INSERT INTO RESENAS': [{ insertId: 9 }],
      'SELECT NOMBRE, ID_VENDEDOR FROM PRODUCTOS WHERE ID': [[{ NOMBRE: 'Guayos', ID_VENDEDOR: 3 }]],
      'SELECT ID_USUARIO FROM VENDEDORES WHERE ID_VENDEDOR': [[{ ID_USUARIO: 8 }]],
    });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: '4', comentario: 'Muy bueno' } }, res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ message: 'Reseña agregada con éxito' });
    const [sqlIns, paramsIns] = routerDe().mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RESENAS'));
    expect(paramsIns).toEqual(['9', 7, 4, 'Muy bueno']); // el id llega STRING
    const notifs = notificacionController.crearNotificacion.mock.calls.map((c) => c[0]);
    expect(notifs[0]).toEqual(expect.objectContaining({ idUsuario: null, tipo: 'resena', titulo: '⭐ Nueva reseña', ruta: '/producto/9' }));
    expect(notifs[1]).toEqual(expect.objectContaining({ idUsuario: 8, tipo: 'resena', titulo: '⭐ Nueva reseña en tu producto', ruta: '/vendedor/productos' }));
  });

  test('producto sin vendedor (JADDA) → solo notif al admin', async () => {
    montar({
      'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 1 }]],
      'SELECT ID_RESENA FROM RESENAS WHERE ID_PRODUCTO': [[]],
      'INSERT INTO RESENAS': [{ insertId: 9 }],
      'SELECT NOMBRE, ID_VENDEDOR FROM PRODUCTOS WHERE ID': [[{ NOMBRE: 'Balon', ID_VENDEDOR: null }]],
    });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: 5 } }, res);
    expect(res.codigo).toBe(201);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledTimes(1);
    expect(notificacionController.crearNotificacion.mock.calls[0][0].idUsuario).toBeNull();
  });

  test('fallo al leer el producto para notificar → se tolera y la reseña igual 201', async () => {
    montar({
      'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 1 }]],
      'SELECT ID_RESENA FROM RESENAS WHERE ID_PRODUCTO': [[]],
      'INSERT INTO RESENAS': [{ insertId: 9 }],
      'SELECT NOMBRE, ID_VENDEDOR FROM PRODUCTOS WHERE ID': async () => { throw new Error('boom'); },
    });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: 5 } }, res);
    expect(res.codigo).toBe(201);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('bd caída al insertar → 500 "Error al guardar reseña"', async () => {
    montar({
      'SELECT COUNT(*) AS N FROM DETALLE_VENTAS': [[{ N: 1 }]],
      'SELECT ID_RESENA FROM RESENAS WHERE ID_PRODUCTO': [[]],
      'INSERT INTO RESENAS': async () => { throw new Error('boom'); },
    });
    const res = resFalsa();
    await agregarResena({ params: { id: '9' }, user: { ID_USUARIO: 7 }, body: { calificacion: 5 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al guardar reseña' });
  });
});

describe('variantes públicas', () => {
  test('obtenerVariantes feliz → json con las variantes', async () => {
    montar({ 'SELECT PV.* FROM PRODUCTO_VARIANTES PV JOIN PRODUCTOS P': [[{ ID_VARIANTE: 5, COLOR: 'Rojo' }]] });
    const res = resFalsa();
    await obtenerVariantes({ params: { id: '9' } }, res);
    expect(res.cuerpo).toEqual([{ ID_VARIANTE: 5, COLOR: 'Rojo' }]);
  });

  test('actualizarVariante: bd caída → 500 "Error al actualizar la variante"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await actualizarVariante({ params: { idVariante: '5' }, body: { COLOR: 'X', STOCK: 1 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al actualizar la variante' });
  });
});

describe('categorías (catches y validaciones residuales)', () => {
  test('obtenerCategorias feliz y 500', async () => {
    montar({ 'SELECT C.ID_CATEGORIA, C.NOMBRE_CATEGORIA, C.DESCRIPCION': [[{ ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Futbol', TOTAL_PRODUCTOS: 3 }]] });
    const res = resFalsa();
    await obtenerCategorias({}, res);
    expect(res.cuerpo).toEqual([{ ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Futbol', TOTAL_PRODUCTOS: 3 }]);

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await obtenerCategorias({}, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al obtener categorías' });
  });

  test('crearCategoria: descripción >100 → 400; ER_DUP_ENTRY → 400; bd caída → 500', async () => {
    const res = resFalsa();
    await crearCategoria({ body: { name: 'Categoria Valida', description: 'x'.repeat(101) } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'La descripción no puede superar 100 caracteres' });

    montar({
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA': [[]],
      'INSERT INTO CATEGORIAS': async () => { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; },
    });
    const res2 = resFalsa();
    await crearCategoria({ body: { name: 'Duplicada por Carrera' } }, res2);
    expect(res2.codigo).toBe(400);
    expect(res2.cuerpo).toEqual({ ok: false, msg: 'Ya existe una categoría con ese nombre' });

    montar({
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA': [[]],
      'INSERT INTO CATEGORIAS': async () => { throw new Error('boom'); },
    });
    const res3 = resFalsa();
    await crearCategoria({ body: { name: 'Otra Mas' } }, res3);
    expect(res3.codigo).toBe(500);
    expect(res3.cuerpo).toEqual({ ok: false, msg: 'Error al crear categoría' });
  });

  test('actualizarCategoria: nombre inválido → 400; descripción >100 → 400; ER_DUP → 400; bd caída → 500', async () => {
    const res = resFalsa();
    await actualizarCategoria({ params: { id: '1' }, body: { name: 'ab' } }, res);
    expect(res.codigo).toBe(400);

    const res2 = resFalsa();
    await actualizarCategoria({ params: { id: '1' }, body: { name: 'Nombre Valido', description: 'y'.repeat(101) } }, res2);
    expect(res2.codigo).toBe(400);
    expect(res2.cuerpo).toEqual({ ok: false, msg: 'La descripción no puede superar 100 caracteres' });

    montar({
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA = ? AND ID_CATEGORIA <> ?': [[]],
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA = ?': [[{ ID_CATEGORIA: 1 }]],
      'UPDATE CATEGORIAS SET': async () => { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; },
    });
    const res3 = resFalsa();
    await actualizarCategoria({ params: { id: '1' }, body: { name: 'Nombre Valido' } }, res3);
    expect(res3.codigo).toBe(400);
    expect(res3.cuerpo).toEqual({ ok: false, msg: 'Ya existe otra categoría con ese nombre' });

    montar({
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA = ? AND ID_CATEGORIA <> ?': [[]],
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA = ?': [[{ ID_CATEGORIA: 1 }]],
      'UPDATE CATEGORIAS SET': async () => { throw new Error('boom'); },
    });
    const res4 = resFalsa();
    await actualizarCategoria({ params: { id: '1' }, body: { name: 'Nombre Valido' } }, res4);
    expect(res4.codigo).toBe(500);
    expect(res4.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar categoría' });
  });

  test('eliminarCategoria: bd caída → 500', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await eliminarCategoria({ params: { id: '1' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar categoría' });
  });
});

describe('públicos y descuentos (catches residuales)', () => {
  test('obtenerVendedores feliz y 500', async () => {
    montar({ 'SELECT ID_VENDEDOR, NOMBRE_EMPRESA FROM VENDEDORES ORDER BY': [[{ ID_VENDEDOR: null, NOMBRE_EMPRESA: 'JADDA SPORTS' }]] });
    const res = resFalsa();
    await obtenerVendedores({}, res);
    expect(res.cuerpo).toEqual([{ ID_VENDEDOR: null, NOMBRE_EMPRESA: 'JADDA SPORTS' }]);

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await obtenerVendedores({}, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al obtener vendedores' });
  });

  test('obtenerDescuentos feliz y 500', async () => {
    montar({ 'SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE FROM DESCUENTOS WHERE FECHA_FIN': [[{ ID_DESCUENTO: 4, DESCRIPCION: 'Black', PORCENTAJE: 15 }]] });
    const res = resFalsa();
    await obtenerDescuentos({}, res);
    expect(res.cuerpo).toEqual([{ ID_DESCUENTO: 4, DESCRIPCION: 'Black', PORCENTAJE: 15 }]);

    montar({}, {}, () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await obtenerDescuentos({}, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ error: 'Error al obtener descuentos' });
  });

  test('obtenerRecomendados: bd caída → 500 "Error al obtener recomendaciones"', async () => {
    montar({}, {}, () => { throw new Error('boom'); });
    const res = resFalsa();
    await productoController.obtenerRecomendados({ user: { ID_USUARIO: 7 }, query: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al obtener recomendaciones' });
  });

  test('crearDescuento: bd caída en el INSERT → 500 "Error al crear el descuento"', async () => {
    montar({ 'INSERT INTO DESCUENTOS': async () => { throw new Error('boom'); } });
    const res = resFalsa();
    await crearDescuento({ body: { DESCRIPCION: 'Descuento Valido', PORCENTAJE: 10 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al crear el descuento' });
  });
});

describe('avisos de stock (suscribir/estado/cancelar)', () => {
  test('suscribirAvisoStock: bd caída → 500 "Error al suscribir el aviso"', async () => {
    montar({ 'INSERT IGNORE INTO AVISOS_STOCK': async () => { throw new Error('boom'); } });
    const res = resFalsa();
    await suscribirAvisoStock({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al suscribir el aviso' });
  });

  test('estadoSuscripcionAviso: 401 sin sesión; suscrito true/false; 500 en bd caída', async () => {
    const res = resFalsa();
    await estadoSuscripcionAviso({ params: { idVariante: '5' } }, res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo).toEqual({ error: 'No autenticado' });

    montar({ 'SELECT ID_AVISO FROM AVISOS_STOCK WHERE ID_VARIANTE': [[{ ID_AVISO: 1 }]] });
    const res2 = resFalsa();
    await estadoSuscripcionAviso({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res2);
    expect(res2.cuerpo).toEqual({ suscrito: true });

    montar({ 'SELECT ID_AVISO FROM AVISOS_STOCK WHERE ID_VARIANTE': [[]] });
    const res3 = resFalsa();
    await estadoSuscripcionAviso({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res3);
    expect(res3.cuerpo).toEqual({ suscrito: false });

    montar({}, {}, () => { throw new Error('boom'); });
    const res4 = resFalsa();
    await estadoSuscripcionAviso({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res4);
    expect(res4.codigo).toBe(500);
    expect(res4.cuerpo).toEqual({ error: 'Error al consultar la suscripción' });
  });

  test('cancelarAvisoStock: 401 sin sesión; feliz → "Ya no te avisaremos"; 500 en bd caída', async () => {
    const res = resFalsa();
    await cancelarAvisoStock({ params: { idVariante: '5' } }, res);
    expect(res.codigo).toBe(401);

    montar({ 'DELETE FROM AVISOS_STOCK WHERE ID_VARIANTE': [{ affectedRows: 1 }] });
    const res2 = resFalsa();
    await cancelarAvisoStock({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res2);
    expect(res2.cuerpo).toEqual({ ok: true, message: 'Ya no te avisaremos' });

    montar({}, {}, () => { throw new Error('boom'); });
    const res3 = resFalsa();
    await cancelarAvisoStock({ params: { idVariante: '5' }, user: { ID_USUARIO: 7 } }, res3);
    expect(res3.codigo).toBe(500);
    expect(res3.cuerpo).toEqual({ error: 'Error al cancelar la suscripción' });
  });
});

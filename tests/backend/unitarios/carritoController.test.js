/**
 * carritoController — carrito de compras (unit).
 *
 * El controlador importa el pool real de config/db (sin _useDb): la BD falsa
 * muta las PROPIEDADES del singleton (db.query) ANTES del require del SUT.
 * Aquí se ejercitan: validarCantidad (vía agregar/actualizar), el bloqueo de
 * vendedores (403), los guardas de variante/stock, la actualización vs inserción
 * del mismo item, y eliminarDelCarrito/actualizarCantidad con 404.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');

const carritoController = require('../../../backend/controllers/carritoController');
const { agregarAlCarrito, obtenerCarrito, eliminarDelCarrito, actualizarCantidad } = carritoController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({
  user: { ID_USUARIO: 7, ID_ROL: 4 },
  params: {},
  body: {},
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.query = vi.fn(async () => [[]]);
});

describe('agregarAlCarrito — guardas', () => {
  test('vendedor (rol 6) → 403 sin tocar la BD', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ user: { ID_USUARIO: 7, ID_ROL: 6 }, body: { id_producto: 1, id_variante: 2, cantidad: 1 } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toBe('Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras.');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('sin producto o variante → 400', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { cantidad: 1 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Producto y variante son obligatorios');
  });

  test('cantidad ausente → 400 "La cantidad es obligatoria"', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('La cantidad es obligatoria');
  });

  test('cantidad vacía ("" / null) → 400 obligatoria', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: '' } }), res);
    expect(res.cuerpo.msg).toBe('La cantidad es obligatoria');

    const res2 = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: null } }), res2);
    expect(res2.cuerpo.msg).toBe('La cantidad es obligatoria');
  });

  test('cantidad no entera ("abc", 1.5) → 400 entero', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 'abc' } }), res);
    expect(res.cuerpo.msg).toBe('La cantidad debe ser un número entero');

    const res2 = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 1.5 } }), res2);
    expect(res2.cuerpo.msg).toBe('La cantidad debe ser un número entero');
  });

  test('cantidad fuera de rango (0, 100) → 400 entre 1 y 99', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 0 } }), res);
    expect(res.cuerpo.msg).toBe('La cantidad debe estar entre 1 y 99');

    const res2 = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 100 } }), res2);
    expect(res2.cuerpo.msg).toBe('La cantidad debe estar entre 1 y 99');
  });

  test('variante inexistente → 404 "Variante no existe"', async () => {
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 1 } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Variante no existe');
  });

  test('stock insuficiente → 400', async () => {
    db.query = vi.fn(async (sql) => {
      if (sql.toUpperCase().startsWith('SELECT PV.* FROM PRODUCTO_VARIANTES')) return [[{ ID_VARIANTE: 2, STOCK: 0 }]];
      return [[]];
    });
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 1 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Stock insuficiente');
  });

  test('fallo de BD → 500 "Error del servidor"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 1 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error del servidor' });
  });
});

describe('agregarAlCarrito — update vs insert', () => {
  test('item ya en carrito y stock excede → 400 "Solo hay X unidades disponibles."', async () => {
    db.query = vi.fn(async (sql) => {
      if (sql.toUpperCase().startsWith('SELECT PV.* FROM PRODUCTO_VARIANTES')) return [[{ ID_VARIANTE: 2, STOCK: 5 }]];
      if (sql.toUpperCase().startsWith('SELECT * FROM CARRITO')) return [[{ ID_CARRITO: 1, CANTIDAD: 4 }]];
      return [[]];
    });
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 2 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo hay 5 unidades disponibles.');
  });

  test('item ya en carrito con stock → UPDATE y 200 "Carrito actualizado"', async () => {
    const dbq = vi.fn(async (sql) => {
      if (sql.toUpperCase().startsWith('SELECT PV.* FROM PRODUCTO_VARIANTES')) return [[{ ID_VARIANTE: 2, STOCK: 5 }]];
      if (sql.toUpperCase().startsWith('SELECT * FROM CARRITO')) return [[{ ID_CARRITO: 1, CANTIDAD: 4 }]];
      return [[]];
    });
    db.query = dbq;
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 1 } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Carrito actualizado' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE CARRITO SET CANTIDAD'));
    expect(update[1]).toEqual([5, 1]);
  });

  test('item nuevo → INSERT y 201 "Producto agregado al carrito"', async () => {
    const dbq = vi.fn(async (sql) => {
      if (sql.toUpperCase().startsWith('SELECT PV.* FROM PRODUCTO_VARIANTES')) return [[{ ID_VARIANTE: 2, STOCK: 5 }]];
      return [[]];
    });
    db.query = dbq;
    const res = resFalsa();
    await agregarAlCarrito(req({ body: { id_producto: 1, id_variante: 2, cantidad: 2 } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Producto agregado al carrito' });
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CARRITO'));
    expect(insert[1]).toEqual([7, 1, 2, 2]);
  });
});

describe('obtenerCarrito', () => {
  test('devuelve filas', async () => {
    db.query = vi.fn(async () => [[{ ID_CARRITO: 1, NOMBRE: 'Bola' }]]);
    const res = resFalsa();
    await obtenerCarrito(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE).toBe('Bola');
  });

  test('fallo de BD → 500 { msg }', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await obtenerCarrito(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ msg: 'Error al obtener el carrito' });
  });
});

describe('eliminarDelCarrito', () => {
  test('item ajeno o inexistente → 404 "Item no encontrado"', async () => {
    db.query = vi.fn(async () => [{ affectedRows: 0 }]);
    const res = resFalsa();
    await eliminarDelCarrito(req({ params: { id_carrito: '1' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Item no encontrado' });
  });

  test('eliminado → 200 "Producto eliminado" con params del dueño', async () => {
    const dbq = vi.fn(async () => [{ affectedRows: 1 }]);
    db.query = dbq;
    const res = resFalsa();
    await eliminarDelCarrito(req({ params: { id_carrito: '3' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Producto eliminado' });
    expect(dbq.mock.calls[0][1]).toEqual(['3', 7]);
  });

  test('fallo de BD → 500 "Error al eliminar"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await eliminarDelCarrito(req({ params: { id_carrito: '1' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar' });
  });
});

describe('actualizarCantidad', () => {
  test('cantidad inválida → 400 (validarCantidad)', async () => {
    const res = resFalsa();
    await actualizarCantidad(req({ params: { id_carrito: '1' }, body: { cantidad: 0 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('La cantidad debe estar entre 1 y 99');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('item ajeno o inexistente → 404', async () => {
    const res = resFalsa();
    await actualizarCantidad(req({ params: { id_carrito: '9' }, body: { cantidad: 2 } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Item no encontrado' });
  });

  test('stock insuficiente → 400', async () => {
    db.query = vi.fn(async () => [[{ STOCK: 1 }]]);
    const res = resFalsa();
    await actualizarCantidad(req({ params: { id_carrito: '1' }, body: { cantidad: 5 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Stock insuficiente');
  });

  test('cantidad válida → UPDATE y 200 "Cantidad actualizada"', async () => {
    const dbq = vi.fn(async (sql) => {
      if (sql.toUpperCase().startsWith('SELECT PV.STOCK FROM CARRITO')) return [[{ STOCK: 10 }]];
      return [{ affectedRows: 1 }];
    });
    db.query = dbq;
    const res = resFalsa();
    await actualizarCantidad(req({ params: { id_carrito: '1' }, body: { cantidad: 3 } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Cantidad actualizada' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE CARRITO SET CANTIDAD'));
    expect(update[1]).toEqual([3, '1', 7]);
  });

  test('fallo de BD → 500 "Error al actualizar"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await actualizarCantidad(req({ params: { id_carrito: '1' }, body: { cantidad: 3 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al actualizar' });
  });
});

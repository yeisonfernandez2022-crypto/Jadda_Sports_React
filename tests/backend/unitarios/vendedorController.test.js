/**
 * vendedorController — validaciones y errores (unit).
 *
 * El ciclo COMPLETO del vendedor (solicitud → aprobación → tienda → ventas →
 * devoluciones) vive en la INTEGRACIÓN. Aquí se cubren las validaciones de
 * entrada y los errores del flujo que la integración no alcanza.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');

notificacionController.crearNotificacion = vi.fn(async () => ({}));

const vendedorController = require('../../../backend/controllers/vendedorController');
const { crearProductoVendedor, actualizarProductoVendedor, eliminarProductoVendedor, actualizarEmpresa, actualizarEnvioVenta, actualizarEstadoVenta, miTienda } = vendedorController;

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const VENDEDOR = { ID_VENDEDOR: 3, ID_USUARIO: 8, NOMBRE_EMPRESA: 'Tienda Probe' };

const dbVend = (mapa = {}) => ({
  query: vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const [clave, respuesta] of Object.entries(mapa)) {
      if (s.startsWith(clave.toUpperCase())) return typeof respuesta === 'function' ? respuesta(params) : respuesta;
    }
    if (s.startsWith('SELECT * FROM PRODUCTOS WHERE ID')) return [[{ ID: 1, ID_VENDEDOR: 3, ESTADO_PUBLICACION: 'PENDIENTE' }]];
    if (s.startsWith('SELECT ID_DESCUENTO, PORCENTAJE, FECHA_FIN FROM DESCUENTOS WHERE')) return [[]];
    if (s.startsWith('SELECT D.ID_DEVOLUCION') || s.includes('FROM DEVOLUCIONES')) return [[]];
    if (s.startsWith('INSERT INTO PRODUCTOS')) return [{ insertId: 55 }];
    if (s.startsWith('INSERT INTO')) return [{ insertId: 60 }];
    if (s.startsWith('SELECT V.ID_VENTA FROM VENTAS')) return [[]];
    if (s.startsWith('SELECT ID_VENTA, ID_CLIENTE, ESTADO, DATOS_PAGO')) return [[]];
    if (s.startsWith('SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS')) return [[]];
    if (s.startsWith('SELECT ID_PRODUCTO, ID_VARIANTE, CANTIDAD')) return [[]];
    return [[{}]];
  }),
});

const reqVend = (body = {}) => ({ vendedor: VENDEDOR, user: { ID_USUARIO: 8, ID_ROL: 6 }, body, params: {}, query: {} });

beforeEach(() => {
  vi.clearAllMocks();
  vendedorController._useDb(dbVend());
});

describe('crearProductoVendedor (validaciones)', () => {
  test('sin nombre o precio → 400', async () => {
    const res1 = resFalsa();
    await crearProductoVendedor(reqVend({ NOMBRE: '', PRECIO: 100 }), res1);
    expect(res1.codigo).toBe(400);
    const res2 = resFalsa();
    await crearProductoVendedor(reqVend({ NOMBRE: 'X', PRECIO: undefined }), res2);
    expect(res2.codigo).toBe(400);
  });

  test('producto válido nace PENDIENTE (INSERT con ESTADO_PUBLICACION PENDIENTE)', async () => {
    const db = dbVend();
    vendedorController._useDb(db);
    const res = resFalsa();
    await crearProductoVendedor(reqVend({ NOMBRE: 'Producto Probe', PRECIO: 50000, IMAGENES: ['/images/productos/Producto_01/img_1.jpg'], VARIANTES: [{ COLOR: 'Azul', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'M', STOCK: 3 }] }), res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
    const insert = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('INSERT INTO PRODUCTOS'));
    expect(String(insert[0])).toContain("'PENDIENTE'");
  });

  test('descuento de OTRO vendedor o RETO- se descarta silenciosamente (seguridad)', async () => {
    const db = dbVend({ 'SELECT ID_DESCUENTO FROM DESCUENTOS': [[]] });
    vendedorController._useDb(db);
    const res = resFalsa();
    await crearProductoVendedor(reqVend({ NOMBRE: 'Con descuento ajeno', PRECIO: 10000, ID_DESCUENTO: 99 }), res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
    const insert = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('INSERT INTO PRODUCTOS'));
    expect(insert[1][6] ?? null).toBeNull(); // idDescuentoFinal null
  });

  test('fallo de BD → 500', async () => {
    vendedorController._useDb({ query: vi.fn(async () => { throw new Error('BD'); }) });
    const res = resFalsa();
    await crearProductoVendedor(reqVend({ NOMBRE: 'X', PRECIO: 100 }), res);
    expect(res.codigo).toBe(500);
  });
});

describe('actualizarProductoVendedor y eliminar (guard de propiedad/estado)', () => {
  test('producto de OTRO vendedor → 404 (no te pertenece)', async () => {
    const db = dbVend({ 'SELECT * FROM PRODUCTOS WHERE ID': [[]] });
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarProductoVendedor({ vendedor: VENDEDOR, user: { ID_USUARIO: 8, ID_ROL: 6 }, body: { NOMBRE: 'Hack', PRECIO: 1 }, params: { id: 1 } }, res);
    expect(res.codigo).toBe(404);
  });

  test('producto APROBADO no se elimina (400 con mensaje)', async () => {
    const db = dbVend({ 'SELECT * FROM PRODUCTOS WHERE ID': [[{ ID: 1, ID_VENDEDOR: 3, ESTADO_PUBLICACION: 'APROBADO' }]] });
    vendedorController._useDb(db);
    const res = resFalsa();
    await eliminarProductoVendedor(reqVend(), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('aprobado');
  });

  test('editar producto vuelve a PENDIENTE (re-aprobación obligatoria)', async () => {
    const db = dbVend({ 'SELECT * FROM PRODUCTOS WHERE ID': [[{ ID: 1, ID_VENDEDOR: 3, ESTADO_PUBLICACION: 'APROBADO' }]] });
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarProductoVendedor(reqVend({ NOMBRE: 'Editado', PRECIO: 20000 }), res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
  });
});

describe('actualizarEmpresa (validaciones por campo)', () => {
  test('teléfono malformado → 400', async () => {
    const res = resFalsa();
    await actualizarEmpresa(reqVend({ TELEFONO: 'hola' }), res);
    expect(res.codigo).toBe(400);
  });

  test('departamento/ciudad fuera de rango → 400', async () => {
    const res1 = resFalsa();
    await actualizarEmpresa(reqVend({ DEPARTAMENTO: 'x' }), res1);
    expect(res1.codigo).toBe(400);
    const res2 = resFalsa();
    await actualizarEmpresa(reqVend({ CIUDAD: 'y' }), res2);
    expect(res2.codigo).toBe(400);
  });

  test('solo NIT y correo NO se actualizan (los updates no los tocan)', async () => {
    const db = dbVend();
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarEmpresa(reqVend({ TELEFONO: '3001112233', DEPARTAMENTO: 'Cundinamarca', CIUDAD: 'Chía', DIRECCION: 'Cra 1' }), res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
    const update = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE VENDEDORES'));
    expect(String(update[0]).toUpperCase()).not.toContain('NIT');
    expect(String(update[0]).toUpperCase()).not.toContain('EMAIL_VENDEDOR');
  });
});

describe('ventas del vendedor (reembolso automático al cancelar)', () => {
  test('cancelar SU venta pagada pre-despacho → reembolso incluido en la respuesta', async () => {
    const db = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[{ ID_VENTA: 15 }]],
      'SELECT ID_VENTA, ID_CLIENTE, ESTADO, DATOS_PAGO': [[{ ID_VENTA: 15, ID_CLIENTE: 7, ESTADO: 'COMPLETADA', DATOS_PAGO: null }]],
      'SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS': [[{ ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: 9000 }]],
      'SELECT ID_PRODUCTO, ID_VARIANTE, CANTIDAD': [[{ ID_PRODUCTO: 1, CANTIDAD: 1 }]],
      'SELECT ESTADO FROM VENTAS WHERE ID_VENTA': [[{ ESTADO: 'PENDIENTE_PAGO' }]],
    });
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 15 }, body: { estado: 'CANCELADA' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res);
    expect(res.cuerpo).toBeTruthy();
  });

  test('venta AJENA al vendedor → 403', async () => {
    const db = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[]],
    });
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 16 }, body: { estado: 'CANCELADA' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res);
    expect(res.codigo).toBe(403);
  });

  test('estado inválido → 400; PENDIENTE_PAGO a mano → 400; CANCELADA no revive', async () => {
    const db = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[{ ID_VENTA: 15 }]],
      'SELECT ESTADO FROM VENTAS WHERE ID_VENTA': [[{ ESTADO: 'COMPLETADA' }]],
    });
    vendedorController._useDb(db);
    const res1 = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 15 }, body: { estado: 'RARA' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res1);
    expect(res1.codigo).toBe(400);

    const db2 = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[{ ID_VENTA: 15 }]],
      'SELECT ESTADO FROM VENTAS WHERE ID_VENTA': [[{ ESTADO: 'COMPLETADA' }]],
    });
    vendedorController._useDb(db2);
    const res2 = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 15 }, body: { estado: 'PENDIENTE_PAGO' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res2);
    expect(res2.codigo).toBe(400);
    expect(res2.cuerpo.msg).toContain('pasarela');

    const db3 = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[{ ID_VENTA: 15 }]],
      'SELECT ESTADO FROM VENTAS WHERE ID_VENTA': [[{ ESTADO: 'CANCELADA' }]],
    });
    vendedorController._useDb(db3);
    const res3 = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 15 }, body: { estado: 'COMPLETADA' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res3);
    expect(res3.codigo).toBe(400);
    expect(res3.cuerpo.msg).toContain('cancelada');
  });

  test('repetir el MISMO estado → sinCambios (idempotencia sin notificación)', async () => {
    const db = dbVend({
      'SELECT V.ID_VENTA FROM VENTAS': [[{ ID_VENTA: 15 }]],
      'SELECT ESTADO FROM VENTAS WHERE ID_VENTA': [[{ ESTADO: 'COMPLETADA' }]],
    });
    vendedorController._useDb(db);
    const res = resFalsa();
    await actualizarEstadoVenta({ vendedor: VENDEDOR, params: { id: 15 }, body: { estado: 'COMPLETADA' }, user: { ID_USUARIO: 8, ID_ROL: 6 } }, res);
    expect(res.cuerpo.sinCambios).toBe(true);
  });
});

describe('miTienda (KPIs)', () => {
  test('devuelve el objeto de KPIs del vendedor', async () => {
    const db = dbVend({
      'SELECT (SELECT COUNT(*) FROM PRODUCTOS': [[{ productosPublicados: 5, productosPendientes: 1, unidadesVendidas: 8, totalVentas: 3 }]],
    });
    vendedorController._useDb(db);
    const res = resFalsa();
    await miTienda(reqVend(), res);
    expect(res.cuerpo).toBeTruthy();
  });
});

/**
 * devolucionController — solicitudes de devolución/reembolso (RF-033, unit).
 *
 * La BD se inyecta con _useDb: la conexión falsa decide qué devuelve cada
 * query por su PREFIJO SQL. Los flujos felices con MySQL real viven en la
 * suite de INTEGRACIÓN; aquí se ejercitan:
 * - guardas de entrada de solicitarDevolucion (401/400/motivos/ventana)
 * - la transacción FOR UPDATE por ítem (disponible, evidencias, rollback)
 * - las 4 decisiones del admin (devolver/reembolsar/mas_pruebas/rechazar),
 *   incluida la re-mapeo legacy {estado} y el reingreso de stock
 * - evidencias (subir, agregar con tope de 5, eliminar con contención de ruta)
 * - post-commit: notificación a vendedor/JADDA y correo no bloqueante
 *
 * Deps mutables se REEMPLAZAN ANTES del require del SUT (destructuring en carga).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');
const mailer = require('../../../backend/config/mailer');
const movimientosStock = require('../../../backend/utils/movimientosStock');
const cloudinaryUtils = require('../../../backend/utils/cloudinary');
const chatController = require('../../../backend/controllers/chatController');

// Mutaciones ANTES del require del SUT (destructuring en carga).
notificacionController.crearNotificacion = vi.fn(async () => ({}));
mailer.sendMail = vi.fn(async () => ({}));
movimientosStock.registrarMovimientoStock = vi.fn(async () => ({}));
cloudinaryUtils.estaConfigurado = vi.fn(() => false);
cloudinaryUtils.subirArchivoLocal = vi.fn(async () => ({ secure_url: 'https://res.cloudinary.com/jadda/image/upload/subida.jpg' }));
cloudinaryUtils.eliminarPorUrl = vi.fn(async () => ({}));
chatController.cerrarChatDeDevolucion = vi.fn(async () => ({}));

const devolucionController = require('../../../backend/controllers/devolucionController');
const { solicitarDevolucion, misDevoluciones, todas, procesar, subirEvidencias, agregarEvidencias, eliminarEvidencia } = devolucionController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

/** Conexión falsa con mapa por prefijo SQL; respuesta callable puede lanzar. */
const conexionFalsa = (mapa = {}) => ({
  query: vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const [clave, respuesta] of Object.entries(mapa)) {
      if (s.startsWith(clave.toUpperCase())) {
        return typeof respuesta === 'function' ? respuesta() : respuesta;
      }
    }
    return [[]];
  }),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

const dbFalso = (mapaConexion = {}, mapaDb = {}) => {
  const conn = conexionFalsa(mapaConexion);
  return { conn, db: { query: conexionFalsa(mapaDb).query, getConnection: vi.fn(async () => conn) } };
};

const req = (over = {}) => ({
  user: { ID_USUARIO: 7, USUARIO: 'ana' },
  params: {},
  body: {},
  files: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  cloudinaryUtils.estaConfigurado.mockImplementation(() => false);
  devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conexionFalsa()) });
});

// ---------------------------------------------------------------------------
// solicitarDevolucion — guardas de entrada
// ---------------------------------------------------------------------------
describe('solicitarDevolucion — guardas', () => {
  test('sin sesión → 401', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ user: null }), res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('sin id_venta → 400 "Faltan datos de la venta"', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { items: [{ id_producto: 1, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Faltan datos de la venta');
  });

  test('motivo > 500 caracteres → 400', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, motivo: 'x'.repeat(501), items: [{ id_producto: 1, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El motivo no puede superar 500 caracteres');
  });

  test('REEMBOLSO con motivo fuera de la lista cerrada → 400 (y motivo null también cae)', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, tipo: 'REEMBOLSO', motivo: 'ya no lo quiero', items: [{ id_producto: 1, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(JSON.stringify(res.cuerpo)).toContain('reembolso sin devolución');

    const res2 = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, tipo: 'REEMBOLSO', items: [{ id_producto: 1, cantidad: 1 }] } }), res2);
    expect(res2.codigo).toBe(400);
  });

  test('descripción > 2000 → 400', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, descripcion: 'x'.repeat(2001), items: [{ id_producto: 1, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('La descripción no puede superar 2000 caracteres');
  });

  test('sin items ni id_producto → 400 "Selecciona al menos un producto"', async () => {
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Selecciona al menos un producto');
  });

  test('formato legacy (id_producto) → items normalizados', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[{ CANTIDAD: 2 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS TOTAL FROM DEVOLUCIONES': [[{ total: 0 }]],
      'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }],
    });
    devolucionController._useDb({ query: conexionFalsa({ 'SELECT D.ID_DEVOLUCION': [[]] }).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, id_producto: 4, cantidad: 1 } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.ID_DEVOLUCIONES).toEqual([101]);
    const insert = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DEVOLUCIONES '));
    expect(insert[1]).toEqual([7, 9, 4, 1, null, null, 'DEVOLUCION']);
  });

  test('tipo no reconocido cae a DEVOLUCION', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[{ CANTIDAD: 1 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS TOTAL FROM DEVOLUCIONES': [[{ total: 0 }]],
      'INSERT INTO DEVOLUCIONES': [{ insertId: 102 }],
    });
    devolucionController._useDb({ query: conexionFalsa({ 'SELECT D.ID_DEVOLUCION': [[]] }).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, tipo: 'CAMBIO', items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(201);
    const insert = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DEVOLUCIONES '));
    expect(insert[1][6]).toBe('DEVOLUCION');
  });
});

// ---------------------------------------------------------------------------
// solicitarDevolucion — ventana de devolución (motivoVentanaNoDisponible)
// ---------------------------------------------------------------------------
describe('solicitarDevolucion — ventana (5 ramas + disponible)', () => {
  const baseOk = {
    'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[{ CANTIDAD: 2 }]],
    'SELECT COALESCE(SUM(CANTIDAD), 0) AS TOTAL FROM DEVOLUCIONES': [[{ total: 0 }]],
    'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }],
  };

  test('venta CANCELADA → 400 con mensaje de cancelación', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'CANCELADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('fue cancelado');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('envío EN_CAMINO → 400 "tu pedido está en camino"', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'ENVIADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[{ ESTADO_ENVIO: 'EN_CAMINO' }]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('está en camino');
  });

  test('envío PENDIENTE (no en camino) → 400 "todavía no ha sido entregado"', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'PENDIENTE' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[{ ESTADO_ENVIO: 'PENDIENTE' }]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('todavía no ha sido entregado');
  });

  test('venta sin envío y no COMPLETADA → 400 no entregado', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'PENDIENTE' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('todavía no ha sido entregado');
  });

  test('venta ENVIADA sin fila ENVIOS → 400 "en camino" (estado de venta manda)', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'ENVIADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('está en camino');
  });

  test('plazo de 3 días vencido → 400', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, FECHA_VENTA_LEGACY: true, items: [{ id_producto: 4, cantidad: 1 }], fechaEntregaVencida: true }, user: { ID_USUARIO: 7 }, extraVenta: { FECHA_VENTA: new Date(Date.now() - 10 * 86400000).toISOString() } }), res);
    // la venta del mapa arriba no tiene FECHA_VENTA vencida; usamos un mapa dedicado
    const { conn: conn2 } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA', FECHA_VENTA: new Date(Date.now() - 10 * 86400000).toISOString() }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      ...baseOk,
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn2) });
    const res2 = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res2);
    expect(res2.codigo).toBe(400);
    expect(res2.cuerpo.msg).toContain('ya venció');
  });

  test('item inválido (cantidad 0) → 400 + rollback', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 0 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Producto o cantidad inválidos');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('producto no está en el pedido → 400', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Uno de los productos no está en este pedido');
  });

  test('cantiad mayor al disponible (ya solicitadas) → 400 con número', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
      'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
      'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[{ CANTIDAD: 2 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS TOTAL FROM DEVOLUCIONES': [[{ total: 1 }]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 2 }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo puedes devolver 1 unidad(es) de uno de los productos en este pedido');
  });
});

// ---------------------------------------------------------------------------
// solicitarDevolucion — transacción feliz + post-commit
// ---------------------------------------------------------------------------
describe('solicitarDevolucion — transacción y post-commit', () => {
  const baseOk = {
    'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': [[{ ID_VENTA: 9, ESTADO: 'COMPLETADA' }]],
    'SELECT ESTADO_ENVIO, FECHA_ENTREGA FROM ENVIOS': [[]],
    'SELECT SUM(CANTIDAD) AS CANTIDAD FROM DETALLE_VENTAS': [[{ CANTIDAD: 3 }]],
    'SELECT COALESCE(SUM(CANTIDAD), 0) AS TOTAL FROM DEVOLUCIONES': [[{ total: 0 }]],
  };

  test('multi-item: 2 INSERTs + commit + 201 con IDs', async () => {
    const { conn } = dbFalso({ ...baseOk, 'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }] });
    devolucionController._useDb({ query: conexionFalsa({ 'SELECT D.ID_DEVOLUCION': [[]] }).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }, { id_producto: 5, cantidad: 2 }] } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.ID_DEVOLUCIONES).toEqual([101, 101]);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
    const inserts = conn.query.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DEVOLUCIONES '));
    expect(inserts).toHaveLength(2);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('evidencias válidas se insertan (imagen, video, cloudinary; ".." rechazada; tope 5)', async () => {
    const { conn } = dbFalso({
      ...baseOk,
      'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }],
    });
    devolucionController._useDb({ query: conexionFalsa({ 'SELECT D.ID_DEVOLUCION': [[]] }).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({
      body: {
        id_venta: 9,
        items: [{ id_producto: 4, cantidad: 1 }],
        evidencias: [
          '/images/devoluciones/u7/foto.jpg',
          'https://res.cloudinary.com/jadda/video/upload/evid.mp4',
          'https://res.cloudinary.com/jadda/image/upload/evid.png',
          '../etc/passwd',
          '/images/devoluciones/u7/e1.jpg',
          '/images/devoluciones/u7/e2.jpg',
          '/images/devoluciones/u7/e3.jpg',
        ],
      },
    }), res);
    expect(res.codigo).toBe(201);
    const evidencias = conn.query.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DEVOLUCIONES_EVIDENCIAS'));
    expect(evidencias).toHaveLength(5);
    expect(evidencias[0][1]).toEqual([101, 'imagen', '/images/devoluciones/u7/foto.jpg']);
    expect(evidencias[1][1]).toEqual([101, 'video', 'https://res.cloudinary.com/jadda/video/upload/evid.mp4']);
  });

  test('producto JADDA → notificación al admin y msg por defecto', async () => {
    const { conn } = dbFalso({ ...baseOk, 'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }] });
    const dbPost = conexionFalsa({ 'SELECT D.ID_DEVOLUCION': [[{ ID_DEVOLUCION: 101, TIPO: 'DEVOLUCION', ID_VENDEDOR: null }]] }).query;
    devolucionController._useDb({ query: dbPost, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.cuerpo.msg).toBe('Solicitud enviada. Nuestro equipo la revisará');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: null, tipo: 'devolucion', ruta: '/admin/devoluciones',
    }));
  });

  test('producto de vendedor → notificación al vendedor y msg de chat', async () => {
    const { conn } = dbFalso({ ...baseOk, 'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }] });
    const dbPost = conexionFalsa({
      'SELECT D.ID_DEVOLUCION': [[{ ID_DEVOLUCION: 101, TIPO: 'DEVOLUCION', ID_VENDEDOR: 3 }]],
      'SELECT ID_USUARIO FROM VENDEDORES': [[{ ID_USUARIO: 77 }]],
    }).query;
    devolucionController._useDb({ query: dbPost, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.cuerpo.msg).toBe('Solicitud enviada al vendedor del producto. Abre el chat de la solicitud cuando quieras coordinar el acuerdo');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: 77, tipo: 'devolucion', ruta: '/vendedor/devoluciones',
    }));
  });

  test('mixto JADDA + vendedor → msg combinado', async () => {
    const { conn } = dbFalso({ ...baseOk, 'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }] });
    const dbPost = conexionFalsa({
      'SELECT D.ID_DEVOLUCION': [[{ ID_DEVOLUCION: 101, TIPO: 'REEMBOLSO', ID_VENDEDOR: null }, { ID_DEVOLUCION: 102, TIPO: 'DEVOLUCION', ID_VENDEDOR: 3 }]],
      'SELECT ID_USUARIO FROM VENDEDORES': [[{ ID_USUARIO: 77 }]],
    }).query;
    devolucionController._useDb({ query: dbPost, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.cuerpo.msg).toBe('Solicitud enviada: parte al vendedor y parte al equipo JADDA. Revisa tus solicitudes.');
  });

  test('fallo en el post-commit de notificaciones no rompe el 201', async () => {
    const { conn } = dbFalso({ ...baseOk, 'INSERT INTO DEVOLUCIONES': [{ insertId: 101 }] });
    const dbPost = conexionFalsa({
      'SELECT D.ID_DEVOLUCION': () => { throw new Error('chat caído'); },
    }).query;
    devolucionController._useDb({ query: dbPost, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.msg).toBe('Solicitud enviada. Nuestro equipo la revisará');
  });

  test('fallo de BD en la transacción → 500 + rollback + release', async () => {
    const { conn } = dbFalso({
      'SELECT ID_VENTA, ESTADO, FECHA_VENTA FROM VENTAS': () => { throw new Error('boom'); },
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await solicitarDevolucion(req({ body: { id_venta: 9, items: [{ id_producto: 4, cantidad: 1 }] } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al solicitar la devolución' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// misDevoluciones / todas
// ---------------------------------------------------------------------------
describe('misDevoluciones y todas', () => {
  test('sin sesión → 401', async () => {
    const res = resFalsa();
    await misDevoluciones(req({ user: null }), res);
    expect(res.codigo).toBe(401);
  });

  test('misDevoluciones devuelve filas; fallo → 500', async () => {
    const db = dbFalso({}, { 'SELECT D.*, P.NOMBRE': [[{ ID_DEVOLUCION: 1 }]] });
    devolucionController._useDb(db.db);
    const res = resFalsa();
    await misDevoluciones(req(), res);
    expect(res.cuerpo).toHaveLength(1);

    devolucionController._useDb({ query: () => { throw new Error('boom'); } });
    const res2 = resFalsa();
    await misDevoluciones(req(), res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo.msg).toBe('Error al obtener devoluciones');
  });

  test('todas devuelve filas; fallo → 500', async () => {
    devolucionController._useDb({ query: conexionFalsa({ 'SELECT D.*, U.NOMBRE_USUARIO': [[{ ID_DEVOLUCION: 2 }]] }).query });
    const res = resFalsa();
    await todas(req(), res);
    expect(res.cuerpo).toHaveLength(1);

    devolucionController._useDb({ query: () => { throw new Error('boom'); } });
    const res2 = resFalsa();
    await todas(req(), res2);
    expect(res2.codigo).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// procesar — 4 decisiones del admin
// ---------------------------------------------------------------------------
describe('procesar — decisiones del admin', () => {
  const solBase = { ID_DEVOLUCION: 3, ID_USUARIO: 7, ID_VENTA: 9, ID_PRODUCTO: 4, CANTIDAD: 2, TIPO: 'DEVOLUCION', ESTADO: 'SOLICITADA' };

  test('decisión inválida → 400 sin tocar la BD', async () => {
    const db = dbFalso();
    devolucionController._useDb(db.db);
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'borrar' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('Decisión inválida');
    expect(db.conn.query).not.toHaveBeenCalled();
  });

  test('observación > 500 → 400', async () => {
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver', observacion: 'x'.repeat(501) } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('La observación no puede superar 500 caracteres');
  });

  test('solicitud inexistente → 404', async () => {
    const { conn } = dbFalso({ 'SELECT * FROM DEVOLUCIONES': [[]] });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Solicitud de devolución no encontrada' });
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('ya procesada → 400 con estado', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[{ ...solBase, ESTADO: 'APROBADA' }]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta solicitud ya fue procesada (APROBADA)');
  });

  test('producto de vendedor sin hilo JADDA y no ESCALADA → 403', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: 3 }]],
      'SELECT ID_CHAT FROM CHAT WHERE ID_DEVOLUCION': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toContain('producto de un vendedor');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('producto de vendedor ESCALADA → el admin sí decide (sin chequeo de chat)', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[{ ...solBase, ESTADO: 'ESCALADA' }]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: 3 }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: 7 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Solicitud actualizada a APROBADA' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('devolver: reingreso stock + movimiento + notificación + cierre de chat + correo', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: 7 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[{ EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana' }]],
    });
    devolucionController._useDb({
      query: conexionFalsa({ 'SELECT EMAIL, NOMBRE_USUARIO': [[{ EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana' }]] }).query,
      getConnection: vi.fn(async () => conn),
    });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver', observacion: 'Caja dañada' } }), res);
    const updateVariante = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE PRODUCTO_VARIANTES'));
    expect(updateVariante[1]).toEqual([2, 7]);
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalledWith({
      conn, idProducto: 4, tipo: 'ENTRADA', cantidad: 2,
    });
    const updateDevolucion = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE DEVOLUCIONES SET ESTADO'));
    expect(updateDevolucion[1]).toEqual(['APROBADA', 'Caja dañada', '3']);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: 7, tipo: 'devolucion', titulo: '✅ Devolución aprobada',
      mensaje: 'Tu devolución fue aprobada. Los artículos vuelven a stock y el reembolso se gestionará por el método de pago original. Observación: Caja dañada',
    }));
    expect(chatController.cerrarChatDeDevolucion).toHaveBeenCalledWith('3', '⚖️ El equipo JADDA resolvió la solicitud #3: APROBADA. Caja dañada');
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.to).toBe('ana@test.com');
    expect(correo.subject).toContain('✅');
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Solicitud actualizada a APROBADA' });
  });

  test('reembolsar: APROBADA SIN reingreso de stock ni movimiento', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[{ ...solBase, TIPO: 'REEMBOLSO' }]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'reembolsar' } }), res);
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE PRODUCTO_VARIANTES'))).toBe(false);
    expect(movimientosStock.registrarMovimientoStock).not.toHaveBeenCalled();
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      titulo: '✅ Reembolso aprobado',
      mensaje: 'Tu reembolso fue aprobado sin necesidad de devolver los productos. El dinero llegará por el método de pago original en unos días hábiles.',
    }));
    expect(chatController.cerrarChatDeDevolucion).toHaveBeenCalled();
  });

  test('mas_pruebas: estado MAS_PRUEBAS, sin stock, sin cierre de chat', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({
      query: conexionFalsa({ 'SELECT EMAIL, NOMBRE_USUARIO': [[{ EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana' }]] }).query,
      getConnection: vi.fn(async () => conn),
    });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'mas_pruebas' } }), res);
    expect(res.cuerpo.msg).toBe('Solicitud actualizada a MAS_PRUEBAS');
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE PRODUCTO_VARIANTES'))).toBe(false);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      titulo: '📋 Necesitamos más pruebas',
      mensaje: 'Necesitamos más evidencias para procesar tu solicitud.',
    }));
    expect(chatController.cerrarChatDeDevolucion).not.toHaveBeenCalled();
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].subject).toContain('Necesitamos más pruebas');
  });

  test('rechazar: RECHAZADA con motivo y chat cerrado', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({
      query: conexionFalsa({ 'SELECT EMAIL, NOMBRE_USUARIO': [[{ EMAIL: 'ana@test.com', NOMBRE_USUARIO: 'Ana' }]] }).query,
      getConnection: vi.fn(async () => conn),
    });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'rechazar', observacion: 'Evidencia insuficiente' } }), res);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      titulo: '❌ Solicitud rechazada',
      mensaje: 'Tu solicitud fue rechazada. Motivo: Evidencia insuficiente',
    }));
    expect(chatController.cerrarChatDeDevolucion).toHaveBeenCalledWith('3', '⚖️ El equipo JADDA resolvió la solicitud #3: RECHAZADA. Evidencia insuficiente');
    expect(mailer.sendMail.mock.calls[0][0].subject).toContain('❌');
  });

  test('legacy {estado: APROBADA} en REEMBOLSO → re-mapea a reembolsar (sin stock)', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[{ ...solBase, TIPO: 'REEMBOLSO' }]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { estado: 'APROBADA' } }), res);
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('SELECT MIN(ID_VARIANTE)'))).toBe(false);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ titulo: '✅ Reembolso aprobado' }));
  });

  test('legacy {estado: APROBADA} en DEVOLUCION → devolver con stock', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: 7 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { estado: 'APROBADA' } }), res);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ titulo: '✅ Devolución aprobada' }));
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalled();
  });

  test('legacy {estado: RECHAZADA} → rechazar', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { estado: 'RECHAZADA' } }), res);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ titulo: '❌ Solicitud rechazada' }));
  });

  test('devolver sin variantes → 400', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: null }]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El producto no tiene variantes para reingresar stock');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('cliente sin EMAIL → no se envía correo (y si la consulta falla tampoco bloquea)', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: 7 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': [[{ NOMBRE_USUARIO: 'Ana' }]],
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(res.cuerpo.ok).toBe(true);

    mailer.sendMail.mockClear();
    const { conn: conn2 } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': [[solBase]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT MIN(ID_VARIANTE)': [[{ ID_VARIANTE: 7 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [[]],
      'UPDATE DEVOLUCIONES SET ESTADO': [[]],
      'SELECT EMAIL, NOMBRE_USUARIO': () => { throw new Error('boom'); },
    });
    devolucionController._useDb({ query: conexionFalsa({}).query, getConnection: vi.fn(async () => conn2) });
    const res2 = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res2);
    expect(res2.cuerpo.ok).toBe(true);
  });

  test('fallo de BD → 500 + rollback + release', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES': () => { throw new Error('boom'); },
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesar(req({ params: { id: '3' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al procesar la devolución' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// subirEvidencias / agregarEvidencias / eliminarEvidencia
// ---------------------------------------------------------------------------
describe('subirEvidencias', () => {
  test('sin sesión → 401; sin archivos → 400', async () => {
    const res = resFalsa();
    await subirEvidencias(req({ user: null }), res);
    expect(res.codigo).toBe(401);

    const res2 = resFalsa();
    await subirEvidencias(req(), res2);
    expect(res2.codigo).toBe(400);
    expect(res2.cuerpo.msg).toBe('Selecciona al menos un archivo');
  });

  test('sin Cloudinary: URLs locales por archivo', async () => {
    const res = resFalsa();
    await subirEvidencias(req({
      files: [
        { path: 'C:/tmp/a.jpg', filename: 'a.jpg', mimetype: 'image/jpeg' },
        { path: 'C:/tmp/b.mp4', filename: 'b.mp4', mimetype: 'video/mp4' },
      ],
    }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.urls).toEqual([
      '/images/devoluciones/ana/a.jpg',
      '/images/devoluciones/ana/b.mp4',
    ]);
    expect(cloudinaryUtils.subirArchivoLocal).not.toHaveBeenCalled();
  });

  test('con Cloudinary: subida ok (unlinkSync llamado) y fallback local en error', async () => {
    cloudinaryUtils.estaConfigurado.mockImplementation(() => true);
    // 1ª llamada sube bien; la 2ª falla y conserva el archivo local.
    cloudinaryUtils.subirArchivoLocal.mockImplementationOnce(async () => ({ secure_url: 'https://res.cloudinary.com/jadda/image/upload/subida.jpg' }));
    cloudinaryUtils.subirArchivoLocal.mockImplementationOnce(async () => { throw new Error('cloud caído'); });
    const res = resFalsa();
    await subirEvidencias(req({
      files: [
        { path: 'C:/tmp/ok.jpg', filename: 'ok.jpg', mimetype: 'image/jpeg' },
        { path: 'C:/tmp/falla.jpg', filename: 'falla.jpg', mimetype: 'image/jpeg' },
      ],
    }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.urls).toEqual([
      'https://res.cloudinary.com/jadda/image/upload/subida.jpg',
      '/images/devoluciones/ana/falla.jpg',
    ]);
  });
});

describe('agregarEvidencias', () => {
  const sol = { ID_DEVOLUCION: 3, ID_USUARIO: 7, ESTADO: 'SOLICITADA', ID_PRODUCTO: 4 };
  const files = [{ path: 'C:/tmp/n1.jpg', filename: 'n1.jpg', mimetype: 'image/jpeg' }];

  test('sin sesión → 401; sin archivos → 400', async () => {
    const res = resFalsa();
    await agregarEvidencias(req({ user: null }), res);
    expect(res.codigo).toBe(401);

    const res2 = resFalsa();
    await agregarEvidencias(req(), res2);
    expect(res2.codigo).toBe(400);
  });

  test('solicitud ajena → 404 + limpieza de entradas', async () => {
    const { conn } = dbFalso({ 'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[]] });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Solicitud no encontrada o no te pertenece');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('solicitud resuelta → 400 "ya fue resuelta"', async () => {
    const { conn } = dbFalso({ 'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[{ ...sol, ESTADO: 'APROBADA' }]] });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta solicitud ya fue resuelta');
  });

  test('tope de 5 evidencias alcanzado → 400', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[sol]],
      'SELECT COUNT(*) AS N FROM DEVOLUCIONES_EVIDENCIAS': [[{ n: 5 }]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Máximo 5 evidencias por solicitud');
  });

  test('SOLICITADA: inserta evidencias locales y responde 201 (sin volver a SOLICITADA)', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[sol]],
      'SELECT COUNT(*) AS N FROM DEVOLUCIONES_EVIDENCIAS': [[{ n: 1 }]],
      'INSERT INTO DEVOLUCIONES_EVIDENCIAS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.urls).toEqual(['/images/devoluciones/ana/n1.jpg']);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith("UPDATE DEVOLUCIONES SET ESTADO = 'SOLICITADA'"))).toBe(false);
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
  });

  test('MAS_PRUEBAS sin vendedor: vuelve a SOLICITADA + notifica al admin', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[{ ...sol, ESTADO: 'MAS_PRUEBAS' }]],
      'SELECT COUNT(*) AS N FROM DEVOLUCIONES_EVIDENCIAS': [[{ n: 2 }]],
      'INSERT INTO DEVOLUCIONES_EVIDENCIAS': [[]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: null }]],
      'SELECT ID_CHAT FROM CHAT WHERE ID_DEVOLUCION': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(conn.query.mock.calls.some(([sql]) => sql.toUpperCase().startsWith("UPDATE DEVOLUCIONES SET ESTADO = 'SOLICITADA'"))).toBe(true);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: null, titulo: '📎 Nuevas evidencias adjuntadas', ruta: '/admin/devoluciones',
    }));
  });

  test('MAS_PRUEBAS con vendedor y sin hilos JADDA: notifica al vendedor', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[{ ...sol, ESTADO: 'MAS_PRUEBAS' }]],
      'SELECT COUNT(*) AS N FROM DEVOLUCIONES_EVIDENCIAS': [[{ n: 0 }]],
      'INSERT INTO DEVOLUCIONES_EVIDENCIAS': [[]],
      'SELECT ID_VENDEDOR FROM PRODUCTOS': [[{ ID_VENDEDOR: 3 }]],
      'SELECT ID_CHAT FROM CHAT WHERE ID_DEVOLUCION': [[]],
    });
    // La consulta del vendedor (post-INSERT) usa db.query EXTERIOR, no la conexión.
    devolucionController._useDb({
      query: conexionFalsa({ 'SELECT ID_USUARIO FROM VENDEDORES': [[{ ID_USUARIO: 77 }]] }).query,
      getConnection: vi.fn(async () => conn),
    });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: 77, ruta: '/vendedor/devoluciones',
    }));
  });

  test('sobrantes se recortan al cupo disponible (maxNuevos)', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': [[sol]],
      'SELECT COUNT(*) AS N FROM DEVOLUCIONES_EVIDENCIAS': [[{ n: 4 }]],
      'INSERT INTO DEVOLUCIONES_EVIDENCIAS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({
      params: { id: '3' },
      files: [
        { path: 'C:/tmp/a.jpg', filename: 'a.jpg', mimetype: 'image/jpeg' },
        { path: 'C:/tmp/b.jpg', filename: 'b.jpg', mimetype: 'image/jpeg' },
        { path: 'C:/tmp/c.jpg', filename: 'c.jpg', mimetype: 'image/jpeg' },
      ],
    }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo.urls).toHaveLength(1);
    expect(res.cuerpo.urls[0]).toBe('/images/devoluciones/ana/a.jpg');
  });

  test('fallo de BD → 500 + rollback + limpieza + release', async () => {
    const { conn } = dbFalso({
      'SELECT * FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ? AND ID_USUARIO': () => { throw new Error('boom'); },
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await agregarEvidencias(req({ params: { id: '3' }, files }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al agregar evidencias' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

describe('eliminarEvidencia', () => {
  const evSol = { ID_EVIDENCIA: 12, RUTA: '/images/devoluciones/u7/f.jpg', ESTADO: 'SOLICITADA' };

  test('sin sesión → 401', async () => {
    const res = resFalsa();
    await eliminarEvidencia(req({ user: null }), res);
    expect(res.codigo).toBe(401);
  });

  test('evidencia inexistente o ajena → 404', async () => {
    const { conn } = dbFalso({ 'SELECT E.ID_EVIDENCIA': [[]] });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await eliminarEvidencia(req({ params: { idEvidencia: '12' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Evidencia no encontrada' });
  });

  test('solicitud resuelta → 400', async () => {
    const { conn } = dbFalso({ 'SELECT E.ID_EVIDENCIA': [[{ ...evSol, ESTADO: 'APROBADA' }]] });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await eliminarEvidencia(req({ params: { idEvidencia: '12' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo puedes eliminar evidencias de solicitudes en revisión');
  });

  test('local: DELETE + commit + 201 (archivo fuera de la base no se borra)', async () => {
    const { conn } = dbFalso({
      'SELECT E.ID_EVIDENCIA': [[evSol]],
      'DELETE FROM DEVOLUCIONES_EVIDENCIAS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await eliminarEvidencia(req({ params: { idEvidencia: '12' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Evidencia eliminada' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(cloudinaryUtils.eliminarPorUrl).not.toHaveBeenCalled();
  });

  test('cloudinary: DELETE + eliminarPorUrl con la RUTA', async () => {
    const { conn } = dbFalso({
      'SELECT E.ID_EVIDENCIA': [[{ ...evSol, RUTA: 'https://res.cloudinary.com/jadda/video/upload/evid.mp4' }]],
      'DELETE FROM DEVOLUCIONES_EVIDENCIAS': [[]],
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await eliminarEvidencia(req({ params: { idEvidencia: '12' } }), res);
    expect(cloudinaryUtils.eliminarPorUrl).toHaveBeenCalledWith('https://res.cloudinary.com/jadda/video/upload/evid.mp4');
  });

  test('fallo de BD → 500 + rollback + release', async () => {
    const { conn } = dbFalso({
      'SELECT E.ID_EVIDENCIA': () => { throw new Error('boom'); },
    });
    devolucionController._useDb({ query: vi.fn(), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await eliminarEvidencia(req({ params: { idEvidencia: '12' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar la evidencia' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

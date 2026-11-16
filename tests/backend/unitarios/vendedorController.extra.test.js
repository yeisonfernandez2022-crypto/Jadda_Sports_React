/**
 * vendedorController — caminos que la suite base (vendedorController.test.js)
 * y la integración no cubren: miSolicitud (fn completa), los catch de
 * procesarSolicitud (L462) y procesarDevolucionVendedor (L1065) con rollback
 * que resuelve/rechaza, el .catch de la notificación de rechazo (L389) y
 * reportesVendedor (fn completa con sus 4 granularidades).
 * Suite NUEVA: la base no se edita. Deps destructuradas en carga
 * (crearNotificacion, registrarMovimientoStock) se mutan ANTES del require.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');
const movimientosStock = require('../../../backend/utils/movimientosStock');
const chatController = require('../../../backend/controllers/chatController');
const mailer = require('../../../backend/config/mailer');

// destructuring en carga → mutar ANTES del require del SUT
notificacionController.crearNotificacion = vi.fn(async () => ({}));
movimientosStock.registrarMovimientoStock = vi.fn(async () => {});
// chatCtrl.cerrarChatDeDevolucion usa el pool interno de chatController:
// se reemplaza la propiedad del módulo para no tocar MySQL real.
chatController.cerrarChatDeDevolucion = vi.fn(async () => {});

const vendedorController = require('../../../backend/controllers/vendedorController');
const { miSolicitud, procesarSolicitud, procesarDevolucionVendedor, reportesVendedor } = vendedorController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

// Router de BD por prefijo SQL normalizado (prefijos MÁS LARGOS primero)
const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) return rutas[clave];
    }
    return defecto ? defecto() : [[]];
  });
};

const connDe = (rutas, defecto) => ({
  query: dbDe(rutas, defecto),
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

const SOL_PENDIENTE = {
  ID_SOLICITUD: 4, ESTADO: 'PENDIENTE', ID_USUARIO: 7,
  EMAIL_EMPRESA: 'empresa@test.com', NOMBRE_EMPRESA: 'Deportes XYZ',
  NOMBRE_REPRESENTANTE: 'Juan Perez', NIT: '900123456', TELEFONO: '3001234567',
  DEPARTAMENTO: 'Cundinamarca', CIUDAD: 'Bogota', DIRECCION: 'Cra 1 #2-3',
  CATEGORIAS: 'Deportes',
};

const VENDEDOR = { ID_USUARIO: 7, ID_ROL: 6, USUARIO: 'vend7' };
const req = (over = {}) => ({ user: null, params: {}, body: {}, query: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
  movimientosStock.registrarMovimientoStock.mockImplementation(async () => {});
  mailer.sendMail = vi.fn(async () => ({ accepted: true }));
  vendedorController._useDb({
    query: vi.fn(async () => [[]]),
    getConnection: vi.fn(async () => connDe({}, async () => [[]])),
  });
});

describe('miSolicitud (fn completa)', () => {
  test('con solicitud y cuenta de vendedor → 200 con ambos objetos', async () => {
    const dbq = dbDe({
      'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_USUARIO': [[{ ID_SOLICITUD: 4, ESTADO: 'APROBADA' }]],
      'SELECT V.*, U.USUARIO': [[{ ID_VENDEDOR: 3, USUARIO: 'vend7', DEBE_CAMBIAR_PASSWORD: 1 }]],
    });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await miSolicitud(req({ user: { ID_USUARIO: 7 } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.solicitud.ESTADO).toBe('APROBADA');
    expect(res.cuerpo.vendedor.ID_VENDEDOR).toBe(3);
    expect(dbq.mock.calls[1][1]).toEqual([4]); // 2ª query por ID_SOLICITUD
  });

  test('sin solicitud → vendedor null y sin 2ª query', async () => {
    const dbq = dbDe({ 'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_USUARIO': [[]] });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await miSolicitud(req({ user: { id: 9 } }), res);
    expect(res.cuerpo).toEqual({ solicitud: null, vendedor: null });
    expect(dbq).toHaveBeenCalledTimes(1);
    expect(dbq.mock.calls[0][1]).toEqual([9]); // usa req.user.id como respaldo
  });

  test('fallo de BD → 500 "Error al obtener la solicitud"', async () => {
    vendedorController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await miSolicitud(req({ user: { ID_USUARIO: 7 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener la solicitud' });
  });
});

describe('procesarSolicitud — RECHAZADA (correos y notificación tolerantes)', () => {
  const rechazar = (dbRutas, connRutas) => {
    const conn = connDe(connRutas);
    const dbq = dbDe(dbRutas);
    vendedorController._useDb({ query: dbq, getConnection: vi.fn(async () => conn) });
    return { conn, dbq };
  };

  test('notificación que RECHAZA no bloquea (catch L389) y el correo sale con el email de la cuenta', async () => {
    notificacionController.crearNotificacion.mockImplementation(async () => { throw new Error('notif caída'); });
    const { conn } = rechazar(
      { 'SELECT EMAIL FROM USUARIOS WHERE ID_USUARIO': [[{ EMAIL: 'cuenta@t.co' }]] },
      { 'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE': [[SOL_PENDIENTE]] },
    );
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'RECHAZADA', observacion: 'Fotos borrosas' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Solicitud rechazada. El motivo fue enviado al solicitante por correo.' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('cuenta@t.co'); // prioriza el EMAIL del USUARIO
  });

  test('consulta del correo del solicitante que falla → catch (L381) y correo de empresa', async () => {
    rechazar(
      { 'SELECT EMAIL FROM USUARIOS WHERE ID_USUARIO': async () => { throw new Error('boom'); } },
      { 'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE': [[SOL_PENDIENTE]] },
    );
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'RECHAZADA', observacion: 'Falta NIT' } }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('empresa@test.com');
  });

  test('correo de empresa inválido → NO se intenta el envío (correoValido)', async () => {
    rechazar(
      { 'SELECT EMAIL FROM USUARIOS WHERE ID_USUARIO': [[]] },
      { 'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE': [[{ ...SOL_PENDIENTE, EMAIL_EMPRESA: 'no-es-correo' }]] },
    );
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'RECHAZADA', observacion: 'Datos incompletos' } }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('observación requerida en RECHAZADA → 400', async () => {
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'RECHAZADA', observacion: '   ' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Debes indicar el motivo del rechazo' });
  });
});

describe('procesarSolicitud — APROBADA y catch (L462)', () => {
  const aprobar = (dbRutas, connRutas) => {
    const conn = connDe(connRutas);
    vendedorController._useDb({
      query: dbDe(dbRutas),
      getConnection: vi.fn(async () => conn),
    });
    return conn;
  };

  test('feliz: INSERT USUARIOS/VENDEDORES, credenciales por correo y 2 notificaciones', async () => {
    const conn = aprobar(
      { 'SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO': [[]] }, // generarUsuarioUnico: libre
      {
        'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE': [[SOL_PENDIENTE]],
        'SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL': [[]], // correo libre
      },
    );
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'APROBADA' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Vendedor creado. Credenciales enviadas por correo.' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    const insertUsuario = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO USUARIOS'));
    expect(insertUsuario[1][0]).toBe('Juan Perez'); // NOMBRE_REPRESENTANTE
    expect(insertUsuario[1][2]).toMatch(/^vendedor_depor\.\d{3,4}$/); // usuario único generadom
    expect(insertUsuario[1][3]).toMatch(/^\$2[aby]\$/); // bcrypt hash REAL
    const notifs = notificacionController.crearNotificacion.mock.calls.map((c) => c[0].titulo);
    expect(notifs).toContain('¡Solicitud aprobada!');
    expect(notifs).toContain('¡Bienvenido a JADDA SPORTS!');
    expect(mailer.sendMail).toHaveBeenCalledTimes(1); // enviarCredenciales
  });

  test('email de empresa ya usado → rollback + 409', async () => {
    const conn = aprobar(
      {},
      {
        'SELECT * FROM SOLICITUDES_VENDEDOR WHERE ID_SOLICITUD = ? FOR UPDATE': [[SOL_PENDIENTE]],
        'SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 55 }]],
      },
    );
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'APROBADA' } }), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo.msg).toContain('empresa@test.com ya está registrado');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalled();
  });

  test('error dentro de la transacción → catch (L462) con rollback que resuelve → 500', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    vendedorController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'APROBADA' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al procesar la solicitud' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalled();
  });

  test('rollback que TAMBIÉN rechaza → 500 igualmente (.catch del rollback)', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    conn.rollback = vi.fn(async () => { throw new Error('rollback caído'); });
    vendedorController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarSolicitud(req({ params: { id: '4' }, body: { estado: 'APROBADA' } }), res);
    expect(res.codigo).toBe(500);
  });
});

describe('procesarDevolucionVendedor — decisiones y catch (L1065)', () => {
  const SOL_DEV = { ID_DEVOLUCION: 9, ID_VENTA: 12, ID_PRODUCTO: 30, CANTIDAD: 2, TIPO: 'devolucion', ESTADO: 'SOLICITADA', ID_USUARIO: 7 };

  const preparar = (dbRutas, connRutas) => {
    const conn = connDe(connRutas);
    vendedorController._useDb({
      query: dbDe(dbRutas),
      getConnection: vi.fn(async () => conn),
    });
    return conn;
  };

  test('decisión inválida → 400 con las 4 opciones', async () => {
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'otra' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Decisión inválida: usa devolver, reembolsar, mas_pruebas o rechazar');
  });

  test('ESCALADA → 400 "el equipo JADTA decide" sin tocar transacción', async () => {
    const conn = preparar({}, {
      'SELECT D.* FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[{ ...SOL_DEV, ESTADO: 'ESCALADA' }]],
    });
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta solicitud fue escalada al equipo JADDA: ellos deciden el resultado');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('devolver sin variantes → rollback + 400', async () => {
    preparar({}, {
      'SELECT D.* FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[SOL_DEV]],
      'SELECT MIN(ID_VARIANTE) AS ID_VARIANTE FROM PRODUCTO_VARIANTES': [[{ ID_VARIANTE: null }]],
    });
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El producto no tiene variantes para reingresar stock');
  });

  test('devolver feliz: reingresa stock, registra movimiento, notifica y cierra chat (APROBADA)', async () => {
    const dbq = dbDe({
      'SELECT ID_CHAT FROM CHAT WHERE ID_DEVOLUCION': [[{ ID_CHAT: 77 }]],
    }, () => [[]]);
    const conn = connDe({
      'SELECT D.* FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[SOL_DEV]],
      'SELECT MIN(ID_VARIANTE) AS ID_VARIANTE FROM PRODUCTO_VARIANTES': [[{ ID_VARIANTE: 5 }]],
      'UPDATE PRODUCTO_VARIANTES SET STOCK': [{ affectedRows: 1 }],
      'UPDATE DEVOLUCIONES SET ESTADO': [{ affectedRows: 1 }],
    }, () => [{ insertId: 1 }]);
    vendedorController._useDb({ query: dbq, getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Solicitud actualizada a APROBADA', estado: 'APROBADA' });
    expect(movimientosStock.registrarMovimientoStock).toHaveBeenCalledWith(expect.objectContaining({ idProducto: 30, tipo: 'ENTRADA', cantidad: 2 }));
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.titulo).toBe('✅ Solicitud aprobada por el vendedor');
    expect(notif.ruta).toBe('/perfil/devolucion/12');
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(chatController.cerrarChatDeDevolucion).toHaveBeenCalledWith('9', expect.stringContaining('#9')); // chat cerrado por acuerdo
  });

  test('rechazar con observación → mensaje con Motivo', async () => {
    preparar({}, {
      'SELECT D.* FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[SOL_DEV]],
      'UPDATE DEVOLUCIONES SET ESTADO': [{ affectedRows: 1 }],
    }, () => [{ insertId: 1 }]);
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'rechazar', observacion: 'No es nuestra talla' } }), res);
    expect(res.cuerpo.estado).toBe('RECHAZADA');
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.mensaje).toContain('Motivo: No es nuestra talla');
  });

  test('mas_pruebas sin observación → 400', async () => {
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'mas_pruebas' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Debes indicar el motivo en la observación');
  });

  test('error en transacción → catch (L1065) con rollback que resuelve → 500', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    vendedorController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'devolver' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al procesar la devolución' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalled();
  });

  test('rollback que rechaza dentro del catch → 500 igualmente', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    conn.rollback = vi.fn(async () => { throw new Error('rollback caído'); });
    vendedorController._useDb({ query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => conn) });
    const res = resFalsa();
    await procesarDevolucionVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, params: { id: '9' }, body: { decision: 'reembolsar' } }), res);
    expect(res.codigo).toBe(500);
  });
});

describe('reportesVendedor (fn completa — 4 granularidades)', () => {
  const dbReportes = ({ resumen, serie = [], masVendidos = [] }) => {
    let llamadas = 0;
    return vi.fn(async () => {
      llamadas += 1;
      if (llamadas === 1) return [[resumen]];
      if (llamadas === 2) return [serie];
      return [masVendidos];
    });
  };

  const RESUMEN = { ordenes: 4, ingresos: '120000', unidades: '10', productosVendidos: 3 };
  const MAS = [{ ID: 9, NOMBRE: 'Guayos', IMAGEN: '/i.png', unidades: '10', ingresos: '120000', stock: '7' }];

  test('dia (defecto): serie completa con huecos en 0 y mapeo de números', async () => {
    const dbq = dbReportes({ resumen: RESUMEN, masVendidos: MAS });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2026-11-01', hasta: '2026-11-03' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.desde).toBe('2026-11-01');
    expect(res.cuerpo.totalOrdenes).toBe(4);
    expect(res.cuerpo.totalIngresos).toBe(120000);
    expect(res.cuerpo.ticketPromedio).toBe(30000);
    expect(res.cuerpo.serie).toEqual([
      { dia: '2026-11-01', pedidos: 0, ingresos: 0, unidades: 0 },
      { dia: '2026-11-02', pedidos: 0, ingresos: 0, unidades: 0 },
      { dia: '2026-11-03', pedidos: 0, ingresos: 0, unidades: 0 },
    ]);
    expect(res.cuerpo.masVendidos[0]).toEqual({ ID: 9, NOMBRE: 'Guayos', IMAGEN: '/i.png', unidades: 10, ingresos: 120000, stock: 7 });
    const masQuery = dbq.mock.calls[2];
    expect(masQuery[1]).toEqual([3, '2026-11-01 00:00:00', '2026-11-03 23:59:59', 10]); // límite por defecto
  });

  test('dia con serie existente: filas matcheadas conservan pedidos/ingresos', async () => {
    const dbq = dbReportes({ resumen: RESUMEN, serie: [{ dia: '2026-11-02', pedidos: 2, ingresos: '50000', unidades: '3' }], masVendidos: [] });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2026-11-01', hasta: '2026-11-03' } }), res);
    expect(res.cuerpo.serie[1]).toEqual({ dia: '2026-11-02', pedidos: 2, ingresos: 50000, unidades: 3 });
  });

  test('semana: cursor arranca en el lunes de la semana de "desde"', async () => {
    const dbq = dbReportes({ resumen: RESUMEN, serie: [{ dia: '2026-11-02', pedidos: 1, ingresos: '20000', unidades: '1' }] });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2026-11-02', hasta: '2026-11-08', granularidad: 'semana' } }), res);
    expect(res.cuerpo.granularidad).toBe('semana');
    expect(res.cuerpo.serie.length).toBeGreaterThanOrEqual(1); // pasos de 7 días entre lunes(desde) y hasta
    expect(res.cuerpo.serie[0].dia).toMatch(/^2026-1[01]-\d{2}$/);
  });

  test('mes: serie por YYYY-MM con cursor mensual', async () => {
    const dbq = dbReportes({ resumen: RESUMEN, serie: [{ dia: '2026-10', pedidos: 3, ingresos: '90000', unidades: '5' }] });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2026-09-15', hasta: '2026-11-15', granularidad: 'mes' } }), res);
    expect(res.cuerpo.serie.map((s) => s.dia)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(res.cuerpo.serie[1].pedidos).toBe(3);
  });

  test('anio: serie por año entre startY y endY', async () => {
    // fechas a mitad de año: getFullYear() es idéntico en UTC y en UTC-5
    const dbq = dbReportes({ resumen: RESUMEN, serie: [{ dia: '2025', pedidos: 7, ingresos: '210000', unidades: '9' }] });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2024-06-15', hasta: '2026-06-01', granularidad: 'anio' } }), res);
    expect(res.cuerpo.serie.map((s) => s.dia)).toEqual(['2024', '2025', '2026']);
    expect(res.cuerpo.serie[1].unidades).toBe(9);
  });

  test('granularidad inválida cae a dia; límite inválido usa defecto y se acota a 50', async () => {
    const dbq = dbReportes({ resumen: RESUMEN });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: 'x', hasta: 'y', granularidad: 'siglos', limite: '999' } }), res);
    expect(res.cuerpo.granularidad).toBe('dia'); // fecha inválida → defecto 30 días; serie de ~31 días
    expect(res.cuerpo.serie.length).toBeGreaterThanOrEqual(28);
    expect(dbq.mock.calls[2][1][3]).toBe(50); // límite acotado
  });

  test('sin ventas → ticketPromedio 0', async () => {
    const dbq = dbReportes({ resumen: { ordenes: 0, ingresos: 0, unidades: 0, productosVendidos: 0 } });
    vendedorController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 }, query: { desde: '2026-11-01', hasta: '2026-11-01' } }), res);
    expect(res.cuerpo.ticketPromedio).toBe(0);
  });

  test('fallo de BD → 500 "Error al generar tus reportes"', async () => {
    vendedorController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }), getConnection: vi.fn() });
    const res = resFalsa();
    await reportesVendedor(req({ vendedor: { ID_VENDEDOR: 3 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al generar tus reportes' });
  });
});

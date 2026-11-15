/**
 * chatController — caminos que la suite base (chatController.test.js) y la
 * integración no cubren: abrirChatDevolucion (fn completa, la usan
 * devolucionController e iniciar), la resolución de hilo en iniciar DEVOLUCION
 * (los 2 callbacks find: PARTE mío, PARTE null, sin objetivo) y bordes de
 * escalar (notificación que rechaza no bloquea; chat sin vendedor → rVen
 * null). Suite NUEVA: la base no se edita.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');

// destructuring en carga → mutar ANTES del require del SUT
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const chatController = require('../../../backend/controllers/chatController');
const { iniciar, escalar, abrirChatDevolucion } = chatController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const CLIENTE = { ID_USUARIO: 7, ID_ROL: 4, NOMBRE_USUARIO: 'Ana' };
const req = (over = {}) => ({ user: null, params: {}, body: {}, query: {}, ...over });

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

const SOL_DEV = { ID_DEVOLUCION: 9, ID_USUARIO: 7, ID_VENDEDOR: 3, ID_PRODUCTO: 12, TIPO: 'devolucion' };

// Fake por defecto: hilo de acuerdo ACTIVA del cliente 7 por la devolución 9
const dbChat = ({ chatsLista = [], sol = SOL_DEV, existenteAbrir = null } = {}) => dbDe({
  'SELECT * FROM CHAT WHERE ID_CHAT': [[{ ID_CHAT: 5, TIPO: 'DEVOLUCION', ID_CLIENTE: 7, ID_VENDEDOR: 3, ID_DEVOLUCION: 9, ID_PRODUCTO: 12, ESTADO: 'ACTIVA', PARTE: null }]],
  'SELECT * FROM CHAT WHERE TIPO': [chatsLista],
  'SELECT ID_CHAT FROM CHAT WHERE TIPO': [existenteAbrir ? [{ ID_CHAT: 44 }] : []],
  'SELECT D.*, P.ID_VENDEDOR FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[sol]],
  'SELECT D.*, P.NOMBRE AS PRODUCTO_NOMBRE': [[{ ...sol, PRODUCTO_NOMBRE: 'Guayos', CLIENTE_NOMBRE: 'Ana', CLIENTE_EMAIL: 'ana@t.co', VENDEDOR_EMPRESA: 'Tienda', MOTIVO: 'No llegó', CANTIDAD: 2 }]],
  'SELECT ID_PRODUCTO FROM DEVOLUCIONES': [[{ ID_PRODUCTO: 12 }]],
  'SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1': [[{ ID_USUARIO: 1 }, { ID_USUARIO: 2 }]],
  'SELECT ID_USUARIO FROM VENDEDORES WHERE ID_VENDEDOR': [[{ ID_USUARIO: 8 }]],
  'INSERT INTO CHAT_MENSAJE': [{ insertId: 90 }],
  'INSERT INTO CHAT': [{ insertId: 66 }],
  'UPDATE CHAT SET ESTADO': [{ affectedRows: 1 }],
}, () => [[]]);

beforeEach(() => {
  vi.clearAllMocks();
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
  chatController._useDb({ query: dbChat(), getConnection: vi.fn() });
});

describe('abrirChatDevolucion (fn completa, la usan devolucionController e iniciar)', () => {
  test('chat ya existente → { idChat, nuevo: false } sin INSERT', async () => {
    const dbq = dbChat({ existenteAbrir: true });
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const resultado = await abrirChatDevolucion({ idCliente: 7, idVendedor: 3, idDevolucion: 9, mensajeInicial: 'hola' });
    expect(resultado).toEqual({ idChat: 44, nuevo: false });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('INSERT'))).toBe(false);
  });

  test('nuevo: INSERT del chat + mensajeSistema + mensaje inicial del comprador', async () => {
    const dbq = dbChat();
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const resultado = await abrirChatDevolucion({ idCliente: 7, idVendedor: 3, idDevolucion: 9, mensajeInicial: 'Hola, quiero devolver  <b>ya</b>' });
    expect(resultado).toEqual({ idChat: 66, nuevo: true });
    const insertChat = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT ('));
    expect(insertChat[1]).toEqual([7, 3, 12, 9]); // ID_PRODUCTO resuelto de la devolución
    const insertMsg = [...dbq.mock.calls].reverse().find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT_MENSAJE'));
    expect(insertMsg[1][1]).toBe(7); // ID_AUTOR = comprador
    expect(insertMsg[1][2]).toBe('Hola, quiero devolver  <b>ya</b>'); // censurar no altera texto limpio
  });

  test('consulta del producto que falla → catch y INSERT con ID_PRODUCTO null', async () => {
    const dbq = dbDe({
      'SELECT ID_CHAT FROM CHAT WHERE TIPO': [[]],
      'SELECT ID_PRODUCTO FROM DEVOLUCIONES': async () => { throw new Error('boom'); },
    }, () => [{ insertId: 66 }]);
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const resultado = await abrirChatDevolucion({ idCliente: 7, idVendedor: 3, idDevolucion: 9, mensajeInicial: null });
    expect(resultado).toEqual({ idChat: 66, nuevo: true });
    const insertChat = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT ('));
    expect(insertChat[1][2]).toBeNull();
    // solo el mensaje SISTEMA del hilo nuevo: sin mensaje inicial del comprador
    const insertsMsg = dbq.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT_MENSAJE'));
    expect(insertsMsg).toHaveLength(1);
    expect(insertsMsg[0][0]).toContain("'SISTEMA'"); // rol como literal en el SQL
    expect(insertsMsg[0][1][1]).toContain('Espacio de acuerdo');
  });
});

describe('iniciar DEVOLUCION — resolución del hilo (callbacks find L200)', () => {
  test('hilo con MI PARTE (cliente) ya existe → primer find acierta, sin INSERT', async () => {
    const chatsLista = [
      { ID_CHAT: 8, PARTE: 'VENDEDOR' },
      { ID_CHAT: 7, PARTE: 'CLIENTE' },
    ];
    const dbq = dbChat({ chatsLista });
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await iniciar(req({ user: CLIENTE, body: { tipo: 'DEVOLUCION', id_devolucion: 9 } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, id_chat: 7 });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('INSERT'))).toBe(false);
  });

  test('sin hilo de MI PARTE pero con hilo null (acuerdo) → segundo find acierta', async () => {
    const chatsLista = [{ ID_CHAT: 5, PARTE: null }];
    const dbq = dbChat({ chatsLista });
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await iniciar(req({ user: CLIENTE, body: { tipo: 'DEVOLUCION', id_devolucion: 9 } }), res);
    expect(res.cuerpo).toEqual({ ok: true, id_chat: 5 });
  });

  test('hilos existen pero ninguno sirve → INSERT de un hilo de acuerdo (201)', async () => {
    const chatsLista = [{ ID_CHAT: 8, PARTE: 'VENDEDOR' }]; // el find del cliente no acierta ni con null
    const dbq = dbChat({ chatsLista });
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await iniciar(req({ user: CLIENTE, body: { tipo: 'DEVOLUCION', id_devolucion: 9 } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, id_chat: 66 });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT ('))).toBe(true);
  });
});

describe('escalar — bordes de notificación y vendedor ausente', () => {
  test('crearNotificacion que RECHAZA no bloquea (catch de notificarUsuarios y del admin)', async () => {
    notificacionController.crearNotificacion.mockImplementation(async () => { throw new Error('notif caída'); });
    const res = resFalsa();
    await escalar(req({ user: CLIENTE, params: { id: '5' } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.ok).toBe(true);
    expect(notificacionController.crearNotificacion).toHaveBeenCalled(); // al admin, dentro del try/catch
  });

  test('chat de devolución SIN vendedor (JADDA) → rVen null y sin notificación de vendedor', async () => {
    const chatSinVendedor = {
      ID_CHAT: 5, TIPO: 'DEVOLUCION', ID_CLIENTE: 7, ID_VENDEDOR: null,
      ID_DEVOLUCION: 9, ID_PRODUCTO: null, ESTADO: 'ACTIVA', PARTE: null,
    };
    const dbq = dbDe({
      'SELECT * FROM CHAT WHERE ID_CHAT': [[chatSinVendedor]],
      'SELECT * FROM CHAT WHERE TIPO': [[]],
      'SELECT ID_CHAT FROM CHAT WHERE TIPO': [[]],
      'SELECT D.*, P.ID_VENDEDOR FROM DEVOLUCIONES D JOIN PRODUCTOS P': [[SOL_DEV]],
      'SELECT D.*, P.NOMBRE AS PRODUCTO_NOMBRE': [[{ ...SOL_DEV, PRODUCTO_NOMBRE: 'Guayos', CLIENTE_NOMBRE: 'Ana', CLIENTE_EMAIL: 'ana@t.co', VENDEDOR_EMPRESA: null, MOTIVO: 'No llegó', CANTIDAD: 1 }]],
      'SELECT ID_PRODUCTO FROM DEVOLUCIONES': [[{ ID_PRODUCTO: 12 }]],
      'SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1': [[{ ID_USUARIO: 1 }]],
      'SELECT TIPO FROM DEVOLUCIONES WHERE ID_DEVOLUCION': [[{ TIPO: 'devolucion' }]],
      'INSERT INTO CHAT_MENSAJE': [{ insertId: 90 }],
      'INSERT INTO CHAT': [{ insertId: 66 }],
    }, () => [[]]);
    chatController._useDb({ query: dbq, getConnection: vi.fn() });
    const res = resFalsa();
    await escalar(req({ user: CLIENTE, params: { id: '5' } }), res);
    expect(res.cuerpo.ok).toBe(true);
    // los INSERT de hilos escalados: solo el del CLIENTE (ID_VENDEDOR va como literal NULL en el SQL)
    const inserts = dbq.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT INTO CHAT ('));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual([7, 12, 9]); // [ID_CLIENTE, idProdEscalada, ID_DEVOLUCION]
    expect(notificacionController.crearNotificacion.mock.calls.every((c) => c[0].ruta === '/admin/chats' || c[0].tipo === 'chat')).toBe(true);
  });
});

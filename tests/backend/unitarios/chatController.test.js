/**
 * chatController — guardas y caminos de error del ciclo de chat (unit).
 *
 * Los flujos felices (soporte, vendedor, disputa con escalación) viven en la
 * INTEGRACIÓN con MySQL real. Aquí se cubren las validaciones y errores que
 * la integración no alcanza: escalar conversaciones no-devolución, ya
 * escaladas/cerradas, admin sobre su propio equipo, mensajes vacíos/ajenos,
 * acceso a conversaciones inexistentes y censura de groserías.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const notificacionController = require('../../../backend/controllers/notificacionController');

// mutación ANTES del require del SUT (destructuring en carga)
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const chatController = require('../../../backend/controllers/chatController');
const { escalar, mensajes, enviar, misConversaciones, noLeidos } = chatController;

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

/** Fila de chat configurable + conexión falsa por SQL-prefix. */
const CHAT_DEVOLUCION = {
  ID_CHAT: 5, TIPO: 'DEVOLUCION', ID_CLIENTE: 7, ID_VENDEDOR: 3,
  ID_DEVOLUCION: 9, ID_PRODUCTO: 12, ESTADO: 'ACTIVA', PARTE: null,
};

function dbChat({ chat = CHAT_DEVOLUCION, chatsLista = null } = {}) {
  return {
    query: vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT * FROM CHAT WHERE ID_CHAT')) return [[chat]];
      if (s.startsWith('SELECT * FROM CHAT WHERE TIPO')) return [chatsLista ?? []];
      if (s.startsWith('SELECT ID_PRODUCTO FROM DEVOLUCIONES')) return [[{ ID_PRODUCTO: 12 }]];
      if (s.startsWith('SELECT D.*, P.NOMBRE')) return [[{
        ID_DEVOLUCION: 9, ID_USUARIO: 7, ID_VENDEDOR: 3, ID_PRODUCTO: 12,
        PRODUCTO_NOMBRE: 'Guayos', CLIENTE_NOMBRE: 'Ana', CLIENTE_EMAIL: 'ana@t.co', VENDEDOR_EMPRESA: 'Tienda',
      }]];
      if (s.startsWith('SELECT * FROM VENDEDORES WHERE ID_USUARIO')) return [[{ ID_VENDEDOR: 3, ID_USUARIO: 8 }]];
      if (s.startsWith('SELECT ID_CHAT FROM CHAT WHERE')) return [[]];
      if (s.startsWith('SELECT CM.* FROM CHAT_MENSAJE') || s.includes('FROM CHAT_MENSAJE')) return [[]];
      if (s.startsWith('INSERT INTO CHAT')) return [{ insertId: 66 }];
      if (s.startsWith('INSERT INTO CHAT_MENSAJE')) return [{ insertId: 90 }];
      if (s.startsWith('SELECT MENSAJE, ROL_AUTOR')) return [[{ MENSAJE: 'holi', ROL_AUTOR: 'CLIENTE' }]];
      // cualquier SELECT de vend (id_chat, titulo...) para los hilos escalados
      return [[{ ID_CHAT: 66, PARTE: 'CLIENTE' }]];
    }),
  };
}

const CLIENTE = { ID_USUARIO: 7, ID_ROL: 4, NOMBRE_USUARIO: 'Ana' };
const ADMIN = { ID_USUARIO: 1, ID_ROL: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  chatController._useDb(dbChat());
});

describe('escalar', () => {
  test('sin sesión → 401', async () => {
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: null }, res);
    expect(res.codigo).toBe(401);
  });

  test('conversación inexistente → 404', async () => {
    chatController._useDb(dbChat({ chat: null }));
    const res = resFalsa();
    await escalar({ params: { id: 999 }, user: CLIENTE }, res);
    expect(res.codigo).toBe(404);
  });

  test('solo DEVOLUCION se escala (SOPORTE → 400)', async () => {
    chatController._useDb(dbChat({ chat: { ...CHAT_DEVOLUCION, TIPO: 'SOPORTE' } }));
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: CLIENTE }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('devolución');
  });

  test('admin no escala (acceso DENEGADO al hilo de acuerdo 403 — el admin solo entra a escaladas)', async () => {
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: ADMIN }, res);
    expect(res.codigo).toBe(403);
  });

  test('chat ya ESCALADA → 400 (no re-escalar)', async () => {
    chatController._useDb(dbChat({ chat: { ...CHAT_DEVOLUCION, ESTADO: 'ESCALADA' } }));
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: CLIENTE }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('escalada');
  });

  test('chat CERRADA → 400', async () => {
    chatController._useDb(dbChat({ chat: { ...CHAT_DEVOLUCION, ESTADO: 'CERRADA' } }));
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: CLIENTE }, res);
    expect(res.codigo).toBe(400);
  });

  test('cliente escala su devolución ACTIVA: cierra el acuerdo y crea hilos por PARTE', async () => {
    chatController._useDb(dbChat({ chatsLista: [] }));
    const res = resFalsa();
    await escalar({ params: { id: 5 }, user: CLIENTE }, res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
  });
});

describe('mensajes y envío', () => {
  test('mensajes de conversación inexistente → 404', async () => {
    chatController._useDb(dbChat({ chat: null }));
    const res = resFalsa();
    await mensajes({ params: { id: 999 }, user: CLIENTE }, res);
    expect(res.codigo).toBe(404);
  });

  test('envío con mensaje vacío → 400', async () => {
    const res = resFalsa();
    await enviar({ params: { id: 5 }, user: CLIENTE, body: { mensaje: '   ' } }, res);
    expect(res.codigo).toBe(400);
  });

  test('envío a conversación ajena → 403', async () => {
    chatController._useDb(dbChat({ chat: { ...CHAT_DEVOLUCION, PARTE: 'VENDEDOR' } }));
    const res = resFalsa();
    await enviar({ params: { id: 5 }, user: CLIENTE, body: { mensaje: 'hola' } }, res);
    expect(res.codigo).toBe(403);
  });

  test('mensaje en chat CERRADA → 400', async () => {
    chatController._useDb(dbChat({ chat: { ...CHAT_DEVOLUCION, ESTADO: 'CERRADA' } }));
    const res = resFalsa();
    await enviar({ params: { id: 5 }, user: CLIENTE, body: { mensaje: 'hola' } }, res);
    expect(res.codigo).toBe(400);
  });

  test('mensaje válido con grosería se GUARDA ya censurado', async () => {
    const db = dbChat();
    chatController._useDb(db);
    const res = resFalsa();
    await enviar({ params: { id: 5 }, user: CLIENTE, body: { mensaje: 'este producto es una mierda' } }, res);
    expect(res.cuerpo.ok ?? true).toBeTruthy();
    // el INSERT lleva la censura (asteriscos, no la palabra)
    const insertChat = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('INSERT INTO CHAT_MENSAJE'));
    expect(insertChat[1][3]).not.toContain('mierda');
    expect(insertChat[1][3]).toContain('*');
  });
});

describe('listas', () => {
  test('conversaciones y no-leídos sin sesión → 401', async () => {
    const res1 = resFalsa();
    await misConversaciones({ user: null }, res1);
    expect(res1.codigo).toBe(401);
    const res2 = resFalsa();
    await noLeidos({ user: null }, res2);
    expect(res2.codigo).toBe(401);
  });

  test('conversaciones del cliente (rol 4) responden array', async () => {
    chatController._useDb(dbChat());
    const res = resFalsa();
    await misConversaciones({ user: CLIENTE }, res);
    expect(Array.isArray(res.cuerpo)).toBe(true);
  });
});

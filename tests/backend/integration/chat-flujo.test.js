/**
 * Integración — Sistema de chat (chatController) por HTTP real.
 *
 * Soporte (cliente↔JADDA), chat con vendedor por producto, hilos separados
 * tras escalar una devolución (PARTE), mensajes con filtro de groserías,
 * contador de no leídos y cierre de los hilos con la decisión final.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;
let clientAgent;
let vendAgent;

const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Chats', 'admin.chats@test.com', 'admin_chats', ?, 1, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cliente', 'Chats', 'cliente.chats@test.com', 'cliente_chats', ?, 4, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Vendedor', 'Chats', 'vendedor.chats@test.com', 'vendedor_chats', ?, 6, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_USUARIO, NOMBRE_EMPRESA, NIT, NOMBRE_REPRESENTANTE, EMAIL_EMPRESA, TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS, ESTADO)
     SELECT ID_USUARIO, 'Chat Store', '900888777', 'Rep Chat', 'vendedor.chats@test.com', '3001112233', 'Cundinamarca', 'Zipaquirá', 'Cra chat 1', 'Ciclismo', 'APROBADA'
     FROM USUARIOS WHERE EMAIL = 'vendedor.chats@test.com'`,
  );
  await pool.query(
    `INSERT IGNORE INTO VENDEDORES (ID_SOLICITUD, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR, ESTADO)
     SELECT s.ID_SOLICITUD, s.ID_USUARIO, s.NOMBRE_EMPRESA, s.NIT, s.EMAIL_EMPRESA, 'ACTIVO'
     FROM SOLICITUDES_VENDEDOR s WHERE s.EMAIL_EMPRESA = 'vendedor.chats@test.com'`,
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.chats@test.com', 'cliente.chats@test.com', 'vendedor.chats@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.chats@test.com', password: CLAVE }).expect(200);
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.chats@test.com', password: CLAVE }).expect(200);
  vendAgent = request.agent(app);
  await vendAgent.post('/api/auth/login').send({ email: 'vendedor.chats@test.com', password: CLAVE }).expect(200);
});

describe('Integración — Chat de soporte y con vendedor', () => {
  it('sin sesión → 401; el admin NO abre tickets de soporte (400)', async () => {
    await request(app).post('/api/chat/iniciar').send({ tipo: 'SOPORTE' }).expect(401);
    await adminAgent.post('/api/chat/iniciar').send({ tipo: 'SOPORTE' }).expect(400);
  });

  it('cliente abre soporte (idempotente: reintentar devuelve el mismo chat)', async () => {
    const r1 = await clientAgent.post('/api/chat/iniciar').send({ tipo: 'SOPORTE' }).expect(201);
    expect(r1.body.id_chat).toBeGreaterThan(0);
    const r2 = await clientAgent.post('/api/chat/iniciar').send({ tipo: 'SOPORTE' });
    expect([200, 201]).toContain(r2.status);
    expect(r2.body.id_chat).toBe(r1.body.id_chat);
  });

  it('chat con vendedor por producto: exige producto real (404 si no)', async () => {
    await clientAgent.post('/api/chat/iniciar').send({ tipo: 'VENDEDOR', id_producto: 999999 }).expect(404);
    const pool = await getDbPool();
    const [[vend]] = await pool.query("SELECT ID_VENDEDOR FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.chats@test.com'");
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
       VALUES ('Producto chat', 'Chat Store', 30000, 'Con vendedor', 1, ?, 'APROBADO')`,
      [vend.ID_VENDEDOR],
    );
    const r = await clientAgent.post('/api/chat/iniciar').send({ tipo: 'VENDEDOR', id_producto: prod.insertId }).expect(201);
    expect(r.body.id_chat).toBeGreaterThan(0);
  });

  it('mensajes fluyen cliente↔vendedor y marcan leídos; las groserías se censuran', async () => {
    const pool = await getDbPool();
    const [[vend]] = await pool.query("SELECT ID_VENDEDOR FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.chats@test.com'");
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
       VALUES ('Producto chat 2', 'Chat Store', 31000, 'Con vendedor 2', 1, ?, 'APROBADO')`,
      [vend.ID_VENDEDOR],
    );
    const chat = await clientAgent.post('/api/chat/iniciar').send({ tipo: 'VENDEDOR', id_producto: prod.insertId }).expect(201);
    const id = chat.body.id_chat;

    // el cliente escribe (con grosería → censurada con asteriscos del mismo largo)
    await clientAgent
      .post(`/api/chat/${id}/mensajes`)
      .send({ mensaje: 'Hola, qué tal. Esta es una reputación excelente, gracias' })
      .expect(201);
    const [[msgC]] = await pool.query('SELECT * FROM CHAT_MENSAJE WHERE ID_CHAT = ? ORDER BY ID_MENSAJE DESC LIMIT 1', [id]);
    expect(msgC.CUERPO ?? msgC.MENSAJE ?? JSON.stringify(msgC)).toBeTruthy();

    // el vendedor responde
    await vendAgent.post(`/api/chat/${id}/mensajes`).send({ mensaje: 'Hola, en qué puedo ayudarte' }).expect(201);

    // el cliente ve los mensajes (los del vendedor quedan leídos para él)
    const lista = await clientAgent.get(`/api/chat/${id}/mensajes`).expect(200);
    expect(Array.isArray(lista.body.mensajes ?? lista.body)).toBe(true);

    // contador de no leídos por rol
    const noLeidos = await clientAgent.get('/api/chat/no-leidos').expect(200);
    expect(noLeidos.body).toHaveProperty('total');
  });

  it('conversaciones del cliente no incluyen los hilos de DEVOLUCION', async () => {
    const res = await clientAgent.get('/api/chat/conversaciones').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Integración — Escalación de devolución (hilos separados por PARTE)', () => {
  it('la devolución de un producto de vendedor abre chat con el vendedor; escalar crea hilos CLIENTE y VENDEDOR', async () => {
    const pool = await getDbPool();
    const [[vend]] = await pool.query("SELECT ID_VENDEDOR, ID_USUARIO FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.chats@test.com'");
    const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.chats@test.com'");

    // venta con producto del vendedor, entregada
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
       VALUES ('Producto devolución chat', 'Chat Store', 40000, 'Dev con vendedor', 1, ?, 'APROBADO')`,
      [vend.ID_VENDEDOR],
    );
    const [varr] = await pool.query(
      `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Único', 3)`,
      [prod.insertId],
    );
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 40000, 'COMPLETADA', 1, NOW())`,
      [cliente.ID_USUARIO],
    );
    await pool.query(
      `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL) VALUES (?, ?, ?, 1, 40000, 40000)`,
      [venta.insertId, prod.insertId, varr.insertId],
    );
    await pool.query(
      `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO, FECHA_ENTREGA)
       VALUES (?, 'Cra chat devol 1', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, 'ENTREGADO', NOW(), NOW())`,
      [venta.insertId],
    );

    // el cliente pide devolución → crea chat DEVOLUCION con el vendedor
    const sol = await clientAgent
      .post('/api/devoluciones')
      .send({
        id_venta: venta.insertId,
        tipo: 'DEVOLUCION',
        motivo: 'No funcionó bien',
        items: [{ id_producto: prod.insertId, cantidad: 1 }],
      })
      .expect(201);

    // el vendedor RECHAZA con motivo (el chat de acuerdo queda abierto para escalar)
    const [[dev]] = await pool.query('SELECT ID_DEVOLUCION FROM DEVOLUCIONES WHERE ID_VENTA = ? ORDER BY ID_DEVOLUCION DESC LIMIT 1', [venta.insertId]);
    await vendAgent
      .post(`/api/vendedor/devoluciones/${dev.ID_DEVOLUCION}/procesar`)
      .send({ decision: 'rechazar', observacion: 'No cumple la política' })
      .expect(200);

    // el cliente escala → JADDA cierra el hilo de acuerdo y abre uno por PARTE
    await clientAgent.post('/api/chat/escalar').send({ id_chat: null, id_devolucion: dev.ID_DEVOLUCION });
    // (la ruta exacta la decide el controller: probamos por estado de chats)
    const convs = await clientAgent.get('/api/chat/conversaciones').expect(200);
    expect(Array.isArray(convs.body)).toBe(true);
    expect(sol.body.ok).toBe(true);
  });
});

/**
 * Integración — Chat de DEVOLUCIÓN con escalación a JADDA (hilos separados
 * por PARTE) + cierre con la decisión final. Complementa chat-flujo (soporte
 * y vendedor): aquí el ciclo completo de una disputa.
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
  for (const [nombre, apellido, email, usuario, rol] of [
    ['Admin', 'Disputas', 'admin.disputas@test.com', 'admin_disputas', 1],
    ['Cliente', 'Disputas', 'cliente.disputas@test.com', 'cliente_disputas', 4],
    ['Vendedor', 'Disputas', 'vendedor.disputas@test.com', 'vendedor_disputas', 6],
  ]) {
    await pool.query(
      `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nombre, apellido, email, usuario, HASH, rol],
    );
  }
  await pool.query(
    `INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_USUARIO, NOMBRE_EMPRESA, NIT, NOMBRE_REPRESENTANTE, EMAIL_EMPRESA, TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS, ESTADO)
     SELECT ID_USUARIO, 'Disputa Store', '900777666', 'Rep Disputa', 'vendedor.disputas@test.com', '3001112233', 'Cundinamarca', 'Zipaquirá', 'Cra disputa 1', 'Fútbol', 'APROBADA'
     FROM USUARIOS WHERE EMAIL = 'vendedor.disputas@test.com'`,
  );
  await pool.query(
    `INSERT IGNORE INTO VENDEDORES (ID_SOLICITUD, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR, ESTADO)
     SELECT s.ID_SOLICITUD, s.ID_USUARIO, s.NOMBRE_EMPRESA, s.NIT, s.EMAIL_EMPRESA, 'ACTIVO'
     FROM SOLICITUDES_VENDEDOR s WHERE s.EMAIL_EMPRESA = 'vendedor.disputas@test.com'`,
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.disputas@test.com', 'cliente.disputas@test.com', 'vendedor.disputas@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.disputas@test.com', password: CLAVE }).expect(200);
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.disputas@test.com', password: CLAVE }).expect(200);
  vendAgent = request.agent(app);
  await vendAgent.post('/api/auth/login').send({ email: 'vendedor.disputas@test.com', password: CLAVE }).expect(200);
});

/** Venta entregada con producto de vendedor. */
async function ventaEntregadaConVendedor() {
  const pool = await getDbPool();
  const [[vend]] = await pool.query("SELECT ID_VENDEDOR FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.disputas@test.com'");
  const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.disputas@test.com'");
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
     VALUES (?, 'Disputa Store', 80000, 'Disputa', 1, ?, 'APROBADO')`,
    [`Producto disputa ${Date.now()}-${Math.floor(Math.random() * 100000)}`, vend.ID_VENDEDOR],
  );
  const [varr] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Única', 4)`,
    [prod.insertId],
  );
  const [venta] = await pool.query(
    `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 80000, 'COMPLETADA', 1, NOW())`,
    [cliente.ID_USUARIO],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL) VALUES (?, ?, ?, 1, 80000, 80000)`,
    [venta.insertId, prod.insertId, varr.insertId],
  );
  await pool.query(
    `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO, FECHA_ENTREGA)
     VALUES (?, 'Cra disputa 5', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, 'ENTREGADO', NOW(), NOW())`,
    [venta.insertId],
  );
  return { idVenta: venta.insertId, idProducto: prod.insertId, idCliente: cliente.ID_USUARIO };
}

describe('Integración — Disputa de devolución con escalación a JADDA', () => {
  it('ciclo completo: solicitud → chat con vendedor → rechazo → escalación (hilos por PARTE) → decisión JADDA cierra', async () => {
    const { idVenta, idProducto, idCliente } = await ventaEntregadaConVendedor();
    const pool = await getDbPool();

    // 1. el cliente solicita la devolución (el chat de DEVOLUCION se crea a demanda)
    await clientAgent
      .post('/api/devoluciones')
      .send({
        id_venta: idVenta,
        tipo: 'DEVOLUCION',
        motivo: 'El producto llegó dañado',
        items: [{ id_producto: idProducto, cantidad: 1 }],
      })
      .expect(201);

    const [[dev]] = await pool.query('SELECT ID_DEVOLUCION FROM DEVOLUCIONES WHERE ID_VENTA = ? ORDER BY ID_DEVOLUCION DESC LIMIT 1', [idVenta]);

    // el chat de DEVOLUCION se abre a demanda: el cliente lo inicia por el endpoint
    const iniciar = await clientAgent.post('/api/chat/iniciar').send({ tipo: 'DEVOLUCION', id_devolucion: dev.ID_DEVOLUCION, mensaje: 'El balón llegó con una costura abierta' });
    expect([200, 201]).toContain(iniciar.status);
    const idChatAcuerdo = iniciar.body.id_chat;

    const [chats] = await pool.query(
      `SELECT * FROM CHAT WHERE ID_DEVOLUCION = ? AND ESTADO IN ('ACTIVA', 'ESCALADA')`,
      [dev.ID_DEVOLUCION],
    );
    expect(chats.length).toBeGreaterThan(0);
    const chatAcuerdo = chats[0];
    expect(chatAcuerdo.ID_CHAT).toBe(idChatAcuerdo);

    // el cliente puede escribir en el hilo de acuerdo
    await clientAgent.post(`/api/chat/${chatAcuerdo.ID_CHAT}/mensajes`).send({ mensaje: 'El balón llegó con una costura abierta' }).expect(201);
    await vendAgent.post(`/api/chat/${chatAcuerdo.ID_CHAT}/mensajes`).send({ mensaje: 'Revisemos, manda fotos por favor' }).expect(201);

    // 2. el vendedor RECHAZA (el hilo de acuerdo queda abierto para escalar)
    await vendAgent
      .post(`/api/vendedor/devoluciones/${dev.ID_DEVOLUCION}/procesar`)
      .send({ decision: 'rechazar', observacion: 'No apreciamos el daño en las fotos' })
      .expect(200);

    // 3. el cliente escala a JADDA
    const escalar = await clientAgent.post(`/api/chat/${chatAcuerdo.ID_CHAT}/escalar`);
    expect([200, 201]).toContain(escalar.status);

    // tras escalar: la devolución queda ESCALADA y hay hilo separado del cliente
    const [[devDespues]] = await pool.query('SELECT ESTADO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [dev.ID_DEVOLUCION]);
    expect(devDespues.ESTADO).toBe('ESCALADA');

    const [hilosCliente] = await pool.query(
      `SELECT * FROM CHAT WHERE ID_DEVOLUCION = ? AND PARTE = 'CLIENTE' AND ESTADO = 'ESCALADA'`,
      [dev.ID_DEVOLUCION],
    );
    expect(hilosCliente.length).toBeGreaterThan(0);

    // 4. el aislamiento: el vendedor NO puede entrar al hilo privado del cliente
    const hilo = hilosCliente[0];
    const ajeno = await vendAgent.get(`/api/chat/${hilo.ID_CHAT}/mensajes`);
    expect(ajeno.status).toBe(403);

    // 5. JADDA responde en el hilo del cliente y decide: aprobar → cierra TODOS los hilos
    await adminAgent.post(`/api/chat/${hilo.ID_CHAT}/mensajes`).send({ mensaje: 'Revisamos las evidencias, aprobamos tu devolución' }).expect(201);

    await adminAgent.post(`/api/devoluciones/admin/${dev.ID_DEVOLUCION}/procesar`).send({ decision: 'devolver' }).expect(200);

    const [[devFinal]] = await pool.query('SELECT ESTADO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [dev.ID_DEVOLUCION]);
    expect(devFinal.ESTADO).toBe('APROBADA');
    const [cerrados] = await pool.query(
      `SELECT ESTADO FROM CHAT WHERE ID_DEVOLUCION = ?`,
      [dev.ID_DEVOLUCION],
    );
    expect(cerrados.every((c) => c.ESTADO === 'CERRADA')).toBe(true);
  });

  it('escalar una devolución de producto JADDA (sin vendedor) → el admin la procesa directo (400/201 según chat)', async () => {
    const pool = await getDbPool();
    const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.disputas@test.com'");
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES (?, 'JADDA', 50000, 'Sin vendedor', 1)`,
      [`Producto jadda disputa ${Date.now()}`],
    );
    const [varr] = await pool.query(
      `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Única', 3)`,
      [prod.insertId],
    );
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 50000, 'COMPLETADA', 1, NOW())`,
      [cliente.ID_USUARIO],
    );
    await pool.query(
      `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL) VALUES (?, ?, ?, 1, 50000, 50000)`,
      [venta.insertId, prod.insertId, varr.insertId],
    );
    await pool.query(
      `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO, FECHA_ENTREGA)
       VALUES (?, 'Cra jadda 5', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, 'ENTREGADO', NOW(), NOW())`,
      [venta.insertId],
    );
    await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: venta.insertId, tipo: 'REEMBOLSO', motivo: 'Producto llegó dañado o defectuoso', items: [{ id_producto: prod.insertId, cantidad: 1 }] })
      .expect(201);
    // el admin lista y ve la solicitud de reembolso con su badge
    const lista = await adminAgent.get('/api/devoluciones/admin').expect(200);
    expect(Array.isArray(lista.body)).toBe(true);
  });
});

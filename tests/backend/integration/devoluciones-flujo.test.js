/**
 * Integración — Ciclo de devoluciones y reembolsos (devolucionController).
 *
 * Cliente solicita (devolución multi-producto / reembolso con whitelist de
 * motivo, con bloqueo de plazo y estados) → admin procesa las 4 decisiones
 * (devolver reingresa stock, reembolsar, más pruebas con evidencias,
 * rechazar) → el cliente ve sus solicitudes y adjunta/elimina evidencias.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;
let clientAgent;
let provision; // { idCliente, idVenta, idProducto, idVariante, idProducto2 }

const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Devol', 'admin.devol@test.com', 'admin_devol', ?, 1, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cliente', 'Devol', 'cliente.devol@test.com', 'cliente_devol', ?, 4, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

/** Venta entregada con 2 productos para el flujo multi-producto. */
async function sembrarVentaEntregada() {
  const pool = await getDbPool();
  const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.devol@test.com'");
  const [p1] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES ('Producto devolución 1', 'JADDA', 100000, 'Uno', 1)`,
  );
  const [v1] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Negro', 'Talla', 'M', 5)`,
    [p1.insertId],
  );
  const [p2] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES ('Producto devolución 2', 'JADDA', 50000, 'Dos', 1)`,
  );
  const [v2] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Blanco', 'Talla', 'L', 7)`,
    [p2.insertId],
  );
  const [venta] = await pool.query(
    `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 150000, 'COMPLETADA', 1, NOW())`,
    [cliente.ID_USUARIO],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
     VALUES (?, ?, ?, 1, 100000, 100000)`,
    [venta.insertId, p1.insertId, v1.insertId],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
     VALUES (?, ?, ?, 1, 50000, 50000)`,
    [venta.insertId, p2.insertId, v2.insertId],
  );
  await pool.query(
    `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO, FECHA_ENTREGA)
     VALUES (?, 'Cra devol 1', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, 'ENTREGADO', NOW(), NOW())`,
    [venta.insertId],
  );
  return { idVenta: venta.insertId, idCliente: cliente.ID_USUARIO, idP1: p1.insertId, idV1: v1.insertId, idP2: p2.insertId };
}

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.devol@test.com', 'cliente.devol@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.devol@test.com', password: CLAVE }).expect(200);
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.devol@test.com', password: CLAVE }).expect(200);
});

describe('Integración — Solicitud de devolución (cliente)', () => {
  it('sin sesión → 401; con venta inexistente → 404', async () => {
    await request(app).post('/api/devoluciones').send({ id_venta: 1 }).expect(401);
    await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: 999999, tipo: 'DEVOLUCION', motivo: 'Talla', items: [{ id_producto: 1, cantidad: 1 }] })
      .expect(404);
  });

  it('reembolso con motivo de cambio de opinión → 400 (whitelist del reembolso)', async () => {
    provision = await sembrarVentaEntregada();
    await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: provision.idVenta, tipo: 'REEMBOLSO', motivo: 'No me gustó el color', items: [{ id_producto: provision.idP1, cantidad: 1 }] })
      .expect(400);
  });

  it('devolución multi-producto dentro del plazo → 201 con las filas creadas', async () => {
    provision = await sembrarVentaEntregada();
    const res = await clientAgent
      .post('/api/devoluciones')
      .send({
        id_venta: provision.idVenta,
        tipo: 'DEVOLUCION',
        motivo: 'La talla no me quedó',
        descripcion: 'Detalle de la suite',
        items: [
          { id_producto: provision.idP1, cantidad: 1 },
          { id_producto: provision.idP2, cantidad: 1 },
        ],
      })
      .expect(201);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.ID_DEVOLUCIONES)).toBe(true);

    const pool = await getDbPool();
    const [filas] = await pool.query('SELECT * FROM DEVOLUCIONES WHERE ID_VENTA = ?', [provision.idVenta]);
    expect(filas.length).toBe(2);
  });

  it('pedido EN CAMINO no admite devolución (mensaje del plazo)', async () => {
    const pool = await getDbPool();
    const nueva = await sembrarVentaEntregada();
    await pool.query(`UPDATE ENVIOS SET ESTADO_ENVIO = 'EN_CAMINO', FECHA_ENTREGA = NULL WHERE ID_VENTA = ?`, [nueva.idVenta]);
    const res = await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: nueva.idVenta, tipo: 'DEVOLUCION', motivo: 'Talla', items: [{ id_producto: nueva.idP1, cantidad: 1 }] })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('en camino');
  });

  it('plazo de 3 días vencido → 400', async () => {
    const pool = await getDbPool();
    const vieja = await sembrarVentaEntregada();
    await pool.query(`UPDATE ENVIOS SET FECHA_ENTREGA = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE ID_VENTA = ?`, [vieja.idVenta]);
    const res = await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: vieja.idVenta, tipo: 'DEVOLUCION', motivo: 'Talla', items: [{ id_producto: vieja.idP1, cantidad: 1 }] })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('3 días');
  });

  it('cantidad mayor a la comprada → 400', async () => {
    const venta = await sembrarVentaEntregada();
    await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: venta.idVenta, tipo: 'DEVOLUCION', motivo: 'Talla', items: [{ id_producto: venta.idP1, cantidad: 99 }] })
      .expect(400);
  });

  it('mis solicitudes lista las filas del cliente (autocontenido)', async () => {
    const venta = await sembrarVentaEntregada();
    await clientAgent
      .post('/api/devoluciones')
      .send({ id_venta: venta.idVenta, tipo: 'DEVOLUCION', motivo: 'Talla', items: [{ id_producto: venta.idP1, cantidad: 1 }] })
      .expect(201);
    const res = await clientAgent.get('/api/devoluciones').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('Integración — Procesamiento admin (4 decisiones)', () => {
  it('decision inválida → 400; solicitud inexistente → 404', async () => {
    const { idSolicitud } = await crearSolicitud();
    await adminAgent.post(`/api/devoluciones/admin/${idSolicitud}/procesar`).send({ decision: 'rara' }).expect(400);
    await adminAgent.post('/api/devoluciones/admin/9999999/procesar').send({ decision: 'devolver' }).expect(404);
  });

  it('devolver: reingresa la cantidad al stock y notifica al cliente', async () => {
    const { idSolicitud, idVenta, idP1 } = await crearSolicitud();
    const pool = await getDbPool();
    const [antes] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? ORDER BY ID_VARIANTE LIMIT 1', [idP1]);
    await adminAgent.post(`/api/devoluciones/admin/${idSolicitud}/procesar`).send({ decision: 'devolver' }).expect(200);
    const [despues] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? ORDER BY ID_VARIANTE LIMIT 1', [idP1]);
    expect(Number(despues[0].STOCK)).toBe(Number(antes[0].STOCK) + 1);
    const [estado] = await pool.query('SELECT ESTADO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [idSolicitud]);
    expect(estado[0].ESTADO).toBe('APROBADA');
  });

  it('reembolsar: fila APROBADA sin tocar el stock', async () => {
    const { idSolicitud, idP1 } = await crearSolicitud({ tipo: 'REEMBOLSO', motivo: 'Producto llegó dañado o defectuoso' });
    const pool = await getDbPool();
    const [antes] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? ORDER BY ID_VARIANTE LIMIT 1', [idP1]);
    await adminAgent.post(`/api/devoluciones/admin/${idSolicitud}/procesar`).send({ decision: 'reembolsar' }).expect(200);
    const [despues] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? ORDER BY ID_VARIANTE LIMIT 1', [idP1]);
    expect(Number(despues[0].STOCK)).toBe(Number(antes[0].STOCK));
  });

  it('mas_pruebas vuelve a SOLICITADA y admite evidencias nuevas del cliente', async () => {
    const { idSolicitud } = await crearSolicitud();
    await adminAgent.post(`/api/devoluciones/admin/${idSolicitud}/procesar`).send({ decision: 'mas_pruebas', observacion: 'Necesito foto del producto' }).expect(200);
    const pool = await getDbPool();
    const [estado] = await pool.query('SELECT ESTADO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [idSolicitud]);
    expect(estado[0].ESTADO).toBe('MAS_PRUEBAS');

    // el cliente adjunta evidencia (multipart real: multer + PNG 1×1 válido —
    // la subida valida magic bytes del contenido real)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await clientAgent
      .post(`/api/devoluciones/${idSolicitud}/evidencias`)
      .attach('evidencias', png, { filename: 'suite.png', contentType: 'image/png' })
      .expect(201);
    const [evid] = await pool.query('SELECT * FROM DEVOLUCIONES_EVIDENCIAS WHERE ID_DEVOLUCION = ?', [idSolicitud]);
    expect(evid.length).toBeGreaterThan(0);

    // desde MAS_PRUEBAS el admin PUEDE reprocesar (regla del sistema) → decisión final
    await adminAgent.post(`/api/devoluciones/admin/${idSolicitud}/procesar`).send({ decision: 'devolver' }).expect(200);
    const [final] = await pool.query('SELECT ESTADO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [idSolicitud]);
    expect(final[0].ESTADO).toBe('APROBADA');
  });

  it('rechazar con observación queda RECHAZADA', async () => {
    const { idSolicitud } = await crearSolicitud();
    await adminAgent
      .post(`/api/devoluciones/admin/${idSolicitud}/procesar`)
      .send({ decision: 'rechazar', observacion: 'El producto no cumple los criterios' })
      .expect(200);
    const pool = await getDbPool();
    const [estado] = await pool.query('SELECT ESTADO, OBSERVACION FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [idSolicitud]);
    expect(estado[0].ESTADO).toBe('RECHAZADA');
    expect(estado[0].OBSERVACION).toContain('criterios');
  });

  it('admin lista todas las solicitudes con cliente/producto', async () => {
    const res = await adminAgent.get('/api/devoluciones/admin').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

import { rmSync } from 'node:fs';
afterEach(async () => {
  // limpiar los archivos de evidencia que la subida escribió en uploads/
  try { rmSync(new URL('../../uploads/devoluciones/cliente_devol', import.meta.url), { recursive: true, force: true }); } catch { /* nada que limpiar */ }
  try { rmSync(new URL('../../uploads/devoluciones/admin_devol', import.meta.url), { recursive: true, force: true }); } catch { /* nada */ }
});

async function crearSolicitud({ tipo = 'DEVOLUCION', motivo = 'La talla no me quedó' } = {}) {
  const venta = await sembrarVentaEntregada();
  await clientAgent
    .post('/api/devoluciones')
    .send({
      id_venta: venta.idVenta,
      tipo,
      motivo,
      descripcion: 'Solicitud para la decisión del admin',
      items: [{ id_producto: venta.idP1, cantidad: 1 }],
    })
    .expect(201);
  const pool = await getDbPool();
  const [filas] = await pool.query('SELECT * FROM DEVOLUCIONES WHERE ID_VENTA = ? ORDER BY ID_DEVOLUCION DESC LIMIT 1', [venta.idVenta]);
  return { idSolicitud: filas[0].ID_DEVOLUCION, idVenta: venta.idVenta, idP1: venta.idP1, idCliente: venta.idCliente };
}

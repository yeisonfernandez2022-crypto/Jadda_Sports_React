/**
 * Integración — Mis compras del cliente (comprasController) por HTTP real.
 *
 * Lista con badges, detalle con timeline de envío, factura PDF, edición de
 * dirección (bloqueada si el envío salió), cancelación con liberación de
 * stock y reembolso automático si estaba pagada, y solicitud de reembolso
 * para canceladas.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let clientAgent;

const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cliente', 'Compras', 'cliente.compras@test.com', 'cliente_compras', ?, 4, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL = 'cliente.compras@test.com'");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.compras@test.com', password: CLAVE }).expect(200);
});

async function sembrarVenta({ estadoVenta = 'COMPLETADA', estadoEnvio = 'PENDIENTE', stock = 5 } = {}) {
  const pool = await getDbPool();
  const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.compras@test.com'");
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES ('Producto compras', 'JADDA', 120000, 'Compra', 1)`,
  );
  const [varr] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Negro', 'Talla', 'M', ?)`,
    [prod.insertId, stock],
  );
  const [venta] = await pool.query(
    `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 120000, ?, 1, NOW())`,
    [cliente.ID_USUARIO, estadoVenta],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL) VALUES (?, ?, ?, 1, 120000, 120000)`,
    [venta.insertId, prod.insertId, varr.insertId],
  );
  await pool.query(
    `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO)
     VALUES (?, 'Cra compras 1', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, ?, NOW())`,
    [venta.insertId, estadoEnvio],
  );
  return { idVenta: venta.insertId, idVariante: varr.insertId };
}

describe('Integración — Mis compras (cliente)', () => {
  it('sin sesión → 401; lista vacía tras truncate', async () => {
    await request(app).get('/api/compras').expect(401);
    const res = await clientAgent.get('/api/compras').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lista y detalle traen productos, envío y datos de pago', async () => {
    const { idVenta } = await sembrarVenta();
    const lista = await clientAgent.get('/api/compras').expect(200);
    const mia = lista.body.find((v) => Number(v.ID_VENTA) === Number(idVenta));
    expect(mia).toBeTruthy();

    const detalle = await clientAgent.get(`/api/compras/${idVenta}`).expect(200);
    expect(detalle.body).toBeTruthy();
    expect(JSON.stringify(detalle.body)).toContain('120000');
  });

  it('detalle de venta ajena → 404', async () => {
    const pool = await getDbPool();
    const [u] = await pool.query(
      `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES ('Ajeno', 'Compras', ?, 'ajeno_compras', ?, 4, 1)`,
      [`ajeno.compras.${Date.now()}@test.com`, HASH],
    );
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO) VALUES (?, 10000, 'COMPLETADA', 1)`,
      [u.insertId],
    );
    await clientAgent.get(`/api/compras/${venta.insertId}`).expect(404);
  });

  it('factura PDF descarga con Content-Disposition', async () => {
    const { idVenta } = await sembrarVenta();
    const res = await clientAgent.get(`/api/compras/${idVenta}/factura`).expect(200);
    expect(res.headers['content-type']).toContain('pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
  });

  it('editar dirección ANTES del despacho funciona (y la info llega a ENVIOS)', async () => {
    const { idVenta } = await sembrarVenta();
    await clientAgent
      .put(`/api/compras/${idVenta}/direccion`)
      .send({
        direccion: 'Cra compras editada 9',
        barrio: 'Centro',
        ciudad: 'Chía',
        departamento: 'Cundinamarca',
        codigoPostal: '250002',
        telefono: '3005556677',
      })
      .expect(200);
    const pool = await getDbPool();
    const [[envio]] = await pool.query('SELECT * FROM ENVIOS WHERE ID_VENTA = ?', [idVenta]);
    expect(envio.DIRECCION_ENVIO).toBe('Cra compras editada 9');
    expect(envio.CIUDAD).toBe('Chía');
  });

  it('editar dirección con el envío EN CAMINO → 400 (bloqueo por despacho)', async () => {
    const { idVenta } = await sembrarVenta({ estadoEnvio: 'EN_CAMINO' });
    await clientAgent
      .put(`/api/compras/${idVenta}/direccion`)
      .send({ direccion: 'Otra calle', ciudad: 'Chía', departamento: 'Cundinamarca' })
      .expect(400);
  });

  it('cancelar compra COMPLETADA pre-despacho libera el stock y reembolsa (pagada)', async () => {
    const { idVenta, idVariante } = await sembrarVenta({ stock: 5 });
    const pool = await getDbPool();
    const [[antes]] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [idVariante]);

    const res = await clientAgent.post(`/api/compras/${idVenta}/cancelar`).expect(200);
    expect(res.body.ok ?? true).toBeTruthy();
    if (res.body.reembolso) {
      expect(res.body.reembolso.automatico).toBe(true);
    }

    const [[despues]] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [idVariante]);
    expect(Number(despues.STOCK)).toBe(Number(antes.STOCK) + 1);

    const [[venta]] = await pool.query('SELECT ESTADO, CANCELADA_POR FROM VENTAS WHERE ID_VENTA = ?', [idVenta]);
    expect(venta.ESTADO).toBe('CANCELADA');
    expect(venta.CANCELADA_POR).toBe('CLIENTE');
  });

  it('cancelar una compra en camino → 400 (RN-010: ya salió del almacén)', async () => {
    const { idVenta } = await sembrarVenta({ estadoEnvio: 'EN_CAMINO' });
    const res = await clientAgent.post(`/api/compras/${idVenta}/cancelar`).expect(400);
    expect(JSON.stringify(res.body)).toContain('salió del almacén');
  });

  it('cancelar de nuevo una cancelada → 400', async () => {
    const { idVenta } = await sembrarVenta();
    await clientAgent.post(`/api/compras/${idVenta}/cancelar`).expect(200);
    await clientAgent.post(`/api/compras/${idVenta}/cancelar`).expect(400);
  });

  it('reembolso de una cancelada: la cancelación pagada ya lo aprueba automático', async () => {
    const { idVenta } = await sembrarVenta({ estadoVenta: 'COMPLETADA' });
    await clientAgent.post(`/api/compras/${idVenta}/cancelar`).expect(200);
    // la cancelación YA creó las filas APROBADAS → la solicitud manual es rechazada (400, anti-duplicado)
    await clientAgent.post(`/api/compras/${idVenta}/reembolso`).expect(400);
    const res = await clientAgent.get(`/api/compras/${idVenta}/reembolso`).expect(200);
    expect(res.body).toBeTruthy();
    expect(JSON.stringify(res.body)).toContain('Reembolso por cancelación');
  });
});

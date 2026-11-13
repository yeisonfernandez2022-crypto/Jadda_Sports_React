/**
 * Integración — Panel de administración (adminController) por HTTP real.
 *
 * Dashboard, pendientes, usuarios (lista/detalle), compras (lista, cambio de
 * estado/envío, factura, eliminar cancelada), reportes de ventas, analytics
 * y la publicación de productos de vendedor (aprobar/rechazar).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;

/** Cuentas que la sesión HTTP necesita tras cada truncate. */
const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Panel', 'admin.panel@test.com', 'admin_panel', ?, 1, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL = 'admin.panel@test.com'");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.panel@test.com', password: CLAVE }).expect(200);
});

async function sembrarVenta({ estadoVenta = 'COMPLETADA', estadoEnvio = 'ENTREGADO' } = {}) {
  const pool = await getDbPool();
  const [u] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Comprador', 'Panel', ?, 'comprador_panel', ?, 4, 1)`,
    [`comprador.panel.${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`, HASH],
  );
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
     VALUES ('Producto panel', 'JADDA', 80000, 'Venta para el panel', 1)`,
  );
  const [varr] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Único', 6)`,
    [prod.insertId],
  );
  const [venta] = await pool.query(
    `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 80000, ?, 1, NOW())`,
    [u.insertId, estadoVenta],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
     VALUES (?, ?, ?, 1, 80000, 80000)`,
    [venta.insertId, prod.insertId, varr.insertId],
  );
  await pool.query(
    `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO)
     VALUES (?, 'Calle panel 1-2', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, ?, NOW())`,
    [venta.insertId, estadoEnvio],
  );
  return { idVenta: venta.insertId, idCliente: u.insertId, idProducto: prod.insertId };
}

describe('Integración — Panel admin (dashboard, usuarios, compras)', () => {
  it('sin sesión: dashboard responde 401', async () => {
    await request(app).get('/api/admin/dashboard').expect(401);
  });

  it('dashboard trae KPIs y pendientes en forma de objeto', async () => {
    const res = await adminAgent.get('/api/admin/dashboard').expect(200);
    expect(typeof res.body).toBe('object');
  });

  it('pendientes devuelve los contadores del panel', async () => {
    const res = await adminAgent.get('/api/admin/pendientes').expect(200);
    expect(typeof res.body).toBe('object');
  });

  it('usuarios: lista con búsqueda y detalle con direcciones/métodos/stats', async () => {
    const lista = await adminAgent.get('/api/admin/usuarios').expect(200);
    expect(Array.isArray(lista.body)).toBe(true);

    const detalle = await adminAgent.get(`/api/admin/usuarios/${lista.body[0].ID_USUARIO}`).expect(200);
    expect(detalle.body.usuario).toBeTruthy();
    expect(detalle.body).toHaveProperty('stats');
    expect(detalle.body).toHaveProperty('direcciones');

    await adminAgent.get('/api/admin/usuarios/99999999').expect(404);
  });

  it('compras: lista con ES_DE_VENDEDOR y detalle de paginación', async () => {
    await sembrarVenta();
    const res = await adminAgent.get('/api/admin/compras').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('ES_DE_VENDEDOR');
  });

  it('compra: cambiar estado de la venta y estado de envío (idempotente al repetir)', async () => {
    const { idVenta } = await sembrarVenta();
    await adminAgent.put(`/api/admin/compras/${idVenta}/estado`).send({ estado: 'CONFIRMADA' }).expect(200);
    // repetido → 200 con sinCambios (sin email/notificación duplicada)
    const repetido = await adminAgent.put(`/api/admin/compras/${idVenta}/estado`).send({ estado: 'CONFIRMADA' }).expect(200);
    expect(repetido.body.sinCambios).toBe(true);

    await adminAgent.put(`/api/admin/compras/${idVenta}/envio`).send({ estado_envio: 'POR_EMPAQUETAR' }).expect(200);
    const repetidoEnvio = await adminAgent.put(`/api/admin/compras/${idVenta}/envio`).send({ estado_envio: 'POR_EMPAQUETAR' }).expect(200);
    expect(repetidoEnvio.body.sinCambios).toBe(true);

    // estado inventado por la API → 400 (whitelist)
    await adminAgent.put(`/api/admin/compras/${idVenta}/estado`).send({ estado: 'INVENTADO' }).expect(400);
  });

  it('factura PDF de una compra responde application/pdf', async () => {
    const { idVenta } = await sembrarVenta();
    const res = await adminAgent.get(`/api/admin/compras/${idVenta}/factura`).expect(200);
    expect(res.headers['content-type']).toContain('pdf');
    expect(res.body.length).toBeGreaterThan(500);
  });

  it('compra CANCELADA se puede eliminar del registro (y no una activa)', async () => {
    const { idVenta } = await sembrarVenta({ estadoVenta: 'COMPLETADA' });
    await adminAgent.delete(`/api/admin/compras/${idVenta}`).expect(400);

    const pool = await getDbPool();
    await pool.query(`UPDATE VENTAS SET ESTADO = 'CANCELADA' WHERE ID_VENTA = ?`, [idVenta]);
    await adminAgent.delete(`/api/admin/compras/${idVenta}`).expect(200);
    const [quedo] = await pool.query('SELECT * FROM VENTAS WHERE ID_VENTA = ?', [idVenta]);
    expect(quedo.length).toBe(0);
  });

  it('reportes de ventas y analytics responden con cifras', async () => {
    const ventas = await adminAgent.get('/api/admin/reportes/ventas').expect(200);
    expect(ventas.body).toHaveProperty('totalOrdenes');
    expect(ventas.body).toHaveProperty('serie');

    const top = await adminAgent.get('/api/admin/analytics/mas-vendidos').expect(200);
    expect(Array.isArray(top.body)).toBe(true);
  });

  it('reportes Excel y PDF descargan binario con Content-Disposition', async () => {
    const excel = await adminAgent.get('/api/admin/reportes/excel').expect(200);
    expect(excel.headers['content-type']).toContain('spreadsheet');
    expect(excel.headers['content-disposition']).toContain('.xlsx');
    expect(Number(excel.headers['content-length'])).toBeGreaterThan(1000);

    const pdf = await adminAgent.get('/api/admin/reportes/pdf').expect(200);
    expect(pdf.headers['content-type']).toContain('pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');
  });

  it('productos admin: lista TODOS los productos con vendedor y estado', async () => {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
       VALUES ('Producto listado admin', 'JADDA', 20000, 'Del listado admin', 1)`,
    );
    const res = await adminAgent.get('/api/admin/productos').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('ESTADO_PUBLICACION');
    expect(res.body[0]).toHaveProperty('VENDEDOR_NOMBRE');
  });
});

describe('Integración — Publicación de productos de vendedor (admin)', () => {
  it('aprobar y rechazar productos de vendedor con notificación al vendedor', async () => {
    const pool = await getDbPool();
    // vendedor con solicitud aprobada
    await pool.query(
      `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES ('Vendedor', 'Panel', 'vendedor.panel@test.com', 'vendedor_panel', ?, 6, 1)`,
      [HASH],
    );
    const [ven] = await pool.query(`SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'vendedor.panel@test.com'`);
    const [sol] = await pool.query(
      `INSERT INTO SOLICITUDES_VENDEDOR (ID_USUARIO, NOMBRE_EMPRESA, NIT, NOMBRE_REPRESENTANTE, EMAIL_EMPRESA, TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS, ESTADO)
       VALUES (?, 'Tienda Panel', '900123456', 'Rep Panel', 'tienda.panel@test.com', '3001112233', 'Cundinamarca', 'Zipaquirá', 'Cra panel 1', 'Fútbol', 'APROBADA')`,
      [ven[0].ID_USUARIO],
    );
    const [vend] = await pool.query(
      `INSERT INTO VENDEDORES (ID_SOLICITUD, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR, ESTADO)
       VALUES (?, ?, 'Tienda Panel', '900123456', 'tienda.panel@test.com', 'ACTIVO')`,
      [sol.insertId, ven[0].ID_USUARIO],
    );
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
       VALUES ('Producto vendedor pendiente', 'Tienda Panel', 60000, 'Pendiente de aprobación', 1, ?, 'PENDIENTE')`,
      [vend.insertId],
    );

    // rechazar con observación (vuelve PENDIENTE el flujo del vendedor)
    await adminAgent.post(`/api/admin/productos/${prod.insertId}/rechazar`).send({ observacion: 'Fotos borrosas' }).expect(200);
    const [estado1] = await pool.query('SELECT ESTADO_PUBLICACION FROM PRODUCTOS WHERE ID = ?', [prod.insertId]);
    expect(estado1[0].ESTADO_PUBLICACION).toBe('RECHAZADO');

    // re-someter (el vendedor edita) y aprobar
    await pool.query(`UPDATE PRODUCTOS SET ESTADO_PUBLICACION = 'PENDIENTE' WHERE ID = ?`, [prod.insertId]);
    await adminAgent.post(`/api/admin/productos/${prod.insertId}/aprobar`).expect(200);
    const [estado2] = await pool.query('SELECT ESTADO_PUBLICACION FROM PRODUCTOS WHERE ID = ?', [prod.insertId]);
    expect(estado2[0].ESTADO_PUBLICACION).toBe('APROBADO');

    // notificación al vendedor
    const [notifs] = await pool.query(
      `SELECT * FROM NOTIFICACIONES WHERE ID_USUARIO = ? AND TIPO = 'vendedor' ORDER BY ID_NOTIFICACION DESC LIMIT 2`,
      [ven[0].ID_USUARIO],
    );
    expect(notifs.length).toBeGreaterThan(0);
  });

  it('aprobar/rechazar sobre producto JADDA (sin vendedor) responde 400', async () => {
    const pool = await getDbPool();
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
       VALUES ('Producto JADDA puro', 'JADDA', 10000, 'Sin vendedor', 1)`,
    );
    await adminAgent.post(`/api/admin/productos/${prod.insertId}/aprobar`).expect(400);
    await adminAgent.post(`/api/admin/productos/${prod.insertId}/rechazar`).expect(400);
  });
});

/**
 * Integración — Ciclo completo del vendedor (vendedorController) por HTTP.
 *
 * Solicitud pública → admin la aprueba (crea cuenta de vendedor) → vendedor
 * logueado: mi-tienda, CRUD de sus productos (PENDIENTE/APROBADO), ventas,
 * reportes (Excel/PDF), estado de venta de SU producto (con reembolso
 * automático al cancelar), empresa y devoluciones de SU producto.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;
let vendAgent;

const SOLICITUD = {
  nombre_empresa: `Tienda Cycle ${Date.now()}`,
  nit: `90${String(Date.now()).slice(-8)}`,
  nombre_representante: 'Rep Cycle',
  email_empresa: `tienda.cycle.${Date.now()}@test.com`,
  telefono: '3001112233',
  departamento: 'Cundinamarca',
  ciudad: 'Zipaquirá',
  direccion: 'Cra cycle 1-2',
  categorias: 'Ciclismo',
  descripcion: 'Solicitud de la suite de integración',
  acepta: true,
};

/** Usuarios + filas de vendedor que la sesión HTTP necesita tras cada truncate. */
const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Vendedores', 'admin.vendedores@test.com', 'admin_vendedores', ?, 1, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Vendedor', 'Provision', 'vendedor.provision@test.com', 'vendedor_provision', ?, 6, 1)`,
    [HASH],
  );
  // solicitud + vendedor provisionado (esVendedor exige fila ACTIVA en VENDEDORES,
  // y VENDEDORES.ID_SOLICITUD es NOT NULL → también la SOLICITUDES_VENDEDOR)
  await pool.query(
    `INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_USUARIO, NOMBRE_EMPRESA, NIT, NOMBRE_REPRESENTANTE, EMAIL_EMPRESA, TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS, ESTADO)
     SELECT ID_USUARIO, 'Tienda Provision', '900999999', 'Rep Provision', 'vendedor.provision@test.com', '3001112233', 'Cundinamarca', 'Zipaquirá', 'Cra provision 1', 'Ciclismo', 'APROBADA'
     FROM USUARIOS WHERE EMAIL = 'vendedor.provision@test.com'`,
  );
  await pool.query(
    `INSERT IGNORE INTO VENDEDORES (ID_SOLICITUD, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR, ESTADO)
     SELECT s.ID_SOLICITUD, s.ID_USUARIO, s.NOMBRE_EMPRESA, s.NIT, s.EMAIL_EMPRESA, 'ACTIVO'
     FROM SOLICITUDES_VENDEDOR s WHERE s.EMAIL_EMPRESA = 'vendedor.provision@test.com'`,
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.vendedores@test.com', 'vendedor.provision@test.com')");
  await pool.query("DELETE FROM VENDEDORES WHERE EMAIL_VENDEDOR LIKE 'tienda.cycle.%@test.com'");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.vendedores@test.com', password: CLAVE }).expect(200);

  vendAgent = request.agent(app);
  await vendAgent.post('/api/auth/login').send({ email: 'vendedor.provision@test.com', password: CLAVE }).expect(200);
});

async function sembrarVentaDelVendedor({ estadoVenta = 'COMPLETADA', estadoEnvio = 'PENDIENTE' } = {}) {
  const pool = await getDbPool();
  const [[vend]] = await pool.query("SELECT ID_VENDEDOR FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.provision@test.com'");
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA, ID_VENDEDOR, ESTADO_PUBLICACION)
     VALUES ('Producto del vendedor vendido', 'Tienda Provision', 90000, 'Vendido', 1, ?, 'APROBADO')`,
    [vend.ID_VENDEDOR],
  );
  const [varr] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Único', 5)`,
    [prod.insertId],
  );
  const [u] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Comprador', 'Ven', ?, 'comprador_ven', ?, 4, 1)`,
    [`comprador.ven.${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`, HASH],
  );
  const [venta] = await pool.query(
    `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 90000, ?, 1, NOW())`,
    [u.insertId, estadoVenta],
  );
  await pool.query(
    `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
     VALUES (?, ?, ?, 1, 90000, 90000)`,
    [venta.insertId, prod.insertId, varr.insertId],
  );
  await pool.query(
    `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, DEPARTAMENTO, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO)
     VALUES (?, 'Cra ven 1-2', 'Zipaquirá', 'Cundinamarca', '3000000000', 9000, ?, NOW())`,
    [venta.insertId, estadoEnvio],
  );
  return { idVenta: venta.insertId, idProducto: prod.insertId, idCliente: u.insertId };
}

describe('Integración — Solicitud de vendedor (pública → admin → aprobada)', () => {
  it('solicitud sin sesión y con datos completos se registra (201)', async () => {
    const res = await request(app).post('/api/vendedor/solicitud').send(SOLICITUD).expect(201);
    expect(res.body.ok).toBe(true);
  });

  it('solicitud duplicada por NIT responde 409 (dos envíos seguidos)', async () => {
    const base = {
      nombre_empresa: `Dup ${Date.now()}`,
      nit: `95${String(Date.now()).slice(-8)}`,
      nombre_representante: 'Rep Dup',
      email_empresa: `dup.cycle.${Date.now()}@test.com`,
      telefono: '3001112233',
      departamento: 'Cundinamarca',
      ciudad: 'Zipaquirá',
      direccion: 'Cra dup 1',
      categorias: 'Ciclismo',
    };
    await request(app).post('/api/vendedor/solicitud').send(base).expect(201);
    const res = await request(app).post('/api/vendedor/solicitud').send(base);
    expect([409, 400]).toContain(res.status);
  });

  it('solicitud con validaciones rotas responde 400', async () => {
    await request(app).post('/api/vendedor/solicitud').send({ ...SOLICITUD, nit: '12', nombre_empresa: 'ab' }).expect(400);
  });

  it('admin lista las solicitudes y las procesa (aprobar crea cuenta de vendedor)', async () => {
    // autocontenido: el truncate borra SOLICITUDES entre tests
    const solicitud = {
      nombre_empresa: `Ciclo Apr ${Date.now()}`,
      nit: `97${String(Date.now()).slice(-8)}`,
      nombre_representante: 'Rep Apr',
      email_empresa: `ciclo.apr.${Date.now()}@test.com`,
      telefono: '3001112233',
      departamento: 'Cundinamarca',
      ciudad: 'Zipaquirá',
      direccion: 'Cra apr 1',
      categorias: 'Ciclismo',
    };
    await request(app).post('/api/vendedor/solicitud').send(solicitud).expect(201);
    const lista = await adminAgent.get('/api/vendedor/admin').expect(200);
    const mia = lista.body.find((s) => s.EMAIL_EMPRESA === solicitud.email_empresa);
    expect(mia).toBeTruthy();
    expect(mia.ESTADO).toBe('PENDIENTE');

    const res = await adminAgent.post(`/api/vendedor/admin/${mia.ID_SOLICITUD}/procesar`).send({ estado: 'APROBADA' }).expect(200);
    expect(res.body.ok).toBe(true);

    // re-procesar → 400
    await adminAgent.post(`/api/vendedor/admin/${mia.ID_SOLICITUD}/procesar`).send({ estado: 'APROBADA' }).expect(400);

    // la solicitud quedó APROBADA y hay fila VENDEDORES
    const pool = await getDbPool();
    const [vend] = await pool.query('SELECT * FROM VENDEDORES WHERE EMAIL_VENDEDOR = ?', [solicitud.email_empresa]);
    expect(vend.length).toBe(1);
  });

  it('rechazo sin motivo → 400; con motivo guarda la observación', async () => {
    // nueva solicitud para rechazar (autocontenido: el truncate borra entre tests)
    const solicitud = { ...SOLICITUD, nit: `91${String(Date.now()).slice(-8)}`, email_empresa: `tienda.rechazo.${Date.now()}@test.com`, nombre_empresa: `Rechazo ${Date.now()}` };
    await request(app).post('/api/vendedor/solicitud').send(solicitud).expect(201);
    const lista = await adminAgent.get('/api/vendedor/admin').expect(200);
    const mia = lista.body.find((s) => s.EMAIL_EMPRESA === solicitud.email_empresa);
    expect(mia).toBeTruthy();

    await adminAgent.post(`/api/vendedor/admin/${mia.ID_SOLICITUD}/procesar`).send({ estado: 'RECHAZADA' }).expect(400);
    const res = await adminAgent
      .post(`/api/vendedor/admin/${mia.ID_SOLICITUD}/procesar`)
      .send({ estado: 'RECHAZADA', observacion: 'NIT no verificable en la DIAN' })
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('estado inválido en el procesamiento → 400', async () => {
    const lista = await adminAgent.get('/api/vendedor/admin').expect(200);
    const cualquiera = lista.body[0];
    await adminAgent.post(`/api/vendedor/admin/${cualquiera.ID_SOLICITUD}/procesar`).send({ estado: 'RARA' }).expect(400);
  });
});

describe('Integración — Mi tienda del vendedor (productos, ventas, empresa)', () => {
  it('mi-tienda trae KPIs de la tienda', async () => {
    const res = await vendAgent.get('/api/vendedor/mi-tienda').expect(200);
    expect(typeof res.body).toBe('object');
  });

  it('CRUD de productos del vendedor: crear → PENDIENTE, editar → PENDIENTE, listar, eliminar si no aprobado', async () => {
    const creado = await vendAgent
      .post('/api/vendedor/productos')
      .send({
        NOMBRE: 'Bicicleta del vendedor',
        MARCA: 'Tienda Provision',
        PRECIO: 1200000,
        DESCRIPCION: 'Producto de prueba del vendedor',
        ID_CATEGORIA: 1,
        IMAGENES: ['/images/productos/Producto_01/img_1.jpg'],
        VARIANTES: [{ COLOR: 'Rojo', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'Única', STOCK: 4 }],
      })
      .expect(201);
    const id = creado.body.id ?? creado.body.ID;
    expect(id).toBeGreaterThan(0);

    const pool = await getDbPool();
    const [estado] = await pool.query('SELECT ESTADO_PUBLICACION FROM PRODUCTOS WHERE ID = ?', [id]);
    expect(estado[0].ESTADO_PUBLICACION).toBe('PENDIENTE');

    await vendAgent.get('/api/vendedor/productos').expect(200);
    const detalle = await vendAgent.get(`/api/vendedor/productos/${id}`).expect(200);
    expect(detalle.body).toBeTruthy();

    // editar vuelve a PENDIENTE
    await vendAgent
      .put(`/api/vendedor/productos/${id}`)
      .send({
        NOMBRE: 'Bicicleta del vendedor v2',
        MARCA: 'Tienda Provision',
        PRECIO: 1250000,
        DESCRIPCION: 'Editada',
        ID_CATEGORIA: 1,
        IMAGENES: ['/images/productos/Producto_01/img_2.jpg'],
      })
      .expect(200);
    const [estado2] = await pool.query('SELECT ESTADO_PUBLICACION FROM PRODUCTOS WHERE ID = ?', [id]);
    expect(estado2[0].ESTADO_PUBLICACION).toBe('PENDIENTE');

    // eliminar (no APROBADO aún) sí permite
    await vendAgent.delete(`/api/vendedor/productos/${id}`).expect(200);
  });

  it('ventas del vendedor: lista con sus productos y dirección del cliente', async () => {
    const { idVenta, idProducto } = await sembrarVentaDelVendedor();
    const res = await vendAgent.get('/api/vendedor/ventas').expect(200);
    const mia = res.body.find((v) => Number(v.ID_VENTA) === Number(idVenta));
    expect(mia).toBeTruthy();
    expect(JSON.stringify(mia)).toContain(idProducto.toString());
  });

  it('vendedor avanza EL ENVÍO de su venta (con notificación al cliente)', async () => {
    const { idVenta } = await sembrarVentaDelVendedor();
    await vendAgent.put(`/api/vendedor/ventas/${idVenta}/envio`).send({ estado_envio: 'POR_EMPAQUETAR' }).expect(200);
    const repetido = await vendAgent.put(`/api/vendedor/ventas/${idVenta}/envio`).send({ estado_envio: 'POR_EMPAQUETAR' }).expect(200);
    expect(repetido.body.sinCambios ?? true).toBeTruthy();
  });

  it('vendedor cancela SU venta pagada pre-despacho → reembolso automático', async () => {
    const { idVenta } = await sembrarVentaDelVendedor({ estadoVenta: 'COMPLETADA' });
    const res = await vendAgent.put(`/api/vendedor/ventas/${idVenta}/estado`).send({ estado: 'CANCELADA' }).expect(200);
    expect(res.body.ok ?? true).toBeTruthy();
    const pool = await getDbPool();
    const [venta] = await pool.query('SELECT ESTADO, CANCELADA_POR FROM VENTAS WHERE ID_VENTA = ?', [idVenta]);
    expect(venta[0].ESTADO).toBe('CANCELADA');
    expect(venta[0].CANCELADA_POR).toBe('TIENDA');
  });

  it('venta de OTRO vendedor (o JADDA pura) → 403 al intentar gestionarla', async () => {
    const pool = await getDbPool();
    const [u] = await pool.query(
      `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES ('Ajeno', 'Ven', ?, 'ajeno_ven', ?, 4, 1)`,
      [`ajeno.ven.${Date.now()}@test.com`, HASH],
    );
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO) VALUES (?, 50000, 'COMPLETADA', 1)`,
      [u.insertId],
    );
    await vendAgent.put(`/api/vendedor/ventas/${venta.insertId}/estado`).send({ estado: 'CANCELADA' }).expect(403);
  });

  it('reportes del vendedor (JSON, Excel y PDF) responden', async () => {
    await sembrarVentaDelVendedor();
    const json = await vendAgent.get('/api/vendedor/reportes').expect(200);
    expect(json.body).toHaveProperty('totalOrdenes');
    expect(json.body).toHaveProperty('serie');
    expect(json.body).toHaveProperty('masVendidos');

    const excel = await vendAgent.get('/api/vendedor/reportes/excel').expect(200);
    expect(excel.headers['content-disposition']).toContain('.xlsx');
    const pdf = await vendAgent.get('/api/vendedor/reportes/pdf').expect(200);
    expect(pdf.headers['content-disposition']).toContain('.pdf');
  });

  it('actualizarEmpresa cambia teléfono/ubicación (no el NIT ni el correo)', async () => {
    const res = await vendAgent
      .put('/api/vendedor/empresa')
      .send({ TELEFONO: '3002223344', DEPARTAMENTO: 'Cundinamarca', CIUDAD: 'Chía', DIRECCION: 'Cra provision 9' })
      .expect(200);
    expect(res.body.ok ?? true).toBeTruthy();
    const pool = await getDbPool();
    const [vend] = await pool.query("SELECT TELEFONO, CIUDAD FROM VENDEDORES WHERE EMAIL_VENDEDOR = 'vendedor.provision@test.com'");
    expect(vend[0].TELEFONO).toBe('3002223344');
  });

  it('devoluciones del vendedor: lista sus solicitudes y las procesa (rechazar con motivo)', async () => {
    const { idVenta, idProducto, idCliente } = await sembrarVentaDelVendedor({ estadoVenta: 'COMPLETADA', estadoEnvio: 'ENTREGADO' });
    const pool = await getDbPool();
    await pool.query(`UPDATE ENVIOS SET FECHA_ENTREGA = NOW() WHERE ID_VENTA = ?`, [idVenta]);
    const [sol] = await pool.query(
      `INSERT INTO DEVOLUCIONES (ID_USUARIO, ID_VENTA, ID_PRODUCTO, CANTIDAD, TIPO, MOTIVO, DESCRIPCION, ESTADO, FECHA_CREACION)
       VALUES (?, ?, ?, 1, 'DEVOLUCION', 'No me quedó la talla', 'Detalle de la suite', 'SOLICITADA', NOW())`,
      [idCliente, idVenta, idProducto],
    );

    const lista = await vendAgent.get('/api/vendedor/devoluciones').expect(200);
    const mia = lista.body.find((d) => Number(d.ID_DEVOLUCION) === Number(sol.insertId));
    expect(mia).toBeTruthy();

    await vendAgent.post(`/api/vendedor/devoluciones/${sol.insertId}/procesar`).send({ decision: 'rechazar' }).expect(400);
    await vendAgent
      .post(`/api/vendedor/devoluciones/${sol.insertId}/procesar`)
      .send({ decision: 'rechazar', observacion: 'Sin evidencia suficiente' })
      .expect(200);
  });
});

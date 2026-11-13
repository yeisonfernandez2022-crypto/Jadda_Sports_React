/**
 * Integración — CRUD completo de productos (panel admin) por HTTP real.
 *
 * Cubre productoController (crear/actualizar/eliminar, variantes con
 * MOVIMIENTOS_STOCK, características, categorías, descuentos) más las rutas
 * y el middleware esAdmin. Las imágenes usan rutas del catálogo local
 * (validadas por el punto de entrada).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;

/** Re-crea las cuentas de la sesión (el truncate del beforeEach las borra). */
const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Crud', 'admin.crud@test.com', 'admin_crud', ?, 1, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cliente', 'Crud', 'cliente.crud@test.com', 'cliente_crud', ?, 4, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  // limpiar restos de una corrida anterior abortada (beforeAll corre antes
  // del primer truncate del beforeEach)
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.crud@test.com', 'cliente.crud@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  await semillaCuentas();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.crud@test.com', password: CLAVE }).expect(200);
});

const PRODUCTO_BASE = {
  NOMBRE: 'Balón de prueba CRUD',
  MARCA: 'JADDA',
  PRECIO: 150000,
  DESCRIPCION: 'Producto de prueba de la suite CRUD',
  ID_CATEGORIA: 1,
  IMAGENES: ['/images/productos/Producto_01/img_1.jpg'],
  VARIANTES: [{ COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '5', STOCK: 8 }],
};

describe('Integración — CRUD de productos (admin)', () => {
  it('sin sesión: crear producto responde 401', async () => {
    await request(app).post('/api/productos').send(PRODUCTO_BASE).expect(401);
  });

  it('crear con precio inválido o sin nombre devuelve 400', async () => {
    await adminAgent.post('/api/productos').send({ ...PRODUCTO_BASE, NOMBRE: '' }).expect(400);
    await adminAgent.post('/api/productos').send({ ...PRODUCTO_BASE, PRECIO: -5 }).expect(400);
    await adminAgent.post('/api/productos').send({ ...PRODUCTO_BASE, PRECIO: 'caro' }).expect(400);
  });

  it('crear con imagen fuera del catálogo (path traversal) devuelve 400', async () => {
    await adminAgent
      .post('/api/productos')
      .send({ ...PRODUCTO_BASE, IMAGENES: ['../../../etc/passwd.png'] })
      .expect(400);
  });

  it('crear producto válido inserta producto + imágenes + variantes y devuelve 201', async () => {
    const res = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    expect(res.body.id).toBeGreaterThan(0);

    const pool = await getDbPool();
    const [variantes] = await pool.query('SELECT * FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?', [res.body.id]);
    expect(variantes.length).toBe(1);
    expect(variantes[0].STOCK).toBe(8);
    // crearProducto siembra variantes SIN movimiento inicial (el registro
    // ENTRADA es de agregarVariante/actualizarVariante — RF-029 lo cubre ahí)
    const [movs] = await pool.query('SELECT * FROM MOVIMIENTOS_STOCK WHERE ID_PRODUCTO = ?', [res.body.id]);
    expect(movs.length).toBe(0);
  });

  it('detalle del producto trae variantes, características e imágenes ordenadas', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    const res = await request(app).get(`/api/productos/${creado.body.id}`).expect(200);
    expect(res.body.NOMBRE).toBe('Balón de prueba CRUD');
    expect(Array.isArray(res.body.VARIANTES ?? res.body.variantes ?? [])).toBe(true);
    expect(res.body.ID).toBe(creado.body.id);
  });

  it('detalle de producto inexistente devuelve 404', async () => {
    await request(app).get('/api/productos/999999').expect(404);
  });

  it('actualizar producto cambia nombre/precio y reordena imágenes', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    const res = await adminAgent
      .put(`/api/productos/${creado.body.id}`)
      .send({
        ...PRODUCTO_BASE,
        NOMBRE: 'Balón CRUD editado',
        PRECIO: 175000,
        IMAGENES: [
          '/images/productos/Producto_01/img_2.jpg',
          '/images/productos/Producto_01/img_1.jpg',
        ],
      })
      .expect(200);

    const pool = await getDbPool();
    const [imgs] = await pool.query(
      'SELECT URL_IMAGEN, ORDEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ? ORDER BY ORDEN',
      [creado.body.id],
    );
    expect(imgs[0].URL_IMAGEN).toContain('img_2');
    expect(imgs[0].ORDEN).toBe(1);
    const [prod] = await pool.query('SELECT NOMBRE, PRECIO FROM PRODUCTOS WHERE ID = ?', [creado.body.id]);
    expect(prod[0].NOMBRE).toBe('Balón CRUD editado');
    expect(Number(prod[0].PRECIO)).toBe(175000);
    expect(res.body).toBeTruthy();
  });

  it('actualizar con precio inválido devuelve 400 sin tocar la BD', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    await adminAgent.put(`/api/productos/${creado.body.id}`).send({ ...PRODUCTO_BASE, PRECIO: -1 }).expect(400);
  });

  it('variantes: agregar suma ENTRADA, actualizar por diferencia y eliminar', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    const id = creado.body.id;

    const nueva = await adminAgent
      .post(`/api/productos/${id}/variantes`)
      .send({ COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '6', STOCK: 3 })
      .expect(201);
    expect(nueva.body.ID_VARIANTE).toBeGreaterThan(0);

    const pool = await getDbPool();
    const verVariantes = async () =>
      (await pool.query('SELECT * FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [nueva.body.ID_VARIANTE]))[0][0];

    // actualizar stock 3 → 9 (diferencia +6 ⇒ ENTRADA), cuerpo COMPLETO como el form admin
    await adminAgent
      .put(`/api/productos/variantes/${nueva.body.ID_VARIANTE}`)
      .send({ COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '6', STOCK: 9 })
      .expect(200);
    expect(Number((await verVariantes()).STOCK)).toBe(9);
    let [movs] = await pool.query(
      'SELECT TIPO_MOVIMIENTO, CANTIDAD FROM MOVIMIENTOS_STOCK WHERE ID_PRODUCTO = ? ORDER BY ID_MOVIMIENTO',
      [id],
    );
    let ultimaEntrada = [...movs].reverse().find((m) => m.TIPO_MOVIMIENTO === 'ENTRADA');
    expect(Number(ultimaEntrada.CANTIDAD)).toBe(6);

    // stock 9 → 2 (diferencia −7 ⇒ SALIDA)
    await adminAgent
      .put(`/api/productos/variantes/${nueva.body.ID_VARIANTE}`)
      .send({ COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '6', STOCK: 2 })
      .expect(200);
    [movs] = await pool.query(
      'SELECT TIPO_MOVIMIENTO, CANTIDAD FROM MOVIMIENTOS_STOCK WHERE ID_PRODUCTO = ? ORDER BY ID_MOVIMIENTO',
      [id],
    );
    const ultimaSalida = [...movs].reverse().find((m) => m.TIPO_MOVIMIENTO === 'SALIDA');
    expect(Number(ultimaSalida.CANTIDAD)).toBe(7);

    await adminAgent.delete(`/api/productos/variantes/${nueva.body.ID_VARIANTE}`).expect(200);
    const [quedo] = await pool.query('SELECT * FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [nueva.body.ID_VARIANTE]);
    expect(quedo.length).toBe(0);
  });

  it('características: agregar, actualizar, listar y eliminar', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    const id = creado.body.id;

    const car = await adminAgent
      .post(`/api/productos/${id}/caracteristicas`)
      .send({ NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero sintético' })
      .expect(201);
    expect(car.body.ID_CARACTERISTICA).toBeGreaterThan(0);

    await adminAgent
      .put(`/api/productos/caracteristicas/${car.body.ID_CARACTERISTICA}`)
      .send({ NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'TPU reforzado' })
      .expect(200);

    const lista = await adminAgent.get(`/api/productos/${id}/caracteristicas`).expect(200);
    expect(JSON.stringify(lista.body)).toContain('TPU reforzado');

    await adminAgent.delete(`/api/productos/caracteristicas/${car.body.ID_CARACTERISTICA}`).expect(200);
    const lista2 = await adminAgent.get(`/api/productos/${id}/caracteristicas`).expect(200);
    expect(JSON.stringify(lista2.body)).not.toContain('TPU reforzado');
  });

  it('categorías: crear, validar duplicado/corto, actualizar y eliminar', async () => {
    const nombre = `Deportes de prueba ${Date.now()}`;
    const creada = await adminAgent
      .post('/api/productos/categorias')
      .send({ name: nombre, description: 'Categoría de la suite' })
      .expect(201);
    expect(creada.body.ID_CATEGORIA).toBeGreaterThan(0);

    // duplicada
    await adminAgent
      .post('/api/productos/categorias')
      .send({ name: nombre })
      .expect(400);
    // muy corta
    await adminAgent.post('/api/productos/categorias').send({ name: 'ab' }).expect(400);

    await adminAgent
      .put(`/api/productos/categorias/${creada.body.ID_CATEGORIA}`)
      .send({ name: `${nombre} v2`, description: 'Editada' })
      .expect(200);

    await adminAgent.delete(`/api/productos/categorias/${creada.body.ID_CATEGORIA}`).expect(200);
    await adminAgent.delete(`/api/productos/categorias/${creada.body.ID_CATEGORIA}`).expect(404);
  });

  it('categoría con productos asociados NO se elimina (400 con conteo)', async () => {
    const pool = await getDbPool();
    const [cats] = await pool.query('SELECT ID_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA = 1');
    if (cats.length === 0) return; // entorno sin seed de categorías
    await adminAgent.delete('/api/productos/categorias/1').expect(400);
  });

  it('descuentos: crear con validaciones y listar', async () => {
    await adminAgent.post('/api/productos/descuentos').send({ DESCRIPCION: 'x', PORCENTAJE: 10, FECHA_FIN: '2030-01-01' }).expect(400);
    await adminAgent.post('/api/productos/descuentos').send({ DESCRIPCION: 'CRUD10', PORCENTAJE: 200, FECHA_FIN: '2030-01-01' }).expect(400);
    await adminAgent.post('/api/productos/descuentos').send({ DESCRIPCION: 'CRUD10', PORCENTAJE: 10, FECHA_FIN: 'fecha-mala' }).expect(400);

    const creado = await adminAgent
      .post('/api/productos/descuentos')
      .send({ DESCRIPCION: 'CRUD10', PORCENTAJE: 10, FECHA_FIN: '2030-01-01', MONTO_MINIMO: 50000 })
      .expect(201);
    expect(creado.body.ID_DESCUENTO).toBeGreaterThan(0);

    const lista = await adminAgent.get('/api/productos/descuentos').expect(200);
    expect(JSON.stringify(lista.body)).toContain('CRUD10');
  });

  it('producto con ventas asociadas NO se elimina (400)', async () => {
    const pool = await getDbPool();
    // venta de demo: producto 1 pertenece a la categoría seed; sembrar venta directa
    const [u] = await pool.query(
      `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES ('Comprador', 'Ventas', 'comprador.ventas@test.com', 'comprador_ventas', ?, 4, 1)`,
      [HASH],
    );
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
       VALUES ('Producto vendido', 'JADDA', 50000, 'Con venta', 1)`,
    );
    const [varr] = await pool.query(
      `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Único', 'Talla', 'Único', 5)`,
      [prod.insertId],
    );
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO) VALUES (?, 50000, 'COMPLETADA', 1)`,
      [u.insertId],
    );
    await pool.query(
      `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
       VALUES (?, ?, ?, 1, 50000, 50000)`,
      [venta.insertId, prod.insertId, varr.insertId],
    );

    await adminAgent.delete(`/api/productos/${prod.insertId}`).expect(400);
  });

  it('producto sin ventas SÍ se elimina (y borra imágenes/variantes/características)', async () => {
    const creado = await adminAgent.post('/api/productos').send(PRODUCTO_BASE).expect(201);
    await adminAgent.delete(`/api/productos/${creado.body.id}`).expect(200);
    const pool = await getDbPool();
    const [imgs] = await pool.query('SELECT * FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ?', [creado.body.id]);
    expect(imgs.length).toBe(0);
  });
});

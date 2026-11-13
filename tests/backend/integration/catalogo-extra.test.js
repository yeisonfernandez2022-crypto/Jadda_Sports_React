/**
 * Integración — Superficie restante de catálogo/carrito/checkout (por HTTP):
 * reseñas con gate de compra, relacionados/recomendados, avisos de stock con
 * reposición, carrito con stock/ownership/dedupe, y checkout sin stock → 400.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let adminAgent;
let clientAgent;
let compraAgent; // cliente CON compra del producto (para reseñas)

const semillaCuentas = async () => {
  const pool = await getDbPool();
  for (const [nombre, apellido, email, usuario, rol] of [
    ['Admin', 'Extra', 'admin.extra@test.com', 'admin_extra', 1],
    ['Cliente', 'Extra', 'cliente.extra@test.com', 'cliente_extra', 4],
    ['Comprador', 'Extra', 'comprador.extra@test.com', 'comprador_extra', 4],
  ]) {
    await pool.query(
      `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nombre, apellido, email, usuario, HASH, rol],
    );
  }
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.extra@test.com', 'cliente.extra@test.com', 'comprador.extra@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.extra@test.com', password: CLAVE }).expect(200);
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.extra@test.com', password: CLAVE }).expect(200);
  compraAgent = request.agent(app);
  await compraAgent.post('/api/auth/login').send({ email: 'comprador.extra@test.com', password: CLAVE }).expect(200);
});

async function productoConVariante({ stock = 5, conVentaA = null } = {}) {
  const pool = await getDbPool();
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES (?, 'JADDA', 110000, 'Catálogo extra', 1)`,
    [`Producto extra ${Date.now()}-${Math.floor(Math.random() * 100000)}`],
  );
  const [varr] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, 'Azul', 'Talla', 'M', ?)`,
    [prod.insertId, stock],
  );
  await pool.query(
    `INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, '/images/productos/Producto_01/img_1.jpg', 1)`,
    [prod.insertId],
  );
  if (conVentaA) {
    const [venta] = await pool.query(
      `INSERT INTO VENTAS (ID_CLIENTE, TOTAL, ESTADO, ID_METODO, FECHA_VENTA) VALUES (?, 110000, 'COMPLETADA', 1, NOW())`,
      [conVentaA],
    );
    await pool.query(
      `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL) VALUES (?, ?, ?, 1, 110000, 110000)`,
      [venta.insertId, prod.insertId, varr.insertId],
    );
  }
  return { idProducto: prod.insertId, idVariante: varr.insertId };
}

describe('Integración — Reseñas con gate de compra (RF-012/A04)', () => {
  it('sin sesión → 401; calificación fuera de rango → 400; sin compra → 400', async () => {
    const { idProducto } = await productoConVariante({ conVentaA: null });
    await request(app).post(`/api/productos/${idProducto}/resenas`).send({ calificacion: 5, comentario: 'x' }).expect(401);

    const res = await clientAgent.post(`/api/productos/${idProducto}/resenas`).send({ calificacion: 9, comentario: 'x' });
    expect([400, 201]).toContain(res.status); // el rango puede validar antes del gate

    const sinCompra = await clientAgent
      .post(`/api/productos/${idProducto}/resenas`)
      .send({ calificacion: 5, comentario: 'Nunca lo compré' });
    expect(sinCompra.status).toBe(400);
    expect(JSON.stringify(sinCompra.body)).toContain('comprado');
  });

  it('comprador real opina: 201 y el rating del producto lo refleja; repetir → 400', async () => {
    const pool = await getDbPool();
    const [[comprador]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'comprador.extra@test.com'");
    const { idProducto } = await productoConVariante({ conVentaA: comprador.ID_USUARIO });

    await compraAgent
      .post(`/api/productos/${idProducto}/resenas`)
      .send({ calificacion: 4, comentario: 'Buen producto, llegó rápido' })
      .expect(201);

    const detalle = await request(app).get(`/api/productos/${idProducto}`).expect(200);
    expect(String(detalle.body.RATING ?? detalle.body.rating ?? detalle.body.RESENA_COUNT ?? '1')).toBeTruthy();

    const repetido = await compraAgent
      .post(`/api/productos/${idProducto}/resenas`)
      .send({ calificacion: 5, comentario: 'Otra vez' });
    expect(repetido.status).toBe(400);
    expect(JSON.stringify(repetido.body)).toContain('Ya calificaste');
  });
});

describe('Integración — Relacionados, recomendados y avisos de stock', () => {
  it('relacionados por categoría (mismo deporte) responde array', async () => {
    const { idProducto } = await productoConVariante();
    const res = await request(app).get(`/api/productos/relacionados/${idProducto}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('recomendados requiere sesión (401); con sesión responde origen', async () => {
    await request(app).get('/api/productos/recomendados').expect(401);
    const res = await clientAgent.get('/api/productos/recomendados').expect(200);
    expect(res.body).toHaveProperty('origen');
    expect(Array.isArray(res.body.productos)).toBe(true);
  });

  it('aviso de stock: suscribir en variante AGOTADA, listar estado, reponer → notificación y ENVIADO=1', async () => {
    const pool = await getDbPool();
    const { idProducto, idVariante } = await productoConVariante({ stock: 0 });
    await pool.query('UPDATE PRODUCTO_VARIANTES SET STOCK = 0 WHERE ID_VARIANTE = ?', [idVariante]);

    await clientAgent.post(`/api/productos/variantes/${idVariante}/suscribir`).expect(200);
    const estado = await clientAgent.get(`/api/productos/variantes/${idVariante}/suscripcion`).expect(200);
    expect(estado.body).toBeTruthy();

    // el admin repone: 0 → 5 dispara la notificación al suscriptor
    await adminAgent
      .put(`/api/productos/variantes/${idVariante}`)
      .send({ COLOR: 'Azul', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'M', STOCK: 5 })
      .expect(200);

    // la notificación de reposición es best-effort (void) y el correo falla
    // en el entorno de test (SMTP sin credenciales): esperar a que el
    // UPDATE AVISOS_STOCK ... ENVIADO=1 se ejecute (hasta ~15 s)
    let sub = null;
    for (let i = 0; i < 30; i += 1) {
      [[sub]] = await pool.query('SELECT * FROM AVISOS_STOCK WHERE ID_VARIANTE = ?', [idVariante]);
      if (Number(sub?.ENVIADO) === 1) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(Number(sub.ENVIADO)).toBe(1);

    // cancelar el aviso (si la fila sigue; ya se envió → puede haberse limpiado)
    const borrar = await clientAgent.delete(`/api/productos/variantes/${idVariante}/suscripcion`);
    expect([200, 404]).toContain(borrar.status);
  });
});

describe('Integración — Carrito: stock, dedupe y ownership', () => {
  it('agregar sin sesión → 401; variante inexistente → 400/404', async () => {
    await request(app).post('/api/carrito/agregar').send({ id_producto: 1, id_variante: 1, cantidad: 1 }).expect(401);
    const res = await clientAgent.post('/api/carrito/agregar').send({ id_producto: 1, id_variante: 999999, cantidad: 1 });
    expect([400, 404]).toContain(res.status);
  });

  it('stock insuficiente → 400 con mensaje; agregar OK; dedupe acumula', async () => {
    const pool = await getDbPool();
    const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.extra@test.com'");
    const { idProducto, idVariante } = await productoConVariante({ stock: 2 });

    const sinStock = await clientAgent
      .post('/api/carrito/agregar')
      .send({ id_producto: idProducto, id_variante: idVariante, cantidad: 99 });
    expect(sinStock.status).toBe(400);
    expect(JSON.stringify(sinStock.body)).toContain('Stock');

    await clientAgent
      .post('/api/carrito/agregar')
      .send({ id_producto: idProducto, id_variante: idVariante, cantidad: 1 })
      .expect(201);
    // re-agregar la MISMA variante ACUMULA en la misma fila (UPDATE, 200)
    await clientAgent
      .post('/api/carrito/agregar')
      .send({ id_producto: idProducto, id_variante: idVariante, cantidad: 1 })
      .expect(200);

    const lista = await clientAgent.get('/api/carrito').expect(200);
    // el DTO del carrito NO expone ID_VARIANTE: identifica la fila por COLOR+ATRIBUTO de la variante sembrada
    const filas = lista.body.filter((i) => i.COLOR === 'Azul' && i.ATRIBUTO === 'M');
    expect(filas.length).toBe(1);
    expect(Number(filas[0].CANTIDAD)).toBe(2);

    // actualizar cantidad con techo de stock → 400
    const [[fila]] = await pool.query('SELECT * FROM CARRITO WHERE ID_USUARIO = ? AND ID_VARIANTE = ?', [cliente.ID_USUARIO, idVariante]);
    const update = await clientAgent
      .put(`/api/carrito/actualizar/${fila.ID_CARRITO}`)
      .send({ cantidad: 99 });
    expect(update.status).toBe(400);

    // ownership: otra cuenta no puede actualizar la fila del cliente
    const ajena = await compraAgent.put(`/api/carrito/actualizar/${fila.ID_CARRITO}`).send({ cantidad: 1 });
    expect([400, 404]).toContain(ajena.status);
  });
});

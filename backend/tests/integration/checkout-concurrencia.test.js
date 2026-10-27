/**
 * Concurrency test - Stock in checkout (Fase 4)
 *
 * Two users with the same variant in the cart (STOCK=1) check out at the SAME
 * time: exactly one must win (200) and the other must receive a 409 with a
 * friendly message, without generating negative stock, duplicate rows or
 * a 500 due to deadlock. Requires REAL MySQL (row lock SELECT ... FOR UPDATE);
 * that is why it lives in the integration suite, not in the unit tests.
 */
import { describe, it, expect } from 'vitest';
import { app } from './setup.js';
import { getDbPool } from './setup.js';
import { procesarCompra } from '../../controllers/checkoutController.js';

function resCaptor() {
  const r = { statusCode: null, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => {
    // En Express, res.json sin .status previo responde 200 implícito
    if (r.statusCode === null) r.statusCode = 200;
    r.body = body;
    return r;
  };
  return r;
}

async function comprar(pool, idUsuario, cantidad = 1) {
  const req = {
    user: { ID_USUARIO: idUsuario, ID_ROL: 4 },
    body: {
      metodoPago: 'credito',
      nombre: 'Cliente Concurrencia',
      direccion: 'Cra de prueba 1-2',
      ciudad: 'Zipaquirá',
      departamento: 'Cundinamarca',
      telefono: '3001112233',
    },
  };
  const res = resCaptor();
  await procesarCompra(req, res);
  return res;
}

async function sembrar(pool, { stock, cantidadCarrito }) {
  const [u1] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Comprador', 'Uno', 'concur.uno@test.com', 'concur_uno', 'x', 4, 1)`
  );
  const [u2] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Comprador', 'Dos', 'concur.dos@test.com', 'concur_dos', 'x', 4, 1)`
  );
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
     VALUES ('Producto concurrencia', 'MARCA', 100000, 'Test de concurrencia', 1)`
  );
  const [variante] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)
     VALUES (?, 'Único', 'Talla', 'Único', ?)`,
    [prod.insertId, stock]
  );
  for (const idUsuario of [u1.insertId, u2.insertId]) {
    await pool.query(
      `INSERT INTO CARRITO (ID_USUARIO, ID_PRODUCTO, ID_VARIANTE, CANTIDAD) VALUES (?, ?, ?, ?)`,
      [idUsuario, prod.insertId, variante.insertId, cantidadCarrito]
    );
  }
  return { idUsuario1: u1.insertId, idUsuario2: u2.insertId, idVariante: variante.insertId };
}

describe('Integración - Concurrencia de stock en checkout (FOR UPDATE)', () => {
  it('2 usuarios comprando la última unidad a la vez: 200 para uno y 409 para el otro, stock >= 0', async () => {
    const pool = await getDbPool();
    const { idUsuario1, idUsuario2, idVariante } = await sembrar(pool, { stock: 1, cantidadCarrito: 1 });

    const resultados = await Promise.all([
      comprar(pool, idUsuario1),
      comprar(pool, idUsuario2),
    ]);

    const ganadores = resultados.filter((r) => r.statusCode === 200 && r.body?.ok);
    const perdedores = resultados.filter((r) => r.statusCode === 409);
    expect(ganadores).toHaveLength(1);
    expect(perdedores).toHaveLength(1);
    expect(String(perdedores[0].body?.error || '')).toMatch(/solo tiene|agotó/);
    expect(perdedores[0].body?.error).not.toMatch(/Error al procesar la compra/);

    const [[stock]] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [idVariante]);
    expect(Number(stock.STOCK)).toBe(0);
    expect(Number(stock.STOCK)).toBeGreaterThanOrEqual(0);

    const [[ventas]] = await pool.query('SELECT COUNT(*) AS N FROM VENTAS');
    expect(Number(ventas.N)).toBe(1);
    const [[detalles]] = await pool.query('SELECT COUNT(*) AS N FROM DETALLE_VENTAS');
    expect(Number(detalles.N)).toBe(1);
    const [[salidas]] = await pool.query("SELECT COUNT(*) AS N FROM MOVIMIENTOS_STOCK WHERE TIPO_MOVIMIENTO = 'SALIDA'");
    expect(Number(salidas.N)).toBe(1);
  }, 20000);

  it('Compra normal sin competencia: 200 y stock descontado exacto', async () => {
    const pool = await getDbPool();
    const { idUsuario1, idVariante } = await sembrar(pool, { stock: 5, cantidadCarrito: 2 });

    const res = await comprar(pool, idUsuario1);
    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);

    const [[stock]] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [idVariante]);
    expect(Number(stock.STOCK)).toBe(3);
  }, 20000);
});

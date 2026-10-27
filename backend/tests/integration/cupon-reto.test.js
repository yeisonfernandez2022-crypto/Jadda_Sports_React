/**
 * Seguridad de cupones RETO- (P4)
 *
 * Un cupón de reto es personal: solo lo gana quien completó el reto y solo es
 * canjeable una vez (USADO 0 -> 1). Exige MySQL real porque la exclusividad se
 * decide con SELECT ... FOR UPDATE dentro de la transacción del checkout:
 * dos checkouts al mismo tiempo con el MISMO código RETO- no deben producir
 * dos ventas con descuento.
 */
import { describe, it, expect } from 'vitest';
import { app } from './setup.js';
import { getDbPool } from './setup.js';
import { procesarCompra } from '../../controllers/checkoutController.js';

function resCaptor() {
  const r = { statusCode: null, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => {
    if (r.statusCode === null) r.statusCode = 200;
    r.body = body;
    return r;
  };
  return r;
}

const CUPO_RETO_A = 'RETO-CUPON-A-TEST'; // lo ganó el usuario A
const CUPO_RETO_B = 'RETO-CUPON-B-TEST'; // lo ganó el usuario B

async function comprar(idUsuario, cuponCodigo) {
  const req = {
    user: { ID_USUARIO: idUsuario, ID_ROL: 4 },
    body: {
      metodoPago: 'credito',
      nombre: 'Cliente Cupón',
      direccion: 'Cra de prueba 1-2',
      ciudad: 'Zipaquirá',
      departamento: 'Cundinamarca',
      telefono: '3001112233',
      cuponCodigo: cuponCodigo || undefined,
    },
  };
  const res = resCaptor();
  await procesarCompra(req, res);
  return res;
}

/**
 * Crea: usuarios A y B, un reto, SU RETOS_USUARIOS para cada uno (A con el
 * cupón A, B con el cupón B, ambos COMPLETADO=1), las filas DESCUENTOS de los
 * dos códigos (USADO=0) y un producto con variante de stock 2 para ambos
 * carritos.
 */
async function sembrar(pool) {
  const [uA] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cupon', 'Ganador', 'cupon.a@test.com', 'cupon_a', 'x', 4, 1)`
  );
  const [uB] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cupon', 'Ajeno', 'cupon.b@test.com', 'cupon_b', 'x', 4, 1)`
  );
  const [prod] = await pool.query(
    `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA)
     VALUES ('Producto cupón reto', 'MARCA', 100000, 'Test de cupón de reto', 1)`
  );
  const [variante] = await pool.query(
    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)
     VALUES (?, 'Único', 'Talla', 'Único', 2)`,
    [prod.insertId]
  );
  const [reto] = await pool.query(
    `INSERT INTO RETOS (TITULO, DESCRIPCION, META_TIPO, META_VALOR, RECOMPENSA_PORCENTAJE, FECHA_INICIO, FECHA_FIN)
     VALUES ('Reto cupón test', 'Reto de prueba', 'km', 5, 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY))`
  );
  for (const [idUsuario, cupon] of [[uA.insertId, CUPO_RETO_A], [uB.insertId, CUPO_RETO_B]]) {
    await pool.query(
      `INSERT INTO RETOS_USUARIOS (ID_RETO, ID_USUARIO, PROGRESO, COMPLETADO, CUPON_GENERADO)
       VALUES (?, ?, 5, 1, ?)`,
      [reto.insertId, idUsuario, cupon]
    );
    await pool.query(
      `INSERT INTO DESCUENTOS (DESCRIPCION, PORCENTAJE, USADO) VALUES (?, 10, 0)`,
      [cupon]
    );
  }
  for (const idUsuario of [uA.insertId, uB.insertId]) {
    await pool.query(
      `INSERT INTO CARRITO (ID_USUARIO, ID_PRODUCTO, ID_VARIANTE, CANTIDAD) VALUES (?, ?, ?, 1)`,
      [idUsuario, prod.insertId, variante.insertId]
    );
  }
  return { idUsuarioA: uA.insertId, idUsuarioB: uB.insertId, idVariante: variante.insertId };
}

describe('Integración - cupones RETO- (exclusividad y ownership en la transacción)', () => {
  it('2 checkouts al mismo tiempo con el MISMO RETO-: una venta 200, el otro 400 y el cupón queda USADO=1', async () => {
    const pool = await getDbPool();
    const { idUsuarioA, idUsuarioB, idVariante } = await sembrar(pool);

    const resultados = await Promise.all([
      comprar(idUsuarioA, CUPO_RETO_A),
      comprar(idUsuarioB, CUPO_RETO_A),
    ]);

    const ganadores = resultados.filter((r) => r.statusCode === 200 && r.body?.ok);
    const rechazados = resultados.filter((r) => r.statusCode === 400);
    expect(ganadores).toHaveLength(1);
    expect(rechazados).toHaveLength(1);
    expect(String(rechazados[0].body?.error || '')).toMatch(/ya fue usado/i);

    const [[cupon]] = await pool.query('SELECT USADO FROM DESCUENTOS WHERE DESCRIPCION = ?', [CUPO_RETO_A]);
    expect(Number(cupon.USADO)).toBe(1);

    const [[ventas]] = await pool.query('SELECT COUNT(*) AS N FROM VENTAS');
    expect(Number(ventas.N)).toBe(1);

    const [[stock]] = await pool.query('SELECT STOCK FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?', [idVariante]);
    expect(Number(stock.STOCK)).toBe(1);
    // (la limpieza real la hace el truncate del setup entre archivos)
  }, 20000);

  it('usar un RETO- que NO es de tu cuenta: 403, sin venta y el cupón queda libre', async () => {
    const pool = await getDbPool();
    const { idUsuarioA, idUsuarioB } = await sembrar(pool);

    // B intenta canjear el cupón que ganó A
    const res = await comprar(idUsuarioB, CUPO_RETO_A);
    expect(res.statusCode).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/no pertenece/i);

    const [[cupon]] = await pool.query('SELECT USADO FROM DESCUENTOS WHERE DESCRIPCION = ?', [CUPO_RETO_A]);
    expect(Number(cupon.USADO)).toBe(0);

    const [[ventas]] = await pool.query('SELECT COUNT(*) AS N FROM VENTAS');
    expect(Number(ventas.N)).toBe(0);
    // (la limpieza real la hace el truncate del setup entre archivos)
  }, 20000);
});

/**
 * movimientosStock (RF-029): registro no bloqueante de ENTRADA/SALIDA en
 * MOVIMIENTOS_STOCK con fecha de hoy.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../backend/config/db');
const { registrarMovimientoStock } = require('../../../backend/utils/movimientosStock');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('registrarMovimientoStock', () => {
  test('INSERT con tipo en mayúsculas, cantidad y CURDATE', async () => {
    db.query = vi.fn(async () => [{}]);
    await registrarMovimientoStock({ idProducto: 9, tipo: 'SALIDA', cantidad: 3 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql.toUpperCase()).toContain('INSERT INTO MOVIMIENTOS_STOCK');
    expect(params[0]).toBe(9);
    expect(params[1]).toBe('SALIDA');
    expect(params[2]).toBe(3);
    expect(sql.toUpperCase()).toContain('CURDATE');
  });

  test('con conexión externa (transacción) usa esa conexión', async () => {
    const conn = { query: vi.fn(async () => [{}]) };
    await registrarMovimientoStock({ conn, idProducto: 1, tipo: 'ENTRADA', cantidad: 7 });
    expect(conn.query).toHaveBeenCalledTimes(1);
  });

  test('NUNCA lanza: el registro fallido solo se loguea (no bloquea el flujo)', async () => {
    db.query = vi.fn(async () => { throw new Error('BD caída'); });
    await expect(registrarMovimientoStock({ idProducto: 1, tipo: 'SALIDA', cantidad: 1 })).resolves.toBeUndefined();
  });
});

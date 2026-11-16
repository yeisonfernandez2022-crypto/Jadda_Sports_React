/**
 * proveedorController — listado público de proveedores (unit).
 *
 * El controlador importa el pool real de config/db (sin _useDb): la BD falsa
 * muta db.query sobre el singleton ANTES del require. SELECT básico + 500.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');
const proveedorController = require('../../../backend/controllers/proveedorController');
const { obtenerProveedores } = proveedorController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  db.query = vi.fn(async () => [[]]);
});

describe('obtenerProveedores', () => {
  test('devuelve ID y nombre', async () => {
    db.query = vi.fn(async () => [[{ ID_PROVEEDOR: 1, NOMBRE_PROVEEDOR: 'ADIDAS' }]]);
    const res = resFalsa();
    await obtenerProveedores({}, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE_PROVEEDOR).toBe('ADIDAS');
  });

  test('fallo de BD → 500 con error descriptivo', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await obtenerProveedores({}, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al obtener los proveedores de la base de datos' });
  });
});

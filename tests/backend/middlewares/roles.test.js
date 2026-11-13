/**
 * Middlewares de rol: esAdmin (rol 1) y esVendedor (rol 6 + fila ACTIVA en
 * VENDEDORES), y verificarSesion de passport.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../backend/config/db');
const esAdmin = require('../../../backend/middlewares/esAdmin');
const esVendedor = require('../../../backend/middlewares/esVendedor');
const { verificarSesion } = require('../../../backend/middlewares/authMiddleware');

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('esAdmin', () => {
  test('sin sesión → 401; con rol ≠ 1 → 403; admin pasa', () => {
    const req = {};
    req.isAuthenticated = () => false;
    const res = resFalsa();
    esAdmin(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(401);

    req.isAuthenticated = () => true;
    req.user = { ID_ROL: 4 };
    esAdmin(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toContain('administrador');

    req.user = { ID_ROL: 1 };
    let paso = false;
    esAdmin(req, res, () => { paso = true; });
    expect(paso).toBe(true);
  });
});

describe('verificarSesion', () => {
  test('sin sesión → 401 JSON; con sesión pasa', () => {
    const req = { isAuthenticated: () => false };
    const res = resFalsa();
    verificarSesion(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(401);

    const req2 = { isAuthenticated: () => true };
    let paso = false;
    verificarSesion(req2, res, () => { paso = true; });
    expect(paso).toBe(true);
  });
});

describe('esVendedor', () => {
  test('sin sesión → 401; rol ≠ 6 → 403', async () => {
    const req = {};
    req.isAuthenticated = () => false;
    const res = resFalsa();
    await esVendedor(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(401);

    req.isAuthenticated = () => true;
    req.user = { ID_ROL: 4 };
    await esVendedor(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(403);
  });

  test('sin fila ACTIVA en VENDEDORES → 403; con fila agrega req.vendedor', async () => {
    db.query = vi.fn(async () => [[]]);
    const req = { isAuthenticated: () => true, user: { ID_ROL: 6, ID_USUARIO: 8 } };
    const res = resFalsa();
    await esVendedor(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(403);
    expect(res.cuerpo.msg).toContain('no está activa');

    db.query = vi.fn(async () => [[{ ID_VENDEDOR: 3, NOMBRE_EMPRESA: 'Chat Store' }]]);
    let paso = false;
    await esVendedor(req, res, () => { paso = true; });
    expect(paso).toBe(true);
    expect(req.vendedor.NOMBRE_EMPRESA).toBe('Chat Store');
  });

  test('fallo de BD → 500 sin reventar el proceso', async () => {
    db.query = vi.fn(async () => { throw new Error('BD caída'); });
    const req = { isAuthenticated: () => true, user: { ID_ROL: 6, ID_USUARIO: 8 } };
    const res = resFalsa();
    await esVendedor(req, res, () => { throw new Error('no debió pasar'); });
    expect(res.codigo).toBe(500);
  });
});

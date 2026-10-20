/**
 * Tests de integración básicos - Health checks y autenticación
 * Usan Supertest contra Express real + MySQL real
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, getDbPool } from './setup.js';

let pool;

beforeAll(async () => {
  pool = await getDbPool();
});

describe('Integración - Health Check', () => {
  it('GET /api/productos responde con array (aunque vacío tras truncate)', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/productos/categorias responde con array', async () => {
    const res = await request(app).get('/api/productos/categorias');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/envio/calcular calcula envío correctamente', async () => {
    const res = await request(app)
      .get('/api/envio/calcular')
      .query({ departamento: 'bogota', subtotal: 100000 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('costo');
    expect(typeof res.body.costo).toBe('number');
  });
});

describe('Integración - Autenticación', () => {
  const testUser = {
    nombre: 'Test',
    apellido: 'User',
    email: 'test.integration@test.com',
    telefono: '3001234567',
    direccion: 'Calle 123',
    password: 'TestPass123',
    confirmar: 'TestPass123',
  };

  it('POST /api/auth/registro crea usuario y devuelve 200', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send(testUser);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('correo');
  });

  it('POST /api/auth/login con credenciales inválidas devuelve 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('incorrectos');
  });

  it('POST /api/auth/login sin campos devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    
    expect(res.status).toBe(400);
  });
});

describe('Integración - Cupones', () => {
  it('POST /api/cupones/validar con código inexistente devuelve 404', async () => {
    const res = await request(app)
      .post('/api/cupones/validar')
      .send({ codigo: 'NOEXISTE' });
    
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('ok', false);
  });

  it('GET /api/cupones/disponibles requiere autenticación (401 sin login)', async () => {
    const res = await request(app)
      .get('/api/cupones/disponibles');
    
    expect(res.status).toBe(401);
  });
});

describe('Integración - Carrito', () => {
  it('GET /api/carrito sin sesión devuelve 401', async () => {
    const res = await request(app).get('/api/carrito');
    expect(res.status).toBe(401);
  });
});

describe('Integración - Base de datos real', () => {
  it('Pool de BD conecta y ejecuta queries', async () => {
    const [rows] = await pool.query('SELECT 1 as test');
    expect(rows[0].test).toBe(1);
  });

  it('Tablas principales existen tras setup', async () => {
    const tables = ['USUARIOS', 'PRODUCTOS', 'CATEGORIAS', 'VENTAS', 'ROLES'];
    for (const table of tables) {
      const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [table]);
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it('Seed data: ROLES tiene 6 roles', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM ROLES');
    expect(rows[0].count).toBe(6);
  });

  it('Seed data: CATEGORIAS tiene 15 categorías', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM CATEGORIAS');
    expect(rows[0].count).toBe(15);
  });

  it('Seed data: PROVEEDORES tiene 15 proveedores', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM PROVEEDORES');
    expect(rows[0].count).toBe(15);
  });
});
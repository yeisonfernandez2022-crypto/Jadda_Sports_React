/*
 * Gate de subida de imágenes (routes/productoRoutes.js): esAdminOVendedor
 * deja pasar a admin (rol 1) o delega en esVendedor (rol 6 con cuenta ACTIVA
 * en la BD). Se cubren todas las salidas del gate: admin, vendedor activo,
 * sin sesión, sin método isAuthenticated, rol no permitido, cuenta de
 * vendedor inactiva y fallo de BD (500). imagenController se reemplaza
 * ANTES del require del router (el router captura la referencia en carga);
 * esVendedor usa el pool directo, así que db.query se muta en el singleton.
 */

const supertest = require('supertest');
const express = require('express');

const db = require('../../../backend/config/db');
const imagenController = require('../../../backend/controllers/imagenController');
imagenController.subirImagenes = (req, res) => res.status(200).json({ stub: 'subirImagenes' });

const productoRoutes = require('../../../backend/routes/productoRoutes');

const ADMIN = { ID_USUARIO: 1, ID_ROL: 1 };
const VENDEDOR = { ID_USUARIO: 7, ID_ROL: 6, USUARIO: 'vendedor_activo' };
const CLIENTE = { ID_USUARIO: 8, ID_ROL: 4 };

const crearApp = (usuario, conMetodo = true) => {
  const app = express();
  app.use((req, _res, next) => {
    if (conMetodo) req.isAuthenticated = () => Boolean(usuario);
    if (usuario) req.user = usuario;
    next();
  });
  app.use('/api/productos', productoRoutes);
  return app;
};

describe('routes/productoRoutes — POST /imagenes (esAdminOVendedor)', () => {
  beforeEach(() => {
    db.query = vi.fn(async () => [[{ ID_VENDEDOR: 1, ID_USUARIO: 7 }]]);
  });

  test('admin (rol 1) pasa directo por el gate → 200 del controller', async () => {
    const respuesta = await supertest(crearApp(ADMIN)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('subirImagenes');
  });

  test('vendedor activo (rol 6) pasa por esVendedor → 200 del controller', async () => {
    const respuesta = await supertest(crearApp(VENDEDOR)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('subirImagenes');
  });

  test('sin sesión → 401 "Debes iniciar sesión"', async () => {
    const respuesta = await supertest(crearApp(null)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('req sin método isAuthenticated → 401 (rama de emergencia del gate)', async () => {
    const respuesta = await supertest(crearApp(null, false)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('cliente (rol 4) → 403 "Solo los vendedores pueden realizar esta acción"', async () => {
    const respuesta = await supertest(crearApp(CLIENTE)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toBe('Solo los vendedores pueden realizar esta acción');
  });

  test('vendedor sin cuenta activa en VENDEDORES → 403', async () => {
    db.query = vi.fn(async () => [[]]);
    const respuesta = await supertest(crearApp(VENDEDOR)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toBe('Tu cuenta de vendedor no está activa');
  });

  test('fallo de BD en esVendedor → 500 "Error de servidor"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const respuesta = await supertest(crearApp(VENDEDOR)).post('/api/productos/imagenes');
    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Error de servidor' });
  });
});

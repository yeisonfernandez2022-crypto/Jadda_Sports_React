/*
 * Bordes del router de devoluciones (routes/devolucionRoutes.js):
 * verificarSesion (401), esAdmin (401/403/next) y subirEvidencias (multer):
 * MIME rechazado → "Formato no permitido..."; extensión que no coincide con
 * el MIME → "La extensión del archivo no coincide..."; archivo coherente →
 * la escritura falla a propósito (fs.mkdirSync reemplazado) → mensaje por
 * defecto "Error al subir las evidencias". Controllers stubbeados ANTES del
 * require del router; fs se restaura en cada test.
 */

const supertest = require('supertest');
const express = require('express');
const fs = require('fs');

const devolucionController = require('../../../backend/controllers/devolucionController');
const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });
['solicitarDevolucion', 'misDevoluciones', 'todas', 'procesar', 'subirEvidencias',
  'agregarEvidencias', 'eliminarEvidencia',
].forEach((nombre) => { devolucionController[nombre] = marca(nombre); });

const devolucionRoutes = require('../../../backend/routes/devolucionRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

const crearApp = (usuario = null) => {
  const app = express();
  app.use(sesionFalsa(usuario));
  app.use('/api/devoluciones', devolucionRoutes);
  return app;
};

const CLIENTE = { ID_USUARIO: 7, ID_ROL: 4, USUARIO: 'cliente_activo' };

const PNG = Buffer.from('89504e470d0a1a0a0000000d', 'hex');

describe('routes/devolucionRoutes — gates de sesión y admin', () => {
  test('POST / sin sesión → 401 "Debes iniciar sesión"', async () => {
    const respuesta = await supertest(crearApp()).post('/api/devoluciones');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('GET /admin sin sesión → 401 (esAdmin)', async () => {
    const respuesta = await supertest(crearApp()).get('/api/devoluciones/admin');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('GET /admin con rol no admin → 403', async () => {
    const respuesta = await supertest(crearApp(CLIENTE)).get('/api/devoluciones/admin');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toBe('No tienes permisos de administrador');
  });

  test('GET /admin con rol admin → 200 del controller', async () => {
    const respuesta = await supertest(crearApp({ ID_USUARIO: 1, ID_ROL: 1 })).get('/api/devoluciones/admin');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('todas');
  });
});

describe('routes/devolucionRoutes — subirEvidencias (multer)', () => {
  const mkdirSyncReal = fs.mkdirSync;

  beforeEach(() => {
    fs.mkdirSync = vi.fn();
  });

  afterEach(() => {
    fs.mkdirSync = mkdirSyncReal;
  });

  test('MIME no permitido → 400 "Formato no permitido..."', async () => {
    const respuesta = await supertest(crearApp(CLIENTE))
      .post('/api/devoluciones/evidencias')
      .attach('evidencias', Buffer.from('texto'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.msg).toBe('Formato no permitido (usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV)');
  });

  test('extensión que no coincide con el MIME → 400 "La extensión del archivo no coincide..."', async () => {
    const respuesta = await supertest(crearApp(CLIENTE))
      .post('/api/devoluciones/evidencias')
      .attach('evidencias', PNG, { filename: 'a.txt', contentType: 'image/png' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.msg).toBe('La extensión del archivo no coincide con su contenido');
  });

  test('archivo coherente → la escritura falla (mkdirSync no-op) → 400 por defecto', async () => {
    const respuesta = await supertest(crearApp(CLIENTE))
      .post('/api/devoluciones/evidencias')
      .attach('evidencias', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Error al subir las evidencias' });
  });
});

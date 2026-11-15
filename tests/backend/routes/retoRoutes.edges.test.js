/*
 * Bordes del router de retos (routes/retoRoutes.js): verificarSesion (401),
 * esAdmin (401/403/next) y el pipeline multer de /progreso/:id_reto_usuario:
 * id no numérico → carpeta null → "Identificador de reto no válido"; id
 * válido → la subida pasa por filename (extensión de lista blanca por MIME)
 * y muere al escribir (el directorio destino NO se crea de verdad: fs.mkdirSync
 * está reemplazado durante el test) → el error de fs baja como msg del 400;
 * MIME no permitido → rechazo del fileFilter. Los controllers se stubbeaban
 * ANTES del require del router; fs se restaura en cada test.
 */

const supertest = require('supertest');
const express = require('express');
const fs = require('fs');

const retoController = require('../../../backend/controllers/retoController');
const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });
['obtenerRetos', 'unirseReto', 'reportarProgreso', 'misRetos', 'misEvidencias',
  'eliminarEvidencia', 'adminEvidencias', 'aprobarEvidencia', 'rechazarEvidencia',
].forEach((nombre) => { retoController[nombre] = marca(nombre); });

const retoRoutes = require('../../../backend/routes/retoRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

const crearApp = (usuario = null) => {
  const app = express();
  app.use(sesionFalsa(usuario));
  app.use('/api/retos', retoRoutes);
  return app;
};

const VENDEDOR = { ID_USUARIO: 7, ID_ROL: 6, USUARIO: 'vendedor_activo' };

const PNG = Buffer.from('89504e470d0a1a0a0000000d', 'hex');

describe('routes/retoRoutes — gates de sesión y admin', () => {
  test('GET / sin sesión → 401 "Debes iniciar sesión"', async () => {
    const respuesta = await supertest(crearApp()).get('/api/retos');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('GET /admin/evidencias sin sesión → 401 (esAdmin)', async () => {
    const respuesta = await supertest(crearApp()).get('/api/retos/admin/evidencias');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('GET /admin/evidencias con rol no admin → 403', async () => {
    const respuesta = await supertest(crearApp({ ID_USUARIO: 8, ID_ROL: 4 })).get('/api/retos/admin/evidencias');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toBe('No tienes permisos de administrador');
  });

  test('GET /admin/evidencias con rol admin → 200 del controller', async () => {
    const respuesta = await supertest(crearApp({ ID_USUARIO: 1, ID_ROL: 1 })).get('/api/retos/admin/evidencias');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('adminEvidencias');
  });
});

describe('routes/retoRoutes — pipeline multer de POST /progreso/:id_reto_usuario', () => {
  const mkdirSyncReal = fs.mkdirSync;

  beforeEach(() => {
    // Ningún directorio real se crea: la escritura del archivo falla a
    // propósito (ENOENT) y el error baja como msg del 400.
    fs.mkdirSync = vi.fn();
  });

  afterEach(() => {
    fs.mkdirSync = mkdirSyncReal;
  });

  test('id no numérico → carpeta null → 400 "Identificador de reto no válido"', async () => {
    const respuesta = await supertest(crearApp(VENDEDOR))
      .post('/api/retos/progreso/abc')
      .attach('materiales', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Identificador de reto no válido' });
  });

  test('id válido + MIME permitido → filename asigna extensión y la escritura falla (ENOENT)', async () => {
    const respuesta = await supertest(crearApp(VENDEDOR))
      .post('/api/retos/progreso/5')
      .attach('materiales', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.msg).toContain('ENOENT');
  });

  test('MIME no permitido → 400 "Formato no permitido..."', async () => {
    const respuesta = await supertest(crearApp(VENDEDOR))
      .post('/api/retos/progreso/5')
      .attach('materiales', Buffer.from('texto'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.msg).toBe('Formato no permitido (usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV)');
  });
});

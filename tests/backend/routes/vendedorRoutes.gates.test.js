/*
 * Gates del router de vendedores (routes/vendedorRoutes.js). El router
 * estaba casi cubierto por integración, salvo su verificarSesion inline
 * (rama 401). Los controllers se reemplazan ANTES del require del router
 * (el router captura las referencias en carga) para no tocar la BD.
 */

const supertest = require('supertest');
const express = require('express');

const vendedorController = require('../../../backend/controllers/vendedorController');
const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });
vendedorController.miSolicitud = marca('miSolicitud');
vendedorController.obtenerSolicitudes = marca('obtenerSolicitudes');
vendedorController.procesarSolicitud = marca('procesarSolicitud');

const vendedorRoutes = require('../../../backend/routes/vendedorRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

describe('routes/vendedorRoutes — gates de sesión y roles', () => {
  const app = express();
  app.use(sesionFalsa());
  app.use('/api/vendedores', vendedorRoutes);

  test('GET /solicitud sin sesión → 401 "Debes iniciar sesión"', async () => {
    const respuesta = await supertest(app).get('/api/vendedores/solicitud');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('GET /admin sin sesión → 401 (esAdmin)', async () => {
    const respuesta = await supertest(app).get('/api/vendedores/admin');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('GET /admin con rol no admin → 403 "No tienes permisos de administrador"', async () => {
    const appCliente = express();
    appCliente.use(sesionFalsa({ ID_USUARIO: 8, ID_ROL: 4 }));
    appCliente.use('/api/vendedores', vendedorRoutes);

    const respuesta = await supertest(appCliente).get('/api/vendedores/admin');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toBe('No tienes permisos de administrador');
  });

  test('GET /solicitud con sesión → 200 del controller', async () => {
    const appAutenticada = express();
    appAutenticada.use(sesionFalsa({ ID_USUARIO: 8, ID_ROL: 4 }));
    appAutenticada.use('/api/vendedores', vendedorRoutes);

    const respuesta = await supertest(appAutenticada).get('/api/vendedores/solicitud');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('miSolicitud');
  });

  test('POST /admin/:id/procesar con rol admin → 200 del controller', async () => {
    const appAdmin = express();
    appAdmin.use(sesionFalsa({ ID_USUARIO: 1, ID_ROL: 1 }));
    appAdmin.use('/api/vendedores', vendedorRoutes);

    const respuesta = await supertest(appAdmin).post('/api/vendedores/admin/9/procesar');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('procesarSolicitud');
  });
});

/*
 * Gates de sesión de los routers privados "chicos" (favoritos, historial,
 * métodos de pago, notificaciones y cupones). Cada uno define su PROPIO
 * verificarSesion inline; integración solo pasa por la rama con sesión, así
 * que aquí se cubre la rama SIN sesión (401) y el paso feliz hacia el
 * controller (stubbed ANTES del require de cada router).
 * favoritos e historial usan `req.isAuthenticated && req.isAuthenticated()`
 * (el método puede no existir); los demás llaman el método directo.
 */

const supertest = require('supertest');
const express = require('express');

const favoritosController = require('../../../backend/controllers/favoritosController');
const historialController = require('../../../backend/controllers/historialController');
const metodoPagoController = require('../../../backend/controllers/metodoPagoController');
const notificacionController = require('../../../backend/controllers/notificacionController');
const cuponesController = require('../../../backend/controllers/cuponesController');

const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });

favoritosController.obtenerFavoritos = marca('obtenerFavoritos');
historialController.obtenerHistorial = marca('obtenerHistorial');
metodoPagoController.obtenerMetodos = marca('obtenerMetodos');
notificacionController.misNotificaciones = marca('misNotificaciones');
cuponesController.validarCupon = marca('validarCupon');
cuponesController.listarParaCheckout = marca('listarParaCheckout');

const favoritosRoutes = require('../../../backend/routes/favoritosRoutes');
const historialRoutes = require('../../../backend/routes/historialRoutes');
const metodoPagoRoutes = require('../../../backend/routes/metodoPagoRoutes');
const notificacionRoutes = require('../../../backend/routes/notificacionRoutes');
const cuponesRoutes = require('../../../backend/routes/cuponesRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

describe('routes/favoritos e historial — gate con guard &&', () => {
  const appSinSesion = express();
  appSinSesion.use('/api/favoritos', favoritosRoutes);
  appSinSesion.use('/api/historial', historialRoutes);

  test('favoritos: req sin isAuthenticated → 401 (rama del && vacío)', async () => {
    const respuesta = await supertest(appSinSesion).get('/api/favoritos');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('No hay sesión activa en el servidor');
  });

  test('historial: req sin isAuthenticated → 401', async () => {
    const respuesta = await supertest(appSinSesion).get('/api/historial');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('No hay sesión activa en el servidor');
  });

  test('con sesión llegan al controller', async () => {
    const app = express();
    app.use(sesionFalsa({ ID_USUARIO: 7 }));
    app.use('/api/favoritos', favoritosRoutes);
    app.use('/api/historial', historialRoutes);

    const favoritos = await supertest(app).get('/api/favoritos');
    expect(favoritos.body.stub).toBe('obtenerFavoritos');

    const historial = await supertest(app).get('/api/historial');
    expect(historial.body.stub).toBe('obtenerHistorial');
  });
});

describe('routes/metodoPago, notificaciones y cupones — gate directo', () => {
  test('metodos de pago sin sesión → 401 "Debes iniciar sesión"', async () => {
    const app = express();
    app.use(sesionFalsa());
    app.use('/api/metodos-pago', metodoPagoRoutes);

    const respuesta = await supertest(app).get('/api/metodos-pago');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('notificaciones sin sesión → 401', async () => {
    const app = express();
    app.use(sesionFalsa());
    app.use('/api/notificaciones', notificacionRoutes);

    const respuesta = await supertest(app).get('/api/notificaciones');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('Debes iniciar sesión');
  });

  test('cupones /disponibles sin sesión → 401; /validar es público', async () => {
    const app = express();
    app.use(sesionFalsa());
    app.use('/api/cupones', cuponesRoutes);

    const sinSesion = await supertest(app).get('/api/cupones/disponibles');
    expect(sinSesion.status).toBe(401);
    expect(sinSesion.body.msg).toBe('Debes iniciar sesión');

    const publico = await supertest(app).post('/api/cupones/validar');
    expect(publico.status).toBe(200);
    expect(publico.body.stub).toBe('validarCupon');
  });

  test('con sesión llegan al controller', async () => {
    const app = express();
    app.use(sesionFalsa({ ID_USUARIO: 7 }));
    app.use('/api/metodos-pago', metodoPagoRoutes);
    app.use('/api/notificaciones', notificacionRoutes);
    app.use('/api/cupones', cuponesRoutes);

    const metodos = await supertest(app).get('/api/metodos-pago');
    expect(metodos.body.stub).toBe('obtenerMetodos');

    const notificaciones = await supertest(app).get('/api/notificaciones');
    expect(notificaciones.body.stub).toBe('misNotificaciones');

    const cupones = await supertest(app).get('/api/cupones/disponibles');
    expect(cupones.body.stub).toBe('listarParaCheckout');
  });
});

/*
 * Pasarela de pagos (routes/pagosRoutes.js), que estaba en 0% porque ningún
 * test la requería. Se prueba el CABLEADO de las 5 rutas y sus gates:
 * /config y /webhook van SIN sesión (la firma la valida el controller);
 * /pagar, /simular y /estado/:idVenta exigen sesión (verificarSesion → 401).
 * Los límites por ruta (8/5min pagos, 12/5min simulación, 90/min estado,
 * 60/min webhook) están desactivados con NODE_ENV=test; el limitador real
 * se prueba en unitarios/middlewares.
 */

const supertest = require('supertest');
const express = require('express');

const pagosController = require('../../../backend/controllers/pagosController');
const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });
pagosController.configPagos = marca('configPagos');
pagosController.crearSesionPago = marca('crearSesionPago');
pagosController.simularPago = marca('simularPago');
pagosController.estadoVenta = marca('estadoVenta');
pagosController.webhookWompi = marca('webhookWompi');

const pagosRoutes = require('../../../backend/routes/pagosRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

describe('routes/pagosRoutes — cableado de la pasarela', () => {
  const app = express();
  app.use(sesionFalsa());
  app.use('/api/pagos', pagosRoutes);

  test('GET /config es pública → 200 del controller', async () => {
    const respuesta = await supertest(app).get('/api/pagos/config');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('configPagos');
  });

  test('POST /webhook va SIN sesión (lo llama Wompi) → 200 del controller', async () => {
    const respuesta = await supertest(app).post('/api/pagos/webhook');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('webhookWompi');
  });

  test('POST /pagar sin sesión → 401 "No autorizado"', async () => {
    const respuesta = await supertest(app).post('/api/pagos/pagar');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'No autorizado' });
  });

  test('POST /simular sin sesión → 401 "No autorizado"', async () => {
    const respuesta = await supertest(app).post('/api/pagos/simular');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('No autorizado');
  });

  test('GET /estado/:idVenta sin sesión → 401 "No autorizado"', async () => {
    const respuesta = await supertest(app).get('/api/pagos/estado/1');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.msg).toBe('No autorizado');
  });

  test('POST /pagar con sesión → 200 del controller', async () => {
    const appAutenticada = express();
    appAutenticada.use(sesionFalsa({ ID_USUARIO: 7, ID_ROL: 4 }));
    appAutenticada.use('/api/pagos', pagosRoutes);

    const respuesta = await supertest(appAutenticada).post('/api/pagos/pagar');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('crearSesionPago');
  });
});

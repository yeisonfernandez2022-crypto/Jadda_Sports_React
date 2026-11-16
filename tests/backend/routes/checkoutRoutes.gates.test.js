/*
 * Gate de sesión del router de checkout (routes/checkoutRoutes.js):
 * estaAutenticado (L7) es la única función sin cubrir — sin sesión responde
 * 401 y con sesión deja pasar al controller (stubbed ANTES del require del
 * router).
 */

const supertest = require('supertest');
const express = require('express');

const checkoutController = require('../../../backend/controllers/checkoutController');
checkoutController.procesarCompra = (req, res) => res.status(200).json({ stub: 'procesarCompra' });

const checkoutRoutes = require('../../../backend/routes/checkoutRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

describe('routes/checkoutRoutes — POST /procesar (gate estaAutenticado)', () => {
  test('sin sesión → 401 "No autenticado"', async () => {
    const app = express();
    app.use(sesionFalsa());
    app.use('/api/checkout', checkoutRoutes);

    const respuesta = await supertest(app).post('/api/checkout/procesar');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ error: 'No autenticado' });
  });

  test('con sesión → 200 del controller', async () => {
    const app = express();
    app.use(sesionFalsa({ ID_USUARIO: 7, ID_ROL: 4 }));
    app.use('/api/checkout', checkoutRoutes);

    const respuesta = await supertest(app).post('/api/checkout/procesar');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.stub).toBe('procesarCompra');
  });
});

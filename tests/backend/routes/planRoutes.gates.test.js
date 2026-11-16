/*
 * Gates de sesión del router de planes (routes/planRoutes.js): verificarSesion
 * (L6) es la única función sin cubrir — sin sesión 401; con sesión pasa a los
 * controllers (stubbed ANTES del require del router).
 */

const supertest = require('supertest');
const express = require('express');

const planController = require('../../../backend/controllers/planController');
const marca = (nombre) => (req, res) => res.status(200).json({ stub: nombre });
planController.misPlanes = marca('misPlanes');
planController.generarPlan = marca('generarPlan');
planController.marcarDia = marca('marcarDia');

const planRoutes = require('../../../backend/routes/planRoutes');

const sesionFalsa = (usuario = null) => (req, _res, next) => {
  req.isAuthenticated = () => Boolean(usuario);
  if (usuario) req.user = usuario;
  next();
};

describe('routes/planRoutes — gates de sesión', () => {
  test('GET / sin sesión → 401 "Debes iniciar sesión"', async () => {
    const app = express();
    app.use(sesionFalsa());
    app.use('/api/planes', planRoutes);

    const respuesta = await supertest(app).get('/api/planes');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ ok: false, msg: 'Debes iniciar sesión' });
  });

  test('con sesión: las 3 rutas llegan a su controller', async () => {
    const app = express();
    app.use(sesionFalsa({ ID_USUARIO: 7, ID_ROL: 4 }));
    app.use('/api/planes', planRoutes);

    const lista = await supertest(app).get('/api/planes');
    expect(lista.body.stub).toBe('misPlanes');

    const generar = await supertest(app).post('/api/planes/generar');
    expect(generar.body.stub).toBe('generarPlan');

    const marcar = await supertest(app).post('/api/planes/marcar-dia/9');
    expect(marcar.body.stub).toBe('marcarDia');
  });
});

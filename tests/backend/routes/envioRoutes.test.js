/*
 * Pruebas del endpoint de dominio GET /api/envio/tarifas (Sprint 0).
 * Expone las tarifas de envío (departamento y ciudad), la tarifa por
 * defecto y el umbral de envío gratis desde backend/utils/envio.js —
 * solo lectura, sin base de datos y sin sesión.
 */

const supertest = require('supertest');
const express = require('express');

const envioRoutes = require('../../../backend/routes/envioRoutes');
const dominioEnvio = require('../../../backend/utils/envio');

describe('routes/envioRoutes — GET /api/envio/tarifas (dominio, solo lectura)', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/api/envio', envioRoutes);
  });

  test('responde 200 con tarifas, tarifa por defecto y umbral de envío gratis', async () => {
    const respuesta = await supertest(app).get('/api/envio/tarifas');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.tarifa_default).toBe(15000);
    expect(respuesta.body.envio_gratis_desde).toBe(800000);
    expect(typeof respuesta.body.tarifas).toBe('object');
    expect(typeof respuesta.body.tarifas.departamento).toBe('object');
    expect(typeof respuesta.body.tarifas.ciudad).toBe('object');
  });

  test('las tarifas coinciden con el módulo de dominio real (utils/envio)', async () => {
    const respuesta = await supertest(app).get('/api/envio/tarifas');

    expect(respuesta.body.tarifas.departamento).toEqual(dominioEnvio.TARIFAS_DEPARTAMENTO);
    expect(respuesta.body.tarifas.ciudad).toEqual(dominioEnvio.TARIFAS_CIUDAD);
    // Valores conocidos del dominio real
    expect(respuesta.body.tarifas.departamento['BOGOTA']).toBe(8000);
    expect(respuesta.body.tarifas.departamento['ANTIOQUIA']).toBe(9000);
  });

  test('es de solo lectura: GET repetido devuelve exactamente la misma respuesta', async () => {
    const primera = await supertest(app).get('/api/envio/tarifas');
    const segunda = await supertest(app).get('/api/envio/tarifas');

    expect(segunda.status).toBe(200);
    expect(segunda.body).toEqual(primera.body);
  });

  test('no acepta métodos de escritura sobre /tarifas', async () => {
    const post = await supertest(app).post('/api/envio/tarifas');
    expect(post.status).toBe(404);
  });
});

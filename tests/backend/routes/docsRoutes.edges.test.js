/*
 * Bordes del router de documentación (routes/docsRoutes.js).
 *
 * El router no tiene gates ni BD: aquí se cubre el router COMPLETO (estaba en
 * 0% porque ningún test lo requería) — la spec OpenAPI en JSON puro y la UI
 * de Swagger con su CSP propia (el header se SOBREESCRIBE solo para /api-docs).
 */

const supertest = require('supertest');
const express = require('express');

const docsRoutes = require('../../../backend/routes/docsRoutes');

describe('routes/docsRoutes — spec JSON y UI de Swagger', () => {
  const app = express();
  app.use('/api', docsRoutes);

  test('GET /api/api-docs.json devuelve la especificación OpenAPI en JSON', async () => {
    const respuesta = await supertest(app).get('/api/api-docs.json');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/application\/json/);
    expect(respuesta.body.openapi).toMatch(/^3\.0\./);
    expect(respuesta.body.info.title).toContain('JADDA');
  });

  test('GET /api/api-docs sirve la UI de Swagger con su CSP propia', async () => {
    const respuesta = await supertest(app).get('/api/api-docs/');

    expect(respuesta.status).toBe(200);
    const csp = respuesta.headers['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("form-action 'none'");
  });
});

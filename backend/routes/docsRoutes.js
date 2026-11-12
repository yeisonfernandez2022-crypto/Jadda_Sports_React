/**
 * Rutas de documentación de la API (Swagger UI + OpenAPI JSON).
 *
 * - GET /api-docs        → Swagger UI (interfaz interactiva)
 * - GET /api-docs.json   → Especificación OpenAPI 3.0 en JSON puro
 *
 * La spec vive en backend/docs/openapi.js (única fuente de verdad).
 *
 * CSP: en producción el helmet global bloquea scripts/estilos (default-src
 * 'none') — la UI de Swagger necesita los suyos (mismo origin) y un script
 * inline de arranque, así que este router SOBREESCRIBE el header
 * Content-Security-Policy SOLO para /api-docs. La CSP dura del resto del
 * backend queda intacta. El router se monta antes del rate limiter global
 * (como /health) para que los assets de la UI no compitan en el cubo por IP.
 */
'use strict';

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const spec = require('../docs/openapi');

const router = express.Router();

// CSP propia de la UI (relajada a mismo-origin + inline del arranque de la UI)
const CSP_SWAGGER =
  "default-src 'none'; " +
  "img-src 'self' data:; " +
  "media-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; " +
  "connect-src 'self'; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

router.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(spec);
});

router.use('/api-docs', (req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP_SWAGGER);
  next();
}, swaggerUi.serve, swaggerUi.setup(spec, {
  customSiteTitle: 'JADDA SPORTS — API Docs',
  customCss: '.topbar { display: none }',
  docExpansion: 'list',
  defaultModelsExpandDepth: 1,
  persistAuthorization: true,
}));

module.exports = router;

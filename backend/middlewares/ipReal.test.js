const express = require('express');
const request = require('supertest');

function appCopiaServidor(trustProxyBruto) {
  const app = express();
  const saltos = trustProxyBruto !== undefined ? Number(trustProxyBruto) : 1;
  app.set('trust proxy', Number.isFinite(saltos) ? saltos : 1);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('IP real detrás de dos proxys (TRUST_PROXY=2)', () => {
  it('TRUST_PROXY=2 resuelve req.ip como la IP del cliente (primer salto de X-Forwarded-For)', async () => {
    const app = appCopiaServidor('2');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2');
    expect(res.status).toBe(200);
    expect(res.body.ip).toBe('203.0.113.10');
  });

  it('sin trust proxy, req.ip es la IP del último proxy: los clientes comparten el mismo cubo de rate limit', async () => {
    const app = appCopiaServidor('0');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2');
    expect(res.body.ip).toContain('127.0.0.1');
  });

  it('TRUST_PROXY invalido cae al default de server.js (1 salto): la IP visible pasa a ser un proxy, no el cliente', async () => {
    const app = appCopiaServidor('no-num');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2, 10.0.0.3');
    expect(res.body.ip).toBe('10.0.0.3');
  });
});

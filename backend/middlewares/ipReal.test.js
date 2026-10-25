const express = require('express');
const request = require('supertest');
const resolverTrustProxy = require('../utils/trustProxy');

function appCopiaServidor(trustProxyBruto, isProduction = true) {
  const app = express();
  app.set('trust proxy', resolverTrustProxy(trustProxyBruto, isProduction));
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('resolverTrustProxy (utils/trustProxy.js)', () => {
  it('sin TRUST_PROXY en produccion: 1 salto (proxy delante)', () => {
    expect(resolverTrustProxy(undefined, true)).toBe(1);
  });

  it('sin TRUST_PROXY en desarrollo: 0 saltos (sin proxy; header forjado NO se honra)', () => {
    expect(resolverTrustProxy(undefined, false)).toBe(0);
  });

  it('TRUST_PROXY numerico se respeta tal cual', () => {
    expect(resolverTrustProxy('2', false)).toBe(2);
    expect(resolverTrustProxy('0', true)).toBe(0);
  });

  it('TRUST_PROXY invalido cae a 1 salto; vacio equivale a 0 (igual que Number("") en server.js)', () => {
    expect(resolverTrustProxy('no-num', false)).toBe(1);
    expect(resolverTrustProxy('', true)).toBe(0);
  });
});

describe('IP real detrás de dos proxys (TRUST_PROXY=2)', () => {
  it('TRUST_PROXY=2 resuelve req.ip como la IP del cliente (primer salto de X-Forwarded-For)', async () => {
    const app = appCopiaServidor('2');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2');
    expect(res.status).toBe(200);
    expect(res.body.ip).toBe('203.0.113.10');
  });

  it('con TRUST_PROXY=0 (desarrollo), req.ip es la IP del último proxy: los clientes comparten el mismo cubo de rate limit', async () => {
    const app = appCopiaServidor('0');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2');
    expect(res.body.ip).toContain('127.0.0.1');
  });

  it('TRUST_PROXY invalido cae a 1 salto: la IP visible pasa a ser un proxy, no el cliente', async () => {
    const app = appCopiaServidor('no-num');
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.2, 10.0.0.3');
    expect(res.body.ip).toBe('10.0.0.3');
  });

  it('sin TRUST_PROXY en produccion (default 1 salto) se resuelve la IP del cliente', async () => {
    const app = appCopiaServidor(undefined, true);
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.44');
    expect(res.body.ip).toBe('203.0.113.44');
  });

  it('sin TRUST_PROXY en desarrollo (default 0 saltos) IGNORA el header forjado', async () => {
    const app = appCopiaServidor(undefined, false);
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.44');
    expect(res.body.ip).not.toBe('203.0.113.44');
  });
});

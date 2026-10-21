/*
 * Pruebas unitarias de la defensa CSRF (middlewares/proteccionOrigen.js).
 * El middleware es puro (solo cabeceras), así que se prueba con req/res de
 * mentira sin montar Express.
 */

const { proteccionOrigen } = require('./proteccionOrigen');
const { ORIGENES_BASE } = require('../config/origenesAdmitidos');

const ALLOWED = ORIGENES_BASE[0]; // http://localhost:5173

function reqFalso({ method = 'POST', origin, host = 'localhost:5000', xfwd, xfproto } = {}) {
  const headers = { host };
  if (origin !== undefined) headers.origin = origin;
  if (xfwd !== undefined) headers['x-forwarded-host'] = xfwd;
  if (xfproto !== undefined) headers['x-forwarded-proto'] = xfproto;
  return { method, headers, originalUrl: '/api/prueba', ip: '10.0.0.1' };
}

function resFalso() {
  const res = {
    statusCode: 0,
    cuerpo: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.cuerpo = payload;
      return this;
    },
  };
  return res;
}

/** Corre el middleware y devuelve { pasa, status, cuerpo } */
function correr(opciones) {
  const req = reqFalso(opciones);
  const res = resFalso();
  let pasa = false;
  proteccionOrigen(req, res, () => {
    pasa = true;
  });
  return { pasa, status: res.statusCode, cuerpo: res.cuerpo };
}

describe('proteccionOrigen — defensa CSRF', () => {
  test('GET con Origin ajeno pasa (solo mutaciones se verifican)', () => {
    const r = correr({ method: 'GET', origin: 'https://atacante.ejemplo' });
    expect(r.pasa).toBe(true);
  });

  test('OPTIONS (preflight) con Origin ajeno pasa', () => {
    expect(
      correr({ method: 'OPTIONS', origin: 'https://atacante.ejemplo' }).pasa
    ).toBe(true);
  });

  test('POST sin Origin pasa (app móvil nativa / curl / tests)', () => {
    expect(correr({ method: 'POST' }).pasa).toBe(true);
  });

  test(`POST con Origin permitido (${ALLOWED}) pasa`, () => {
    expect(correr({ method: 'POST', origin: ALLOWED }).pasa).toBe(true);
  });

  test('POST con Origin del propio host efectivo pasa (mismo origen tras proxy)', () => {
    // Desarrollo: Vite proxea /api conservando el Host del navegador
    expect(
      correr({ method: 'POST', origin: 'http://localhost:5173', host: 'localhost:5173' }).pasa
    ).toBe(true);
    // Producción: nginx/Caddy conservan el Host y el esquema real llega por X-Forwarded-Proto
    expect(
      correr({
        method: 'POST',
        origin: 'https://www.jaddasports.com',
        host: 'www.jaddasports.com',
        xfproto: 'https',
      }).pasa
    ).toBe(true);
  });

  test('POST con Origin ajeno responde 403 y NO pasa', () => {
    const r = correr({ method: 'POST', origin: 'https://atacante.ejemplo' });
    expect(r.pasa).toBe(false);
    expect(r.status).toBe(403);
    expect(r.cuerpo).toEqual({ ok: false, msg: 'Origen no permitido' });
  });

  test('POST con Origin "null" (contexto opaco) responde 403', () => {
    expect(correr({ method: 'POST', origin: 'null' }).status).toBe(403);
  });

  test('DELETE y PATCH también se verifican', () => {
    expect(correr({ method: 'DELETE', origin: 'https://atacante.ejemplo' }).status).toBe(403);
    expect(correr({ method: 'PATCH', origin: 'https://atacante.ejemplo' }).status).toBe(403);
    expect(correr({ method: 'DELETE', origin: ALLOWED }).pasa).toBe(true);
  });

  test('Un Origin dominio de producción añadido por CORS_ORIGINS queda admitido', () => {
    process.env.CORS_ORIGINS = 'https://www.jaddasports.com';
    try {
      expect(
        correr({ method: 'POST', origin: 'https://www.jaddasports.com' }).pasa
      ).toBe(true);
      // Y un ajeno sigue bloqueado
      expect(correr({ method: 'POST', origin: 'https://otro.ejemplo' }).status).toBe(403);
    } finally {
      delete process.env.CORS_ORIGINS;
    }
  });

  test('Origen con slash final en CORS_ORIGINS se normaliza y admite', () => {
    process.env.CORS_ORIGINS = 'https://www.jaddasports.com/';
    try {
      expect(
        correr({ method: 'POST', origin: 'https://www.jaddasports.com' }).pasa
      ).toBe(true);
    } finally {
      delete process.env.CORS_ORIGINS;
    }
  });
});

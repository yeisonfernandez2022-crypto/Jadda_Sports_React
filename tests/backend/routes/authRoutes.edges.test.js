/*
 * Bordes del flujo OAuth (routes/authRoutes.js) que la suite base no cubre:
 * 1) verificarSesion cuando req NO trae isAuthenticated (gate defensivo);
 * 2) 503 cuando el servidor no tiene credenciales de Google;
 * 3) callback SIN sesión (403 "no llegó");
 * 4) proveedor que FALLA (this.fail) o ROMPE (this.error) → redirección al
 *    popup con ?motivo= en lugar de morir;
 * 5) usuarios de éxito con claves menores (nombre/foto_url) o vacíos.
 * La estrategia de Google es fingida (passport-strategy), como en la suite
 * base de authRoutes.
 */

const supertest = require('supertest');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: EstrategiaBase } = require('passport-strategy');

const authRoutes = require('../../../backend/routes/authRoutes');

describe('routes/authRoutes — verificarSesion sin método isAuthenticated', () => {
  const app = express();
  app.use('/api/auth', authRoutes);

  test('GET /perfil → 401 "No hay sesión activa en el servidor"', async () => {
    const respuesta = await supertest(app).get('/api/auth/perfil');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('No hay sesión activa en el servidor');
  });

  test('PUT /perfil → 401', async () => {
    const respuesta = await supertest(app).put('/api/auth/perfil');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('No hay sesión activa en el servidor');
  });
});

describe('routes/authRoutes — bordes del OAuth Google', () => {
  let app;
  const CLIENT_ID_REAL = process.env.GOOGLE_CLIENT_ID;
  const EXPO_ID_REAL = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  class EstrategiaGoogleDePruebas extends EstrategiaBase {
    constructor() {
      super();
      this.name = 'google';
    }

    authenticate(req, options) {
      if (req.path.startsWith('/google/callback')) {
        if (req.query.modofalla === 'error') {
          return this.error(new Error('proveedor de Google caído'));
        }
        if (req.query.modofalla === 'fallo') {
          return this.fail({ message: 'cuenta de Google bloqueada' });
        }
        let usuario = {};
        const bruto = String(req.query.usuario || '');
        if (bruto) {
          try {
            usuario = JSON.parse(Buffer.from(bruto, 'base64url').toString('utf8'));
          } catch {
            usuario = {};
          }
        }
        return this.success(usuario);
      }
      return this.redirect(`https://proveedor-fingido/oauth2?state=${options.state}`, 302);
    }
  }

  beforeAll(() => {
    passport.use('google', new EstrategiaGoogleDePruebas());
    passport.serializeUser((usuario, fin) => fin(null, usuario));
    passport.deserializeUser((obj, fin) => fin(null, obj));

    app = express();
    app.use(session({ secret: 'secreto-de-pruebas', resave: false, saveUninitialized: true }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use('/api/auth', authRoutes);
  });

  const extraerCookie = (res) => (res.headers['set-cookie'] || [])[0]?.split(';')[0];

  const flujoDeState = async (from = '/perfil') => {
    const inicio = await supertest(app).get(`/api/auth/google?from=${from}`);
    const cookie = extraerCookie(inicio);
    const [, state] = inicio.headers.location.match(/state=([^&]+)/);
    return { cookie, state };
  };

  test('GET /google sin credenciales → 503 "Login con Google no está configurado"', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    try {
      const respuesta = await supertest(app).get('/api/auth/google');
      expect(respuesta.status).toBe(503);
      expect(respuesta.body.msg).toBe('Login con Google no está configurado en este servidor');
    } finally {
      process.env.GOOGLE_CLIENT_ID = CLIENT_ID_REAL;
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = EXPO_ID_REAL;
    }
  });

  test('GET /google/callback sin credenciales → 503', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    try {
      const respuesta = await supertest(app).get('/api/auth/google/callback');
      expect(respuesta.status).toBe(503);
      expect(respuesta.body.msg).toBe('Login con Google no está configurado en este servidor');
    } finally {
      process.env.GOOGLE_CLIENT_ID = CLIENT_ID_REAL;
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = EXPO_ID_REAL;
    }
  });

  test('callback sin sesión → 403 "la sesión del flujo social no llegó al callback"', async () => {
    const respuesta = await supertest(app).get('/api/auth/google/callback?state=loquesea');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toContain('la sesión del flujo social no llegó al callback');
  });

  test('proveedor FALLA con state válido → 302 al popup con ?motivo=', async () => {
    const { cookie, state } = await flujoDeState();
    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}&modofalla=fallo`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toMatch(/\/perfil\?motivo=cuenta%20de%20Google%20bloqueada$/);
  });

  test('proveedor ROMPE con state válido → 302 con el motivo del error', async () => {
    const { cookie, state } = await flujoDeState();
    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}&modofalla=error`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toMatch(/motivo=proveedor%20de%20Google%20ca%C3%ADdo$/);
  });

  test('éxito con claves menores (nombre/foto_url) → se usan en la redirección', async () => {
    const { cookie, state } = await flujoDeState();
    const usuario = Buffer.from(JSON.stringify({ nombre: 'Menor', foto_url: '/f.png' })).toString('base64url');
    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}&usuario=${usuario}`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toBe('http://localhost:5173/perfil?user=Menor&photo=%2Ff.png');
  });

  test('éxito con usuario sin claves → user y photo vacíos', async () => {
    const { cookie, state } = await flujoDeState();
    const usuario = Buffer.from(JSON.stringify({})).toString('base64url');
    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}&usuario=${usuario}`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toBe('http://localhost:5173/perfil?user=&photo=');
  });
});

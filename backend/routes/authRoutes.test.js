/*
 * Pruebas de las redirecciones OAuth (routes/authRoutes.js).
 * 1) rutaRetornoSegura: "/" relativa, sin "//", "\" ni "://" (anti open redirect).
 * 2) Flujo /google + /google/callback: el state devuelto por el proveedor debe
 *    coincidir con el aleatorio guardado en req.session antes de autenticar,
 *    y la ruta de retorno se toma de la sesión (no del query del atacante).
 * passport se usa con estrategias fingidas: devuelven en el redirect el state
 * de options y hacen success() en el callback (no se llaman servicios reales).
 */

const supertest = require('supertest');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: EstrategiaBase } = require('passport-strategy');

const authRoutes = require('./authRoutes');

describe('routes/authRoutes — rutaRetornoSegura (anti open redirect)', () => {
  const validar = (valor) => authRoutes.rutaRetornoSegura(valor);

  test('acepta rutas relativas including con query', () => {
    expect(validar('/perfil')).toBe('/perfil');
    expect(validar('/perfil/compras?x=1')).toBe('/perfil/compras?x=1');
  });

  test('usa /principal cuando no hay ruta', () => {
    expect(validar(undefined)).toBe('/principal');
    expect(validar('')).toBe('/principal');
    expect(validar(null)).toBe('/principal');
  });

  test('rechaza URLs absolutas y protocol-relative', () => {
    expect(validar('https://atacante.example')).toBe('/principal');
    expect(validar('http://atacante.example')).toBe('/principal');
    expect(validar('//atacante.example')).toBe('/principal');
  });

  test('rechaza backslash y esquemas embebidos', () => {
    expect(validar('/\\perfiles')).toBe('/principal');
    expect(validar('/redirect?u=https://atacante.example')).toBe('/principal');
  });
});

describe('routes/authRoutes — state OAuth (anti CSRF) con servidor mínimo', () => {
  let app;

  beforeAll(() => {
    // Estrategia fingida basada en passport-strategy: en el paso de LOGIN
    // redirige con el state de options (guardado en req.session) y en el
    // callback hace success() con un usuario de prueba. Así se prueba el
    // flujo real de las rutas sin depender de Google/Facebook.
    class EstrategiaFingida extends EstrategiaBase {
      constructor(nombre) {
        super();
        this.name = nombre;
      }
      authenticate(req, options) {
        if (req.path.startsWith('/google/callback') || req.path.startsWith('/facebook/callback')) {
          this.success({ NOMBRE_USUARIO: 'Prueba Social', FOTO_URL: '/images/prueba.png' });
        } else {
          this.redirect(`https://proveedor-fingido/oauth2?state=${options.state}`, 302);
        }
      }
    }

    passport.use('google', new EstrategiaFingida('google'));
    passport.use('facebook', new EstrategiaFingida('facebook'));
    passport.serializeUser((usuario, fin) => fin(null, usuario));
    passport.deserializeUser((obj, fin) => fin(null, obj));

    app = express();
    app.use(
      session({
        secret: 'secreto-de-prueba',
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true, sameSite: 'lax' },
      })
    );
    app.use(passport.initialize());
    app.use(passport.session());
    app.use('/api/auth', authRoutes);
  });

  const extraerCookie = (res) =>
    (res.headers['set-cookie'] || [])[0]?.split(';')[0];

  test('el callback con state INCORRECTO responde 403', async () => {
    const inicio = await supertest(app)
      .get('/api/auth/google?from=//atacante.example')
      .set('Accept', 'text/html');
    const cookie = extraerCookie(inicio);

    const respuesta = await supertest(app)
      .get('/api/auth/google/callback?state=state-falsificado')
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toMatch(/state no coincide/);
  });

  test('el callback SIN state responde 403', async () => {
    const inicio = await supertest(app).get('/api/auth/google?from=/perfil');
    const cookie = extraerCookie(inicio);

    const respuesta = await supertest(app)
      .get('/api/auth/google/callback')
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.msg).toMatch(/state no coincide/);
  });

  test('el callback con el state CORRECTO autentica y usa la ruta de la sesión', async () => {
    const inicio = await supertest(app)
      .get('/api/auth/google?from=/perfil/compras')
      .set('Accept', 'text/html');
    const cookie = extraerCookie(inicio);
    const [, state] = inicio.headers.location.match(/state=([^&]+)/);

    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toMatch(/^http:\/\/localhost:5173\/perfil\/compras\?user=/);
  });

  test('atame con ruta inválida el retorno asegurado cae en /principal', async () => {
    const inicio = await supertest(app)
      .get('/api/auth/google?from=https://atacante.example')
      .set('Accept', 'text/html');
    const cookie = extraerCookie(inicio);
    const [, state] = inicio.headers.location.match(/state=([^&]+)/);

    const respuesta = await supertest(app)
      .get(`/api/auth/google/callback?state=${state}`)
      .set('Cookie', cookie);

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toMatch(/^http:\/\/localhost:5173\/principal\?user=/);
  });
});

/**
 * authController — caminos que la suite base (authController.test.js) no
 * cubre: validarCodigoRecuperacion (fuerza bruta por cuenta), socialLogin
 * (Google desde la app móvil, con regeneración de sesión y foto propia),
 * actualizarPrivacidad, logout (callbacks de passport/destroy),
 * confirmarCambioEmail (OTP de 2 pasos con contador) y subirFotoPerfil
 * (magic bytes, Cloudinary con fallback local, defensa de recorrido).
 * Suite NUEVA: la base no se edita. Deps destructuradas en carga (cloudinary,
 * verificacionSocial) se mutan ANTES del require; detectarFormato y bcrypt
 * quedan REALES (magic bytes y hash de verdad).
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const fs = require('fs');
const cloudinary = require('../../../backend/utils/cloudinary');
const verificacionSocial = require('../../../backend/utils/verificacionSocial');
const carpetaUsuario = require('../../../backend/utils/carpetaUsuario');
const mailer = require('../../../backend/config/mailer');

// destructuring en carga → mutar ANTES del require del SUT
cloudinary.estaConfigurado = vi.fn(() => false);
cloudinary.subirDataUri = vi.fn(async () => ({ secure_url: 'https://res.cloudinary.com/perfil.png' }));
cloudinary.eliminarPorUrl = vi.fn(async () => {});
cloudinary.carpetaSegura = vi.fn((...partes) => partes.filter(Boolean).join('/'));
cloudinary.esUrlCloudinary = vi.fn((url) => /^https:\/\/res\.cloudinary\.com/.test(String(url || '')));
cloudinary.esFotoPropia = vi.fn((url) => /^\/images\//.test(String(url || '')));
cloudinary.GUARD_SQL_FOTO_PROPIA = 'FOTO_URL IS NULL';
verificacionSocial.verificarTokenGoogle = vi.fn(async () => ({
  email: 'google@t.co', nombre: 'Ana', apellido: 'Gomez', foto: 'https://g.co/avatar.png',
}));
verificacionSocial.contrasenaNoVerificable = vi.fn(() => '!no-verificable!');

const authController = require('../../../backend/controllers/authController');

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.clearCookie = vi.fn();
  return res;
};

const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) return rutas[clave];
    }
    return defecto ? defecto() : [[]];
  });
};

const req = (over = {}) => ({ user: null, params: {}, body: {}, query: {}, ip: '127.0.0.1', session: {}, ...over });

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a46494600', 'hex');
const dataUri = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

const mkdirSyncReal = fs.mkdirSync;
const readdirSyncReal = fs.readdirSync;
const writeFileSyncReal = fs.writeFileSync;
const unlinkSyncReal = fs.unlinkSync;

beforeEach(() => {
  vi.clearAllMocks();
  cloudinary.estaConfigurado.mockImplementation(() => false);
  cloudinary.subirDataUri.mockImplementation(async () => ({ secure_url: 'https://res.cloudinary.com/perfil.png' }));
  verificacionSocial.verificarTokenGoogle.mockImplementation(async () => ({
    email: 'google@t.co', nombre: 'Ana', apellido: 'Gomez', foto: 'https://g.co/avatar.png',
  }));
  mailer.sendMail = vi.fn(async () => ({ accepted: true }));
  fs.mkdirSync = vi.fn();
  fs.readdirSync = vi.fn(() => []);
  fs.writeFileSync = vi.fn();
  fs.unlinkSync = vi.fn();
  authController._useDb({ query: vi.fn(async () => [[]]) });
});

afterEach(() => {
  fs.mkdirSync = mkdirSyncReal;
  fs.readdirSync = readdirSyncReal;
  fs.writeFileSync = writeFileSyncReal;
  fs.unlinkSync = unlinkSyncReal;
});

describe('validarCodigoRecuperacion (anti-enumeración y fuerza bruta)', () => {
  test('correo inexistente → misma respuesta que código mal (400)', async () => {
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'nadie@t.co', codigo: '111111' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ message: 'Código incorrecto o ya utilizado.' });
  });

  test('TOKEN null (código invalidado) → 400 tras registrar el intento', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, TOKEN: null }]],
      'SELECT INTENTOS_CODIGO AS INTENTOS': [[{ INTENTOS: 1 }]],
    });
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '222222' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('Código incorrecto o ya utilizado.');
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().includes('VENTANA_CODIGO = IF'))).toBe(true);
    expect(dbq.mock.calls.length).toBeGreaterThan(2); // UPDATE del contador + SELECT del total
  });

  test('código incorrecto con hash real (bcrypt) → 400', async () => {
    const tokenReal = require('bcryptjs').hashSync('654321', 10);
    authController._useDb({ query: dbDe({ 'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, TOKEN: tokenReal }]] }) });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '000000' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('Código incorrecto o ya utilizado.');
  });

  test('5 intentos fallidos → el código se invalida por fuerza bruta', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, TOKEN: null }]],
      'SELECT INTENTOS_CODIGO AS INTENTOS': [[{ INTENTOS: 5 }]],
    });
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '333333' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('Demasiados intentos con código incorrecto. Solicita un código nuevo.');
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET TOKEN = NULL'))).toBe(true);
  });

  test('código correcto pero expirado → 400 "El código ha expirado."', async () => {
    const tokenReal = require('bcryptjs').hashSync('654321', 10);
    authController._useDb({ query: dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, TOKEN: tokenReal, TOKEN_EXPIRA: '2020-01-01 00:00:00' }]],
    }) });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '654321' } }), res);
    expect(res.cuerpo).toEqual({ message: 'El código ha expirado.' });
  });

  test('código correcto y vigente → reinicia el contador y 200 "Código válido."', async () => {
    const tokenReal = require('bcryptjs').hashSync('654321', 10);
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, TOKEN: tokenReal, TOKEN_EXPIRA: '2099-01-01 00:00:00' }]],
    }, () => [{ affectedRows: 1 }]);
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '654321' } }), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ message: 'Código válido.' });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET INTENTOS_CODIGO = 0'))).toBe(true);
  });

  test('fallo de BD → 500', async () => {
    authController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await authController.validarCodigoRecuperacion(req({ body: { email: 'a@t.co', codigo: '1' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.message).toBe('Error al validar el código.');
  });
});

describe('socialLogin (Google desde la app móvil)', () => {
  const sesion = (errRegen = null, errLogin = null) => ({
    regenerate: vi.fn((cb) => cb(errRegen)),
  });
  const loginDe = (err) => (user, cb) => cb(err);

  test('sin provider o accessToken → 400', async () => {
    const res = resFalsa();
    await authController.socialLogin(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('Provider y accessToken son obligatorios');
  });

  test('provider no soportado → 400', async () => {
    const res = resFalsa();
    await authController.socialLogin(req({ body: { provider: 'facebook', accessToken: 'x' } }), res);
    expect(res.cuerpo.message).toBe('Provider no soportado');
  });

  test('token de Google inválido → 401 con el motivo del proveedor', async () => {
    verificacionSocial.verificarTokenGoogle.mockImplementation(async () => { throw new Error('firma inválida'); });
    const res = resFalsa();
    await authController.socialLogin(req({ body: { provider: 'google', accessToken: 'malo' } }), res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo.message).toBe('firma inválida');
  });

  test('token sin email → 400 "No se pudo obtener el email"', async () => {
    verificacionSocial.verificarTokenGoogle.mockImplementation(async () => ({ email: null }));
    const res = resFalsa();
    await authController.socialLogin(req({ body: { provider: 'google', accessToken: 'x' } }), res);
    expect(res.cuerpo.message).toBe('No se pudo obtener el email desde google');
  });

  test('usuario NUEVO: INSERT con contraseña no verificable, sesión regenerada y 200', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[]],
      'SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO': [[]],
    }, () => [{ insertId: 77 }]);
    authController._useDb({ query: dbq });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(null)) };
    reqFake.login = vi.fn((user, cb) => cb(null));
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.message).toBe('Login social exitoso');
    expect(res.cuerpo.usuario).toMatchObject({ ID_USUARIO: 77, NOMBRE_USUARIO: 'Ana', foto_url: 'https://g.co/avatar.png' });
    expect(verificacionSocial.contrasenaNoVerificable).toHaveBeenCalled();
    expect(reqFake.session.regenerate).toHaveBeenCalledTimes(1);
    expect(reqFake.login).toHaveBeenCalledTimes(1);
  });

  test('usuario EXISTENTE sin confirmar → se confirma y se invalida el TOKEN pendiente', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, CONFIRMADO: 0, FOTO_URL: null }]],
    }, () => [{ affectedRows: 1 }]);
    authController._useDb({ query: dbq });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(null)) };
    reqFake.login = vi.fn((user, cb) => cb(null));
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    expect(res.cuerpo.ok).toBeUndefined();
    expect(res.cuerpo.message).toBe('Login social exitoso');
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET CONFIRMADO = 1'))).toBe(true);
  });

  test('usuario EXISTENTE con foto EXTERNA (Google) → se refresca en cada login', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, CONFIRMADO: 1, FOTO_URL: null }]],
    }, () => [{ affectedRows: 1 }]);
    authController._useDb({ query: dbq });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(null)) };
    reqFake.login = vi.fn((user, cb) => cb(null));
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    const updateFoto = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET FOTO_URL'));
    expect(updateFoto).toBeTruthy();
    expect(updateFoto[1]).toEqual(['https://g.co/avatar.png', 'google', 'google@t.co']);
  });

  test('usuario EXISTENTE con foto PROPIA (/images/...) → NO se pisa, solo AUTH_PROVIDER', async () => {
    const dbq = dbDe({
      'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, CONFIRMADO: 1, FOTO_URL: '/images/usuarios/u7/perfil/perfil-1.png' }]],
    }, () => [{ affectedRows: 1 }]);
    authController._useDb({ query: dbq });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(null)) };
    reqFake.login = vi.fn((user, cb) => cb(null));
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET FOTO_URL'))).toBe(false);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET AUTH_PROVIDER'))).toBe(true);
    expect(res.cuerpo.usuario.foto_url).toBe('/images/usuarios/u7/perfil/perfil-1.png');
  });

  test('regenerate con error → 500 "Error al iniciar sesión"', async () => {
    authController._useDb({ query: dbDe({ 'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, CONFIRMADO: 1 }]] }) });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(new Error('regen caído'))) };
    reqFake.login = vi.fn();
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.message).toBe('Error al iniciar sesión');
    expect(reqFake.login).not.toHaveBeenCalled();
  });

  test('req.login con error → 500 (callback L633)', async () => {
    authController._useDb({ query: dbDe({ 'SELECT * FROM USUARIOS WHERE EMAIL': [[{ ID_USUARIO: 7, CONFIRMADO: 1 }]] }) });
    const reqFake = req({ body: { provider: 'google', accessToken: 'tok' } });
    reqFake.session = { regenerate: vi.fn((cb) => cb(null)) };
    reqFake.login = vi.fn((user, cb) => cb(new Error('passport caído')));
    const res = resFalsa();
    await authController.socialLogin(reqFake, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.message).toBe('Error al iniciar sesión');
  });

  test('fallo de BD → 500 "Error al procesar login social"', async () => {
    authController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await authController.socialLogin(req({ body: { provider: 'google', accessToken: 'tok' } }), res);
    expect(res.cuerpo.message).toBe('Error al procesar login social');
  });
});

describe('actualizarPrivacidad (toggle GUARDAR_HISTORIAL)', () => {
  test('valor no booleano → 400', async () => {
    const res = resFalsa();
    await authController.actualizarPrivacidad(req({ user: { ID_USUARIO: 7 }, body: { guardarHistorial: 'si' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('El valor de guardarHistorial debe ser verdadero o falso');
  });

  test('feliz (true) → UPDATE 1 y devuelve el valor persistido', async () => {
    const dbq = dbDe({
      'UPDATE USUARIOS SET GUARDAR_HISTORIAL': [{ affectedRows: 1 }],
      'SELECT GUARDAR_HISTORIAL FROM USUARIOS': [[{ GUARDAR_HISTORIAL: 1 }]],
    });
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.actualizarPrivacidad(req({ user: { ID_USUARIO: 7 }, body: { guardarHistorial: true } }), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ ok: true, message: 'Ajuste de privacidad actualizado', guardarHistorial: 1 });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET GUARDAR_HISTORIAL'));
    expect(update[1]).toEqual([1, 7]);
  });

  test('usuario sin filas (ID por req.user.id) → 404', async () => {
    authController._useDb({ query: dbDe({ 'UPDATE USUARIOS SET GUARDAR_HISTORIAL': [{ affectedRows: 0 }] }) });
    const res = resFalsa();
    await authController.actualizarPrivacidad(req({ user: { id: 9 }, body: { guardarHistorial: false } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.message).toBe('Usuario no encontrado');
  });

  test('fallo de BD → 500', async () => {
    authController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await authController.actualizarPrivacidad(req({ user: { ID_USUARIO: 7 }, body: { guardarHistorial: true } }), res);
    expect(res.cuerpo.message).toBe('Error al conectar con la base de datos.');
  });
});

describe('logout (callbacks de passport y destroy)', () => {
  test('feliz: logout + destroy + clearCookie + 200', async () => {
    const reqFake = req({});
    reqFake.logout = vi.fn((cb) => cb(null));
    reqFake.session = { destroy: vi.fn((cb) => cb(null)) };
    const res = resFalsa();
    await authController.logout(reqFake, res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ ok: true, message: 'Sesión cerrada correctamente' });
    expect(res.clearCookie).toHaveBeenCalledWith('connect.sid', { path: '/' });
  });

  test('req.logout con error → 500 "Error al cerrar sesión"', async () => {
    const reqFake = req({});
    reqFake.logout = vi.fn((cb) => cb(new Error('passport caído')));
    reqFake.session = { destroy: vi.fn() };
    const res = resFalsa();
    await authController.logout(reqFake, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.message).toBe('Error al cerrar sesión');
    expect(reqFake.session.destroy).not.toHaveBeenCalled();
  });

  test('session.destroy con error → 500 "Error al destruir sesión"', async () => {
    const reqFake = req({});
    reqFake.logout = vi.fn((cb) => cb(null));
    reqFake.session = { destroy: vi.fn((cb) => cb(new Error('sesión huérfana'))) };
    const res = resFalsa();
    await authController.logout(reqFake, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo.message).toBe('Error al destruir sesión');
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});

describe('confirmarCambioEmail (OTP de 2 pasos con contador)', () => {
  const USER = (over = {}) => ({
    EMAIL_PENDIENTE: 'nuevo@t.co', TOKEN: require('bcryptjs').hashSync('654321', 10),
    TOKEN_EXPIRA: '2099-01-01 00:00:00', ID_USUARIO: 7, ...over,
  });

  test('sin correo o código → 400', async () => {
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: {} }), res);
    expect(res.cuerpo.message).toBe('Correo y código son obligatorios');
  });

  test('usuario no encontrado → 404', async () => {
    authController._useDb({ query: dbDe({ 'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[]] }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '654321' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.message).toBe('Usuario no encontrado');
  });

  test('sin solicitud previa (EMAIL_PENDIENTE distinto) → 400 "Primero solicita el cambio."', async () => {
    authController._useDb({ query: dbDe({ 'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER({ EMAIL_PENDIENTE: 'otro@t.co' })]] }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'NUEVO@t.co', codigo: '654321' } }), res);
    expect(res.cuerpo.message).toBe('Primero solicita el cambio de correo.');
  });

  test('código incorrecto → 400 tras registrar el intento', async () => {
    authController._useDb({ query: dbDe({
      'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER()]],
      'SELECT INTENTOS_CODIGO AS INTENTOS': [[{ INTENTOS: 1 }]],
    }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '000000' } }), res);
    expect(res.cuerpo.message).toBe('Código incorrecto o ya utilizado.');
  });

  test('5 intentos fallidos → código invalidado por fuerza bruta', async () => {
    const dbq = dbDe({
      'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER({ TOKEN: null })]],
      'SELECT INTENTOS_CODIGO AS INTENTOS': [[{ INTENTOS: 5 }]],
    });
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '000000' } }), res);
    expect(res.cuerpo.message).toBe('Demasiados intentos con código incorrecto. Solicita un código nuevo.');
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET TOKEN = NULL'))).toBe(true);
  });

  test('código expirado → 400', async () => {
    authController._useDb({ query: dbDe({ 'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER({ TOKEN_EXPIRA: '2020-01-01' })]] }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '654321' } }), res);
    expect(res.cuerpo.message).toBe('El código ha expirado.');
  });

  test('feliz: EMAIL actualizado y temporales limpiados', async () => {
    const dbq = dbDe({
      'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER()]],
    }, () => [{ affectedRows: 1 }]);
    authController._useDb({ query: dbq });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'NUEVO@t.co', codigo: '654321' } }), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toEqual({ ok: true, message: 'Correo actualizado correctamente' });
    const update = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS SET EMAIL'));
    expect(update[1]).toEqual(['nuevo@t.co', 7]); // normalizado a minúsculas
  });

  test('correo duplicado (ER_DUP_ENTRY) → 409', async () => {
    const err = new Error('dup'); err.code = 'ER_DUP_ENTRY';
    authController._useDb({ query: dbDe({
      'SELECT TOKEN, TOKEN_EXPIRA, EMAIL_PENDIENTE': [[USER()]],
    }, () => { throw err; }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '654321' } }), res);
    expect(res.codigo).toBe(409);
    expect(res.cuerpo.message).toBe('Ese correo ya está registrado por otro usuario');
  });

  test('fallo genérico → 500', async () => {
    authController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await authController.confirmarCambioEmail(req({ user: { ID_USUARIO: 7 }, body: { email: 'nuevo@t.co', codigo: '654321' } }), res);
    expect(res.cuerpo.message).toBe('Error al confirmar el cambio de correo');
  });
});

describe('subirFotoPerfil (magic bytes, Cloudinary, local y recorrido)', () => {
  test('sin foto → 400 "No se envió ninguna foto"', async () => {
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: {} }), res);
    expect(res.cuerpo.message).toBe('No se envió ninguna foto');
  });

  test('data-URI con formato no listado → 400 formato', async () => {
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: 'data:application/pdf;base64,AAAA' } }), res);
    expect(res.cuerpo.message).toBe('Formato de imagen no válido (jpg, png, webp, gif)');
  });

  test('MIME declarado ≠ contenido real (declara png, bytes jpeg) → 400', async () => {
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', JPEG) } }), res);
    expect(res.cuerpo.message).toBe('El contenido del archivo no corresponde a una imagen válida');
  });

  test('Cloudinary configurado → sube y devuelve la URL remota', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', PNG) } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, url: 'https://res.cloudinary.com/perfil.png' });
    expect(cloudinary.carpetaSegura).toHaveBeenCalledWith('perfiles', 'u7');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('Cloudinary falla → guarda local con limpieza de fotos anteriores', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    cloudinary.subirDataUri.mockImplementation(async () => { throw new Error('503 cloud'); });
    fs.readdirSync = vi.fn(() => ['perfil.jpg', 'perfil-123.png', 'otra.jpg']);
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', PNG) } }), res);
    expect(res.cuerpo.url).toMatch(/^\/images\/usuarios\/u7\/perfil\/perfil-\d+\.png$/);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2); // solo las fotos con patrón perfil*
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('sin Cloudinary (por defecto) → escritura local directa', async () => {
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', PNG) } }), res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.url).toMatch(/^\/images\/usuarios\/u7\/perfil\/perfil-\d+\.png$/);
    expect(cloudinary.subirDataUri).not.toHaveBeenCalled();
  });

  test('clave con recorrido de rutas → 400 "Carpeta de usuario no válida" sin escribir', async () => {
    const claveReal = carpetaUsuario.claveDeReq;
    carpetaUsuario.claveDeReq = () => '../../escape';
    try {
      const res = resFalsa();
      await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', PNG) } }), res);
      expect(res.codigo).toBe(400);
      expect(res.cuerpo.message).toBe('Carpeta de usuario no válida');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    } finally {
      carpetaUsuario.claveDeReq = claveReal;
    }
  });

  test('fallo de escritura → 500 "Error al guardar la foto"', async () => {
    fs.writeFileSync = vi.fn(() => { throw new Error('disco lleno'); });
    const res = resFalsa();
    await authController.subirFotoPerfil(req({ user: { USUARIO: 'u7', ID_USUARIO: 7 }, body: { foto: dataUri('image/png', PNG) } }), res);
    expect(res.cuerpo.message).toBe('Error al guardar la foto');
  });
});

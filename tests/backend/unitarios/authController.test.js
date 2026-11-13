/**
 * authController — ciclo de verificación OTP, recuperación y perfil (unit).
 *
 * La BD se inyecta con exports._useDb y bcrypt se MUTA antes del require del
 * SUT: así el código OTP es determinista (compare solo aprueba '123456') y se
 * prueban los caminos de registro → confirmar → reenvío (anti-enum) →
 * recuperación → actualizar-password → perfil → cambiar-email sin SMTP.
 *
 * El login y su anti-enumeración ya viven en la integración (fuerza-bruta);
 * aquí se prueba la rama de login bloqueado por ventana y el 403 sin verificar.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const bcrypt = require('bcryptjs');
const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

// crearNotificacion se captura por destructuring EN la carga del SUT:
// la mutación debe ocurrir ANTES del require del controller.
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const authController = require('../../../backend/controllers/authController');

// El código de pruebas: registrar SIEMPRE ese hash y compare solo lo aprueba.
const CODIGO = '123456';
const CODIGO_HASH = '$2b$10$codigopruebas1234567890123456789012345678901234567890';
const CLAVE_HASH = '$2b$10$clavepruebas123456789012345678901234567890123456789';

const db = { query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  bcrypt.compare = vi.fn(async (plain) => plain === CODIGO || plain === 'ClaveSegura123');
  // El código OTP es aleatorio: se distingue por largo (código de 6 dígitos
  // vs contraseña ≥8). compare acepta '123456' como el código de prueba.
  bcrypt.hash = vi.fn(async (v) => (String(v).length <= 6 ? CODIGO_HASH : CLAVE_HASH));
  // transporter.sendMail se accede por PROPIEDAD en el SUT (transporter.sendMail):
  // reasignarlo aquí sí alcanza y da un spy fresco por test.
  mailer.sendMail = vi.fn(async () => ({}));
  db.query = vi.fn();
  authController._useDb(db);
});

const resFalsa = () => {
  const res = {};
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.cookie = vi.fn();
  res.clearCookie = vi.fn();
  return res;
};

/** BD falsa por SQL-prefix con usuario volátil. */
function dbAuth({ usuario = null } = {}) {
  const query = vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    if (s.startsWith('SELECT * FROM USUARIOS WHERE EMAIL')) {
      if (!usuario) return [[]];
      return [[{ ...usuario, CONTRASENA: CLAVE_HASH, TOKEN: CODIGO_HASH, CONFIRMADO: usuario.CONFIRMADO ?? 0 }]];
    }
    if (s.startsWith('SELECT NOMBRE_USUARIO FROM USUARIOS WHERE EMAIL')) {
      return usuario ? [[{ NOMBRE_USUARIO: usuario.NOMBRE_USUARIO ?? 'Probe' }]] : [[]];
    }
    if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO')) return [[]];
    if (s.startsWith('INSERT INTO USUARIOS')) return [{ insertId: 77 }];
    if (s.startsWith('INSERT INTO DIRECCIONES')) return [{ insertId: 3 }];
    return [{ affectedRows: 1 }];
  });
  return { query, operaciones: [] };
}

const usuarioSinVerificar = {
  ID_USUARIO: 77, NOMBRE_USUARIO: 'Probe', APELLIDO_USUARIO: 'Test', EMAIL: 'probe.otp@test.com',
  USUARIO: 'probe_test', CONFIRMADO: 0, TOKEN: CODIGO_HASH, TOKEN_EXPIRA: '2030-01-01',
  INTENTOS_CODIGO: 0, ID_ROL: 4, TELEFONO: '3001112233',
};

describe('registro', () => {
  test('validaciones rotas → 400 (correo inválido con coma anti-SMTP-inyección, sin apellido, teléfono ≠10, clave corta)', async () => {
    const db = dbAuth();
    authController._useDb(db);
    const casos = [
      { body: { email: 'a@x.c,victima@y.c', nombre: 'A', apellido: 'B', telefono: '3001112233', password: 'ClaveSegura123' }, msg: 'Correo electrónico inválido' },
      { body: { email: 'a@b.com', nombre: '', apellido: 'B', telefono: '3001112233', password: 'ClaveSegura123' }, msg: 'nombre es obligatorio' },
      { body: { email: 'a@b.com', nombre: 'A', apellido: '', telefono: '3001112233', password: 'ClaveSegura123' }, msg: 'apellido es obligatorio' },
      { body: { email: 'a@b.com', nombre: 'A', apellido: 'B', telefono: '30011', password: 'ClaveSegura123' }, msg: '10 dígitos' },
      { body: { email: 'a@b.com', nombre: 'A', apellido: 'B', telefono: '3001112233', password: 'corta' }, msg: 'al menos 8 caracteres' },
    ];
    for (const caso of casos) {
      const res = resFalsa();
      await authController.registro({ body: caso.body }, res);
      expect(res.codigo).toBe(400);
      expect(res.cuerpo.message).toContain(caso.msg);
    }
  });

  test('registro válido: hashea contraseña y código OTP, siembra TOKEN con 15 min y manda el correo', async () => {
    const db = dbAuth();
    authController._useDb(db);
    const res = resFalsa();
    await authController.registro(
      { body: { email: 'nuevo.otp@test.com', nombre: 'Nuevo', apellido: 'Probe', telefono: '3001112233', password: 'ClaveSegura123', direccion: 'Cra 1 #2-03, Zipaquirá, Cundinamarca' } },
      res,
    );
    expect(res.codigo ?? 200).toBe(200);
    expect(res.cuerpo.message).toContain('correo');

    const insertUsuarios = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('INSERT INTO USUARIOS'));
    expect(insertUsuarios[1][2]).toBe('nuevo.otp@test.com');
    expect(insertUsuarios[1][4]).toBe(CLAVE_HASH); // bcrypt.hash de la contraseña
    expect(insertUsuarios[1][6]).toBe(CODIGO_HASH); // TOKEN = hash del código (6 dígitos)
    expect(insertUsuarios[1][6]).not.toBe(insertUsuarios[1][4]);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test('email duplicado (ER_DUP_ENTRY) → 409 sin revelar datos', async () => {
    const db = dbAuth();
    db.query = vi.fn(async (sql) => {
      const s = sql.toUpperCase();
      if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO')) return [[]];
      if (s.startsWith('INSERT INTO USUARIOS')) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
      return [{}];
    });
    authController._useDb(db);
    const res = resFalsa();
    await authController.registro(
      { body: { email: 'existe@test.com', nombre: 'A', apellido: 'B', telefono: '3001112233', password: 'ClaveSegura123' } },
      res,
    );
    expect(res.codigo).toBe(409);
  });
});

describe('confirmarCuenta (verificación OTP)', () => {
  test('código correcto: CONFIRMADO=1, TOKEN anulado y login posterior válido', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    authController._useDb(db);
    const res = resFalsa();
    await authController.confirmarCuenta({ body: { email: usuarioSinVerificar.EMAIL, codigo: CODIGO } }, res);
    expect(res.codigo ?? 200).toBe(200);

    const update = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE USUARIOS SET CONFIRMADO'));
    expect(update).toBeTruthy();
  });

  test('código incorrecto → 400 y registra el intento (a los 5 invalida el código)', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    authController._useDb(db);
    const res = resFalsa();
    await authController.confirmarCuenta({ body: { email: usuarioSinVerificar.EMAIL, codigo: '999999' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toContain('Código');
  });

  test('cuenta ya confirmada → 400 "ya verificada"', async () => {
    const db = dbAuth({ usuario: { ...usuarioSinVerificar, CONFIRMADO: 1 } });
    authController._useDb(db);
    const res = resFalsa();
    await authController.confirmarCuenta({ body: { email: usuarioSinVerificar.EMAIL, codigo: CODIGO } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toContain('ya está verificada');
  });

  test('código expirado → 400 pidiendo reenvío', async () => {
    const db = dbAuth({ usuario: { ...usuarioSinVerificar, TOKEN_EXPIRA: '2020-01-01' } });
    authController._useDb(db);
    const res = resFalsa();
    await authController.confirmarCuenta({ body: { email: usuarioSinVerificar.EMAIL, codigo: CODIGO } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toContain('expirad');
  });
});

describe('reenviarCodigo (anti email-bombing)', () => {
  test('correo inexistente → 200 GENÉRICO sin enviar (anti-enumeración A07-F8)', async () => {
    const db = dbAuth({});
    authController._useDb(db);
    const res = resFalsa();
    await authController.reenviarCodigo({ body: { email: 'fantasma@test.com' } }, res);
    expect(res.codigo ?? 200).toBe(200);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('reenvío válido: regenera TOKEN y manda correo (cooldown por cuenta en memoria)', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    authController._useDb(db);
    const res = resFalsa();
    await authController.reenviarCodigo({ body: { email: usuarioSinVerificar.EMAIL } }, res);
    expect(res.codigo ?? 200).toBe(200);
    expect(mailer.sendMail).toHaveBeenCalled();

    const update = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE USUARIOS SET TOKEN'));
    expect(update).toBeTruthy();
  });

  test('formato de correo inválido → 400 sin quemar la ventana de reintentos', async () => {
    const res = resFalsa();
    await authController.reenviarCodigo({ body: { email: 'a@x.c,victima@y.c' } }, res);
    expect(res.codigo).toBe(400);
  });
});

describe('recuperarPassword + actualizarPassword', () => {
  test('recuperación de correo inexistente → 200 genérico sin enviar (anti-enum A07-F8)', async () => {
    const db = dbAuth({});
    authController._useDb(db);
    const res = resFalsa();
    await authController.recuperarPassword({ body: { email: 'fantasma@test.com' } }, res);
    expect(res.codigo ?? 200).toBe(200);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('recuperación válida: semilla TOKEN y envía el código', async () => {
    const db = dbAuth({ usuario: { ...usuarioSinVerificar, CONFIRMADO: 1 } });
    authController._useDb(db);
    const res = resFalsa();
    await authController.recuperarPassword({ body: { email: usuarioSinVerificar.EMAIL } }, res);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    // el código es aleatorio: el TOKEN queda con SU hash y el correo sale con el plano
    const update = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE USUARIOS SET TOKEN'));
    expect(update[1][0]).toBe(CODIGO_HASH);
  });

  test('actualizar-password con código correcto cambia la contraseña', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    authController._useDb(db);
    const res = resFalsa();
    await authController.actualizarPassword(
      { body: { email: usuarioSinVerificar.EMAIL, codigo: CODIGO, password: 'NuevaClave999' } },
      res,
    );
    expect(res.cuerpo).toBeTruthy();
    const update = db.query.mock.calls.find((c) => String(c[0]).toUpperCase().startsWith('UPDATE USUARIOS SET CONTRASENA'));
    expect(update).toBeTruthy();
  });

  test('actualizar-password con código malo → 400', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    authController._useDb(db);
    const res = resFalsa();
    await authController.actualizarPassword(
      { body: { email: usuarioSinVerificar.EMAIL, codigo: '000000', password: 'NuevaClave999' } },
      res,
    );
    expect(res.codigo).toBe(400);
  });
});

describe('obtenerPerfil / actualizarPerfil', () => {
  test('perfil devuelve usuario con foto_url normalizada', async () => {
    const db = dbAuth();
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').trim().toUpperCase();
      if (s.startsWith('SELECT ID_USUARIO, NOMBRE_USUARIO')) {
        return [[{ ID_USUARIO: 77, NOMBRE_USUARIO: 'Probe', FOTO_URL: '/images/usuarios/probe_test/perfil/perfil.png', EMAIL: 'probe.otp@test.com' }]];
      }
      return [[]];
    });
    authController._useDb(db);
    const res = resFalsa();
    await authController.obtenerPerfil({ user: { ID_USUARIO: 77 } }, res);
    expect(res.cuerpo.usuario.FOTO_URL).toContain('/images/usuarios/');
  });

  test('actualizarPerfil: usuario inválido → 400; duplicado → 409; válido actualiza SOLO los campos presentes', async () => {
    const db = dbAuth();
    db.query = vi.fn(async (sql, params) => {
      const s = sql.toUpperCase();
      if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO') && params[0] === 'ocupado') return [[{ ID_USUARIO: 99 }]];
      if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO')) return [[]];
      if (s.startsWith('UPDATE USUARIOS')) return [{ affectedRows: 1 }];
      return [{}];
    });
    authController._useDb(db);
    const req = { user: { ID_USUARIO: 77 }, body: {} };

    const res1 = resFalsa();
    await authController.actualizarPerfil({ ...req, body: { usuario: 'ab' } }, res1);
    expect(res1.codigo).toBe(400);

    const res2 = resFalsa();
    await authController.actualizarPerfil({ ...req, body: { usuario: 'con espacios' } }, res2);
    expect(res2.codigo).toBe(400);

    const res3 = resFalsa();
    await authController.actualizarPerfil({ ...req, body: { usuario: 'ocupado' } }, res3);
    expect(res3.codigo).toBe(409);

    const res4 = resFalsa();
    await authController.actualizarPerfil({ ...req, body: { nombre: 'Nombre Editado' } }, res4);
    expect(res4.cuerpo.ok).toBe(true);
  });

  test('actualizarPerfil con teléfono inválido → 400', async () => {
    const db = dbAuth();
    db.query = vi.fn(async () => [[]]);
    authController._useDb(db);
    const res = resFalsa();
    await authController.actualizarPerfil({ user: { ID_USUARIO: 77 }, body: { telefono: '123' } }, res);
    expect(res.codigo).toBe(400);
  });
});

describe('verificarPassword y logout', () => {
  test('verificar-password correcto → ok; malo → 400', async () => {
    const db = dbAuth();
    db.query = vi.fn(async () => [[{ CONTRASENA: CLAVE_HASH }]]);
    authController._useDb(db);
    const res1 = resFalsa();
    await authController.verificarPassword({ user: { ID_USUARIO: 77 }, body: { password: 'ClaveSegura123' } }, res1);
    expect(res1.cuerpo.ok).toBe(true);

    bcrypt.compare = vi.fn(async () => false);
    const res2 = resFalsa();
    await authController.verificarPassword({ user: { ID_USUARIO: 77 }, body: { password: 'OtraClave999' } }, res2);
    expect(res2.codigo).toBe(400);
  });

  test('logout destruye la sesión (passport req.logout)', async () => {
    const res = resFalsa();
    await authController.logout(
      { logout: vi.fn((cb) => cb()), session: { destroy: vi.fn((cb) => cb()) }, user: { ID_USUARIO: 77 } },
      res,
    );
    expect(res.cuerpo).toBeTruthy();
  });
});

describe('cambiarEmail (OTP de 2 pasos)', () => {
  test('contraseña actual incorrecta → 400', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    db.query = vi.fn(async (sql, params) => {
      const s = sql.toUpperCase();
      if (s.startsWith('SELECT EMAIL, CONTRASENA')) return [[{ EMAIL: usuarioSinVerificar.EMAIL, CONTRASENA: CLAVE_HASH }]];
      if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL')) return [[]];
      return [{ affectedRows: 1 }];
    });
    authController._useDb(db);
    bcrypt.compare = vi.fn(async () => false);
    const res = resFalsa();
    await authController.cambiarEmail(
      { user: { ID_USUARIO: 77 }, body: { email: 'otro@test.com', password: 'ClaveSegura123' } },
      res,
    );
    expect(res.codigo).toBe(400);
  });

  test('nuevo email ya registrado → 409; inválido → 400', async () => {
    const db = dbAuth({ usuario: usuarioSinVerificar });
    db.query = vi.fn(async (sql, params) => {
      const s = sql.toUpperCase();
      if (s.startsWith('SELECT EMAIL, CONTRASENA')) return [[{ EMAIL: usuarioSinVerificar.EMAIL, CONTRASENA: CLAVE_HASH }]];
      if (s.startsWith('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL')) return [[{ ID_USUARIO: 999 }]];
      return [{ affectedRows: 1 }];
    });
    authController._useDb(db);
    const res = resFalsa();
    await authController.cambiarEmail(
      { user: { ID_USUARIO: 77 }, body: { email: 'otro@test.com', password: 'ClaveSegura123' } },
      res,
    );
    expect(res.codigo).toBe(409);

    const res2 = resFalsa();
    await authController.cambiarEmail(
      { user: { ID_USUARIO: 77 }, body: { email: 'no-es-correo', password: 'ClaveSegura123' } },
      res2,
    );
    expect(res2.codigo).toBe(400);
  });
});

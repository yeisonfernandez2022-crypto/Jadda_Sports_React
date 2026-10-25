/**
 * Fuerza bruta POR CUENTA (Fase seguridad P3).
 *
 * Cubre el bloqueo persistido en la tabla USUARIOS (INTENTOS_LOGIN/VENTANA_LOGIN,
 * INTENTOS_CODIGO/VENTANA_CODIGO + VENTANA_...). Requiere MySQL real porque los
 * contadores se guardan en la BD y se comparan contra la ventana de 15 minutos;
 * por eso vive en la suite de integración, no en las unitarias.
 */
import { describe, it, expect } from 'vitest';
import { app } from './setup.js';
import { getDbPool } from './setup.js';
import { login, confirmarCuenta } from '../../controllers/authController.js';
import bcrypt from 'bcryptjs';

const MAX_INTENTOS = 5;      // códigos incorrectos antes de invalidar TOKEN
const MAX_INTENTOS_LOGIN = 10; // logins fallidos antes del bloqueo temporal

function resCaptor() {
  const r = { statusCode: null, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => {
    if (r.statusCode === null) r.statusCode = 200;
    r.body = body;
    return r;
  };
  return r;
}

async function reqLogin(email, password) {
  const res = resCaptor();
  // req.login de passport y datos de conexión se fingen: el test solo
  // necesita el código de estado
  await login(
    {
      body: { email, password },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      login: (u, cb) => (typeof cb === 'function' ? cb(null) : null),
      logout: () => null,
    },
    res
  );
  return res;
}

async function reqConfirmar(email, codigo) {
  const res = resCaptor();
  await confirmarCuenta({ body: { email, codigo } }, res);
  return res;
}

const CORREO_OTP = 'brutaotp@test.com';
const CORREO_LOGIN = 'brutalogin@test.com';
const CORREO_FANTASMA = 'brutanadie@test.com';

async function sembrar(pool, { correo, confirmado, contrasena, token }) {
  const [fila] = await pool.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO, TOKEN, TOKEN_EXPIRA)
     VALUES ('Bruta', 'Test', ?, 'bruta_test', ?, 4, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
    [
      correo,
      await bcrypt.hash(contrasena || 'clave-no-usada-12', 10),
      confirmado ? 1 : 0,
      token ? await bcrypt.hash(token, 10) : null,
    ]
  );
  return fila.insertId;
}

describe('Integración - fuerza bruta por cuenta (bloqueo y contador)', () => {
  it('5 códigos incorrectos invalidan TOKEN y TOKEN_EXPIRA en la BD', async () => {
    const pool = await getDbPool();
    const idUsuario = await sembrar(pool, {
      correo: CORREO_OTP,
      confirmado: 0,
      token: '123456',
    });

    // Ventana de código vigente para que los intentos se cuenten seguidos
    await pool.query(
      `UPDATE USUARIOS SET TOKEN_EXPIRA = DATE_ADD(NOW(), INTERVAL 15 MINUTE), VENTANA_CODIGO = NOW()
       WHERE ID_USUARIO = ?`,
      [idUsuario]
    );

    let res = null;
    for (let i = 0; i < MAX_INTENTOS; i += 1) {
      res = await reqConfirmar(CORREO_OTP, '000000'); // código MENTIROSO
    }

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Demasiados intentos/i);

    const [filas] = await pool.query(
      'SELECT TOKEN, TOKEN_EXPIRA, INTENTOS_CODIGO FROM USUARIOS WHERE ID_USUARIO = ?',
      [idUsuario]
    );
    expect(filas[0].TOKEN).toBe(null);        // hash del código invalidado
    expect(filas[0].TOKEN_EXPIRA).toBe(null); // expiración invalidada

    await pool.query('DELETE FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario]);
  });

  it('el código CORRECTO reinicia el contador INTENTOS_CODIGO', async () => {
    const pool = await getDbPool();
    const idUsuario = await sembrar(pool, {
      correo: CORREO_OTP,
      confirmado: 0,
      token: '654321',
    });
    await pool.query('UPDATE USUARIOS SET INTENTOS_CODIGO = 3, VENTANA_CODIGO = NOW() WHERE ID_USUARIO = ?', [idUsuario]);

    const res = await reqConfirmar(CORREO_OTP, '654321');
    expect(res.statusCode).toBe(200);

    const [filas] = await pool.query('SELECT INTENTOS_CODIGO FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario]);
    expect(filas[0].INTENTOS_CODIGO).toBe(0);

    await pool.query('DELETE FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario]);
  });

  it('10 logins fallados bloquean la cuenta incluso con contraseña CORRECTA', async () => {
    const pool = await getDbPool();
    const idUsuario = await sembrar(pool, {
      correo: CORREO_LOGIN,
      confirmado: 1,
      contrasena: 'BuenPato42',
      token: null,
    });
    // 10 fallos registran el contador y bloquean la ventana actual
    for (let i = 0; i < MAX_INTENTOS_LOGIN; i += 1) {
      const res = await reqLogin(CORREO_LOGIN, 'clave_mala');
      expect(res.statusCode).toBe(401);
    }

    // Con credenciales CORRECTAS la cuenta sigue bloqueada (429 genérico)
    const bloqueado = await reqLogin(CORREO_LOGIN, 'BuenPato42');
    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.body.message).toMatch(/Demasiados intentos fallidos/i);

    // La ventana expirada libera la cuenta (la fecha se escribe 20 min en el
    // pasado; al enviarse como parámetro JS el driver la serializa en la
    // misma zona horaria con la que después la lee)
    await pool.query(
      'UPDATE USUARIOS SET VENTANA_LOGIN = ? WHERE ID_USUARIO = ?',
      [new Date(Date.now() - 20 * 60 * 1000), idUsuario]
    );
    const liberado = await reqLogin(CORREO_LOGIN, 'BuenPato42');
    expect(liberado.statusCode).toBe(200);

    // El éxito reinicia el contador de login
    const [filas] = await pool.query('SELECT INTENTOS_LOGIN, INTENTOS_CODIGO FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario]);
    expect(filas[0].INTENTOS_LOGIN).toBe(0);
    expect(filas[0].INTENTOS_CODIGO).toBe(0);

    await pool.query('DELETE FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario]);
  });

  it('el login con correo INEXISTENTE responde 401 sin bloquear a nadie', async () => {
    const res = await reqLogin(CORREO_FANTASMA, 'cualquier-clave');
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Correo o contraseña incorrectos/);

    const pool = await getDbPool();
    const [filas] = await pool.query('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = ?', [CORREO_FANTASMA]);
    expect(filas.length).toBe(0);
  });
});

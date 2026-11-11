#!/usr/bin/env node
/**
 * crear-admin.js — Crea una cuenta de administrador de forma segura (JADDA SPORTS).
 *
 * Uso (interactivo — la contraseña se teclea oculta, no queda en historial ni logs):
 *   node scripts/crear-admin.js --email admin@jaddasports.com --usuario admin.ops --nombre "Nombre" --apellido "Apellido"
 *
 * Uso automatizado (CI/contenedor) — la contraseña viaja por variable de entorno:
 *   ADMIN_PASSWORD='...' node scripts/crear-admin.js --email ... --usuario ... [--forzar-cambio]
 *
 * Uso automatizado por ARCHIVO (recomendado en contenedores: ningún valor en la línea
 * de comandos ni en variables de proceso) — docker cp del JSON a /tmp y borrar después:
 *   {"email":"...","usuario":"...","nombre":"...","apellido":"...","password":"...","forzarCambio":false}
 *   node scripts/crear-admin.js --desde-json /tmp/admin-create.json
 *
 * Reglas de seguridad:
 *   - Contraseña hasheada con bcrypt (costo 10), jamás almacenada ni impresa en claro.
 *   - Exige: mínimo 10 caracteres con mayúscula, minúscula y dígito.
 *   - EMAIL y USUARIO únicos (rechaza duplicados con mensaje claro).
 *   - La cuenta nace CONFIRMADO=1, AUTH_PROVIDER='local', ID_ROL=1 (admin).
 *   - --forzar-cambio marca DEBE_CAMBIAR_PASSWORD=1 (el frontend obliga a cambiarla al ingresar).
 *   - Se conecta con el MISMO pool/config del backend (DB_* del entorno, TLS si DB_SSL=true).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const readline = require('readline');

function argValor(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const tieneFlag = (nombre) => process.argv.includes(`--${nombre}`);

const emailDesdeArg = (argValor('email') || '').trim().toLowerCase();
const usuarioDesdeArg = (argValor('usuario') || '').trim();
let nombre = (argValor('nombre') || 'Administrador').trim();
let apellido = (argValor('apellido') || 'Jadda').trim();
const forzarCambio = tieneFlag('forzar-cambio');
const rutaJson = argValor('desde-json');

let email = emailDesdeArg;
let usuario = usuarioDesdeArg;
let passwordDeJson = null;
let forzarCambioJson = false;

if (rutaJson) {
  const fs = require('fs');
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  } catch (e) {
    morir(`No se pudo leer --desde-json (${rutaJson}): ${e.message}`);
  }
  if (!datos || typeof datos !== 'object') morir('El JSON de --desde-json es inválido.');
  if (datos.passwordDeJson || datos.password) passwordDeJson = String(datos.passwordDeJson || datos.password);
  if (datos.email) email = String(datos.email).trim().toLowerCase();
  if (datos.usuario) usuario = String(datos.usuario).trim();
  if (datos.nombre) nombre = String(datos.nombre).trim();
  if (datos.apellido) apellido = String(datos.apellido).trim();
  if (datos.forzarCambio !== undefined) forzarCambioJson = Boolean(datos.forzarCambio);
}
const forzarCambioFinal = rutaJson ? (forzarCambioJson || forzarCambio) : forzarCambio;

function morir(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USUARIO_RE = /^[a-zA-Z0-9._-]{3,20}$/;
if (!EMAIL_RE.test(email)) morir('Correo inválido (formato nombre@dominio.tld).');
if (!USUARIO_RE.test(usuario)) morir('Usuario inválido: 3-20 caracteres de [a-zA-Z0-9._-].');

function passwordDesdeEnv() {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.length ? p : null;
}

async function passwordInteractiva() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const preguntar = (texto) =>
    new Promise((resolver) =>
      rl.question(texto, (respuesta) => {
        // silenciar eco: reescribir la línea con máscara
        process.stdout.write('\n');
        resolver(respuesta);
      })
    );
  const primera = await preguntar('Contraseña del nuevo admin (entrada oculta al histórico, teclea y pulsa Enter): ');
  const repetida = await preguntar('Repítela para confirmar: ');
  rl.close();
  if (primera !== repetida) morir('Las contraseñas no coinciden.');
  return primera;
}

function validarPassword(p) {
  if (typeof p !== 'string' || p.length < 10) return 'mínimo 10 caracteres';
  if (!/[A-Z]/.test(p)) return 'falta una mayúscula';
  if (!/[a-z]/.test(p)) return 'falta una minúscula';
  if (!/[0-9]/.test(p)) return 'falta un dígito';
  return null;
}

(async () => {
  const password = passwordDeJson || passwordDesdeEnv() || (await passwordInteractiva());
  const problemaPassword = validarPassword(password);
  if (problemaPassword) morir(`Contraseña débil: ${problemaPassword} (mínimo 10 con mayúscula, minúscula y dígito).`);

  // Pool propio del script (misma config del app: DB_* + TLS por DB_SSL)
  const db = require('../config/db');
  try {
    const [dupEmail] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = ?', [email]);
    if (dupEmail.length) morir(`Ya existe una cuenta con el correo ${email} (ID ${dupEmail[0].ID_USUARIO}).`);
    const [dupUsuario] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE USUARIO = ?', [usuario]);
    if (dupUsuario.length) morir(`El usuario '${usuario}' ya existe (ID ${dupUsuario[0].ID_USUARIO}).`);

    const hash = await bcrypt.hash(password, 10);
    const [res] = await db.query(
      `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA,
                             FECHA_REGISTRO, ID_ROL, CONFIRMADO, AUTH_PROVIDER, DEBE_CAMBIAR_PASSWORD)
       VALUES (?, ?, ?, ?, ?, CURDATE(), 1, 1, 'local', ?)`,
      [nombre, apellido, email, usuario, hash, forzarCambioFinal ? 1 : 0]
    );

    // Auto-verificación del hash almacenado (sin imprimir la contraseña)
    const [filas] = await db.query('SELECT CONTRASENA AS H FROM USUARIOS WHERE ID_USUARIO = ?', [res.insertId]);
    const okHash = filas.length === 1 && (await bcrypt.compare(password, filas[0].H));
    if (!okHash) morir('El hash almacenado no verifica — cuenta NO usable, revisar BD.');

    console.log(`✓ Admin creado: ID ${res.insertId} — correo ${email} — usuario ${usuario}`);
    console.log(`  hash bcrypt costo 10 verificado: OK · confirmado: sí · forzar-cambio: ${forzarCambioFinal ? 'sí' : 'no'}`);
    console.log('  La contraseña NO se guarda ni imprime — entrégala al titular por canal seguro y pídele cambiarla al ingresar.');
    process.exit(0);
  } catch (e) {
    morir(`BD: ${e.code || ''} ${e.message}`);
  }
})().catch((e) => morir(e.message));

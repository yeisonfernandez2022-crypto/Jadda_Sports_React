/**
 * carpetaUsuario: clave de carpeta por usuario (a-z0-9._-, minúsculas,
 * saneada; fallback u{ID}). El bind-mount sirve estas carpetas.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { claveDeUsuario, claveDeReq, USUARIOS_DIR } = require('../../../backend/utils/carpetaUsuario');

describe('claveDeUsuario', () => {
  test('minúsculas y conserva el juego permitido', () => {
    expect(claveDeUsuario('Admin_Admin')).toBe('admin_admin');
    expect(claveDeUsuario('yeisonfernandez2022-crypto')).toBe('yeisonfernandez2022-crypto');
  });

  test('caracteres raros fuera: se sustituyen por _', () => {
    expect(claveDeUsuario('Usuario Con Espacios')).toBe('usuario_con_espacios');
  });

  test('sin nombre útil → fallback u{ID} (o ux sin id)', () => {
    expect(claveDeUsuario('', 42)).toBe('u42');
    expect(claveDeUsuario('   ')).toBe('ux');
    expect(claveDeUsuario(null)).toBe('ux');
  });

  test('recorte de "._-" en bordes (el cuerpo no se mutila)', () => {
    expect(claveDeUsuario('..admin..')).toBe('admin');
    expect(claveDeUsuario('-pepe-')).toBe('pepe');
  });
});

describe('claveDeReq', () => {
  test('usa USUARIO del req.user', () => {
    expect(claveDeReq({ user: { USUARIO: 'Pepe_Garcia' } })).toBe('pepe_garcia');
  });

  test('fallback u{ID} cuando no hay USUARIO', () => {
    expect(claveDeReq({ user: { ID_USUARIO: 42 } })).toBe('u42');
    expect(claveDeReq({})).toBe('ux');
  });
});

describe('USUARIOS_DIR', () => {
  test('apunta a uploads/usuarios (bind-mount de frontend/public/images/usuarios)', () => {
    expect(USUARIOS_DIR.replace(/\\/g, '/')).toMatch(/uploads\/usuarios$/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  generarTokenDesuscripcion,
  tokenDesuscripcionValido,
} from '../../../backend/utils/desuscripcionToken.js';

describe('desuscripcionToken', () => {
  it('genera un token hexadecimal de 64 caracteres', () => {
    expect(generarTokenDesuscripcion('usuario@test.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista para el mismo correo', () => {
    expect(generarTokenDesuscripcion('usuario@test.com')).toBe(
      generarTokenDesuscripcion('usuario@test.com')
    );
  });

  it('genera tokens distintos para correos distintos', () => {
    expect(generarTokenDesuscripcion('a@test.com')).not.toBe(
      generarTokenDesuscripcion('b@test.com')
    );
  });

  it('valida el token correcto', () => {
    const token = generarTokenDesuscripcion('usuario@test.com');
    expect(tokenDesuscripcionValido('usuario@test.com', token)).toBe(true);
  });

  it('no distingue mayúsculas del correo (se normaliza a minúsculas)', () => {
    const token = generarTokenDesuscripcion('usuario@test.com');
    expect(tokenDesuscripcionValido('USUARIO@TEST.COM', token)).toBe(true);
  });

  it('rechaza un token incorrecto', () => {
    const token = generarTokenDesuscripcion('usuario@test.com');
    expect(tokenDesuscripcionValido('usuario@test.com', 'a'.repeat(64))).toBe(false);
  });

  it('rechaza el token de otro correo', () => {
    const token = generarTokenDesuscripcion('a@test.com');
    expect(tokenDesuscripcionValido('b@test.com', token)).toBe(false);
  });

  it('rechaza token vacío, no-string o ausente', () => {
    expect(tokenDesuscripcionValido('usuario@test.com', '')).toBe(false);
    expect(tokenDesuscripcionValido('usuario@test.com', null)).toBe(false);
    expect(tokenDesuscripcionValido('usuario@test.com', undefined)).toBe(false);
    expect(tokenDesuscripcionValido('usuario@test.com', 12345)).toBe(false);
  });

  it('falla cerrado cuando falta el secreto (SESSION_SECRET ausente)', () => {
    const secretoOriginal = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(tokenDesuscripcionValido('usuario@test.com', 'x')).toBe(false);
    } finally {
      process.env.SESSION_SECRET = secretoOriginal;
    }
  });
});

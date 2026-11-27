import { describe, it, expect } from 'vitest';
import { mensajeDeError } from '../../../frontend/src/utils/mensajeApi';

/*
 * Contrato de lectura de errores del API (ARQ-5): el backend histórico
 * responde `{error}`, `{msg}` o `{message}` según el controlador. El SPA
 * debe leer los tres sin repetir la cadena de fallbacks en cada pantalla.
 */
describe('mensajeDeError', () => {
  it('lee las tres formas históricas del API', () => {
    expect(mensajeDeError({ error: 'Error del servidor' })).toBe('Error del servidor');
    expect(mensajeDeError({ msg: 'Stock insuficiente' })).toBe('Stock insuficiente');
    expect(mensajeDeError({ message: 'Sesión expirada' })).toBe('Sesión expirada');
  });

  it('prioriza error > msg > message y salta los valores vacíos', () => {
    expect(mensajeDeError({ error: 'A', msg: 'B', message: 'C' })).toBe('A');
    expect(mensajeDeError({ error: '  ', msg: 'B', message: 'C' })).toBe('B');
    expect(mensajeDeError({ msg: '', message: 'C' })).toBe('C');
  });

  it('acepta un string directo y usa el valor por defecto si no hay mensaje', () => {
    expect(mensajeDeError('Falló la red')).toBe('Falló la red');
    expect(mensajeDeError(null)).toBe('Ocurrió un error');
    expect(mensajeDeError({}, 'No se pudo guardar')).toBe('No se pudo guardar');
    expect(mensajeDeError(undefined, 'No se pudo guardar')).toBe('No se pudo guardar');
  });
});

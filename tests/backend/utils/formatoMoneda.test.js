/*
 * Pruebas del formateo monetario colombiano (hallazgo #25).
 * El bug original era `toLocaleString()` sin locale: el separador dependía
 * del ICU del proceso (p. ej. "1,234,567" en en-US) y no del formato de la
 * tienda. El helper fija es-CO y centraliza el fallback numérico.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { formatearMonedaCOP } = require('../../../backend/utils/formatoMoneda');

describe('formatearMonedaCOP', () => {
  it('usa punto de miles y coma decimal de es-CO', () => {
    expect(formatearMonedaCOP(1234567.89)).toBe('1.234.567,89');
    expect(formatearMonedaCOP(220000)).toBe('220.000');
    expect(formatearMonedaCOP(0)).toBe('0');
  });

  it('acepta valores numéricos en texto (precios de MySQL)', () => {
    expect(formatearMonedaCOP('150000')).toBe('150.000');
    expect(formatearMonedaCOP('89.5')).toBe('89,5');
  });

  it('devuelve "0" para valores no finitos o vacíos', () => {
    expect(formatearMonedaCOP(null)).toBe('0');
    expect(formatearMonedaCOP(undefined)).toBe('0');
    expect(formatearMonedaCOP('')).toBe('0');
    expect(formatearMonedaCOP('no-es-numero')).toBe('0');
    expect(formatearMonedaCOP(Number.NaN)).toBe('0');
  });
});

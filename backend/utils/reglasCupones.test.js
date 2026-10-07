import { describe, it, expect } from 'vitest';
import { montoMinimoSegunPorcentaje, textoCondiciones } from './reglasCupones.js';

describe('reglasCupones - montoMinimoSegunPorcentaje', () => {
  it('debe retornar 200000 para porcentajes >= 10%', () => {
    expect(montoMinimoSegunPorcentaje(10)).toBe(200000);
    expect(montoMinimoSegunPorcentaje(15)).toBe(200000);
    expect(montoMinimoSegunPorcentaje(25)).toBe(200000);
    expect(montoMinimoSegunPorcentaje(50)).toBe(200000);
  });

  it('debe retornar 150000 para porcentajes 7-9%', () => {
    expect(montoMinimoSegunPorcentaje(7)).toBe(150000);
    expect(montoMinimoSegunPorcentaje(8)).toBe(150000);
    expect(montoMinimoSegunPorcentaje(9)).toBe(150000);
  });

  it('debe retornar 100000 para porcentajes 5-6%', () => {
    expect(montoMinimoSegunPorcentaje(5)).toBe(100000);
    expect(montoMinimoSegunPorcentaje(6)).toBe(100000);
  });

  it('debe retornar 50000 para porcentajes 3-4%', () => {
    expect(montoMinimoSegunPorcentaje(3)).toBe(50000);
    expect(montoMinimoSegunPorcentaje(4)).toBe(50000);
  });

  it('debe retornar 50000 para porcentajes < 3% (mínimo base)', () => {
    expect(montoMinimoSegunPorcentaje(0)).toBe(50000);
    expect(montoMinimoSegunPorcentaje(1)).toBe(50000);
    expect(montoMinimoSegunPorcentaje(2)).toBe(50000);
    expect(montoMinimoSegunPorcentaje(2.9)).toBe(50000);
  });

  it('debe manejar valores decimales correctamente', () => {
    expect(montoMinimoSegunPorcentaje(9.5)).toBe(150000);
    expect(montoMinimoSegunPorcentaje(6.5)).toBe(100000);
    expect(montoMinimoSegunPorcentaje(3.5)).toBe(50000);
  });
});

describe('reglasCupones - textoCondiciones', () => {
  it('debe generar texto con porcentaje, monto mínimo', () => {
    const resultado = textoCondiciones('RETO-TEST', 10, 200000);
    expect(resultado).toContain('10%');
    expect(resultado).toContain('200.000');
    expect(resultado).toContain('un solo uso');
  });

  it('debe manejar valores nulos/undefined', () => {
    const resultado = textoCondiciones('TEST', 10, null);
    expect(resultado).toContain('10%');
    expect(resultado).toContain('un solo uso');
    expect(resultado).not.toContain('mínima');
  });

  it('debe formatear miles con separador', () => {
    const resultado = textoCondiciones('TEST', 10, 200000);
    expect(resultado).toContain('200.000');
  });
});
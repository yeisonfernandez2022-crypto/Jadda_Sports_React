import { describe, it, expect } from 'vitest';
import { montoMinimoSegunPorcentaje, textoCondicionesCupon, esCuponReto } from '../utils/reglasCupon.ts';

describe('reglasCupon - montoMinimoSegunPorcentaje', () => {
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

  it('debe manejar strings y nulos', () => {
    expect(montoMinimoSegunPorcentaje('10')).toBe(200000);
    expect(montoMinimoSegunPorcentaje(null)).toBe(50000);
    expect(montoMinimoSegunPorcentaje(undefined)).toBe(50000);
  });
});

describe('reglasCupon - esCuponReto', () => {
  it('debe detectar cupones RETO-', () => {
    expect(esCuponReto('RETO-ABC123')).toBe(true);
    expect(esCuponReto('RETO-XYZ')).toBe(true);
  });

  it('debe rechazar cupones no RETO-', () => {
    expect(esCuponReto('JADDA10')).toBe(false);
    expect(esCuponReto('DESCUENTO20')).toBe(false);
    expect(esCuponReto(null)).toBe(false);
    expect(esCuponReto(undefined)).toBe(false);
    expect(esCuponReto('')).toBe(false);
  });
});

describe('reglasCupon - textoCondicionesCupon', () => {
  it('debe generar texto con porcentaje y fecha para cupón RETO-', () => {
    const resultado = textoCondicionesCupon('RETO-TEST', 10, 200000, '2026-12-31');
    expect(resultado).toContain('10% de descuento');
    expect(resultado).toContain('compra mínima $200.000');
    expect(resultado).toContain('un solo uso');
    expect(resultado).toContain('vence');
  });

  it('debe generar texto sin monto mínimo para cupón no RETO-', () => {
    const resultado = textoCondicionesCupon('JADDA10', 10, null, '2026-12-31');
    expect(resultado).toContain('10% de descuento');
    expect(resultado).not.toContain('compra mínima');
    expect(resultado).not.toContain('un solo uso');
  });

  it('debe manejar fecha ISO completa', () => {
    const resultado = textoCondicionesCupon('RETO-TEST', 5, 100000, '2026-06-15T23:59:59.000Z');
    expect(resultado).toContain('5% de descuento');
    expect(resultado).toContain('compra mínima $100.000');
    expect(resultado).toContain('15');
  });

  it('debe manejar valores nulos/undefined', () => {
    const resultado = textoCondicionesCupon('TEST', 10, null, null);
    expect(resultado).toContain('10% de descuento');
    expect(resultado).toContain('vigente hasta agotar promoción');
  });

  it('debe formatear miles con separador', () => {
    const resultado = textoCondicionesCupon('RETO-TEST', 10, 200000, '2026-12-31');
    expect(resultado).toContain('200.000');
  });
});
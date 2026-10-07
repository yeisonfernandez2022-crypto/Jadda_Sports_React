import { describe, it, expect } from 'vitest';
import { calcularCostoEnvio, TARIFAS_DEPARTAMENTO, TARIFAS_CIUDAD, TARIFA_DEFAULT, ENVIO_GRATIS_DESDE } from './envio.js';

describe('envio - calcularCostoEnvio', () => {
  it('debe retornar 0 para envío gratis (subtotal >= 800000)', () => {
    expect(calcularCostoEnvio('bogota', 'bogota', 800000)).toBe(0);
    expect(calcularCostoEnvio('bogota', 'bogota', 1000000)).toBe(0);
    expect(calcularCostoEnvio('antioquia', 'medellin', 800000)).toBe(0);
  });

  it('debe calcular tarifa para Bogotá (ciudad)', () => {
    expect(calcularCostoEnvio('cundinamarca', 'bogota', 100000)).toBe(8000);
    expect(calcularCostoEnvio('cundinamarca', 'bogota', 50000)).toBe(8000);
  });

  it('debe calcular tarifa para Medellín (ciudad)', () => {
    expect(calcularCostoEnvio('antioquia', 'medellin', 100000)).toBe(9000);
  });

  it('debe calcular tarifa para Cali (ciudad)', () => {
    expect(calcularCostoEnvio('valle del cauca', 'cali', 100000)).toBe(9000);
  });

  it('debe calcular tarifa para Barranquilla (ciudad)', () => {
    expect(calcularCostoEnvio('atlantico', 'barranquilla', 100000)).toBe(10000);
  });

  it('debe calcular tarifa para Cartagena (ciudad)', () => {
    expect(calcularCostoEnvio('bolivar', 'cartagena', 100000)).toBe(11000);
  });

  it('debe usar tarifa por departamento si no hay ciudad', () => {
    expect(calcularCostoEnvio('antioquia', '', 100000)).toBe(9000);
    expect(calcularCostoEnvio('cundinamarca', '', 100000)).toBe(10000);
  });

  it('debe usar tarifa default para departamentos no listados', () => {
    expect(calcularCostoEnvio('vichada', '', 100000)).toBe(15000);
    expect(calcularCostoEnvio('guainia', '', 100000)).toBe(15000);
  });

  it('debe ser case-insensitive', () => {
    expect(calcularCostoEnvio('BOGOTA', 'BOGOTA', 100000)).toBe(8000);
    expect(calcularCostoEnvio('Antioquia', 'MEDELLIN', 100000)).toBe(9000);
  });

  it('debe manejar tildes en el nombre', () => {
    expect(calcularCostoEnvio('Bogotá', 'Bogotá', 100000)).toBe(8000);
    expect(calcularCostoEnvio('Córdoba', 'Córdoba', 100000)).toBe(12000);
  });
});

describe('envio - constantes', () => {
  it('debe tener ENVIO_GRATIS_DESDE = 800000', () => {
    expect(ENVIO_GRATIS_DESDE).toBe(800000);
  });

  it('debe tener TARIFA_DEFAULT = 15000', () => {
    expect(TARIFA_DEFAULT).toBe(15000);
  });

  it('debe tener tarifas definidas para departamentos principales', () => {
    expect(TARIFAS_DEPARTAMENTO.BOGOTA).toBe(8000);
    expect(TARIFAS_DEPARTAMENTO.ANTIOQUIA).toBe(9000);
    expect(TARIFAS_DEPARTAMENTO['VALLE DEL CAUCA']).toBe(9000);
    expect(TARIFAS_DEPARTAMENTO.ATLANTICO).toBe(10000);
    expect(TARIFAS_DEPARTAMENTO.BOLIVAR).toBe(11000);
  });

  it('debe tener tarifas definidas para ciudades principales', () => {
    expect(TARIFAS_CIUDAD.BOGOTA).toBe(8000);
    expect(TARIFAS_CIUDAD.MEDELLIN).toBe(9000);
    expect(TARIFAS_CIUDAD.CALI).toBe(9000);
    expect(TARIFAS_CIUDAD.BARRANQUILLA).toBe(10000);
    expect(TARIFAS_CIUDAD.CARTAGENA).toBe(11000);
  });
});
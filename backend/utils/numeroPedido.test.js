import { describe, it, expect } from 'vitest';
import { numeroPedido } from './numeroPedido.js';

describe('numeroPedido - numeroPedido', () => {
  it('debe generar un número de 8 dígitos', () => {
    const numero = numeroPedido(1);
    const str = String(numero);
    expect(str).toHaveLength(8);
    expect(/^\d{8}$/.test(str)).toBe(true);
  });

  it('debe generar números diferentes para IDs diferentes', () => {
    const numeros = new Set();
    for (let i = 1; i <= 1000; i++) {
      numeros.add(numeroPedido(i));
    }
    // Debe haber muy pocas colisiones (el algoritmo de Knuth distribuye bien)
    expect(numeros.size).toBeGreaterThan(990);
  });

  it('debe ser determinista para el mismo ID', () => {
    const n1 = numeroPedido(42);
    const n2 = numeroPedido(42);
    expect(n1).toBe(n2);
  });

  it('no debe generar números con ceros a la izquierda problemáticos', () => {
    const numero = numeroPedido(999999);
    const str = String(numero);
    expect(str).toHaveLength(8);
    expect(str[0]).not.toBe('0');
  });
});
/**
 * Filtro de groserías (chat): censura SOLO palabras completas ES/CO con
 * asteriscos del mismo largo; insensible a mayúsculas/tildes; "reputación"
 * NO se censura aunque contenga la secuencia.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { censurar } = require('../../../backend/utils/groserias');

describe('censurar (chat anti-groserías)', () => {
  test('censura palabras de la lista con asteriscos del mismo largo', () => {
    const salida = censurar('Hola imbecil y estúpido');
    expect(salida).not.toContain('imbecil');
    expect(salida).not.toContain('estúpido');
    expect(salida).toBe('Hola ******* y ********');
  });

  test('insensible a mayúsculas y tildes', () => {
    const salida = censurar('ESTÚPIDO Imbécil');
    expect(salida).not.toMatch(/estupid/i);
    expect(salida).not.toMatch(/imbecil/i);
  });

  test('NO censura palabras que SOLO CONTIENEN la secuencia (reputación, iputación)', () => {
    const salida = censurar('La reputación de este producto es buena');
    expect(salida).toBe('La reputación de este producto es buena');
  });

  test('no censura substrings dentro de palabras legítimas', () => {
    const salida = censurar('El asunto es compacto y puntual');
    expect(salida).not.toContain('*');
  });

  test('texto sin groserías queda intacto', () => {
    expect(censurar('Hola, qué buen servicio')).toBe('Hola, qué buen servicio');
  });
});

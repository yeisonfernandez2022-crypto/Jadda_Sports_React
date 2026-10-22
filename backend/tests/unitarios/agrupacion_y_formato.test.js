import { describe, it, expect } from 'vitest';
import { granularidadValida, formatoAgrupacion, limiteValido } from '../../utils/agrupacionVentas.js';
import { detectarFormato } from '../../utils/formatoImagen.js';

describe('agrupacionVentas', () => {
  it('acepta solo la lista cerrada de granularidades', () => {
    expect(granularidadValida('dia')).toBe('dia');
    expect(granularidadValida('semana')).toBe('semana');
    expect(granularidadValida('mes')).toBe('mes');
    expect(granularidadValida('anio')).toBe('anio');
    expect(granularidadValida('trimestre')).toBe('dia');
    expect(granularidadValida(undefined)).toBe('dia');
    expect(granularidadValida('DIA')).toBe('dia');
    expect(granularidadValida('dia; DROP TABLE VENTAS;--')).toBe('dia');
  });

  it('formatoAgrupacion produce SQL solo con literales por granularidad', () => {
    expect(formatoAgrupacion('dia')).toBe("DATE_FORMAT(FECHA_VENTA, '%Y-%m-%d')");
    expect(formatoAgrupacion('mes')).toBe("DATE_FORMAT(FECHA_VENTA, '%Y-%m')");
    expect(formatoAgrupacion('anio')).toBe("DATE_FORMAT(FECHA_VENTA, '%Y')");
    expect(formatoAgrupacion('semana')).toBe(
      "DATE_FORMAT(DATE_SUB(FECHA_VENTA, INTERVAL WEEKDAY(FECHA_VENTA) DAY), '%Y-%m-%d')"
    );
    // Con alias de tabla — versión vendedor (granularidad inválida cae a día)
    expect(formatoAgrupacion('mue', 'v.FECHA_VENTA')).toBe("DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d')");
  });

  it('formatoAgrupacion no interfiere valores del cliente', () => {
    const granularidad = "anio' UNION SELECT 1;--"; // valor malicioso
    expect(formatoAgrupacion(granularidad)).toBe("DATE_FORMAT(FECHA_VENTA, '%Y-%m-%d')");
  });

  it('limiteValido acota entre 1 y el máximo', () => {
    expect(limiteValido(undefined)).toBe(10);
    expect(limiteValido('5')).toBe(5);
    expect(limiteValido(0)).toBe(1);
    expect(limiteValido(-3)).toBe(1);
    expect(limiteValido(999)).toBe(50);
    expect(limiteValido('50;--')).toBe(10);
    expect(limiteValido('7.9')).toBe(7);
  });
});

describe('formatoImagen (magic bytes)', () => {
  it('reconoce JPG por bytes reales', () => {
    expect(detectarFormato(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toMatchObject({ mime: 'image/jpeg', ext: 'jpg' });
  });
  it('reconoce PNG por bytes reales', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectarFormato(png)).toMatchObject({ mime: 'image/png', ext: 'png' });
  });
  it('GIF87a/GIF89a', () => {
    expect(detectarFormato(Buffer.from('GIF87a-aaa'))).toMatchObject({ mime: 'image/gif', ext: 'gif' });
    expect(detectarFormato(Buffer.from('GIF89a-aaa'))).toMatchObject({ mime: 'image/gif', ext: 'gif' });
  });
  it('reconoce WEBP RIFF', () => {
    const paso = Buffer.alloc(12);
    paso.write('RIFF', 0, 'ascii');
    paso.write('WEBP', 8, 'ascii');
    expect(detectarFormato(paso)).toMatchObject({ mime: 'image/webp', ext: 'webp' });
  });
  it('rechaza contenido que declara image/png pero no lo es', () => {
    const falso = Buffer.concat([
      Buffer.from('data:image/png;base64,'), // solo texto
      Buffer.from('89504E47', 'hex'),
    ]);
    expect(detectarFormato(falso)).toBeNull();
    expect(detectarFormato(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(detectarFormato(Buffer.alloc(0))).toBeNull();
    expect(detectarFormato('texto')).toBeNull();
  });
});

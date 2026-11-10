import { describe, it, expect } from 'vitest';
import { urlImagenProductoValida } from '../../../backend/utils/imagenUrl.js';

describe('urlImagenProductoValida - validación de URLs de imagen en origen', () => {
  it('acepta URLs https (Cloudinary)', () => {
    expect(
      urlImagenProductoValida('https://res.cloudinary.com/jadda/image/upload/v1/productos/p1.png')
    ).toBe(true);
  });

  it('rechaza https de hosts ajenos a Cloudinary (SSRF vía resolutor de PDF)', () => {
    expect(urlImagenProductoValida('https://evil.com/x.png')).toBe(false);
    expect(urlImagenProductoValida('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('acepta rutas relativas del catálogo local', () => {
    expect(urlImagenProductoValida('/images/productos/Producto_01/img_1.jpg')).toBe(true);
    expect(urlImagenProductoValida('/images/productos/subidas/abc-def.png')).toBe(true);
  });

  it('tolera espacios al inicio y al final', () => {
    expect(urlImagenProductoValida('  /images/productos/Producto_01/img_1.jpg  ')).toBe(true);
  });

  it('rechaza traversal con ../', () => {
    expect(urlImagenProductoValida('/images/productos/../../secreto.png')).toBe(false);
  });

  it('rechaza backslashes', () => {
    expect(urlImagenProductoValida('/images/productos\\..\\..\\x.png')).toBe(false);
  });

  it('rechaza http inseguro y esquemas raros (data:, file:, ftp:)', () => {
    expect(urlImagenProductoValida('http://res.cloudinary.com/x.png')).toBe(false);
    expect(urlImagenProductoValida('data:image/png;base64,AAAA')).toBe(false);
    expect(urlImagenProductoValida('file:///etc/passwd')).toBe(false);
    expect(urlImagenProductoValida('ftp://servidor/x.png')).toBe(false);
  });

  it('rechaza rutas relativas fuera del catálogo de productos', () => {
    expect(urlImagenProductoValida('/images/usuarios/admin/perfil.png')).toBe(false);
    expect(urlImagenProductoValida('imagenes/productos/x.png')).toBe(false);
  });

  it('rechaza cadena vacía y valores no string', () => {
    expect(urlImagenProductoValida('')).toBe(false);
    expect(urlImagenProductoValida(null)).toBe(false);
    expect(urlImagenProductoValida(undefined)).toBe(false);
    expect(urlImagenProductoValida(123)).toBe(false);
  });
});

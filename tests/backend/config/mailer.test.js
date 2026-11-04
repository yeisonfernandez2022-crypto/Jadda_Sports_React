/*
 * Pruebas del mapeo correo nodemailer → API HTTPS de Brevo (config/mailer.js).
 * Cobertura: parseo de direcciones (string comillas/ángulos/array/comas/objetos),
 * formatarCorreoBrevo (sender/to/cc/bcc/replyTo/html/text/attachments Buffer→
 * base64 filename) y proveedorCorreo sin cache de módulos (env antes de require).
 * El envío real (fetch a api.brevo.com) NO se prueba: solo funciones puras sin red.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mailer = require('../../../backend/config/mailer');
const { parsearDireccion, formatarCorreoBrevo } = mailer;

describe('parsearDireccion', () => {
  it('correo simple', () => {
    expect(parsearDireccion('a@b.com')).toEqual({ email: 'a@b.com', name: undefined });
  });

  it('con nombre entre comillas → quita comillas y espacios', () => {
    expect(parsearDireccion('"JADDA SPORTS" <jaddasports@gmail.com>')).toEqual({
      email: 'jaddasports@gmail.com',
      name: 'JADDA SPORTS',
    });
  });

  it('con nombre sin comillas', () => {
    expect(parsearDireccion('Juan Perez <juan@gmail.com>')).toEqual({
      email: 'juan@gmail.com',
      name: 'Juan Perez',
    });
  });

  it('objeto {email, name}', () => {
    expect(parsearDireccion({ email: 'a@b.com', name: 'A' })).toEqual({ email: 'a@b.com', name: 'A' });
  });

  it('vacío / undefined / sin email → null', () => {
    expect(parsearDireccion('')).toBeNull();
    expect(parsearDireccion(undefined)).toBeNull();
    expect(parsearDireccion({ name: 'sin correo' })).toBeNull();
  });
});

describe('formatarCorreoBrevo', () => {
  it('mapea from con comillas + to string + html', () => {
    const cuerpo = formatarCorreoBrevo({
      from: '"JADDA SPORTS" <jaddasports@gmail.com>',
      to: 'cliente@gmail.com',
      subject: 'Bienvenido',
      html: '<p>Hola</p>',
    });
    expect(cuerpo.sender).toEqual({ email: 'jaddasports@gmail.com', name: 'JADDA SPORTS' });
    expect(cuerpo.to).toEqual([{ email: 'cliente@gmail.com', name: undefined }]);
    expect(cuerpo.subject).toBe('Bienvenido');
    expect(cuerpo.htmlContent).toBe('<p>Hola</p>');
    expect(cuerpo.textContent).toBeUndefined();
    expect(cuerpo.cc).toBeUndefined();
    expect(cuerpo.bcc).toBeUndefined();
    expect(cuerpo.attachment).toBeUndefined();
  });

  it('varios destinatarios (array + cadena con comas + objetos)', () => {
    const cuerpo = formatarCorreoBrevo({
      to: ['x@y.com', 'a@b.com, c@d.com', { email: 'e@f.com', name: 'E' }],
    });
    expect(cuerpo.to.map((d) => d.email)).toEqual(['x@y.com', 'a@b.com', 'c@d.com', 'e@f.com']);
  });

  it('nombre con coma dentro de comillas NO se divide', () => {
    const cuerpo = formatarCorreoBrevo({ to: '"Perez, Juan" <jp@x.com>' });
    expect(cuerpo.to).toEqual([{ email: 'jp@x.com', name: 'Perez, Juan' }]);
  });

  it('adjuntos nodemailer → Brevo base64 con name', () => {
    const pdf = Buffer.from('PDF-FACTURA');
    const cuerpo = formatarCorreoBrevo({
      attachments: [{ filename: 'factura-compra-1.pdf', content: pdf, contentType: 'application/pdf' }],
    });
    expect(cuerpo.attachment).toEqual([
      { name: 'factura-compra-1.pdf', content: pdf.toString('base64') },
    ]);
  });

  it('adjunto con contenido string se convierte a base64 y descarta archivos vacíos', () => {
    const cuerpo = formatarCorreoBrevo({
      attachments: [
        { filename: 'a.txt', content: 'hola' },
        null,
        { filename: 'sin-contenido.txt', content: '' },
      ],
    });
    expect(cuerpo.attachment).toEqual([
      { name: 'a.txt', content: Buffer.from('hola').toString('base64') },
    ]);
  });

  it('cc, bcc y replyTo', () => {
    const cuerpo = formatarCorreoBrevo({
      to: 'x@y.com',
      cc: 'c1@y.com, c2@y.com',
      bcc: 'b@y.com',
      replyTo: '"Soporte" <soporte@jadda.com>',
    });
    expect(cuerpo.cc.map((d) => d.email)).toEqual(['c1@y.com', 'c2@y.com']);
    expect(cuerpo.bcc).toEqual([{ email: 'b@y.com', name: undefined }]);
    expect(cuerpo.replyTo).toEqual({ email: 'soporte@jadda.com', name: 'Soporte' });
  });

  it('sin from usa el EMAIL_USER cargado al requerir el módulo (o el remitente por defecto)', () => {
    const cuerpo = formatarCorreoBrevo({ to: 'a@b.com' });
    // mailer.js cachea EMAIL_USER al cargar: el fallback coincide con el env
    // inicial o con noreply@jaddasports.com si el env venía vacío.
    expect(cuerpo.sender.email).toBe(process.env.EMAIL_USER || 'noreply@jaddasports.com');
  });
});

describe('proveedorCorreo y transporte exportado', () => {
  it('proveedor según el entorno cargado', () => {
    const { proveedorCorreo } = require('../../../backend/config/mailer');
    if (process.env.BREVO_API_KEY) expect(proveedorCorreo()).toBe('brevo');
    else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) expect(proveedorCorreo()).toBe('smtp');
    else expect(proveedorCorreo()).toBe('ninguno');
  });

  it('el módulo en sí es el transporter (todos los callers hacen require del mailer)', () => {
    expect(typeof mailer.sendMail).toBe('function');
  });
});

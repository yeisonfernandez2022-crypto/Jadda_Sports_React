/**
 * facturaPdf — generador de facturas (RF-021). Suite NUEVA (no tiene base):
 * cubre el armado completo del PDF (encabezado con logo real, tabla de
 * productos, totales con descuento/envío gratis, datos de envío y pie),
 * el fallback "Sin productos registrados", el salto de página con muchos
 * ítems y las tres fuentes de miniatura: ruta local JPEG/PNG, ruta local
 * con extensión no soportada (→ sin imagen) y URL de Cloudinary (descarga
 * con fetch, transformación a JPEG 160x160, caché por URL y fallos de red).
 * correo.resolverRutaImagenLocal se DESTRUCTURA en carga → se muta ANTES del
 * require del SUT; cloudinaryUtil se usa como módulo → se muta por propiedad.
 * El caché de miniaturas persiste entre tests del MISMO archivo → cada test
 * usa URLs distintas. Los asserts son estructurales: el payload del PDF va
 * comprimido, así que se valida el encabezado %PDF-, el conteo de páginas
 * (/Type /Page sin la 's' final de /Pages) y un tamaño mínimo.
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;
const path = require('path');

const correo = require('../../../backend/utils/correo');
const cloudinaryUtil = require('../../../backend/utils/cloudinary');
// destructuring en carga → mutar ANTES del require del SUT
correo.resolverRutaImagenLocal = vi.fn(() => null);
cloudinaryUtil.esUrlCloudinary = vi.fn(() => false);

const facturaPdf = require('../../../backend/utils/facturaPdf');
const { generarFacturaPdf } = facturaPdf;

// PNG real 1x1: pdfkit solo incrusta JPEG/PNG y valida la firma
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const LOGO = path.join(__dirname, '..', '..', '..', 'backend', 'assets', 'LogoJadda.png');

const esPaginas = (buf) => (buf.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

const itemDe = (over = {}) => ({ NOMBRE: 'Guayos', CANTIDAD: 2, PRECIO_UNITARIO: 50000, SUBTOTAL: 100000, URL_IMAGEN: null, ...over });

const datosDe = (items, over = {}) => ({
  venta: { ID_VENTA: 123, REFERENCIA_PAGO: 'REF-1', TOTAL: 100000, ...over.venta },
  usuario: { NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Perez', EMAIL: 'a@t.co', ...over.usuario },
  items,
  metodoPago: 'Wompi',
  envio: { DIRECCION_ENVIO: 'Calle 1', BARRIO: 'Centro', CIUDAD: 'Bogota', DEPARTAMENTO: 'Cundinamarca', COSTO_ENVIO: 0, TELEFONO_CONTACTO: '3101', ...over.envio },
});

beforeEach(() => {
  vi.clearAllMocks();
  correo.resolverRutaImagenLocal.mockImplementation(() => null);
  cloudinaryUtil.esUrlCloudinary.mockImplementation(() => false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generarFacturaPdf', () => {
  test('sin ítems → "Sin productos registrados", envío gratis y 1 página', async () => {
    const buf = await generarFacturaPdf(datosDe(undefined, { venta: { ID_VENTA: 5, TOTAL: 0 }, envio: {} }));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(1);
    expect(buf.length).toBeGreaterThan(500);
  });

  test('descuento y envío se pintan cuando corresponden (total menor que ítems + envío)', async () => {
    const buf = await generarFacturaPdf(datosDe([itemDe()], {
      venta: { ID_VENTA: 6, TOTAL: 85000 },
      envio: { COSTO_ENVIO: 5000 },
    }));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(1);
  });

  test('miniatura local JPEG/PNG → la fila se dibuja con imagen (logo real)', async () => {
    correo.resolverRutaImagenLocal.mockImplementation((url) =>
      url && url.startsWith('/images/productos/') ? LOGO : null
    );
    const buf = await generarFacturaPdf(datosDe([itemDe({ URL_IMAGEN: '/images/productos/guayos.png' })]));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(1);
  });

  test('miniatura local con extensión no soportada (.webp) → fila sin imagen', async () => {
    correo.resolverRutaImagenLocal.mockImplementation(() => 'C:/falso/producto.webp');
    const buf = await generarFacturaPdf(datosDe([itemDe({ URL_IMAGEN: '/images/productos/guayos.webp' })]));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(1);
  });

  test('Cloudinary: descarga la miniatura JPEG transformada y la cachea por URL', async () => {
    cloudinaryUtil.esUrlCloudinary.mockImplementation((url) => String(url).includes('res.cloudinary.com'));
    const fetchFalso = vi.fn(async () => ({ ok: true, arrayBuffer: async () => PNG_1X1.buffer.slice(PNG_1X1.byteOffset, PNG_1X1.byteOffset + PNG_1X1.byteLength) }));
    vi.stubGlobal('fetch', fetchFalso);

    // primera factura: descarga y cachea (las miniaturas resuelven en
    // PARALELO con Promise.all, así que ítems de la misma URL fetch 2×)
    await generarFacturaPdf(datosDe([
      itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/v1/guayos.png' }),
      itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/v1/guayos.png' }),
    ], { venta: { ID_VENTA: 10 } }));
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(fetchFalso.mock.calls[0][0]).toBe('https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,w_160,h_160,c_pad,b_white/v1/guayos.png');

    // segunda factura con la misma URL: el caché evita la red (0 fetch nuevos)
    fetchFalso.mockClear();
    await generarFacturaPdf(datosDe([itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/v1/guayos.png' })], { venta: { ID_VENTA: 11 } }));
    expect(fetchFalso).not.toHaveBeenCalled();

    // URL sin /image/upload/ → se descarga TAL CUAL (sin transformación)
    fetchFalso.mockClear();
    await generarFacturaPdf(datosDe([itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/raw/v1/otro.png' })], { venta: { ID_VENTA: 12 } }));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0][0]).toBe('https://res.cloudinary.com/demo/raw/v1/otro.png');
  });

  test('Cloudinary caído (respuesta !ok o fetch que rechaza) → filas sin imagen', async () => {
    cloudinaryUtil.esUrlCloudinary.mockImplementation((url) => String(url).includes('res.cloudinary.com'));
    const fetchFalso = vi.fn()
      .mockImplementationOnce(async () => ({ ok: false }))
      .mockImplementationOnce(async () => { throw new Error('sin red'); });
    vi.stubGlobal('fetch', fetchFalso);

    const buf = await generarFacturaPdf(datosDe([
      itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/fallo-1.png' }),
      itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/fallo-2.png' }),
    ], { venta: { ID_VENTA: 7 } }));
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('buffer inválido del proveedor → doc.image falla pero la fila igual se dibuja', async () => {
    cloudinaryUtil.esUrlCloudinary.mockImplementation(() => true);
    // bytes que no son JPEG (ffd8) ni PNG (89504e47) → pdfkit lanza "Unknown image format."
    const basura = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => basura.buffer.slice(0) })));

    const buf = await generarFacturaPdf(datosDe([itemDe({ URL_IMAGEN: 'https://res.cloudinary.com/demo/image/upload/rota.png' })], { venta: { ID_VENTA: 8 } }));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(1);
  });

  test('20 ítems → 2 páginas (el bloque de filas salta de página completo)', async () => {
    const buf = await generarFacturaPdf(datosDe(
      Array.from({ length: 20 }, () => itemDe()),
      { venta: { ID_VENTA: 9, TOTAL: 2000000 }, envio: { COSTO_ENVIO: 10000 } }
    ));
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(esPaginas(buf)).toBe(2);
  });
});

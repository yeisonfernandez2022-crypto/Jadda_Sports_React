/**
 * medidasImagen — lectura de dimensiones reales desde los bytes (unit).
 *
 * Se fabrican mini-imágenes válidas por formato (PNG/JPEG/GIF/WebP VP8/VP8L/
 * VP8X) escribiendo los bytes a mano, y se cubren los recheazos: buffer
 * aleatorio, truncados y dimensiones absurdas. Para obtenerMedidasImagen se
 * stubbea fetch global (rama http) y se prueban los rechazos del gate de
 * rutas locales (segmentos ajenos a /images/productos, evasión ..).
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const { medidasDesdeBuffer, obtenerMedidasImagen } = require('../../../backend/utils/medidasImagen');

// --- constructores de imágenes mínimas ---

const png = (ancho, alto) => {
  const b = Buffer.alloc(33);
  // firma
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);            // longitud del IHDR
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(ancho, 16);
  b.writeUInt32BE(alto, 20);
  b[24] = 8; b[25] = 6;              // profundidad + color RGBA (irrelevantes aquí)
  b.write('IEND', 29, 'ascii');
  return b;
};

const jpeg = (ancho, alto) => {
  // SOI + APP0 (JFIF, con su marcador FF E0) + SOF0 (precisión, alto, ancho) + EOI
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (alto >> 8) & 0xff, alto & 0xff,
    (ancho >> 8) & 0xff, ancho & 0xff,
    0x03, 0x01, 0x22, 0x00,
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app0,
    sof,
    Buffer.from([0xff, 0xd9]),
  ]);
};

const gif = (ancho, alto) => {
  const b = Buffer.alloc(14);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(ancho, 6);
  b.writeUInt16LE(alto, 8);
  return b;
};

const webpVp8 = (ancho, alto) => {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8 ', 12, 'ascii');
  b.writeUInt32LE(10, 16);           // tamaño del chunk
  b[20] = 0x30; b[21] = 0x01; b[22] = 0x00;   // cabecera de frame
  b[23] = 0x9d; b[24] = 0x01; b[25] = 0x2a;   // sync code
  b.writeUInt16LE(ancho & 0x3fff, 26);
  b.writeUInt16LE(alto & 0x3fff, 28);
  return b;
};

const webpVp8l = (ancho, alto) => {
  const b = Buffer.alloc(26);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(18, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8L', 12, 'ascii');
  b.writeUInt32LE(6, 16);
  b[20] = 0x2f;                      // firma del bitstream lossless
  const bits = ((ancho - 1) & 0x3fff) | (((alto - 1) & 0x3fff) << 14);
  b.writeUInt32LE(bits, 21);
  return b;
};

const webpVp8x = (ancho, alto) => {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(ancho - 1, 24, 3);   // lienzo = valor − 1 en 24 bits
  b.writeUIntLE(alto - 1, 27, 3);
  return b;
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no debe consultar la red en unit'); }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('medidasDesdeBuffer', () => {
  test('PNG: 1757×432', () => {
    expect(medidasDesdeBuffer(png(1757, 432))).toEqual({ ancho: 1757, alto: 432 });
  });

  test('JPEG: alto antes del ancho en el SOF', () => {
    expect(medidasDesdeBuffer(jpeg(1920, 500))).toEqual({ ancho: 1920, alto: 500 });
  });

  test('GIF: little-endian', () => {
    expect(medidasDesdeBuffer(gif(640, 157))).toEqual({ ancho: 640, alto: 157 });
  });

  test('WebP en sus tres sabores', () => {
    expect(medidasDesdeBuffer(webpVp8(1757, 432))).toEqual({ ancho: 1757, alto: 432 });
    expect(medidasDesdeBuffer(webpVp8l(1200, 295))).toEqual({ ancho: 1200, alto: 295 });
    expect(medidasDesdeBuffer(webpVp8x(2400, 590))).toEqual({ ancho: 2400, alto: 590 });
  });

  test('bytes aleatorios → null', () => {
    expect(medidasDesdeBuffer(Buffer.from('esto no es una imagen, son letras', 'utf8'))).toBeNull();
  });

  test('buffers truncados → null (sin excepción)', () => {
    expect(medidasDesdeBuffer(png(1757, 432).subarray(0, 15))).toBeNull();
    expect(medidasDesdeBuffer(jpeg(1757, 432).subarray(0, 5))).toBeNull();
    expect(medidasDesdeBuffer(webpVp8(10, 10).subarray(0, 20))).toBeNull();
  });

  test('dimensiones absurdas → null (buffer corrompido)', () => {
    expect(medidasDesdeBuffer(png(0, 0))).toBeNull();
    expect(medidasDesdeBuffer(png(99999, 1))).toBeNull();
  });

  test('buffer no-Buffer → null', () => {
    expect(medidasDesdeBuffer('png')).toBeNull();
  });
});

describe('obtenerMedidasImagen — rutas locales (gate igual al server.js)', () => {
  test('solo acepta /images/productos/ con carpeta Producto_* o subidas', async () => {
    // segmentos ajenos o evasión: null SIN intento de lectura
    await expect(obtenerMedidasImagen('/images/usuarios/x/f.png')).resolves.toBeNull();
    await expect(obtenerMedidasImagen('/images/productos/../config/db.js')).resolves.toBeNull();
    await expect(obtenerMedidasImagen('images/productos/subidas/f.png')).resolves.toBeNull();
  });

  test('archivo inexistente en carpeta válida → null sin lanzar', async () => {
    await expect(obtenerMedidasImagen('/images/productos/subidas/no-existe-nadita.png')).resolves.toBeNull();
  });

  test('URL vacía o no-string → null', async () => {
    await expect(obtenerMedidasImagen('')).resolves.toBeNull();
    await expect(obtenerMedidasImagen(null)).resolves.toBeNull();
  });
});

describe('obtenerMedidasImagen — rama http (fetch stubbeado)', () => {
  test('descarga y mide un PNG remoto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Map([['content-length', String(png(1757, 432).length)]]),
      arrayBuffer: async () => png(1757, 432).buffer,
    })));
    await expect(obtenerMedidasImagen('https://cdn.example/banner.png')).resolves.toEqual({ ancho: 1757, alto: 432 });
  });

  test('respuesta no-ok → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, headers: new Map() })));
    await expect(obtenerMedidasImagen('https://cdn.example/404.png')).resolves.toBeNull();
  });

  test('falla de red → null sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('caído'); }));
    await expect(obtenerMedidasImagen('https://cdn.example/x.png')).resolves.toBeNull();
  });
});

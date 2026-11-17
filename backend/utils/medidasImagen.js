/*
 * Lectura de dimensiones REALES (ancho × alto) de una imagen a partir de sus
 * bytes — el MIME/la extensión declarados pueden mentir; el contenido no
 * (mismo principio de formatoImagen.js). Soporta PNG (IHDR), JPEG (marcador
 * SOFn), GIF87a/89a y WebP (VP8 lossy, VP8L lossless y VP8X extendido).
 *
 * obtenerMedidasImagen(url) resuelve la imagen por URL:
 *  - absoluta http(s): descarga con tope de tamaño y timeout (no confía en el
 *    Content-Type — parsea los bytes).
 *  - relativa /images/productos/...: lee el archivo de uploads/ aplicando el
 *    MISMO gate A05 que server.js (solo carpetas Producto_* y subidas, sin
 *    evasión de segmentos) para no convertir esto en un lector de archivos
 *    arbitrarios del servidor.
 */
const fs = require('fs');
const path = require('path');

// Tope de descarga remota: una imagen de banner válida no acerca ni de lejos
// este tamaño; se corta antes de guardar en memoria una respuesta trampa.
const MAX_BYTES_DESCARGA = 25 * 1024 * 1024;
const TIMEOUT_MS = 8000;
// Sanidad: dimensiones absurdas (0 o >30000) = buffer corrupto/malicioso.
const MAX_DIMENSION = 30000;

/**
 * Extrae { ancho, alto } de un PNG (el IHDR es siempre el primer chunk:
 * bytes 16-23 con ancho y alto big-endian a 4 bytes cada uno).
 */
const medidasPng = (buffer) => {
  if (buffer.length < 24) return null;
  const ancho = buffer.readUInt32BE(16);
  const alto = buffer.readUInt32BE(20);
  return { ancho, alto };
};

/**
 * Recorre los marcadores JPEG hasta un SOFn (0xC0-0xCF, excepto DHT/JPG/DAC):
 * la cabecera trae alto y alto big-endian detrás de la precisión.
 */
const medidasJpeg = (buffer) => {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marcador = buffer[i + 1];
    if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) {
      i += 2; // sin longitud de segmento
      continue;
    }
    if (marcador === 0xd9 || marcador === 0xda) break; // EOI / SOS: el SOFn ya pasó
    if (i + 4 > buffer.length) break;
    const longitud = buffer.readUInt16BE(i + 2);
    if (longitud <= 0 || i + 2 + longitud > buffer.length) break;
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      if (i + 9 > buffer.length) break;
      return {
        alto: buffer.readUInt16BE(i + 5),
        ancho: buffer.readUInt16BE(i + 7),
      };
    }
    i += 2 + longitud;
  }
  return null;
};

/** GIF87a/89a: el descriptor de pantalla lógico trae ancho y alto LE a 2 bytes. */
const medidasGif = (buffer) => {
  if (buffer.length < 10) return null;
  return { ancho: buffer.readUInt16LE(6), alto: buffer.readUInt16LE(8) };
};

/** WebP según el chunk de bitstream: VP8 (lossy), VP8L (lossless) o VP8X (extended). */
const medidasWebp = (buffer) => {
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8 ') {
    if (buffer.length < 30) return null;
    // bitstream desde el byte 20: cabecera de frame (3) + sync 9d 01 2a + dims
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return {
      ancho: (buffer.readUInt16LE(26) & 0x3fff),
      alto: (buffer.readUInt16LE(28) & 0x3fff),
    };
  }
  if (chunk === 'VP8L') {
    if (buffer.length < 25) return null;
    if (buffer[20] !== 0x2f) return null; // firma del bitstream lossless
    const bits = buffer.readUInt32LE(21);
    return {
      ancho: (bits & 0x3fff) + 1,
      alto: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    if (buffer.length < 30) return null;
    // lienzo codificado como valor-1 en 24 bits little-endian
    return {
      ancho: buffer.readUIntLE(24, 3) + 1,
      alto: buffer.readUIntLE(27, 3) + 1,
    };
  }
  return null;
};

/** Devuelve { ancho, alto } según los magic bytes, o null si es ilegible. */
function medidasDesdeBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  let medidas = null;
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    medidas = medidasPng(buffer);
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    medidas = medidasJpeg(buffer);
  } else if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    medidas = medidasGif(buffer);
  } else if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    medidas = medidasWebp(buffer);
  }
  if (!medidas) return null;
  const { ancho, alto } = medidas;
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1 || ancho > MAX_DIMENSION || alto > MAX_DIMENSION) {
    return null;
  }
  return { ancho, alto };
}

/**
 * Descarga una URL http(s) y devuelve sus medidas (o null si no responde,
 * tarda demasiado, supera el tope o no es una imagen parseable).
 */
const descargarYMedir = async (url) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(url, { signal: controlador.signal, redirect: 'follow' });
    if (!respuesta.ok) return null;
    const declarado = Number.parseInt(respuesta.headers.get('content-length') || '0', 10);
    if (declarado > MAX_BYTES_DESCARGA) return null;
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.length > MAX_BYTES_DESCARGA) return null;
    return medidasDesdeBuffer(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
};

/**
 * Lee del disco la imagen servida por /images/productos/... con el mismo gate
 * del server.js: únicamente carpetas Producto_* y subidas, un único archivo por
 * segmento, sin caracteres de evasión.
 */
const leerYMedirProducto = async (relativo) => {
  const segmentos = relativo.split('/');
  if (segmentos.length !== 2) return null;
  const [carpeta, archivo] = segmentos;
  const carpetaValida = /^Producto_[A-Za-z0-9_-]+$/.test(carpeta) || carpeta === 'subidas';
  if (!carpetaValida) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(archivo) || archivo.includes('..')) return null;
  try {
    const buffer = await fs.promises.readFile(
      path.join(__dirname, '..', 'uploads', carpeta, archivo)
    );
    return medidasDesdeBuffer(buffer);
  } catch {
    return null;
  }
};

/** Punto de entrada: medidas de la imagen identificada por la URL, o null. */
async function obtenerMedidasImagen(url) {
  if (typeof url !== 'string') return null;
  const limpia = url.trim();
  if (!limpia) return null;
  if (/^https?:\/\//i.test(limpia)) return descargarYMedir(limpia);
  if (limpia.startsWith('/images/productos/')) {
    return leerYMedirProducto(limpia.slice('/images/productos/'.length));
  }
  return null;
}

module.exports = { medidasDesdeBuffer, obtenerMedidasImagen };

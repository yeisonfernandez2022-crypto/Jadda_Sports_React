/*
 * Detección de formato REAL de una evidencia a partir de sus magic bytes.
 * El Content-Type/base64 declarado puede mentir; el contenido del buffer no.
 * (JPG FF D8 FF · PNG 89 50 4E 47 0D 0A 1A 0A · GIF 'GIF' y b· GIF87a/GIF89a ·
 * WEBP 'RIFF'....'WEBP' · WEBM cabezal EBML 1A 45 DF A3 ·
 * MP4/MOV caja 'ftyp' (bytes 4-8) con marca en 8-12: MP4 isom/mp42 llll y
 * MOV con marca 'qt  ' de QuickTime/iPhone)
 */

const FIRMAS = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    test: (b) => b.length >= 6 && b.subarray(0, 3).toString('ascii') === 'GIF',
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'video/webm',
    ext: 'webm',
    test: (b) =>
      b.length >= 4 &&
      b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  {
    mime: 'video/mp4',
    ext: 'mp4',
    test: (b) =>
      b.length >= 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      !/^qt\b/.test(b.subarray(8, 12).toString('ascii')),
  },
  {
    mime: 'video/quicktime',
    ext: 'mov',
    test: (b) =>
      b.length >= 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      /^qt\b/.test(b.subarray(8, 12).toString('ascii')),
  },
];

/** Devuelve la firma del formato real si coincide, o null si es desconocido. */
function detectarFormato(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  return FIRMAS.find((f) => f.test(buffer)) || null;
}

module.exports = { detectarFormato, FIRMAS };

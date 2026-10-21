/**
 * Validación común de subidas de evidencias (devoluciones y retos).
 * - Lista blanca de MIMEs REALES (mime declarado por la cabecera del archivo,
 *   no la extensión del nombre); rechaza archivos renombrados/engañosos.
 * - Coherencia extensión <-> mime para dificultar el spoofing.
 * - Límite centralizado: 25 MB por archivo, máx 5 archivos.
 */
const MAX_EVIDENCIA_MB = 25;
const MAX_EVIDENCIAS = 5;

const MIME_EXTENSION = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
};

/**
 * Multer fileFilter: acepta solo MIMEs de la lista blanca cuya extensión
 * declarada coincida con el tipo real (o sin extensión).
 */
function archivoEvidenciaValido(req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (!MIME_EXTENSION[mime]) {
    return cb(new Error('Formato no permitido (usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV)'));
  }
  const ext = String(require('path').extname(file.originalname || '')).toLowerCase();
  if (ext && !MIME_EXTENSION[mime].includes(ext)) {
    return cb(new Error('La extensión del archivo no coincide con su contenido'));
  }
  cb(null, true);
}

const LIMITES_EVIDENCIAS = {
  fileSize: MAX_EVIDENCIA_MB * 1024 * 1024,
  files: MAX_EVIDENCIAS,
};

module.exports = {
  MAX_EVIDENCIA_MB,
  MAX_EVIDENCIAS,
  archivoEvidenciaValido,
  LIMITES_EVIDENCIAS,
};

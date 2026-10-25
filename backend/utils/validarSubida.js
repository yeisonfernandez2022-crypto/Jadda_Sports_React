/**
 * Validación común de subidas de evidencias (devoluciones y retos).
 * - Lista blanca de MIMEs REALES (mime declarado por la cabecera del archivo,
 *   no la extensión del nombre); rechaza archivos renombrados/engañosos.
 * - Coherencia extensión <-> mime para dificultar el spoofing.
 * - Firma real por magic bytes DESPUÉS de multer (verificarContenidosReales):
 *   el mime declarado puede mentir, el contenido del archivo no.
 * - Límite centralizado: 25 MB por archivo, máx 5 archivos.
 */
const fs = require('fs');
const MAX_EVIDENCIA_MB = 25;
const MAX_EVIDENCIAS = 5;
const { detectarFormato } = require('./formatoImagen');

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

/**
 * Middleware que corre DESPUÉS de multer (diskStorage): los archivos ya viven
 * en file.path con nombres temporales, así que se leen SOLO los primeros 512
 * bytes y se compara la firma real (magic bytes) contra el mimetype declarado.
 * Si algún archivo miente (p. ej. un spider renombrado a .mp4), se borran TODOS
 * los archivos de esta petición (aún sin referencias en BD) y se responde 400.
 */
async function verificarContenidosReales(req, res, next) {
  const archivos = [].concat(req.files || []);
  if (req.file) archivos.push(req.file);
  if (archivos.length === 0) return next();

  const podar = () => Promise.allSettled(archivos.map((f) => fs.promises.unlink(f.path)));

  try {
    for (const file of archivos) {
      const fd = await fs.promises.open(file.path, 'r');
      let buffer;
      try {
        buffer = Buffer.alloc(512);
        const { bytesRead } = await fd.read(buffer, 0, 512, 0);
        buffer = buffer.subarray(0, bytesRead);
      } finally {
        await fd.close();
      }
      const firma = detectarFormato(buffer);
      if (!firma || firma.mime !== String(file.mimetype || '').toLowerCase()) {
        await podar();
        return res.status(400).json({
          ok: false,
          msg: "El contenido del archivo no corresponde a su tipo declarado (detectamos que no es una evidencia real)",
        });
      }
    }
    next();
  } catch (err) {
    await podar();
    res.status(400).json({ ok: false, msg: "Error al verificar los archivos subidos" });
  }
}

module.exports = {
  MAX_EVIDENCIA_MB,
  MAX_EVIDENCIAS,
  archivoEvidenciaValido,
  LIMITES_EVIDENCIAS,
  verificarContenidosReales,
};

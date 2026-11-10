// Rutas de devoluciones (RF-033 + evidencias): usuario solicita, admin procesa
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const devolucionController = require('../controllers/devolucionController');
const esAdmin = require('../middlewares/esAdmin');
const rateLimit = require('../middlewares/rateLimiter');
const { claveDeReq } = require('../utils/carpetaUsuario');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// Evidencias multipart: uploads/devoluciones/{USUARIO}/ev-{ts}-{rand}.{ext}
// Límites y validación centralizados en utils/validarSubida.js:
// MIME real (no la extensión declarada), coherencia ext<->mime, 25 MB c/u, máx 5.
const { archivoEvidenciaValido, LIMITES_EVIDENCIAS, MAX_EVIDENCIA_MB, MAX_EVIDENCIAS, verificarContenidosReales, EXTENSION_DE_MIME } = require('../utils/validarSubida');
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const clave = claveDeReq(req); // saneada a [a-z0-9._-] (sin barras); la carpeta SIEMPRE queda dentro de uploads/devoluciones
      const dir = path.join(__dirname, '..', 'uploads', 'devoluciones', clave);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      // Extensión de LISTA BLANCA por MIME (nunca del originalname que manda el
      // cliente). fileFilter solo admite los MIME del mapa, así que la
      // alternativa de respaldo nunca debería alcanzarse.
      const ext = EXTENSION_DE_MIME[file.mimetype] || 'jpg';
      // Aleatorio CSPRNG (A02-H5): además de descongestionar, elimina la
      // colocación posible entre los N archivos de UNA misma petición
      // (multer invoca filename por archivo con el mismo ms).
      cb(null, `ev-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`);
    },
  }),
  fileFilter: archivoEvidenciaValido,
  limits: LIMITES_EVIDENCIAS,
});

const subirEvidencias = (req, res, next) => {
  upload.array('evidencias', MAX_EVIDENCIAS)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Cada archivo debe pesar máximo ${MAX_EVIDENCIA_MB} MB`
        : err.code === 'LIMIT_FILE_COUNT' ? `Máximo ${MAX_EVIDENCIAS} archivos por solicitud`
        : (err.message && (err.message.includes('Formato') || err.message.includes('extensión'))) ? err.message
        : 'Error al subir las evidencias';
      return res.status(400).json({ ok: false, msg });
    }
    verificarContenidosReales(req, res, next);
  });
};

// --- Usuario ---
router.post('/', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiadas solicitudes de devolución. Intenta más tarde" }), devolucionController.solicitarDevolucion);
router.get('/', verificarSesion, devolucionController.misDevoluciones);
router.post('/evidencias', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiadas subidas. Intenta más tarde" }), subirEvidencias, devolucionController.subirEvidencias);
router.post('/:id/evidencias', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiadas subidas. Intenta más tarde" }), subirEvidencias, devolucionController.agregarEvidencias);
router.delete('/evidencias/:idEvidencia', verificarSesion, devolucionController.eliminarEvidencia);

// --- Admin ---
router.get('/admin', esAdmin, rateLimit({ max: 60 }), devolucionController.todas);
router.post('/admin/:id/procesar', esAdmin, rateLimit({ max: 30 }), devolucionController.procesar);

module.exports = router;
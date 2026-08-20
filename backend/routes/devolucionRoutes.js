// Rutas de devoluciones (RF-033 + evidencias): usuario solicita, admin procesa
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const devolucionController = require('../controllers/devolucionController');
const esAdmin = require('../middlewares/esAdmin');
const rateLimit = require('../middlewares/rateLimiter');
const { claveDeReq } = require('../utils/carpetaUsuario');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// Evidencias multipart: uploads/devoluciones/{USUARIO}/ev-{ts}-{rand}.{ext}
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const clave = claveDeReq(req);
      const dir = path.join(__dirname, '..', 'uploads', 'devoluciones', clave);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `ev-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    const ok = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(file.originalname);
    cb(ok ? null : new Error('Formato no permitido'), ok);
  },
  limits: { fileSize: 100 * 1024 * 1024, files: 8 },
});

const subirEvidencias = (req, res, next) => {
  upload.array('evidencias', 8)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Cada archivo debe pesar máximo 100 MB'
        : err.code === 'LIMIT_FILE_COUNT' ? 'Máximo 8 archivos por solicitud'
        : (err.message && err.message.includes('Formato')) ? 'Formato no permitido (usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV)'
        : 'Error al subir las evidencias';
      return res.status(400).json({ ok: false, msg });
    }
    next();
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
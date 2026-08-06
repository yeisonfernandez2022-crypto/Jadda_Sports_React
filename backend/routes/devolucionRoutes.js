// Rutas de devoluciones (RF-033): usuario solicita, admin procesa
const express = require('express');
const router = express.Router();
const devolucionController = require('../controllers/devolucionController');
const esAdmin = require('../middlewares/esAdmin');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// --- Usuario ---
router.post('/', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiadas solicitudes de devolución. Intenta más tarde" }), devolucionController.solicitarDevolucion);
router.get('/', verificarSesion, devolucionController.misDevoluciones);

// --- Admin ---
router.get('/admin', esAdmin, rateLimit({ max: 60 }), devolucionController.todas);
router.post('/admin/:id/procesar', esAdmin, rateLimit({ max: 30 }), devolucionController.procesar);

module.exports = router;

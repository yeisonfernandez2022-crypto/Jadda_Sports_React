// Rutas de vendedores: formulario "Ser vendedor" + aprobación admin
const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedorController');
const esAdmin = require('../middlewares/esAdmin');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// --- Usuario (el POST no exige sesión: cualquiera puede postularse) ---
router.post('/solicitud', rateLimit({ max: 10, mensaje: "Demasiadas solicitudes. Intenta más tarde" }), vendedorController.solicitarVendedor);
router.get('/solicitud', verificarSesion, vendedorController.miSolicitud);

// --- Admin ---
router.get('/admin', esAdmin, rateLimit({ max: 60 }), vendedorController.obtenerSolicitudes);
router.post('/admin/:id/procesar', esAdmin, rateLimit({ max: 30 }), vendedorController.procesarSolicitud);

module.exports = router;

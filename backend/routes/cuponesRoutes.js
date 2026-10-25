// Rutas de validación de cupones de descuento
const express = require('express');
const router = express.Router();
const cuponesController = require('../controllers/cuponesController');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// La validación consulta la BD y se presta a fuerza bruta de códigos: 30/min
router.post('/validar', rateLimit({ max: 30 }), cuponesController.validarCupon);
router.get('/disponibles', verificarSesion, cuponesController.listarParaCheckout);

module.exports = router;

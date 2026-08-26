// Rutas de validación de cupones de descuento
const express = require('express');
const router = express.Router();
const cuponesController = require('../controllers/cuponesController');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

router.post('/validar', cuponesController.validarCupon);
router.get('/disponibles', verificarSesion, cuponesController.listarParaCheckout);

module.exports = router;

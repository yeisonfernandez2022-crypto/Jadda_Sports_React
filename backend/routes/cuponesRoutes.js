// Ruta de validación de cupones de descuento
const express = require('express');
const router = express.Router();
const cuponesController = require('../controllers/cuponesController');

router.post('/validar', cuponesController.validarCupon);

module.exports = router;

// Ruta de checkout: procesar compra completa
const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');

function estaAutenticado(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "No autenticado" });
}

router.post('/procesar', estaAutenticado, checkoutController.procesarCompra);

module.exports = router;

// Ruta de checkout: procesar compra completa
const express = require('express');
const router = express.Router();
const rateLimit = require('../middlewares/rateLimiter');
const checkoutController = require('../controllers/checkoutController');

function estaAutenticado(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "No autenticado" });
}

// El checkout crea ventas/direcciones/notificaciones por petición: sin límite
// propio un usuario autenticado podía disparar el techo global (300/min)
// bombardeando la BD y la campana admin. 5 compras por 15 min es muy por
// encima de un flujo legítimo.
router.post(
  '/procesar',
  estaAutenticado,
  rateLimit({ ventanaMs: 15 * 60 * 1000, max: 5, mensaje: "Demasiadas compras en poco tiempo. Intenta en un momento" }),
  checkoutController.procesarCompra
);

module.exports = router;

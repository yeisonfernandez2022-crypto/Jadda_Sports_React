const express = require('express');
const router = express.Router();

const { verificarSesion } = require('../middlewares/authMiddleware');
const rateLimit = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/pagosController');

/**
 * Pasarela de pagos (Fase 6). Montada en /api/pagos.
 * - /webhook va SIN sesión (lo llama Wompi) y se autentica por firma HMAC del evento.
 * - /pagar y /estado/:idVenta exigen sesión y validan la propiedad de la venta.
 */
router.get('/config', ctrl.configPagos);

router.post(
  '/pagar',
  verificarSesion,
  rateLimit({
    ventanaMs: 5 * 60 * 1000,
    max: 8,
    mensaje: 'Demasiados intentos de pago. Espera unos minutos e intenta de nuevo',
  }),
  ctrl.crearSesionPago
);

router.get(
  '/estado/:idVenta',
  verificarSesion,
  rateLimit({
    ventanaMs: 60 * 1000,
    max: 90,
  }),
  ctrl.estadoVenta
);

router.post(
  '/webhook',
  rateLimit({
    ventanaMs: 60 * 1000,
    max: 60,
    mensaje: 'Demasiados eventos de la pasarela desde esta IP',
  }),
  ctrl.webhookWompi
);

module.exports = router;

// Rutas de métodos de pago guardados: CRUD + principal
const express = require('express');
const router = express.Router();
const metodoPagoController = require('../controllers/metodoPagoController');
const rateLimit = require('../middlewares/rateLimiter');

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

// Mutaciones acotadas (20 por 15 min): guardar/eliminar un método toca la BD
// y el principal se usa en el checkout; 20 es holgura real.
router.get('/', verificarSesion, metodoPagoController.obtenerMetodos);
router.post('/', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de métodos de pago. Intenta más tarde" }), metodoPagoController.guardarMetodo);
router.delete('/:id', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de métodos de pago. Intenta más tarde" }), metodoPagoController.eliminarMetodo);
router.put('/:id/principal', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de métodos de pago. Intenta más tarde" }), metodoPagoController.establecerPrincipal);

module.exports = router;

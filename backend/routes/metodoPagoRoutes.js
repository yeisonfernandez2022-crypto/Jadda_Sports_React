// Rutas de métodos de pago guardados: CRUD + principal
const express = require('express');
const router = express.Router();
const metodoPagoController = require('../controllers/metodoPagoController');

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get('/', verificarSesion, metodoPagoController.obtenerMetodos);
router.post('/', verificarSesion, metodoPagoController.guardarMetodo);
router.delete('/:id', verificarSesion, metodoPagoController.eliminarMetodo);
router.put('/:id/principal', verificarSesion, metodoPagoController.establecerPrincipal);

module.exports = router;

// Rutas de direcciones del usuario: CRUD completo
const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

// Límites en las mutaciones (20 por 15 min): el flujo legítimo toca 1-3
// direcciones por sesión; evita la generación de filas DIRECCIONES por API.
router.get('/', verificarSesion, direccionController.obtenerDirecciones);
router.post('/', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de dirección. Intenta más tarde" }), direccionController.crearDireccion);
router.put('/:id_direccion', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de dirección. Intenta más tarde" }), direccionController.actualizarDireccion);
router.delete('/:id_direccion', verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 20, mensaje: "Demasiados cambios de dirección. Intenta más tarde" }), direccionController.eliminarDireccion);

module.exports = router;

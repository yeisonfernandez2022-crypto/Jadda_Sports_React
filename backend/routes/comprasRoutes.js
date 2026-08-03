// Ruta de compras del usuario logueado
const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

router.get('/', verificarSesion, comprasController.obtenerCompras);
router.get('/:id', verificarSesion, comprasController.obtenerCompraPorId);
router.put('/:id/direccion', verificarSesion, comprasController.actualizarDireccionCompra);
router.post('/:id/cancelar', verificarSesion, comprasController.cancelarCompra);

module.exports = router;

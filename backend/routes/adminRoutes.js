const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

router.get('/dashboard', verificarSesion, adminController.obtenerDashboard);
router.get('/compras', verificarSesion, adminController.obtenerTodasLasCompras);
router.put('/compras/:id/estado', verificarSesion, adminController.actualizarEstadoCompra);
router.get('/usuarios', verificarSesion, adminController.obtenerUsuarios);

module.exports = router;

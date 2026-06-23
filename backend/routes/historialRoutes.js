const express = require('express');
const router = express.Router();
const historialController = require('../controllers/historialController');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

router.get('/', verificarSesion, historialController.obtenerHistorial);
router.post('/', verificarSesion, historialController.guardarHistorial);

module.exports = router;

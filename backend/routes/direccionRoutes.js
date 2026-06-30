// Rutas de direcciones del usuario: CRUD completo
const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

router.get('/', verificarSesion, direccionController.obtenerDirecciones);
router.post('/', verificarSesion, direccionController.crearDireccion);
router.put('/:id_direccion', verificarSesion, direccionController.actualizarDireccion);
router.delete('/:id_direccion', verificarSesion, direccionController.eliminarDireccion);

module.exports = router;

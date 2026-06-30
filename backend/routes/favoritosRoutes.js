// Rutas de favoritos: listar, agregar, eliminar
const express = require('express');
const router = express.Router();
const favoritosController = require('../controllers/favoritosController');

const verificarSesion = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

router.get('/', verificarSesion, favoritosController.obtenerFavoritos);
router.post('/', verificarSesion, favoritosController.agregarFavorito);
router.delete('/:id_favorito', verificarSesion, favoritosController.eliminarFavorito);

module.exports = router;

const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');

// Rutas Específicas
router.get('/relacionados/:id', productoController.obtenerRelacionados);
router.get('/:id/caracteristicas', productoController.obtenerCaracteristicas);
router.post('/:id/caracteristicas', productoController.agregarCaracteristica);
router.delete('/caracteristicas/:idCaracteristica', productoController.eliminarCaracteristica);

// Rutas de reseñas
router.get('/:id/resenas', productoController.obtenerResenasPorProducto);
router.post('/:id/resenas', productoController.agregarResena); // Ahora funcionará

// Rutas Generales
router.get('/', productoController.obtenerProductos);
router.get('/:id', productoController.obtenerProductoPorId);
router.put('/:id', productoController.actualizarProducto);
router.delete('/:id', productoController.eliminarProducto);

module.exports = router;
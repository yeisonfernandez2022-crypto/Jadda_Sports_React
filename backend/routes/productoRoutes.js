const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');


//  INTERACCIONES Y DETALLES (Rutas Específicas)
// Obtener productos relacionados
router.get('/relacionados/:id', productoController.obtenerRelacionados);

// Ficha Técnica / Características
router.get('/:id/caracteristicas', productoController.obtenerCaracteristicas);
router.post('/:id/caracteristicas', productoController.agregarCaracteristica);
router.delete('/caracteristicas/:idCaracteristica', productoController.eliminarCaracteristica);
router.get('/caracteristicas/:idCaracteristica', productoController.obtenerCaracteristicaPorId);
router.put('/caracteristicas/:idCaracteristica', productoController.actualizarCaracteristica);

// Variantes
router.get('/:id/variantes', productoController.obtenerVariantes);
router.post('/:id/variantes', productoController.agregarVariante);
router.put('/variantes/:idVariante', productoController.actualizarVariante);
router.delete('/variantes/:idVariante', productoController.eliminarVariante);


// OPINIONES DE CLIENTES (Rutas de reseñas)
router.get('/:id/resenas', productoController.obtenerResenasPorProducto);
router.post('/:id/resenas', productoController.agregarResena);


// CONTROL GLOBAL Y ADMINISTRACIÓN (Rutas Generales)
// Consultas globales y detalles
router.get('/', productoController.obtenerProductos);
router.get('/categorias', productoController.obtenerCategorias);
router.get('/descuentos', productoController.obtenerDescuentos);
router.get('/:id', productoController.obtenerProductoPorId);

// Acciones del Administrador (Dashboard / Edición)
router.post('/', productoController.crearProducto);
router.put('/:id', productoController.actualizarProducto);
router.delete('/:id', productoController.eliminarProducto);


module.exports = router;
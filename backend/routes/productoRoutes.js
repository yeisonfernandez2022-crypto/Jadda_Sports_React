// Rutas de productos: CRUD + variantes + características + reseñas + categorías
const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const imagenController = require('../controllers/imagenController');
const esAdmin = require('../middlewares/esAdmin');

// --- Subida de imágenes desde el panel admin (base64 JSON) — solo admin ---
router.post('/imagenes', esAdmin, express.json({ limit: '25mb' }), imagenController.subirImagenes);

// --- Productos relacionados ---
router.get('/relacionados/:id', productoController.obtenerRelacionados);

// --- Características (escritura solo admin; lectura pública para la tienda) ---
router.get('/:id/caracteristicas', productoController.obtenerCaracteristicas);
router.post('/:id/caracteristicas', esAdmin, productoController.agregarCaracteristica);
router.delete('/caracteristicas/:idCaracteristica', esAdmin, productoController.eliminarCaracteristica);
router.get('/caracteristicas/:idCaracteristica', esAdmin, productoController.obtenerCaracteristicaPorId);
router.put('/caracteristicas/:idCaracteristica', esAdmin, productoController.actualizarCaracteristica);

// --- Variantes (escritura solo admin; lectura pública) ---
router.get('/:id/variantes', productoController.obtenerVariantes);
router.post('/:id/variantes', esAdmin, productoController.agregarVariante);
router.put('/variantes/:idVariante', esAdmin, productoController.actualizarVariante);
router.delete('/variantes/:idVariante', esAdmin, productoController.eliminarVariante);


// --- Reseñas ---
router.get('/:id/resenas', productoController.obtenerResenasPorProducto);
router.post('/:id/resenas', (req, res, next) => req.isAuthenticated() ? next() : res.status(401).json({ error: "No autenticado" }), productoController.agregarResena);


// --- Categorías y descuentos ---
router.get('/', productoController.obtenerProductos);
router.get('/categorias', productoController.obtenerCategorias);
router.get('/descuentos', productoController.obtenerDescuentos);
router.get('/:id', productoController.obtenerProductoPorId);

// Acciones del Administrador (Dashboard / Edición) — solo admin
router.post('/', esAdmin, productoController.crearProducto);
router.put('/:id', esAdmin, productoController.actualizarProducto);
router.delete('/:id', esAdmin, productoController.eliminarProducto);


module.exports = router;
// Rutas de productos: CRUD + variantes + características + reseñas + categorías
const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const imagenController = require('../controllers/imagenController');
const esAdmin = require('../middlewares/esAdmin');
const esVendedor = require('../middlewares/esVendedor');
const rateLimit = require('../middlewares/rateLimiter');

// Admin o vendedor activo pueden subir imágenes de producto
const esAdminOVendedor = (req, res, next) => {
  const rol = req.user?.ID_ROL;
  if (req.isAuthenticated?.() && Number(rol) === 1) return next();
  return esVendedor(req, res, next);
};

// --- Subida de imágenes desde el panel (base64 JSON) — admin o vendedor ---
router.post('/imagenes', esAdminOVendedor, express.json({ limit: '25mb' }), imagenController.subirImagenes);

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

// --- Alertas de reposición de stock (RF-035) — requieren sesión ---
const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ error: "No autenticado" });

router.post('/variantes/:idVariante/suscribir', verificarSesion, productoController.suscribirAvisoStock);
router.get('/variantes/:idVariante/suscripcion', verificarSesion, productoController.estadoSuscripcionAviso);
router.delete('/variantes/:idVariante/suscribir', verificarSesion, productoController.cancelarAvisoStock);

// --- Recomendaciones personalizadas (RF-038) — requieren sesión ---
router.get('/recomendados', verificarSesion, rateLimit({ max: 30, mensaje: "Demasiadas peticiones. Intenta más tarde" }), productoController.obtenerRecomendados);


// --- Reseñas ---
router.get('/:id/resenas', productoController.obtenerResenasPorProducto);
router.post('/:id/resenas', (req, res, next) => req.isAuthenticated() ? next() : res.status(401).json({ error: "No autenticado" }), productoController.agregarResena);


// --- Categorías y descuentos ---
router.get('/', productoController.obtenerProductos);
// --- Categorías (CRUD solo admin, RF-027; lectura pública) ---
router.get('/categorias', productoController.obtenerCategorias);
router.post('/categorias', esAdmin, rateLimit({ max: 30 }), productoController.crearCategoria);
router.put('/categorias/:id', esAdmin, rateLimit({ max: 30 }), productoController.actualizarCategoria);
router.delete('/categorias/:id', esAdmin, rateLimit({ max: 30 }), productoController.eliminarCategoria);
router.get('/descuentos', productoController.obtenerDescuentos);
router.post('/descuentos', esAdmin, rateLimit({ max: 30 }), productoController.crearDescuento);
router.get('/vendedores', productoController.obtenerVendedores);
router.get('/:id', productoController.obtenerProductoPorId);

// Acciones del Administrador (Dashboard / Edición) — solo admin
router.post('/', esAdmin, productoController.crearProducto);
router.put('/:id', esAdmin, productoController.actualizarProducto);
router.delete('/:id', esAdmin, productoController.eliminarProducto);


module.exports = router;
// Rutas de proveedores: listar (público, alimenta selects de la tienda) y
// crear (solo admin, desde el formulario de publicación de productos).
const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedorController');
const esAdmin = require('../middlewares/esAdmin');

// Público: la lista de proveedores alimenta el formulario de publicación
router.get('/', proveedorController.obtenerProveedores);

// Administración: crear proveedor al vuelo (mutación de catálogo cubierta
// por el rate limit global de 300/min por IP)
router.post('/', esAdmin, proveedorController.crearProveedor);

module.exports = router;

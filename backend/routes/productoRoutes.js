const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');

// Definimos la ruta de productos
router.get('/productos', productoController.obtenerProductos);

module.exports = router;
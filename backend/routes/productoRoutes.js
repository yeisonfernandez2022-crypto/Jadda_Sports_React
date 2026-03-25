const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');

router.get('/productos', productoController.obtenerProductos);

module.exports = router;
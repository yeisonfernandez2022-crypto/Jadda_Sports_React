const express = require('express');
const router = express.Router();

const { 
    agregarAlCarrito, 
    obtenerCarrito, 
    eliminarDelCarrito,
    actualizarCantidad
} = require('../controllers/carritoController');

const { verificarSesion } = require('../middlewares/authMiddleware'); 

// Rutas del carrito
router.post('/agregar', verificarSesion, agregarAlCarrito); 
router.get('/', verificarSesion, obtenerCarrito);
router.put('/actualizar/:id_carrito', verificarSesion, actualizarCantidad); // Ruta para cambios de cantidad
router.delete('/eliminar/:id_carrito', verificarSesion, eliminarDelCarrito);

module.exports = router;
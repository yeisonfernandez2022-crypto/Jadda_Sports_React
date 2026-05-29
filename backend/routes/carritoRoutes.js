const express = require('express');
const router = express.Router();

const { 
    agregarAlCarrito, 
    obtenerCarrito, 
    eliminarDelCarrito 
} = require('../controllers/carritoController');

// 1. IMPORTA EL MIDDLEWARE DE SESIÓN (asegúrate de que sea el mismo que usas para el perfil)
const { verificarSesion } = require('../middlewares/authMiddleware'); 

// 2. USA 'verificarSesion' EN LUGAR DE 'verificarToken'
router.post('/agregar', verificarSesion, agregarAlCarrito);
router.get('/', verificarSesion, obtenerCarrito);
router.delete('/eliminar/:id_carrito', verificarSesion, eliminarDelCarrito);

module.exports = router;
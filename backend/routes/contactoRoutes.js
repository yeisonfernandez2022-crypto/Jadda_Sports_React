const express = require('express');
const router = express.Router();
const contactoController = require('../controllers/contactoController');
const rateLimit = require('../middlewares/rateLimiter');

router.post('/', rateLimit({ max: 5, mensaje: "Demasiados mensajes. Intenta en 15 minutos" }), contactoController.enviarContacto);

module.exports = router;

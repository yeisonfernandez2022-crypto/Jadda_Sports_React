// Rutas del chat: conversaciones usuario-vendedor-admin + disputas de devolución
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });

router.post('/iniciar', verificarSesion, chatController.iniciar);
router.get('/conversaciones', verificarSesion, chatController.misConversaciones);
router.get('/no-leidos', verificarSesion, chatController.noLeidos);
router.get('/:id/mensajes', verificarSesion, chatController.mensajes);
router.post('/:id/mensajes', verificarSesion, chatController.enviar);
router.post('/:id/escalar', verificarSesion, chatController.escalar);

module.exports = router;

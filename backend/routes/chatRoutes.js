// Rutas del chat: conversaciones usuario-vendedor-admin + disputas de devolución
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });

// Abrir una conversación es barato pero crea filas CHAT y notifica a la contraparte.
router.post(
  '/iniciar',
  verificarSesion,
  rateLimit({ ventanaMs: 15 * 60 * 1000, max: 10, mensaje: "Demasiados chats abiertos en poco tiempo" }),
  chatController.iniciar
);
router.get('/conversaciones', verificarSesion, chatController.misConversaciones);
router.get('/no-leidos', verificarSesion, chatController.noLeidos);
router.get('/:id/mensajes', verificarSesion, chatController.mensajes);
// El polling del hilo es GET (4 s), el envío real es POST: 30/min por usuario
// evita el flood de la conversación propia y del buzón de la contraparte
// sin afectar a quien escribe rápido.
router.post(
  '/:id/mensajes',
  verificarSesion,
  rateLimit({ ventanaMs: 60 * 1000, max: 30, mensaje: "Demasiados mensajes. Espera un momento" }),
  chatController.enviar
);
router.post('/:id/escalar', verificarSesion, chatController.escalar);

module.exports = router;

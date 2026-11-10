// Ruta de PQR: crear petición
const express = require('express');
const router = express.Router();
const pqrController = require('../controllers/pqrController');
const rateLimit = require('../middlewares/rateLimiter');

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "No autenticado" });
}

// Cada PQR suena en la campana del admin: 5 por 15 min es holgado para un
// usuario real y frena el bombardeo de notificaciones.
router.post(
  '/',
  verificarSesion,
  rateLimit({ ventanaMs: 15 * 60 * 1000, max: 5, mensaje: "Demasiadas PQR enviadas. Intenta más tarde" }),
  pqrController.crearPqr
);

module.exports = router;

// Ruta de PQR: crear petición
const express = require('express');
const router = express.Router();
const pqrController = require('../controllers/pqrController');

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "No autenticado" });
}

router.post('/', verificarSesion, pqrController.crearPqr);

module.exports = router;

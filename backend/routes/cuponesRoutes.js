const express = require('express');
const router = express.Router();
const cuponesController = require('../controllers/cuponesController');

router.post('/validar', cuponesController.validarCupon);

module.exports = router;

// Rutas de los banners del carrusel de la portada.
// Lectura pública para la tienda; el CRUD y el listado completo solo admin.
const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const esAdmin = require('../middlewares/esAdmin');

// Público: cualquier visitante de la tienda necesita los banners activos
router.get('/', bannerController.listarPublicos);

// Administración: gestionar (la mutación de catálogo está cubierta por el
// rate limit global de 300/min por IP)
router.get('/admin', esAdmin, bannerController.listarTodos);
router.post('/', esAdmin, bannerController.crearBanner);
router.put('/:id', esAdmin, bannerController.editarBanner);
router.delete('/:id', esAdmin, bannerController.eliminarBanner);

module.exports = router;

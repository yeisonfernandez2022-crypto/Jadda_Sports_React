// Rutas de administrador: dashboard, gestión de compras y usuarios
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const esAdmin = require('../middlewares/esAdmin');

// Todas las rutas del panel admin exigen rol de administrador (ID_ROL = 1)
router.use(esAdmin);

router.get('/dashboard', adminController.obtenerDashboard);
router.get('/pendientes', adminController.obtenerPendientes);
router.get('/compras', adminController.obtenerTodasLasCompras);
router.put('/compras/:id/estado', adminController.actualizarEstadoCompra);
router.put('/compras/:id/envio', adminController.actualizarEstadoEnvio);
router.get('/compras/:id/factura', adminController.descargarFacturaAdmin);
  router.delete('/compras/:id', adminController.eliminarCompra);
router.get('/reportes/ventas', adminController.reporteVentas);
router.get('/analytics/mas-vendidos', adminController.masVendidos);
router.get('/usuarios', adminController.obtenerUsuarios);
  router.get('/usuarios/:id', adminController.obtenerUsuarioDetalle);
router.get('/productos', adminController.obtenerProductosAdmin);
router.post('/productos/:id/aprobar', adminController.aprobarProducto);
router.post('/productos/:id/rechazar', adminController.rechazarProducto);

module.exports = router;

// Rutas de vendedores: formulario "Ser vendedor" + aprobación admin + panel del vendedor
const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedorController');
const esAdmin = require('../middlewares/esAdmin');
const esVendedor = require('../middlewares/esVendedor');
const rateLimit = require('../middlewares/rateLimiter');

const verificarSesion = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

// --- Usuario (el POST no exige sesión: cualquiera puede postularse) ---
router.post('/solicitud', rateLimit({ max: 10, mensaje: "Demasiadas solicitudes. Intenta más tarde" }), vendedorController.solicitarVendedor);
router.get('/solicitud', verificarSesion, vendedorController.miSolicitud);

// --- Panel del vendedor (rol 6) ---
router.get('/mi-tienda', esVendedor, vendedorController.miTienda);
router.get('/productos', esVendedor, vendedorController.misProductos);
router.get('/productos/:id', esVendedor, vendedorController.obtenerProductoVendedor);
router.post('/productos', esVendedor, rateLimit({ max: 30 }), vendedorController.crearProductoVendedor);
router.put('/productos/:id', esVendedor, rateLimit({ max: 30 }), vendedorController.actualizarProductoVendedor);
router.delete('/productos/:id', esVendedor, rateLimit({ max: 30 }), vendedorController.eliminarProductoVendedor);
router.get('/ventas', esVendedor, vendedorController.ventasVendedor);
router.get('/reportes', esVendedor, rateLimit({ max: 60 }), vendedorController.reportesVendedor);
router.get('/reportes/excel', esVendedor, rateLimit({ max: 20 }), vendedorController.descargarReporteExcelVendedor);
router.get('/reportes/pdf', esVendedor, rateLimit({ max: 20 }), vendedorController.descargarReportePdfVendedor);
router.put('/ventas/:id/envio', esVendedor, rateLimit({ max: 60 }), vendedorController.actualizarEnvioVenta);
router.put('/ventas/:id/estado', esVendedor, rateLimit({ max: 60 }), vendedorController.actualizarEstadoVenta);
router.get('/devoluciones', esVendedor, vendedorController.devolucionesVendedor);
router.post('/devoluciones/:id/procesar', esVendedor, rateLimit({ max: 30 }), vendedorController.procesarDevolucionVendedor);
router.put('/empresa', esVendedor, vendedorController.actualizarEmpresa);

// --- Admin ---
router.get('/admin', esAdmin, rateLimit({ max: 60 }), vendedorController.obtenerSolicitudes);
router.post('/admin/:id/procesar', esAdmin, rateLimit({ max: 30 }), vendedorController.procesarSolicitud);

module.exports = router;

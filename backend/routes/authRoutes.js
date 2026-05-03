const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');

// --- RUTAS DE REGISTRO Y LOGIN ---
router.post('/registro', authController.registro);
router.post('/login', authController.login);

// Esta ruta es SOLO para la confirmación inicial después del registro
router.post('/confirmar', authController.confirmarCuenta);

// --- RUTAS DE RECUPERACIÓN DE CONTRASEÑA ---

// 1. Envía el código al correo
router.post('/recuperar-password', authController.recuperarPassword);

// 2. NUEVA RUTA: Valida el código sin chocar con el estado de la cuenta
// Asegúrate de que authController tenga una función llamada 'validarCodigoRecuperacion'
router.post('/verificar-codigo', authController.validarCodigoRecuperacion);

// 3. Guarda la nueva contraseña
router.post('/update-password', authController.actualizarPassword);

// Reenvío de código (Funciona para ambos flujos)
router.post("/reenviar-codigo", authController.reenviarCodigo);

// --- RUTAS DE REDES SOCIALES (Google/Facebook) ---
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    const nombre = encodeURIComponent(req.user.nombre);
    const foto = encodeURIComponent(req.user.foto); // <--- CAPTURAMOS LA FOTO
    res.redirect(`http://localhost:5173/principal?user=${nombre}&photo=${foto}`); // <--- LA PASAMOS POR URL
});

router.get('/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
    const nombre = encodeURIComponent(req.user.nombre);
    const foto = encodeURIComponent(req.user.foto); // <--- CAPTURAMOS LA FOTO
    res.redirect(`http://localhost:5173/principal?user=${nombre}&photo=${foto}`); // <--- LA PASAMOS POR URL
});

module.exports = router;
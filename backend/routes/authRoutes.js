// Rutas de autenticación: registro, login, confirmación, recuperación, perfil, OAuth
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const seguridadController = require('../controllers/seguridadController');
const passport = require('passport');
const rateLimit = require('../middlewares/rateLimiter');

// 🚀 MIDDLEWARE DE SESIÓN NATIVO DE PASSPORT
const verificarSesion = (req, res, next) => {
    // Passport añade automáticamente esta función al objeto 'req' si la sesión está activa
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next(); 
    }
    return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

// --- Registro y Login ---
router.post('/registro', rateLimit({ max: 5, mensaje: "Demasiados intentos de registro. Intenta en 15 minutos" }), authController.registro);
router.post('/login', rateLimit({ max: 10, mensaje: "Demasiados intentos de inicio de sesión. Intenta en 15 minutos" }), authController.login);
router.post('/social-login', authController.socialLogin);
router.post('/confirmar', rateLimit({ max: 10, mensaje: "Demasiados intentos de verificación. Intenta en 15 minutos" }), authController.confirmarCuenta);

// --- Recuperación de contraseña ---
router.post('/recuperar-password', rateLimit({ max: 5, mensaje: "Demasiadas solicitudes. Intenta en 15 minutos" }), authController.recuperarPassword);
router.post('/verificar-codigo', rateLimit({ max: 10, mensaje: "Demasiados intentos. Intenta en 15 minutos" }), authController.validarCodigoRecuperacion);
router.post('/update-password', rateLimit({ max: 10, mensaje: "Demasiados intentos. Intenta en 15 minutos" }), authController.actualizarPassword);
router.post("/reenviar-codigo", rateLimit({ max: 5, mensaje: "Demasiados reenvíos de código. Intenta en 15 minutos" }), authController.reenviarCodigo);



// --- Perfil de usuario ---
router.get('/perfil', verificarSesion, authController.obtenerPerfil); 

// --- OAuth Facebook ---
router.get('/facebook', (req, res, next) => {
    const returnTo = req.query.from || '/principal';
    passport.authenticate('facebook', {
        scope: ['email', 'public_profile'],
        state: returnTo
    })(req, res, next);
});

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        const returnTo = req.query.state || '/principal';
        const nombre = encodeURIComponent(req.user.nombre || req.user.NOMBRE_USUARIO);
        const foto = encodeURIComponent(req.user.foto || req.user.FOTO_URL || "");
        res.redirect(`http://localhost:5173${returnTo}?user=${nombre}&photo=${foto}`);
    }
);

// --- OAuth Google ---
router.get('/google', (req, res, next) => {
    // Capturamos de donde viene el usuario de los query params
    const returnTo = req.query.from || '/principal'; 
    
    // Pasamos esa ruta al 'state' de Passport
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state: returnTo 
    })(req, res, next);
});

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }), 
    (req, res) => {
        // Recuperamos la ruta original que pasamos en el 'state'
        const returnTo = req.query.state || '/principal';
        
        const nombre = encodeURIComponent(req.user.NOMBRE_USUARIO);
        const foto = encodeURIComponent(req.user.FOTO_URL || "");
        
        // Redirigimos a la ruta original capturada
        res.redirect(`http://localhost:5173${returnTo}?user=${nombre}&photo=${foto}`); 
    }
);

// --- RUTA DE ACTUALIZAR PERFIL ---
router.put(
  "/perfil",
  verificarSesion,
  authController.actualizarPerfil
);

// --- RUTA DE SUBIR FOTO DE PERFIL (base64 desde el navegador) ---
router.post(
  "/foto",
  verificarSesion,
  express.json({ limit: "10mb" }),
  authController.subirFotoPerfil
);


// --- RUTA DE CAMBIAR CONTRASEÑA ---
router.post('/cambiar-password', verificarSesion, seguridadController.cambiarPassword);

// --- CAMBIO SEGURO DE CORREO (contraseña actual + código al correo nuevo) ---
router.post('/cambiar-email', verificarSesion, rateLimit({ max: 5, mensaje: "Demasiados intentos de cambio de correo. Intenta en 15 minutos" }), authController.cambiarEmail);
router.post('/confirmar-cambio-email', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiados intentos. Intenta en 15 minutos" }), authController.confirmarCambioEmail);

// --- VERIFICACIÓN DE CONTRASEÑA ACTUAL (cambios sensibles, p. ej. teléfono) ---
router.post('/verificar-password', verificarSesion, rateLimit({ max: 10, mensaje: "Demasiados intentos. Intenta en 15 minutos" }), authController.verificarPassword);

// --- RUTA DE CERRAR SESIÓN ---
router.post('/logout', authController.logout);

module.exports = router;
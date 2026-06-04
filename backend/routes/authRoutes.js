const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');

// 🚀 MIDDLEWARE DE SESIÓN NATIVO DE PASSPORT
const verificarSesion = (req, res, next) => {
    // Passport añade automáticamente esta función al objeto 'req' si la sesión está activa
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next(); 
    }
    return res.status(401).json({ message: "No hay sesión activa en el servidor" });
};

// --- RUTAS DE REGISTRO Y LOGIN ---
router.post('/registro', authController.registro);
router.post('/login', authController.login);
router.post('/confirmar', authController.confirmarCuenta);

// --- RUTAS DE RECUPERACIÓN DE CONTRASEÑA ---
router.post('/recuperar-password', authController.recuperarPassword);
router.post('/verificar-codigo', authController.validarCodigoRecuperacion);
router.post('/update-password', authController.actualizarPassword);
router.post("/reenviar-codigo", authController.reenviarCodigo);



// --- 🚀 PERFIL DE USUARIO PROTEGIDO ---
router.get('/perfil', verificarSesion, authController.obtenerPerfil); 

// --- RUTAS DE REDES SOCIALES ---
// En authRoutes.js
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


// --- RUTA DE CERRAR SESIÓN ---
router.post('/logout', authController.logout);

module.exports = router;
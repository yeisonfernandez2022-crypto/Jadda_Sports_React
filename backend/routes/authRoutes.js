// Rutas de autenticación: registro, login, confirmación, recuperación, perfil, OAuth
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const seguridadController = require('../controllers/seguridadController');
const passport = require('passport');
const rateLimit = require('../middlewares/rateLimiter');
const crypto = require('crypto');

// Ruta de retorno SEGURA para las redirecciones OAuth: solo se acepta una
// ruta RELATIVA ("empieza por '/' y no por '//'"), sin '\' ni '://'. Si no
// cumple, se usa /principal (evita open redirect al concatenar
// FRONTEND_URL + returnTo en los callbacks).
const rutaRetornoSegura = (valor) => {
  if (typeof valor !== 'string') return '/principal';
  const ruta = valor.trim();
  if (
    !ruta.startsWith('/') ||
    ruta.startsWith('//') ||
    ruta.includes('\\') ||
    ruta.includes('://')
  ) {
    return '/principal';
  }
  return ruta;
};

// El state que viaja con el OAuth es AZAR (anti CSRF): la ruta de retorno
// REAL se guarda en req.session. Los callbacks comparan el state recibido
// contra el guardado antes de autenticar. Exportado para las pruebas.
router.rutaRetornoSegura = rutaRetornoSegura;

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
  router.post(
    '/social-login',
    rateLimit({ max: 10, mensaje: "Demasiados intentos de login social. Intenta en 15 minutos" }),
    authController.socialLogin
  );
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
    const returnTo = rutaRetornoSegura(req.query.from);
    req.session.csrfSocial = crypto.randomBytes(16).toString('hex');
    req.session.retornoSocial = returnTo;
    passport.authenticate('facebook', {
        scope: ['email', 'public_profile'],
        state: req.session.csrfSocial
    })(req, res, next);
});

router.get('/facebook/callback',
    (req, res, next) => {
        // El state que volvió DEBE ser el mismo que guardamos antes de
        // redirigir a Facebook (anti CSRF); la ruta de retorno sale de la
        // sesión, nunca del query del atacante.
        const esperado = req.session && req.session.csrfSocial;
        const recibido = req.query.state;
        if (!esperado || typeof recibido !== 'string' || recibido !== esperado) {
            return res.status(403).json({ ok: false, msg: "Callback OAuth inválido (state no coincide)" });
        }
        // req.login regenera la sesión: se extrae la ruta de retorno AHORA
        // para que sobreviva al login de passport.
        req.rutaRetornoOAuth = rutaRetornoSegura(req.session.retornoSocial);
        next();
    },
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        const returnTo = req.rutaRetornoOAuth || '/principal';
        delete req.session.csrfSocial;
        delete req.session.retornoSocial;
        const nombre = encodeURIComponent(req.user.nombre || req.user.NOMBRE_USUARIO);
        const foto = encodeURIComponent(req.user.foto || req.user.FOTO_URL || req.user.foto_url || "");
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}${returnTo}?user=${nombre}&photo=${foto}`);
    }
);

// --- OAuth Google ---
router.get('/google', (req, res, next) => {
    // Capturamos de donde viene el usuario de los query params
    const returnTo = rutaRetornoSegura(req.query.from);

    // State ALEATORIO (anti CSRF): el OAuth Viaja con el azar; la ruta de
    // retorno real se guarda en la sesión y el callback la recupera.
    req.session.csrfSocial = crypto.randomBytes(16).toString('hex');
    req.session.retornoSocial = returnTo;

    // Pasamos el state aleatorio a Passport, no la ruta
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: req.session.csrfSocial
    })(req, res, next);
});

router.get('/google/callback',
    (req, res, next) => {
        // El state que volvió DEBE ser el mismo que guardamos antes de
        // redirigir a Google (anti CSRF); la ruta de retorno sale de la
        // sesión, nunca del query del atacante.
        const esperado = req.session && req.session.csrfSocial;
        const recibido = req.query.state;
        if (!esperado || typeof recibido !== 'string' || recibido !== esperado) {
            return res.status(403).json({ ok: false, msg: "Callback OAuth inválido (state no coincide)" });
        }
        // req.login regenera la sesión: se extrae la ruta de retorno AHORA
        // para que sobreviva al login de passport.
        req.rutaRetornoOAuth = rutaRetornoSegura(req.session.retornoSocial);
        next();
    },
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // La ruta se guardó en req.rutaRetornoOAuth por el middleware previo
        const returnTo = req.rutaRetornoOAuth || '/principal';
        delete req.session.csrfSocial;
        delete req.session.retornoSocial;

        const nombre = encodeURIComponent(req.user.NOMBRE_USUARIO);
        const foto = encodeURIComponent(req.user.FOTO_URL || req.user.foto_url || "");

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Redirigimos a la ruta original capturada
        res.redirect(`${frontendUrl}${returnTo}?user=${nombre}&photo=${foto}`);
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
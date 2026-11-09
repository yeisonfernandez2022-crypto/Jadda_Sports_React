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

// OAuth opcional: sin credenciales el servidor arranca igual y esta ruta
// responde 503 en lugar de fallar con "Unknown authentication strategy".
const googleHabilitado = () => Boolean(process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);

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

// --- OAuth Google ---
router.get('/google', (req, res, next) => {
    if (!googleHabilitado()) {
        return res.status(503).json({ ok: false, msg: "Login con Google no está configurado en este servidor" });
    }
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
        if (!googleHabilitado()) {
            return res.status(503).json({ ok: false, msg: "Login con Google no está configurado en este servidor" });
        }
        // El state que volvió DEBE ser el mismo que guardamos antes de
        // redirigir a Google (anti CSRF); la ruta de retorno sale de la
        // sesión, nunca del query del atacante.
        const esperado = req.session && req.session.csrfSocial;
        const recibido = req.query.state;
        if (!esperado || typeof recibido !== 'string' || recibido !== esperado) {
            // Distinguimos la CAUSA para diagnosticar en producción: si la
            // sesión no llegó al callback la cookie del flujo social no
            // coincide con este dominio (p. ej. callback registrado en otro
            // host); si la sesión sí llegó, el fallo es el state (CSRF).
            const motivo = !esperado
                ? "la sesión del flujo social no llegó al callback"
                : "state no coincide";
            return res.status(403).json({ ok: false, msg: `Callback OAuth inválido (${motivo})` });
        }
        // req.login regenera la sesión: se extrae la ruta de retorno AHORA
        // para que sobreviva al login de passport.
        req.rutaRetornoOAuth = rutaRetornoSegura(req.session.retornoSocial);
        next();
    },
    (req, res, next) => {
        // Callback CUSTOM de passport: en fallo ya NO muere en /login (popup
        // en blanco) — redirige al popup con ?motivo= para que el AuthModal
        // muestre el error. En éxito inicia la sesión y sigue al handler de
        // más abajo (contratos de los tests intactos: 302 + ruta de sesión).
        passport.authenticate('google', (err, user, info) => {
            if (!user) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const returnTo = req.rutaRetornoOAuth || '/principal';
                const motivo = (info && info.message) || (err && err.message) || "Google no devolvió una cuenta utilizable";
                // Limpia el flujo social para no dejar la sesión sucia
                delete req.session.csrfSocial;
                delete req.session.retornoSocial;
                return res.redirect(`${frontendUrl}${returnTo}?motivo=${encodeURIComponent(motivo)}`);
            }
            req.logIn(user, (errLogin) => {
                if (errLogin) return next(errLogin);
                next();
            });
        })(req, res, next);
    },
    (req, res) => {
        // La ruta se guardó en req.rutaRetornoOAuth por el middleware previo
        const returnTo = req.rutaRetornoOAuth || '/principal';
        delete req.session.csrfSocial;
        delete req.session.retornoSocial;

        // Red de seguridad: alguna fuente de req.user podría llegar con claves
        // menores; el contrato normal es la estrategia de passport.js (claves BD).
        const nombre = encodeURIComponent(req.user?.NOMBRE_USUARIO || req.user?.nombre || "");
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

// --- AJUSTES DE PRIVACIDAD (toggle guardar historial en /perfil/privacidad) ---
router.put(
  "/privacidad",
  verificarSesion,
  rateLimit({ max: 30, mensaje: "Demasiados cambios de privacidad. Intenta en 15 minutos" }),
  authController.actualizarPrivacidad
);

// --- RUTA DE CERRAR SESIÓN ---
router.post('/logout', authController.logout);

module.exports = router;
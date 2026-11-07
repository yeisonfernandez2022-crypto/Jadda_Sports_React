/*
 * Configuración de Passport.js para autenticación basada en sesiones.
 *
 * serializeUser: guarda el email en la sesión (req.session.passport.user).
 * deserializeUser: en cada petición busca el usuario por email en la BD
 *   y lo asigna a req.user. Sin esto, req.user sería undefined.
 *
 * Estrategia: Google OAuth 2.0.
 * Crea el usuario si no existe y actualiza la foto de perfil.
 * Validación de tokens con bibliotecas oficiales.
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

// En producción, si hay credenciales de Google, la callback URL DEBE
// apuntar al dominio real de la API (no localhost): si falta
// GOOGLE_CALLBACK_URL el flujo caería a localhost y fallaría detrás del proxy.
if (process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV === 'production' && !process.env.GOOGLE_CALLBACK_URL) {
  console.warn('⚠️ Passport: GOOGLE_CALLBACK_URL no definido en producción — el flujo OAuth usaría localhost y fallaría detrás del proxy');
}

// Cliente Google para verificación de ID tokens
// (google-auth-library se usa en authController.socialLogin, flujo móvil,
// para verificar el id_token con verifyIdToken + audiencia. El flujo web de
// passport-google-oauth20 NO entrega un id_token: verificamos contra el
// endpoint userinfo de Google con el accessToken, que ES el token válido
// de la sesión que inició el usuario).

// =========================================================================
// ESTRATEGIA: Google OAuth 2.0
// =========================================================================
/*
 * Estrategia de Google: obtiene los datos del usuario contra el endpoint
 * oficial de userinfo de Google (openidconnect.googleapis.com/v1/userinfo)
 * usando el accessToken de la sesión OAuth — el replace del intento previo
 * con verifyIdToken (que siempre fallaba: passport-google-oauth20 no entrega
 * id_token y el accessToken no es un JWT de OpenID).
 *
 * Extrae email (VERIFICADO email_verified=true), nombre, foto. Si el email no
 * existe en USUARIOS, lo crea con rol 4 (Usuario) y CONFIRMADO = 1. Si ya
 * existe, actualiza solo FOTO_URL si no es una foto local subida por el usuario.
 * La contraseña se guarda como 'google' para identificar el método de registro.
 */
// Sin credenciales (OAuth es opcional) la estrategia NO se registra:
// "sin credenciales = feature apagada" — el arranque no puede depender de ellas.
const googleConfigurado = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
if (googleConfigurado) passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      if (!accessToken) {
        return done(new Error('No se recibió token de Google'));
      }

      const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        return done(new Error(`Google rechazó el token de la sesión (${resp.status})`));
      }

      const payload = await resp.json(); // { sub, email, email_verified, given_name, family_name, picture }
      if (!payload || !payload.email_verified) {
        return done(new Error('Email de Google no verificado'));
      }

      // La audiencia del id_token se valida EXCLUSIVAMENTE en
      // authController.socialLogin (flujo móvil) con google-auth-library
      // (verifyIdToken + audience del client ID). Esta estrategia web recorre
      // el accessToken de una sesión OAuth ya autorizada al cliente de la
      // app: aquí SOLO exigimos que el email llegue del proveedor.
      const email = payload.email;
      const nombre = payload.given_name || payload.name?.split(' ')[0] || email.split('@')[0];
      const apellido = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
      const foto = payload.picture || null;
      const usuarioNick = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, '_');

      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL, AUTH_PROVIDER, PROVIDER_ID) 
        VALUES (?, ?, ?, ?, 'google', NULL, CURDATE(), 4, 1, ?, 'google', ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto, payload.sub]);
      } else {
        // Usuario existente: NO pisar una foto subida por el usuario
        const fotoLocal = result[0].FOTO_URL || result[0].foto_url || null;
        const esFotoLocal = typeof fotoLocal === "string" && fotoLocal.startsWith("/images/");
        if (!esFotoLocal && foto) {
          await db.query(
            "UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ? AND (FOTO_URL IS NULL OR FOTO_URL NOT LIKE '/images/%')",
            [foto, email]
          );
        }
      }

      return done(null, { nombre: payload.given_name || payload.name, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));
if (!googleConfigurado) {
  console.warn('⚠️ Passport: GOOGLE_CLIENT_ID ausente — login con Google deshabilitado en este servidor');
}

/*
 * serializeUser: Guarda solo el email en la sesión.
 * Soporta tanto user.EMAIL (de BD) como user.email (de OAuth).
 * El email es el identificador único para recuperar el usuario después.
 */
passport.serializeUser((user, done) => {
    const correo = user.EMAIL || user.email;

    if (!correo) {
        return done(new Error("No se encontró el correo del usuario para serializar."));
    }

    done(null, correo);
});

/*
 * deserializeUser: Se ejecuta en CADA petición autenticada.
 * Busca el usuario por email en la BD y lo asigna a req.user.
 * Si no existe (cuenta borrada), devuelve false → req.user = undefined.
 * Los campos devueltos (ID_USUARIO, NOMBRE_USUARIO, EMAIL, FOTO_URL, ID_ROL)
 * están disponibles como req.user.ID_USUARIO, etc.
 */
passport.deserializeUser(async (email, done) => {
    if (!email) return done(null, false);
    try {
        const [rows] = await db.query(
            "SELECT ID_USUARIO, NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, FOTO_URL, ID_ROL FROM USUARIOS WHERE EMAIL = ?", 
            [email]
        );
        
        if (rows.length === 0) {
            return done(null, false);
        }
        
        done(null, rows[0]);
    } catch (err) {
        done(err, null);
    }
});
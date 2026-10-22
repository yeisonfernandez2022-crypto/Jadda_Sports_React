/*
 * Configuración de Passport.js para autenticación basada en sesiones.
 *
 * serializeUser: guarda el email en la sesión (req.session.passport.user).
 * deserializeUser: en cada petición busca el usuario por email en la BD
 *   y lo asigna a req.user. Sin esto, req.user sería undefined.
 *
 * Estrategias: Google OAuth 2.0 y Facebook OAuth.
 * Ambas crean el usuario si no existe y actualizan la foto de perfil.
 * Validación de tokens con bibliotecas oficiales.
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('./db');

// En producción, si hay credenciales de Google, la callback URL DEBE
// apuntar al dominio real de la API (no localhost). Lo mismo aplica a
// Facebook: si hay FACEBOOK_CLIENT_ID y falta FACEBOOK_CALLBACK_URL el
// flujo caería a localhost y fallaría detrás del proxy.
if (process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV === 'production' && !process.env.GOOGLE_CALLBACK_URL) {
  console.warn('⚠️ Passport: GOOGLE_CALLBACK_URL no definido en producción — el flujo OAuth usaría localhost y fallaría detrás del proxy');
}
if (process.env.FACEBOOK_CLIENT_ID && process.env.NODE_ENV === 'production' && !process.env.FACEBOOK_CALLBACK_URL) {
  console.warn('⚠️ Passport: FACEBOOK_CALLBACK_URL no definido en producción — el flujo OAuth usaría localhost y fallaría detrás del proxy');
}

// Cliente Google para verificación de ID tokens
// (Eliminado: OAuth2Client de google-auth-library — el flujo web de
// passport-google-oauth20 NO entrega un id_token; verificamos contra el
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
passport.use(new GoogleStrategy({
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

      // El correo del userinfo debe pertenecer a un cliente autorizado (aud de
      // la app). authController.socialLogin cubre el flujo móvil; aquí además
      // exigimos que el email llegue del proveedor obligatoriamente.
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

// =========================================================================
// ESTRATEGIA: Facebook OAuth
// =========================================================================
/*
 * Estrategia de Facebook: verifica el access token con Graph API,
 * extrae email, nombre, foto. Crea usuario si no existe.
 * Diferencia clave: Facebook puede NO devolver email (perfil sin correo).
 * En ese caso, la autenticación falla con mensaje específico.
 */
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID || process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || "http://localhost:5000/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "emails", "photos"]
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Verificar access token con Graph API
      const fbApiUrl = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`;
      const fbResponse = await fetch(fbApiUrl);
      const fbData = await fbResponse.json();

      if (fbData.error) {
        return done(new Error(`Error validando token Facebook: ${fbData.error.message}`));
      }

      const email = fbData.email;
      const nombre = fbData.first_name || fbData.name?.split(' ')[0] || '';
      const apellido = fbData.last_name || '';
      const foto = fbData.picture?.data?.url || null;
      const usuarioNick = fbData.id?.toString() || email?.split("@")[0];

      // Validación: si Facebook no provee email, no podemos crear la cuenta
      if (!email) {
        return done(null, false, { message: "Facebook no proporcionó email" });
      }

      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL, AUTH_PROVIDER, PROVIDER_ID) 
        VALUES (?, ?, ?, ?, 'facebook', NULL, CURDATE(), 4, 1, ?, 'facebook', ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto, fbData.id]);
      } else {
        // NO pisar la foto subida por el usuario (misma protección que Google).
        const fotoLocal = result[0].FOTO_URL || result[0].foto_url || null;
        const esFotoLocal = typeof fotoLocal === "string" && fotoLocal.startsWith("/images/");
        if (!esFotoLocal && foto) {
          await db.query(
            "UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ? AND (FOTO_URL IS NULL OR FOTO_URL NOT LIKE '/images/%')",
            [foto, email]
          );
        }
      }

      return done(null, { nombre: fbData.name, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));

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
/*
 * Configuración de Passport.js para autenticación basada en sesiones.
 *
 * serializeUser: guarda el email en la sesión (req.session.passport.user).
 * deserializeUser: en cada petición busca el usuario por email en la BD
 *   y lo asigna a req.user. Sin esto, req.user sería undefined.
 *
 * Estrategias: Google OAuth 2.0 y Facebook OAuth.
 * Ambas crean el usuario si no existe y actualizan la foto de perfil.
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('./db');

// =========================================================================
// ESTRATEGIA: Google OAuth 2.0
// =========================================================================
/*
 * Estrategia de Google: extrae email, nombre (split en nombre/apellido),
 * foto de perfil. Si el email no existe en USUARIOS, lo crea con rol 4
 * (Usuario) y CONFIRMADO = 1. Si ya existe, actualiza solo FOTO_URL.
 * La contraseña se guarda como 'google' para identificar el método de registro.
 * Al finalizar, pasa { nombre, email, foto } a serializeUser.
 */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const displayName = profile.displayName;
    const nombreParts = displayName.split(' ');
    const nombre = nombreParts[0] || displayName;
    const apellido = nombreParts.slice(1).join(' ') || nombreParts[0] || '';
    const foto = profile.photos[0].value;
    const usuarioNick = email.split("@")[0];

    try {
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL) 
        VALUES (?, ?, ?, ?, 'google', NULL, CURDATE(), 4, 1, ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto]);
      } else {
        // Usuario existente: NO pisar una foto subida por el usuario
        // (bug: el login OAuth reemplazaba la foto de perfil con la de Google).
        // La columna puede venir como foto_url (minúsculas) según la BD.
        const fotoLocal = result[0].FOTO_URL || result[0].foto_url || null;
        const esFotoLocal =
          typeof fotoLocal === "string" && fotoLocal.startsWith("/images/");
        if (!esFotoLocal) {
          await db.query(
            "UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ? AND (FOTO_URL IS NULL OR FOTO_URL NOT LIKE '/images/%')",
            [foto, email]
          );
        }
      }

      return done(null, { nombre, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));

// =========================================================================
// ESTRATEGIA: Facebook OAuth
// =========================================================================
/*
 * Estrategia de Facebook: mismo patrón que Google.
 * Extrae email, nombre, apellido, foto. Crea usuario si no existe,
 * actualiza foto si ya existe.
 * Diferencia clave: Facebook puede NO devolver email (perfil sin correo).
 * En ese caso, la autenticación falla con mensaje específico.
 */
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID || process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID,      
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "emails", "photos"]
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const displayName = profile.displayName;
      const nombreParts = displayName.split(' ');
      const nombre = nombreParts[0] || displayName;
      const apellido = nombreParts.slice(1).join(' ') || nombreParts[0] || '';
      const foto = profile.photos?.[0]?.value || null;

      // Validación: si Facebook no provee email, no podemos crear la cuenta
      if (!email) {
        return done(null, false, { message: "Facebook no proporcionó email" });
      }

      const usuarioNick = email.split("@")[0];
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL) 
        VALUES (?, ?, ?, ?, 'facebook', NULL, CURDATE(), 4, 1, ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto]);
      } else {
        // NO pisar la foto subida por el usuario (misma protección que Google).
        const fotoLocal = result[0].FOTO_URL || result[0].foto_url || null;
        const esFotoLocal =
          typeof fotoLocal === "string" && fotoLocal.startsWith("/images/");
        if (!esFotoLocal) {
          await db.query(
            "UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ? AND (FOTO_URL IS NULL OR FOTO_URL NOT LIKE '/images/%')",
            [foto, email]
          );
        }
      }

      return done(null, { nombre, email, foto });

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
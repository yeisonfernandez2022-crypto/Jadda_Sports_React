const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('./db');

// GOOGLE
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const nombre = profile.displayName;
    const foto = profile.photos[0].value; // <--- EXTRAEMOS LA FOTO
    const usuarioNick = email.split("@")[0];

    try {
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, DIRECCION, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL) 
        VALUES (?, ?, ?, ?, 'google', 'N/A', 'N/A', CURDATE(), 2, 1, ?)`; // <--- AGREGAMOS FOTO_URL

        await db.query(insert, [nombre, "Google", email, usuarioNick, foto]);
      } else {
        // Opcional: Actualizar la foto por si el usuario la cambió en Google
        await db.query("UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ?", [foto, email]);
      }

      return done(null, { nombre, email, foto }); // <--- PASAMOS LA FOTO AL SERIALIZER

    } catch (err) {
      return done(err);
    }
  }
));

// FACEBOOK
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,      
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "emails", "photos"] // <--- AGREGAMOS "photos"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const nombre = profile.displayName;
      const foto = profile.photos?.[0]?.value || null; // <--- EXTRAEMOS LA FOTO

      if (!email) {
        return done(null, false, { message: "Facebook no proporcionó email" });
      }

      const usuarioNick = email.split("@")[0];
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, DIRECCION, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL) 
        VALUES (?, ?, ?, ?, 'facebook', 'N/A', 'N/A', CURDATE(), 2, 1, ?)`;

        await db.query(insert, [nombre, "Facebook", email, usuarioNick, foto]);
      } else {
        await db.query("UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ?", [foto, email]);
      }

      return done(null, { nombre, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
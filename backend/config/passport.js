const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('./db');

// GOOGLE
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
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
        VALUES (?, ?, ?, ?, 'google', 'N/A', CURDATE(), 2, 1, ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto]);
      } else {
        
        await db.query("UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ?", [foto, email]);
      }

      return done(null, { nombre, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));

// FACEBOOK
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,      
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "emails", "photos"] // <--- AGREGAMOS "photos"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const displayName = profile.displayName;
      const nombreParts = displayName.split(' ');
      const nombre = nombreParts[0] || displayName;
      const apellido = nombreParts.slice(1).join(' ') || nombreParts[0] || '';
      const foto = profile.photos?.[0]?.value || null;

      if (!email) {
        return done(null, false, { message: "Facebook no proporcionó email" });
      }

      const usuarioNick = email.split("@")[0];
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS 
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL) 
        VALUES (?, ?, ?, ?, 'facebook', 'N/A', CURDATE(), 2, 1, ?)`;

        await db.query(insert, [nombre, apellido, email, usuarioNick, foto]);
      } else {
        await db.query("UPDATE USUARIOS SET FOTO_URL = ? WHERE EMAIL = ?", [foto, email]);
      }

      return done(null, { nombre, email, foto });

    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
    // Probamos con EMAIL (mayúsculas) o email (minúsculas) por si acaso
    const correo = user.EMAIL || user.email;

    if (!correo) {
        return done(new Error("No se encontró el correo del usuario para serializar."));
    }

    done(null, correo);
});

// 2. DESERIALIZAR: Recuperamos el usuario de la BD en cada petición
passport.deserializeUser(async (email, done) => {
    try {
        const [rows] = await db.query(
            "SELECT ID_USUARIO, NOMBRE_USUARIO, EMAIL, FOTO_URL FROM USUARIOS WHERE EMAIL = ?", 
            [email]
        );
        
        if (rows.length === 0) {
            return done(null, false);
        }
        
        // Esto es lo que aparecerá en req.user en cada ruta de tu backend
        done(null, rows[0]);
    } catch (err) {
        done(err, null);
    }
});
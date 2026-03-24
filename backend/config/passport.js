const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const nombre = profile.displayName;
    const usuarioNick = email.split("@")[0];

    try {
      const [result] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
      if (result.length === 0) {
        const insert = `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, TELEFONO, DIRECCION, FECHA_REGISTRO, ID_ROL, CONFIRMADO) VALUES (?, ?, ?, ?, 'google', 'N/A', 'N/A', CURDATE(), 2, 1)`;
        await db.query(insert, [nombre, "Google", email, usuarioNick]);
        return done(null, { nombre, email });
      }
      return done(null, { nombre: result[0].NOMBRE_USUARIO, email: result[0].EMAIL });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
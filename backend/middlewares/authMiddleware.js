/*
 * Middlewares de autenticación.
 * 
 * verificarToken  → Legacy JWT (ya no se usa en ninguna ruta activa).
 * verificarSesion → Middleware activo basado en Passport + sesiones.
 */

const jwt = require('jsonwebtoken');

/*
 * verificarToken (legacy — no usado actualmente)
 * Queda como respaldo por si se requiere JWT en el futuro.
 * Lee el token del header Authorization, lo verifica con
 * jsonwebtoken y asigna el payload decodificado a req.user.
 * Efecto secundario: req.user contiene { id, email, ... } del token.
 */
exports.verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send("Token requerido");

  jwt.verify(token, process.env.JWT_SECRET || "secreto", (err, decoded) => {
    if (err) return res.status(403).send("Token inválido");
    req.user = decoded;
    next();
  });
};

/*
 * verificarSesion — Middlewar activo para rutas protegidas.
 * Usa req.isAuthenticated() de Passport (revisa si hay sesión válida).
 * Sin sesión, responde 401 con JSON.
 * Con sesión, deja pasar y req.user está disponible.
 */
exports.verificarSesion = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ ok: false, msg: "No autorizado" });
};
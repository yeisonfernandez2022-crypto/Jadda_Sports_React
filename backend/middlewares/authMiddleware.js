/*
 * Middlewares de autenticación.
 *
 * verificarSesion → Middleware activo basado en Passport + sesiones.
 */

/*
 * verificarSesion — Middleware activo para rutas protegidas.
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

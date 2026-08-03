/**
 * esAdmin: protege rutas del panel de administración.
 * Requiere sesión activa y rol de administrador (ID_ROL = 1).
 */
module.exports = function esAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
  }
  if (Number(req.user.ID_ROL) !== 1) {
    return res.status(403).json({ ok: false, msg: "No tienes permisos de administrador" });
  }
  next();
};

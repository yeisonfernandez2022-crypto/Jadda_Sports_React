// Rutas de notificaciones: campana del usuario y del panel admin
const router = require("express").Router();
const notificacionController = require("../controllers/notificacionController");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get("/", verificarSesion, notificacionController.misNotificaciones);
router.get("/no-leidas", verificarSesion, notificacionController.noLeidas);
router.post("/leer-todas", verificarSesion, notificacionController.marcarTodasLeidas);
router.post("/:id/leida", verificarSesion, notificacionController.marcarLeida);
router.delete("/:id", verificarSesion, notificacionController.eliminarNotificacion);
router.delete("/", verificarSesion, notificacionController.eliminarLeidas);

module.exports = router;

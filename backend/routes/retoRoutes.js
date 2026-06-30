// Rutas de retos deportivos: listar, inscribirse, progreso, completar
const router = require("express").Router();
const retoController = require("../controllers/retoController");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get("/", verificarSesion, retoController.obtenerRetos);
router.get("/mis-retos", verificarSesion, retoController.misRetos);
router.post("/unirse/:id_reto", verificarSesion, retoController.unirseReto);
router.post("/progreso/:id_reto_usuario", verificarSesion, retoController.reportarProgreso);
router.post("/completar/:id_reto_usuario", verificarSesion, retoController.completarReto);

module.exports = router;

const router = require("express").Router();
const planController = require("../controllers/planController");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get("/", verificarSesion, planController.misPlanes);
router.post("/generar", verificarSesion, planController.generarPlan);
router.post("/marcar-dia/:id_plan", verificarSesion, planController.marcarDia);

module.exports = router;

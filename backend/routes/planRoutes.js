// Rutas de planes de entrenamiento: listar, generar, marcar día
const router = require("express").Router();
const rateLimit = require("../middlewares/rateLimiter");
const planController = require("../controllers/planController");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get("/", verificarSesion, planController.misPlanes);
// Generar plan lee PLANTILLAS y crea filas: 10 por 15 min es muy por encima
// del uso legítimo (la app genera al completar una compra).
router.post(
  "/generar",
  verificarSesion,
  rateLimit({ ventanaMs: 15 * 60 * 1000, max: 10, mensaje: "Demasiadas generaciones de plan. Intenta más tarde" }),
  planController.generarPlan
);
router.post("/marcar-dia/:id_plan", verificarSesion, planController.marcarDia);

module.exports = router;

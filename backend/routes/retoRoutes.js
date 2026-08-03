// Rutas de retos deportivos: listar, inscribirse, progreso, completar, evidencias
const router = require("express").Router();
const express = require("express");
const retoController = require("../controllers/retoController");
const esAdmin = require("../middlewares/esAdmin");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

router.get("/", verificarSesion, retoController.obtenerRetos);
router.get("/mis-retos", verificarSesion, retoController.misRetos);
router.get("/evidencias/:id_reto_usuario", verificarSesion, retoController.misEvidencias);
router.post("/unirse/:id_reto", verificarSesion, retoController.unirseReto);
router.post(
  "/progreso/:id_reto_usuario",
  verificarSesion,
  express.json({ limit: "100mb" }),
  retoController.reportarProgreso
);

// --- Admin: revisión de evidencias (solo rol administrador) ---
router.get("/admin/evidencias", esAdmin, retoController.adminEvidencias);
router.post("/admin/evidencias/:id_evidencia/aprobar", esAdmin, retoController.aprobarEvidencia);
router.post("/admin/evidencias/:id_evidencia/rechazar", esAdmin, retoController.rechazarEvidencia);

module.exports = router;

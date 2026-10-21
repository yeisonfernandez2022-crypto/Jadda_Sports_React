// Rutas de retos deportivos: listar, inscribirse, progreso, completar, evidencias
const router = require("express").Router();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const retoController = require("../controllers/retoController");
const esAdmin = require("../middlewares/esAdmin");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

// Subida de evidencias con multer: STREAMING a disco (no base64, no memoria).
// Soporta archivos (hasta 100 MB c/u) sin colapsar la app; el controller los
// reenvía a Cloudinary y elimina el archivo temporal.
// Estructura: uploads/usuarios/{USUARIO}/retos/r{id_reto_usuario}/
const { USUARIOS_DIR, claveDeReq } = require("../utils/carpetaUsuario");
const { archivoEvidenciaValido, LIMITES_EVIDENCIAS } = require("../utils/validarSubida");
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(USUARIOS_DIR, claveDeReq(req), "retos", `r${req.params.id_reto_usuario}`);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext =
        file.mimetype === "image/jpeg" ? "jpg"
        : file.mimetype === "video/quicktime" ? "mov"
        : file.mimetype.split("/")[1] || "bin";
      cb(null, `ev-${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`);
    },
  }),
  limits: LIMITES_EVIDENCIAS, // 25 MB por archivo, máx 5 (centralizado en utils/validarSubida.js)
  fileFilter: archivoEvidenciaValido, // MIME real + coherencia extensión <-> mime
});

router.get("/", verificarSesion, retoController.obtenerRetos);
router.get("/mis-retos", verificarSesion, retoController.misRetos);
router.get("/evidencias/:id_reto_usuario", verificarSesion, retoController.misEvidencias);
router.delete("/evidencias/:id_evidencia", verificarSesion, retoController.eliminarEvidencia);
router.post("/unirse/:id_reto", verificarSesion, retoController.unirseReto);

// Multipart (nuevo): uno o más archivos en el campo "materiales" + "cantidad".
// Se conserva la rama base64 en el controller por compatibilidad con el viejo frontend.
router.post(
  "/progreso/:id_reto_usuario",
  verificarSesion,
  (req, res, next) => {
    upload.array("materiales", 10)(req, res, (err) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE"
          ? "Cada foto o video debe pesar máximo 100 MB"
          : err.message || "Error al subir los archivos";
        return res.status(400).json({ ok: false, msg });
      }
      next();
    });
  },
  retoController.reportarProgreso
);

// --- Admin: revisión de evidencias (solo rol administrador) ---
router.get("/admin/evidencias", esAdmin, retoController.adminEvidencias);
router.post("/admin/evidencias/:id_evidencia/aprobar", esAdmin, retoController.aprobarEvidencia);
router.post("/admin/evidencias/:id_evidencia/rechazar", esAdmin, retoController.rechazarEvidencia);

module.exports = router;
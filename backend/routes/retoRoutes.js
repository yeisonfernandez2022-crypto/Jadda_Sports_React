// Rutas de retos deportivos: listar, inscribirse, progreso, completar, evidencias
const router = require("express").Router();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const rateLimit = require("../middlewares/rateLimiter");
const retoController = require("../controllers/retoController");
const esAdmin = require("../middlewares/esAdmin");

function verificarSesion(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });
}

// Subida de evidencias con multer: STREAMING a disco (no base64, no memoria).
// Soporta archivos (hasta 25 MB c/u) sin colapsar la app; el controller los
// reenvía a Cloudinary y elimina el archivo temporal.
// Estructura: uploads/usuarios/{USUARIO}/retos/r{id_reto_usuario}/
const { USUARIOS_DIR, claveDeReq } = require("../utils/carpetaUsuario");
const {
  archivoEvidenciaValido,
  LIMITES_EVIDENCIAS,
  MAX_EVIDENCIA_MB,
  MAX_EVIDENCIAS,
  verificarContenidosReales,
  EXTENSION_DE_MIME,
} = require("../utils/validarSubida");

/*
 * S6082: la carpeta destino se construye a partir de req.params, que llega
 * DECODIFICADO — un "1/../.." en la URL (los %2F se decodifican a '/') escapaba
 * de uploads/usuarios y multer habría escrito el archivo donde el atacante
 * pidiera. Doble barrera:
 *   1) el id EXIGE solo dígitos (rechaza "1/../..", "1/x", negativos…);
 *   2) el destino resuelto DEBE quedar dentro de USUARIOS_DIR, si no se
 *      rechaza la subida (defensa en profundidad).
 * El Error llega al handler de la ruta → 400 con el mensaje.
 */
function carpetaDestinoReto(req) {
  const idBruto = String((req.params && req.params.id_reto_usuario) || "");
  if (!/^\d+$/.test(idBruto)) return null;
  const idRetoUsuario = Number(idBruto);
  const raiz = path.resolve(USUARIOS_DIR);
  const destino = path.resolve(path.join(USUARIOS_DIR, claveDeReq(req), "retos", `r${idRetoUsuario}`));
  return destino.startsWith(raiz + path.sep) ? destino : null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = carpetaDestinoReto(req);
      if (!dir) { cb(new Error("Identificador de reto no válido")); return; }
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Extensión de LISTA BLANCA: el MIME de la cabecera solo elige ENTRE las
      // alternativas del mapa (fileFilter ya admite únicamente esos MIMEs).
      // Nunca se deriva del mimetype/originalname que manda el cliente.
      const ext = EXTENSION_DE_MIME[file.mimetype] || "bin";
      // Nombre aleatorio CSPRNG (no Math.random): además de descongestionar,
      // evita colocaciones dentro de UNA petición multipart de N archivos.
      cb(null, `ev-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`);
    },
  }),
  limits: LIMITES_EVIDENCIAS, // 25 MB por archivo, máx 5 (centralizado en utils/validarSubida.js)
  fileFilter: archivoEvidenciaValido, // MIME real + coherencia extensión <-> mime
});

router.get("/", verificarSesion, retoController.obtenerRetos);
router.get("/mis-retos", verificarSesion, retoController.misRetos);
router.get("/evidencias/:id_reto_usuario", verificarSesion, retoController.misEvidencias);
router.delete("/evidencias/:id_evidencia", verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 10, mensaje: "Demasiadas eliminaciones. Intenta más tarde" }), retoController.eliminarEvidencia);
router.post("/unirse/:id_reto", verificarSesion, rateLimit({ ventanaMs: 15 * 60 * 1000, max: 10, mensaje: "Demasiadas inscripciones. Intenta más tarde" }), retoController.unirseReto);

// Multipart (nuevo): uno o más archivos en el campo "materiales" + "cantidad".
// Se conserva la rama base64 en el controller por compatibilidad con el viejo frontend.
// El límite (10/15 min, clave = usuario autenticado) va ANTES de multer para
// que las peticiones rechazadas ni siquiera escriban archivos en disco: cada
// petición válida mueve hasta 125 MB (5 × 25 MB) a Cloudinary/disco.
router.post(
  "/progreso/:id_reto_usuario",
  verificarSesion,
  rateLimit({ ventanaMs: 15 * 60 * 1000, max: 10, mensaje: "Demasiadas subidas de avance. Espera un momento" }),
  (req, res, next) => {
    upload.array("materiales", MAX_EVIDENCIAS)(req, res, (err) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE"
          ? `Cada foto o video debe pesar máximo ${MAX_EVIDENCIA_MB} MB`
          : err.code === "LIMIT_FILE_COUNT"
            ? `Máximo ${MAX_EVIDENCIAS} archivos por avance`
            : err.message || "Error al subir los archivos";
        return res.status(400).json({ ok: false, msg });
      }
      next();
    });
  },
  verificarContenidosReales,
  retoController.reportarProgreso
);

// --- Admin: revisión de evidencias (solo rol administrador) ---
router.get("/admin/evidencias", esAdmin, retoController.adminEvidencias);
router.post("/admin/evidencias/:id_evidencia/aprobar", esAdmin, retoController.aprobarEvidencia);
router.post("/admin/evidencias/:id_evidencia/rechazar", esAdmin, retoController.rechazarEvidencia);

module.exports = router;
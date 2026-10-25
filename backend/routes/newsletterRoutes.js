const router = require("express").Router();
const esAdmin = require("../middlewares/esAdmin");
const rateLimit = require("../middlewares/rateLimiter");
const {
  suscribirNewsletter,
  desuscribirNewsletter,
  desuscribirPagina,
  obtenerSuscritos,
  enviarAhora,
} = require("../controllers/newsletterController");

router.post("/", rateLimit({ max: 5, mensaje: "Demasiadas suscripciones. Intenta más tarde" }), suscribirNewsletter);
router.post("/desuscribir", rateLimit({ max: 10 }), desuscribirNewsletter);
router.get("/desuscribir", rateLimit({ max: 10 }), desuscribirPagina);
router.get("/suscritos", esAdmin, rateLimit({ max: 60 }), obtenerSuscritos);
router.post("/enviar", esAdmin, rateLimit({ max: 10, mensaje: "Demasiados envíos. Espera un momento" }), enviarAhora);

module.exports = router;
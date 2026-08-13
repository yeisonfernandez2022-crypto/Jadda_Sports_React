const router = require("express").Router();
const esAdmin = require("../middlewares/esAdmin");
const {
  suscribirNewsletter,
  desuscribirNewsletter,
  desuscribirPagina,
  obtenerSuscritos,
  enviarAhora,
} = require("../controllers/newsletterController");

router.post("/", suscribirNewsletter);
router.post("/desuscribir", desuscribirNewsletter);
router.get("/desuscribir", desuscribirPagina);
router.get("/suscritos", esAdmin, obtenerSuscritos);
router.post("/enviar", esAdmin, enviarAhora);

module.exports = router;
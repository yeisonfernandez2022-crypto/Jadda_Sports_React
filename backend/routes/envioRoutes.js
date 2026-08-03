const router = require("express").Router();
const { calcularEnvio } = require("../controllers/envioController");

router.get("/calcular", calcularEnvio);

module.exports = router;

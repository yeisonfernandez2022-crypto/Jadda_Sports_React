const router = require("express").Router();
const { obtenerTarifas, calcularEnvio } = require("../controllers/envioController");

router.get("/tarifas", obtenerTarifas);
router.get("/calcular", calcularEnvio);

module.exports = router;

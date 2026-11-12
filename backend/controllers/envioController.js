const {
  calcularCostoEnvio,
  TARIFAS_DEPARTAMENTO,
  TARIFAS_CIUDAD,
  TARIFA_DEFAULT,
  ENVIO_GRATIS_DESDE,
} = require('../utils/envio');

/**
 * GET /api/envio/tarifas
 * Expone las tarifas del dominio de envío (solo lectura, sin BD y sin sesión):
 * tabla por departamento, tabla por ciudad, tarifa por defecto y el umbral
 * de subtotal a partir del cual el envío es gratis.
 */
const obtenerTarifas = (req, res) => {
  res.json({
    ok: true,
    tarifas: {
      departamento: TARIFAS_DEPARTAMENTO,
      ciudad: TARIFAS_CIUDAD,
    },
    tarifa_default: TARIFA_DEFAULT,
    envio_gratis_desde: ENVIO_GRATIS_DESDE,
  });
};

/**
 * GET /api/envio/calcular?departamento=...&subtotal=...
 * Devuelve el costo de envío para el departamento dado.
 */
const calcularEnvio = async (req, res) => {
  const { departamento, ciudad, subtotal } = req.query;
  try {
    const costo = calcularCostoEnvio(departamento || "", ciudad || "", Number(subtotal) || 0);
    res.json({ ok: true, departamento: departamento || "", ciudad: ciudad || "", costo, gratis: costo === 0 });
  } catch (err) {
    console.error("Error al calcular envío:", err);
    res.status(500).json({ ok: false, msg: "Error al calcular envío" });
  }
};

module.exports = { obtenerTarifas, calcularEnvio };

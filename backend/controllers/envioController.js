const { calcularCostoEnvio } = require('../utils/envio');

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

module.exports = { calcularEnvio };

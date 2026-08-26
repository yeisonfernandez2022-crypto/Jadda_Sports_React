/**
 * Reglas de negocio de los cupones RETO- (compartidas por retoController,
 * cuponesController y checkoutController para que todas usen la misma tabla).
 *
 * El descuento del reto se aplica a TODA la compra, pero con compra mínima
 * escalada: a mayor porcentaje de recompensa, mayor compromiso del carrito.
 * (Nota: el envío gratis real es desde $800.000, ver utils/envio.js.)
 */
const TABLA_MINIMOS = [
  { desde: 10, minimo: 200000 }, // 10% o más
  { desde: 7, minimo: 150000 },  // 7% – 9%
  { desde: 5, minimo: 100000 },  // 5% – 6%
  { desde: 0, minimo: 50000 },   // 3% – 4%
];

/** Compra mínima según el porcentaje de recompensa del reto. */
function montoMinimoSegunPorcentaje(porcentaje) {
  const p = Number(porcentaje) || 0;
  const tramo = TABLA_MINIMOS.find((t) => p >= t.desde);
  return tramo ? tramo.minimo : 50000;
}

const esCuponReto = (descripcion) => /^RETO-/.test(String(descripcion || "").trim());

/** Texto legible de las condiciones para correos/notificaciones. */
function textoCondiciones(descripcion, porcentaje, montoMinimo) {
  const partes = [`${Number(porcentaje)}% de descuento`, "un solo uso"];
  if (montoMinimo) partes.push(`compra mínima $${Number(montoMinimo).toLocaleString("es-CO")}`);
  return partes.join(" · ");
}

module.exports = { montoMinimoSegunPorcentaje, esCuponReto, textoCondiciones };

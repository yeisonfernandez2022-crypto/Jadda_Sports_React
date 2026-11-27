/*
 * Formato monetario único de la tienda (hallazgo #25).
 *
 * El código usaba `toLocaleString()` sin locale en los correos de checkout y
 * de pago: el resultado dependía del ICU del proceso (en-US producía
 * "1,234,567"). La tienda es colombiana y todos los correos/facturas deben
 * usar es-CO: punto de miles y coma decimal.
 *
 * Los valores llegan de MySQL como DECIMAL (string) o como number; el helper
 * normaliza ambos y devuelve "0" si el valor no es finito.
 */
function formatearMonedaCOP(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0";
  return numero.toLocaleString("es-CO");
}

module.exports = { formatearMonedaCOP };

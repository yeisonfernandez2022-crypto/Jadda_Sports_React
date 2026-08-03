/**
 * Cálculo de costo de envío basado en el departamento de destino.
 * Tabla simple de tarifas fijas por departamento (COP).
 * Si el subtotal supera el umbral, el envío es gratis.
 */
const TARIFAS_DEPARTAMENTO = {
  "BOGOTA": 8000,
  "CUNDINAMARCA": 10000,
  "ANTIOQUIA": 9000,
  "VALLE DEL CAUCA": 9000,
  "ATLANTICO": 10000,
  "BOLIVAR": 11000,
  "SANTANDER": 10000,
  "NORTE DE SANTANDER": 12000,
  "TOLIMA": 10000,
  "HUILA": 11000,
  "META": 12000,
  "CALDAS": 10000,
  "RISARALDA": 10000,
  "QUINDIO": 10000,
  "CAUCA": 11000,
  "NARINO": 12000,
  "CORDOBA": 12000,
  "SUCRE": 12000,
  "MAGDALENA": 12000,
  "CESAR": 13000,
  "LA GUAJIRA": 15000,
  "CASANARE": 14000,
  "PUTUMAYO": 14000,
  "BOYACA": 11000,
};

const TARIFA_DEFAULT = 15000;
const ENVIO_GRATIS_DESDE = 200000;

/** Normaliza texto: mayúsculas, sin tildes y sin signos de puntuación. */
function normalizar(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Calcula el costo de envío para un departamento y subtotal dados. */
function calcularCostoEnvio(departamento = "", subtotal = 0) {
  const subtotalNum = Number(subtotal) || 0;
  if (subtotalNum >= ENVIO_GRATIS_DESDE) return 0;

  const dept = normalizar(departamento);
  if (!dept) return 0;

  for (const [nombre, tarifa] of Object.entries(TARIFAS_DEPARTAMENTO)) {
    if (dept === nombre || dept.startsWith(nombre)) return tarifa;
  }
  return TARIFA_DEFAULT;
}

module.exports = { calcularCostoEnvio, TARIFAS_DEPARTAMENTO, ENVIO_GRATIS_DESDE };

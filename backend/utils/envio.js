/**
 * Cálculo de costo de envío basado en el departamento y la ciudad de destino.
 * Las ciudades principales tienen su propia tarifa; si la ciudad no está
 * catalogada, cae a la tarifa del departamento; sin departamento conocido, default.
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

// Tarifas por ciudad: las capitales/departamentos grandes son más baratos
// de enviar; ciudades cercanas o medias pagan un poco más.
const TARIFAS_CIUDAD = {
  "BOGOTA": 8000,
  "MEDELLIN": 9000,
  "CALI": 9000,
  "BARRANQUILLA": 10000,
  "CARTAGENA": 11000,
  "BUCARAMANGA": 10000,
  "SANTA MARTA": 12000,
  "CUCUTA": 11000,
  "IBAGUE": 10000,
  "PEREIRA": 10000,
  "MANIZALES": 10000,
  "ARMENIA": 10000,
  "VILLAVICENCIO": 12000,
  "PASTO": 12000,
  "TUNJA": 11000,
  "NEIVA": 11000,
  "POPAYAN": 11000,
  "RIOHACHA": 15000,
  "VALLEDUPAR": 13000,
  "MONTERIA": 12000,
  "SINCELEJO": 12000,
  "QUIBDO": 14000,
  "YOPAL": 14000,
  "FLORENCIA": 14000,
  "MOCOA": 14000,
  // Municipios vecinos / área metropolitana: más económicos
  "SOLEDAD": 10000,
  "MALAMBO": 10000,
  "BELLO": 9000,
  "ENVIGADO": 9000,
  "ITAGUÍ": 9000,
  "FLORIDABLANCA": 10000,
  "GIRON": 10000,
  "PIEDECUESTA": 10000,
  "DOSQUEBRADAS": 10000,
  "CHIA": 10000,
  "SOACHA": 10000,
  "ZIPAQUIRA": 10000,
  "MADRID": 10000,
  "CALARCA": 10000,
};

const TARIFA_DEFAULT = 15000;
const ENVIO_GRATIS_DESDE = 800000;

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

/** Calcula el costo de envío para un departamento, ciudad y subtotal dados.
 *  Prioriza la ciudad (tarifa más precisa), luego el departamento, luego el default. */
function calcularCostoEnvio(departamento = "", ciudad = "", subtotal = 0) {
  const subtotalNum = Number(subtotal) || 0;
  if (subtotalNum >= ENVIO_GRATIS_DESDE) return 0;

  const dept = normalizar(departamento);
  const city = normalizar(ciudad);

  if (city) {
    for (const [nombre, tarifa] of Object.entries(TARIFAS_CIUDAD)) {
      if (city === nombre || city.startsWith(nombre) || nombre.startsWith(city)) return tarifa;
    }
  }
  if (dept) {
    for (const [nombre, tarifa] of Object.entries(TARIFAS_DEPARTAMENTO)) {
      if (dept === nombre || dept.startsWith(nombre)) return tarifa;
    }
  }
  return TARIFA_DEFAULT;
}

module.exports = { calcularCostoEnvio, TARIFAS_DEPARTAMENTO, TARIFAS_CIUDAD, TARIFA_DEFAULT, ENVIO_GRATIS_DESDE };
const crypto = require("crypto");

/**
 * Utilidad de la pasarela de pagos (Fase 6) — Wompi.
 * Documentación: docs/auditoria/pasarela-pagos-plan.md
 *
 * - Sandbox: llaves pub_test_ / prv_test_ / test_events_ / test_integrity_
 * - Checkout redirect: https://checkout.wompi.co/p/ con signature:integrity
 *   (SHA256 de `{referencia}{centavos}{moneda}{expiracion?}{integridad}`;
 *   si no se envía expiración el hash incluye la lista vacía en su lugar)
 * - Eventos webhook: SHA256 de los valores de data en el orden de
 *   signature.properties + timestamp + WOMPI_EVENTS_SECRET (hex MAYÚSCULAS)
 * - Nunca se confía en el payload del evento: se re-consulta la transacción
 *   por id en la API de Wompi.
 */

const BASE_SANDBOX = "https://sandbox.wompi.co/v1";
const BASE_PRODUCCION = "https://production.wompi.co/v1";
const URL_CHECKOUT = "https://checkout.wompi.co/p/";

function gatewayActivo() {
  return String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase() === "wompi";
}

function llavePublica() {
  return String(process.env.WOMPI_PUBLIC_KEY || "").trim();
}

function llavePrivada() {
  return String(process.env.WOMPI_PRIVATE_KEY || "").trim();
}

function secretoEventos() {
  return String(process.env.WOMPI_EVENTS_SECRET || "").trim();
}

function llaveIntegridad() {
  return String(process.env.WOMPI_INTEGRITY_KEY || "").trim();
}

function esAmbientePruebas() {
  return llavePublica().startsWith("pub_test_");
}

/** URL base de la API REST según el ambiente inferido de la llave pública. */
function urlBase() {
  return esAmbientePruebas() ? BASE_SANDBOX : BASE_PRODUCCION;
}

/** Valida que, con la pasarela activa, existan las llaves mínimas. */
function configuracionCompleta() {
  return Boolean(llavePublica() && llavePrivada() && llaveIntegridad());
}

function sha256(cadena) {
  return crypto.createHash("sha256").update(cadena, "utf8").digest("hex");
}

/** Crea /api/checkout/pagar */
function firmaIntegridad(referencia, centavos, moneda = "COP", expiracion = "") {
  const cadena = `${referencia}${centavos}${moneda}${expiracion ?? ""}${llaveIntegridad()}`;
  return sha256(cadena);
}

/**
 * Arma la URL del widget de checkout (redirect) de Wompi.
 * @param {object} p { referencia, centavos, moneda, correo, redirectUrl }
 */
function urlCheckoutWompi({ referencia, centavos, moneda = "COP", correo, redirectUrl }) {
  if (!configuracionCompleta()) {
    const error = new Error(
      "Pasarela Wompi incompleta: faltan WOMPI_PUBLIC_KEY / WOMPI_PRIVATE_KEY / WOMPI_INTEGRITY_KEY en .env"
    );
    error.codigo = "PAGOS_CONFIG";
    throw error;
  }
  const qs = new URLSearchParams({
    "public-key": llavePublica(),
    currency: moneda,
    "amount-in-cents": String(centavos),
    reference: String(referencia),
    "signature:integrity": `integrity:${firmaIntegridad(String(referencia), centavos, moneda)}`,
    "customer-email": String(correo),
    "redirect-url": String(redirectUrl),
  });
  return `${URL_CHECKOUT}?${qs.toString()}`;
}

/** Resuelve una ruta "transaction.amount_in_cents" dentro del cuerpo del evento. */
function resolverRutaEvento(cuerpo, ruta) {
  let valor = cuerpo;
  for (const parte of String(ruta || "").split(".")) {
    if (valor === null || valor === undefined) return "";
    valor = valor[parte];
  }
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

/** Resuelve la ruta DENTRO de data (convención real de Wompi: las propiedades
 *  "transaction.status" apuntan a data.transaction.status). */
function resolverRutaData(cuerpo, ruta) {
  return resolverRutaEvento(cuerpo && cuerpo.data ? cuerpo.data : {}, ruta);
}

/** Comparación de hex en tiempo constante (independiente del largo real). */
function comparaSegura(hexA, hexB) {
  const a = String(hexA || "").toUpperCase();
  const b = String(hexB || "").toUpperCase();
  if (!a || !b) return false;
  const largo = Math.max(a.length, b.length, 1);
  const bufA = Buffer.alloc(largo, 0);
  const bufB = Buffer.alloc(largo, 0);
  bufA.write(a, "utf8");
  bufB.write(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

/**
 * Verifica el checksum de un evento de webhook de Wompi.
 * Firma = SHA256(valores de signature.properties leídos del cuerpo, en orden,
 * + timestamp + secreto de eventos). También llega en X-Event-Checksum.
 */
function verificarEventosWompi(cuerpo, checksumCabecera) {
  try {
    if (!cuerpo || !cuerpo.data) return false;
    const firma = cuerpo.signature || {};
    const props = Array.isArray(firma.properties) ? firma.properties : [];
    if (props.length === 0) return false;
    const checksumEsperado = String(firma.checksum || checksumCabecera || "");
    if (!checksumEsperado) return false;
    const timestamp = firma.timestamp !== undefined ? firma.timestamp : cuerpo.timestamp;
    if (timestamp === undefined || timestamp === null) return false;
    if (!secretoEventos()) return false;
    const valores = props.map((ruta) => {
      // Convención Wompi: rutas relativas a data.transaction. Fallback: ruta completa del cuerpo.
      const desdeData = resolverRutaData(cuerpo, ruta);
      return desdeData !== "" ? desdeData : resolverRutaEvento(cuerpo, ruta);
    });
    const calculado = sha256(`${valores.join("")}${timestamp}${secretoEventos()}`);
    return comparaSegura(calculado.toUpperCase(), checksumEsperado);
  } catch (e) {
    console.error("Error verificando firma de evento Wompi:", e.message);
    return false;
  }
}

/** fetch contra Wompi con reintentos (la red de sandbox a veces suelta
 *  ECONNRESET justo en la primera conexión TLS). */
async function fetchWompi(url, opciones, intentos = 3) {
  let ultimoError = null;
  for (let i = 1; i <= intentos; i++) {
    try {
      return await fetch(url, opciones);
    } catch (e) {
      ultimoError = e;
      if (i < intentos) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw ultimoError;
}

/** GET /v1/transactions/{id} — auth la llave pública basta para leer. */
async function obtenerTransaccionWompi(idTransaccion) {
  const url = `${urlBase()}/transactions/${encodeURIComponent(idTransaccion)}`;
  try {
    const res = await fetchWompi(url, {
      headers: { Authorization: `Bearer ${llavePublica()}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`Wompi GET transacción ${idTransaccion}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.error(`Wompi GET transacción ${idTransaccion}:`, e.message);
    return null;
  }
}

/** GET /v1/transactions?reference={ref} — la BÚSQUEDA requiere la llave privada
 *  (con la pública responde 401); el GET por ID sí acepta la pública. */
async function buscarTransaccionesPorReferencia(referencia) {
  const url = `${urlBase()}/transactions?reference=${encodeURIComponent(referencia)}`;
  try {
    const res = await fetchWompi(url, {
      headers: { Authorization: `Bearer ${llavePrivada()}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`Wompi GET búsqueda ${referencia}: HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.error(`Wompi GET búsqueda ${referencia}:`, e.message);
    return [];
  }
}

module.exports = {
  gatewayActivo,
  configuracionCompleta,
  esAmbientePruebas,
  urlBase,
  urlCheckoutWompi,
  firmaIntegridad,
  verificarEventosWompi,
  resolverRutaEvento,
  compararSegura: comparaSegura,
  sha256,
  obtenerTransaccionWompi,
  buscarTransaccionesPorReferencia,
};

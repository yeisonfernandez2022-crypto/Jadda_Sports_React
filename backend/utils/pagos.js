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

/**
 * Ventana (minutos) que tiene el cliente para completar el pago de una venta
 * PENDIENTE_PAGO antes de que se cancele sola (reingresa stock). Antes eran
 * 48 h, lo que dejaba pedidos abandonados vivos demasiado tiempo.
 * Configurable con PAGOS_EXPIRA_MINUTOS (mínimo 1; default 10).
 */
const MINUTOS_EXPIRACION = (() => {
  const crudo = String(process.env.PAGOS_EXPIRA_MINUTOS ?? "").trim();
  const n = Number(crudo);
  if (!crudo || !Number.isFinite(n)) return 10;
  return Math.max(1, Math.round(n));
})();

/** True si el plazo de pago de la venta ya pasó. La fecha con prioridad es
 *  FECHA_EXPIRA_PAGO (se reinicia cada vez que el cliente abre una sesión de
 *  pago nueva); si es NULL (ventas anteriores a la columna) se usa FECHA_VENTA. */
function pagoVencido(fechaExpira, fechaVenta, ahora = new Date()) {
  const base = fechaExpira || fechaVenta;
  if (!base) return false;
  return new Date(base).getTime() + MINUTOS_EXPIRACION * 60000 <= ahora.getTime();
}

function gatewayActivo() {
  return String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase() === "wompi";
}

/**
 * Validación de la pasarela al ARRANCAR en producción (fase cierre-produccion).
 * Hoy un PAYMENT_GATEWAY vacío dejaba el checkout silenciosamente en modo
 * simulado (venta COMPLETADA con referencia SIM_ SIN cobro real) — aceptable
 * solo para demostraciones. Reglas:
 *  - NODE_ENV != production → { ok: true } (cero impacto en desarrollo/tests).
 *  - producción SIN pasarela completa → { ok: false, fatal } a menos que
 *    ALLOW_SIMULATED_PAYMENTS=true (demo), que arranca con aviso fuerte.
 *  - producción con wompi + llaves pub_test_ → { ok: true, aviso } (sandbox
 *    en producción, queda registrado; NO bloquea).
 * Las llaves se leen vía gatewayActivo()/esAmbientePruebas() (process.env);
 * NODE_ENV/ALLOW_SIMULATED_PAYMENTS se toman del objeto `env` para poder
 * testear la función sin mutar el proceso.
 */
function validarPasarelaProduccion(env = process.env) {
  if (String(env.NODE_ENV || "").trim().toLowerCase() !== "production") return { ok: true };
  if (!gatewayActivo()) {
    if (String(env.ALLOW_SIMULATED_PAYMENTS || "").trim() === "true") {
      return {
        ok: true,
        aviso: "⚠️⚠️⚠️  Server: PAGOS SIMULADOS EN PRODUCCIÓN — ALLOW_SIMULATED_PAYMENTS=true. Las ventas nacen COMPLETADA con referencia SIM_ y NO se cobra nada real. Solo usar en demostraciones.",
      };
    }
    return {
      ok: false,
      fatal: "❌ Server: En producción la pasarela es obligatoria: define PAYMENT_GATEWAY=wompi y WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_INTEGRITY_KEY y WOMPI_EVENTS_SECRET (o ALLOW_SIMULATED_PAYMENTS=true si es una demostración).",
    };
  }
  const llavesWompi = ["WOMPI_PUBLIC_KEY", "WOMPI_PRIVATE_KEY", "WOMPI_INTEGRITY_KEY", "WOMPI_EVENTS_SECRET"].filter(
    (k) => !String(process.env[k] || "").trim()
  );
  if (llavesWompi.length > 0) {
    return { ok: false, fatal: `❌ Server: Con PAYMENT_GATEWAY=wompi se requieren estas llaves en producción: ${llavesWompi.join(", ")}` };
  }
  if (esAmbientePruebas()) {
    return {
      ok: true,
      aviso: "⚠️  Server: llave pública \"pub_test_...\" en producción — la pasarela cobrará con DINERO DE PRUEBA (sandbox.wompi.co). Reemplaza las llaves por las de producción (pub_prod_/pris_prod_).",
    };
  }
  return { ok: true };
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
 * True si la URL es pública https (no loopback ni LAN). El WAF de Wompi
 * (CloudFront) responde 403 "Request blocked" si algún parámetro contiene
 * localhost / 127.0.0.1 / IPs privadas — verificado 2026-10-26.
 * @param {string} url
 */
function esUrlPublicaHttps(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(127|10|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Arma la URL del widget de checkout (redirect) de Wompi.
 * redirect-url solo se incluye si es una URL https pública (no localhost/LAN,
 * que el WAF de Wompi bloquea con 403); sin ella el widget carga igual y la
 * confirmación corre por webhook + pull (/api/pagos/estado/:id).
 *
 * customer-data:* prefill de la vista "Ingresa tus datos" del widget (docs
 * Wompi "Widget & Checkout Web"): los datos guardados del método en la app
 * (titular, teléfono) llegan ya llenos — el widget NO permite preseleccionar
 * el método de pago, pero sí precargar los datos del pagador.
 * shipping-address:* prefill de la dirección de envío de la venta.
 * @param {object} p { referencia, centavos, moneda, correo, redirectUrl,
 *   nombrePagador, telefonoPagador, direccionEnvio }
 */
function limpiarTexto(objetivo, max = 100) {
  const texto = String(objetivo ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, max) : "";
}

function urlCheckoutWompi({
  referencia,
  centavos,
  moneda = "COP",
  correo,
  redirectUrl,
  nombrePagador,
  telefonoPagador,
  direccionEnvio,
}) {
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
  });
  if (esUrlPublicaHttps(redirectUrl)) {
    qs.set("redirect-url", String(redirectUrl));
  }
  // customer-data (pagador): nombre y teléfono del método guardado o del perfil
  const nombre = limpiarTexto(nombrePagador, 120);
  const telefono = String(telefonoPagador || "").replace(/\D/g, "").slice(0, 15);
  if (nombre) qs.set("customer-data:full-name", nombre);
  if (telefono) {
    qs.set("customer-data:phone-number", telefono);
    qs.set("customer-data:phone-number-prefix", "+57");
  }
  if (limpiarTexto(correo, 190)) qs.set("customer-data:email", limpiarTexto(correo, 190));
  // shipping-address (envío): Wompi exige línea/dirección, ciudad, región y teléfono
  const envio = direccionEnvio || {};
  const linea1 = limpiarTexto(envio.linea1, 100);
  const ciudad = limpiarTexto(envio.ciudad, 60);
  const region = limpiarTexto(envio.region, 60);
  const telEnvio = String(envio.telefono || "").replace(/\D/g, "").slice(0, 15);
  if (linea1 && ciudad && region && telEnvio) {
    qs.set("shipping-address:address-line-1", linea1);
    const linea2 = limpiarTexto(envio.linea2, 100);
    if (linea2) qs.set("shipping-address:address-line-2", linea2);
    qs.set("shipping-address:country", "CO");
    qs.set("shipping-address:city", ciudad);
    const postal = limpiarTexto(envio.postal, 20);
    if (postal) qs.set("shipping-address:postal-code", postal);
    qs.set("shipping-address:region", region);
    if (nombre) qs.set("shipping-address:name", nombre);
    qs.set("shipping-address:phone-number", telEnvio);
  }
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
  validarPasarelaProduccion,
  configuracionCompleta,
  esAmbientePruebas,
  urlBase,
  urlCheckoutWompi,
  esUrlPublicaHttps,
  firmaIntegridad,
  verificarEventosWompi,
  resolverRutaEvento,
  compararSegura: comparaSegura,
  sha256,
  obtenerTransaccionWompi,
  buscarTransaccionesPorReferencia,
  MINUTOS_EXPIRACION,
  pagoVencido,
};

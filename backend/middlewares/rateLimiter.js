/**
 * Limitador de peticiones simple en memoria (ventana deslizante por IP).
 * Protege endpoints sensibles (login, registro, reenvío de código, contacto)
 * contra fuerza bruta y spam. Sin dependencias externas.
 * 
 * Se desactiva en:
 * - Entorno de test (NODE_ENV=test)
 * - Cuando DISABLE_RATE_LIMIT=true FUERA de producción (para tests E2E:
 *   en producción el límite SIEMPRE está activo y la variable se ignora)
 * 
 * Uso: rateLimit({ ventanaMs: 15 * 60 * 1000, max: 5, mensaje: "..." })
 *
 * LIMITACIÓN DE DESPLIEGUE (conocida y documentada): el estado vive EN ESTE
 * PROCESO (Map en memoria) — con varias réplicas del backend cada una llevaría
 * su propio contador distinto y los límites efectivos se multiplicarían.
 * Aceptable para la topología actual de réplica única (docker-compose); si
 * algún día hay N réplicas detrás del balanceador, migrar el estado a un
 * almacén compartido (Redis/RATE LIMIT compartido) o a un gateway que lo
 * aplique ANTES de las réplicas.
 */

const intentos = new Map();

// Desactivar en test o cuando DISABLE_RATE_LIMIT=true (kill-switch SOLO fuera
// de producción: en prod el límite SIEMPRE está activo, se ignore la variable).
const ES_TEST = process.env.NODE_ENV === 'test';
const DESACTIVAR_RATE_LIMIT =
  process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true';
const RATE_LIMIT_DESACTIVADO = ES_TEST || DESACTIVAR_RATE_LIMIT;

// Limpieza periódica para evitar crecimiento de memoria
if (!RATE_LIMIT_DESACTIVADO) {
  setInterval(() => {
    const ahora = Date.now();
    for (const [clave, datos] of intentos) {
      if (ahora > datos.expiraEn) {
        intentos.delete(clave);
      }
    }
  }, 5 * 60 * 1000);
}

function rateLimit({ ventanaMs = 15 * 60 * 1000, max = 10, mensaje = "Demasiados intentos. Intenta de nuevo más tarde", totalPorIp = false, esExenta = null, respetarDesactivado = true } = {}) {
  // En test o con DISABLE_RATE_LIMIT=true, no aplicar rate limiting
  // (solo si respetarDesactivado — los tests unitarios pasan false para
  // poder probar el limitador con req/res falsos)
  if (respetarDesactivado && RATE_LIMIT_DESACTIVADO) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Exenciones (p. ej. sonda /health y estáticos del limitador global)
    if (typeof esExenta === "function" && esExenta(req)) return next();

    // Clave del cubo: si la petición es AUTHENTICADA usamos el ID del usuario,
    // NO req.ip — detrás de un edge que rota IP de salida (PaaS) el cubo por
    // IP puede derramarse entre peticiones y el límite pierde efecto; el
    // abuso típico de estos límites por-ruta es de sesiones autenticadas.
    // El límite global (que corre ANTES del passport) sigue siendo por IP.
    const esDeUsuario = req.user && (req.user.ID_USUARIO || req.user.id);
    const ip = esDeUsuario
      ? `u${req.user.ID_USUARIO || req.user.id}`
      : (req.ip || req.socket?.remoteAddress || "desconocida");
    // La ruta se NORMALIZA para rutas paramétricas: sin esto,
    // /estado/5, /estado/6… serían cubos distintos y el límite "por ruta"
    // sería ilimitado cambiando el ID.
    const rutaPatron = String(req.path || "").replace(/\d+/g, ":N");
    // totalPorIp: el límite es global sobre TODAS las rutas del mismo cliente
    // (techo anti-abuso de la fase 3); por defecto la ventana es por ruta.
    const clave = totalPorIp ? `${ip}::TOTAL` : `${ip}:${rutaPatron}`;
    const ahora = Date.now();

    const registro = intentos.get(clave) || { contador: 0, expiraEn: ahora + ventanaMs };

    if (ahora > registro.expiraEn) {
      registro.contador = 0;
      registro.expiraEn = ahora + ventanaMs;
    }

    registro.contador += 1;
    intentos.set(clave, registro);

    if (registro.contador > max) {
      return res.status(429).json({ ok: false, msg: mensaje });
    }

    next();
  };
}

module.exports = rateLimit;
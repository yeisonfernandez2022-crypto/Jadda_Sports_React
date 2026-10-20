/**
 * Limitador de peticiones simple en memoria (ventana deslizante por IP).
 * Protege endpoints sensibles (login, registro, reenvío de código, contacto)
 * contra fuerza bruta y spam. Sin dependencias externas.
 * 
 * Se desactiva en:
 * - Entorno de test (NODE_ENV=test)
 * - Cuando DISABLE_RATE_LIMIT=true (para tests E2E)
 * 
 * Uso: rateLimit({ ventanaMs: 15 * 60 * 1000, max: 5, mensaje: "..." })
 */

const intentos = new Map();

// Desactivar en test o cuando DISABLE_RATE_LIMIT=true
const ES_TEST = process.env.NODE_ENV === 'test';
const DESACTIVAR_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true';
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

function rateLimit({ ventanaMs = 15 * 60 * 1000, max = 10, mensaje = "Demasiados intentos. Intenta de nuevo más tarde" } = {}) {
  // En test o con DISABLE_RATE_LIMIT=true, no aplicar rate limiting
  if (RATE_LIMIT_DESACTIVADO) {
    return (req, res, next) => next();
  }
  
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "desconocida";
    const clave = `${ip}:${req.path}`;
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
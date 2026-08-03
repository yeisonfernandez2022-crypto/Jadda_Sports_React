/**
 * Limitador de peticiones simple en memoria (ventana deslizante por IP).
 * Protege endpoints sensibles (login, registro, reenvío de código, contacto)
 * contra fuerza bruta y spam. Sin dependencias externas.
 *
 * Uso: rateLimit({ ventanaMs: 15 * 60 * 1000, max: 5, mensaje: "..." })
 */

const intentos = new Map();

// Limpieza periódica para evitar crecimiento de memoria
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, datos] of intentos) {
    if (ahora > datos.expiraEn) {
      intentos.delete(clave);
    }
  }
}, 5 * 60 * 1000);

function rateLimit({ ventanaMs = 15 * 60 * 1000, max = 10, mensaje = "Demasiados intentos. Intenta de nuevo más tarde" } = {}) {
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

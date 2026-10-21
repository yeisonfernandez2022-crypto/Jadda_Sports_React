/*
 * Defensa CSRF por verificación de Origin.
 *
 * Modelo de amenaza: un atacante puede hacer que el NAVEGADOR de una víctima
 * envié una petición con su cookie de sesión a una URL mutante (POST/PUT/
 * PATCH/DELETE) desde un sitio malicioso (formulario oculto, fetch, etc.).
 * Los navegadores envían SIEMPRE la cabecera Origin en esas peticiones, así
 * que basta con exigir que venga de un origen propio.
 *
 * Clientes legítimos que NO envían Origin (y por tanto quedan exentos):
 *   - La app móvil nativa (axios/RN con withCredentials no pone Origin).
 *   - curl, Postman, pruebas automatizadas, integraciones server-to-server.
 * En esos clientes no existe la técnica CSRF (no hay sitio malicioso que los
 * use como contexto de navegador), así que la exención no abre la brecha.
 *
 * Compensación defensiva adicional vigente: cookies SameSite=Lax (los POST
 * cross-site de navegadores no llevan la cookie desde 2020+) y same-origin
 * del frontend en producción (nginx/Caddy una sola origin). Esta capa añade
 * profundidad para clientes web servidos desde otra origin (LAN/host propio).
 *
 * Regla:
 *   - No mutación (GET/HEAD/OPTIONS) → pasa (el navegador no puede mutar con GET).
 *   - Origin ausente → pasa (cliente no navegador).
 *   - Origin == host efectivo de la petición (x-forwarded-host || host) → pasa
 *     (mismo origen, típico detrás del proxy que conserva el Host).
 *   - Origin == "null" → bloquea (navegadores la mandan en contextos opacos;
 *     phishing/sandbox).
 *   - Origin en la lista admitida (config/origenesAdmitidos.js) → pasa.
 *   - Cualquier otro Origin → 403 (en log, sin contenido del cuerpo).
 */

const { origenesAdmitidos } = require('../config/origenesAdmitidos');

const METODO_MUTA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function autoridadDe(urlTexto) {
  try {
    const u = new URL(urlTexto);
    // El navegador omite el puerto por defecto (http:80 / https:443) en Origin;
    // el Host del proxy puede traerlo o no — se normaliza ambos lados.
    let puerto = u.port;
    if (!puerto && u.protocol === 'https:') puerto = '';
    if (puerto === '80' && u.protocol === 'http:') puerto = '';
    if (puerto === '443' && u.protocol === 'https:') puerto = '';
    return `${u.hostname}${puerto ? ':' + puerto : ''}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Origin == host efectivo de la petición (mismo origen detrás del proxy). */
function esMismoOrigen(origin, req) {
  const hostCrudo = String(
    req.headers['x-forwarded-host'] || req.headers.host || ''
  )
    .split(',')[0]
    .trim();
  if (!hostCrudo) return false;
  // El esquema real viene del proxy (X-Forwarded-Proto); con http por defecto
  // alcanza para comparar la autoridad (host:puerto).
  const esquema = String(req.headers['x-forwarded-proto'] || 'http')
    .split(',')[0]
    .trim();
  const hostUrl = esquema === 'https' ? `https://${hostCrudo}` : `http://${hostCrudo}`;
  const autoridadPeticion = autoridadDe(hostUrl);
  const autoridadOrigin = autoridadDe(origin);
  if (!autoridadPeticion || !autoridadOrigin) return false;

  const [h1, p1] = autoridadPeticion.split(':');
  const [h2, p2] = autoridadOrigin.split(':');
  if (h1 !== h2) return false;
  // Autoridad sin puerto + puerto por defecto del esquema equivalente:
  return (p1 || '') === (p2 || '') || !p1 || !p2;
}

exports.proteccionOrigen = function proteccionOrigen(req, res, next) {
  if (!METODO_MUTA.has(req.method)) return next();

  // Headers pueden llegar duplicados en proxies raros: nos quedamos con el
  // primer valor (el navegador nunca manda Origin múltiple).
  const originCrudo = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;

  // Cliente no navegador (móvil nativa, curl, tests, integraciones): pasa.
  if (originCrudo === undefined || originCrudo === '') return next();

  const origin = String(originCrudo).split(',')[0].trim();

  if (origin === 'null') {
    return res.status(403).json({ ok: false, msg: 'Origen no permitido' });
  }

  if (esMismoOrigen(origin, req)) return next();

  if (origenesAdmitidos().includes(origin.toLowerCase())) return next();

  console.warn(
    `🛡️  CSRF/Origin bloqueado: ${req.method} ${req.originalUrl} con Origin "${origin}" (IP ${req.ip})`
  );
  return res.status(403).json({ ok: false, msg: 'Origen no permitido' });
};

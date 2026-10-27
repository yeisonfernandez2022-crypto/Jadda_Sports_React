/*
 * Registro de peticiones + id de correlación (observabilidad operativa).
 *
 * - ID de petición: acepta `x-request-id` del proxy (nginx/Caddy) o genera
 *   uno; se devuelve en la cabecera `X-Request-Id` para que un reporte de
 *   usuario ("este error lleva el id X") se pueda buscar en el log.
 * - Logger estructurado: UNA línea JSON por petición al TERMINAR el response
 *   (método, ruta SIN query, status y duración). Sin IP, sin query ni cuerpo:
 *   cero datos personales en el log (la IP ya la registran solo los flujos de
 *   seguridad que la necesitan, p. ej. la defensa CSRF al bloquear).
 */

const crypto = require('crypto');

// Solo caracteres seguros — no se refleja en la respuesta ni se guarda en el
// log un id inventado por un atacante. 8..64 con [A-Za-z0-9._-].
const PATRON_ID = /^[A-Za-z0-9._-]{8,64}$/;

function idDePeticion(req) {
  const cabecera = String((req.headers && req.headers['x-request-id']) || '').trim();
  if (PATRON_ID.test(cabecera)) return cabecera;
  return crypto.randomBytes(6).toString('hex'); // 12 caracteres hex
}

// Endpoints que los clientes consultan cada pocos segundos (timbre de
// notificaciones): no aportan nada al log y lo ahogan con sondeos.
const RUTAS_SIN_LOG = new Set([
  '/api/notificaciones',
  '/api/notificaciones/no-leidas',
  '/api/chat/no-leidos',
]);

function registrarPeticion(req, res, next) {
  const inicio = Date.now();
  req.id = idDePeticion(req);
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const ruta = String(req.originalUrl || req.url || '/').split('?')[0].slice(0, 120);
    if (RUTAS_SIN_LOG.has(ruta)) return;
    const registro = {
      t: new Date().toISOString(),
      nivel: 'http',
      req: req.id,
      metodo: req.method,
      // Solo el pathname: la query puede traer identificadores personales
      // (chats, devoluciones y en el futuro emails); lo truncamos por si una
      // URL anómala viniera kilométrica.
      ruta,
      status: res.statusCode,
      ms: Date.now() - inicio,
    };
    console.log(JSON.stringify(registro));
  });

  next();
}

module.exports = { registrarPeticion, PATRON_ID };

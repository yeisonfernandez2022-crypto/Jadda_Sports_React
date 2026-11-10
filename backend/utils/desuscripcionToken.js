const crypto = require('crypto');

/**
 * Token HMAC de desuscripción del newsletter.
 *
 * Antes el enlace era ?email=<correo> en claro: cualquiera que conociera la
 * dirección podía dar de baja suscripciones ajenas. Ahora el enlace lleva
 * además ?token=<HMAC-SHA256(email)> con SESSION_SECRET como llave — sin el
 * secreto no se puede generar un token válido para un correo arbitrario.
 *
 * El correo se normaliza a minúsculas (NEWSLETTER_SUSCRIPTOS guarda el correo
 * normalizado) para que el enlace sirva con cualquier combinación de caja.
 *
 * Sin SESSION_SECRET el flujo falla cerrado: generarTokenDesuscripcion lanza
 * (fallo ruidoso — en producción el arranque ya exige el secreto) y
 * tokenDesuscripcionValido devuelve false.
 */

const tokenDe = (email) =>
  crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(`desuscribir:${String(email).toLowerCase()}`)
    .digest('hex');

function generarTokenDesuscripcion(email) {
  return tokenDe(email);
}

function tokenDesuscripcionValido(email, token) {
  if (typeof token !== 'string' || !token) return false;
  try {
    const esperado = tokenDe(email);
    return (
      esperado.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(token))
    );
  } catch {
    return false;
  }
}

module.exports = { generarTokenDesuscripcion, tokenDesuscripcionValido };

/*
 * Opciones TLS del pool mysql2 para la nube (entregable S04).
 *
 * Aiven MySQL (plan gratuito) exige TLS: `DB_SSL=true` activa el ssl del
 * pool. La función es PURA (recibe un objeto env y no toca el proceso) para
 * poder probarla unitariamente; `config/db.js` la invoca con process.env.
 *
 *   DB_SSL                     "true" activa TLS.
 *   DB_SSL_CA                  PEM del CA raíz del servicio (opcional). Acepta
 *                              PEM con saltos reales o en una línea con \n
 *                              literales (p. ej. pegado en .env / panel web).
 *   DB_SSL_REJECT_UNAUTHORIZED "false" desactiva la validación de cadena de
 *                              certificados (escape hatch documentado).
 *
 * Con CA la cadena del servidor se valida (rejectUnauthorized=true por
 * defecto, igual al estándar de Node). Sin CA el TLS cifra el canal pero no
 * autentica el servidor (los free tiers usan una CA propia fuera del almacén
 * de Node — el default evita exigir pegar el PEM).
 */

/*
 * Normaliza un PEM que llega sin saltos: reemplaza la secuencia literal
 * "\n" (y "\r\n") por salto real. Un PEM auténtico multilínea se devuelve
 * intacto.
 */
function pemAReal(caCrudo) {
  if (caCrudo.includes('\\n')) {
    return caCrudo.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  return caCrudo;
}

/*
 * Devuelve null si TLS no está activo; en caso contrario, el objeto que se
 * mete en la config de mysql2 (clave `ssl`) y la marca `sinCa` para que el
 * caller registre el aviso una sola vez.
 */
function construirOpcionesSsl(env) {
  if (!env || String(env.DB_SSL || '').trim() !== 'true') {
    return null;
  }

  const opciones = { minVersion: 'TLSv1.2' };
  const caCrudo = String(env.DB_SSL_CA || '').trim();
  const quitarValidacion = String(env.DB_SSL_REJECT_UNAUTHORIZED || '') === 'false';

  if (caCrudo) {
    // CA presente: validar cadena por defecto (el override "false" queda
    // como escape hatch explícito y queda documentado).
    opciones.ca = pemAReal(caCrudo);
    opciones.rejectUnauthorized = !quitarValidacion;
    return { ssl: opciones, sinCa: false };
  }

  // Sin CA: cifrar pero no autenticar salvo que alguien pida validación.
  opciones.rejectUnauthorized = String(env.DB_SSL_REJECT_UNAUTHORIZED || '') === 'true';
  return { ssl: opciones, sinCa: true };
}

module.exports = { construirOpcionesSsl, pemAReal };

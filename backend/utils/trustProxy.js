/**
 * Resuelve el número de saltos de proxy confiables con los que Express debe
 * configurar `app.set('trust proxy', ...)` (server.js).
 *
 * - Sin TRUST_PROXY definido: 1 salto en producción (nginx/Caddy delante) y
 *   0 en desarrollo (sin proxy; un header X-Forwarded-For forjado NO se honra).
 * - Con TRUST_PROXY inválido (no numérico): cae a 1 salto (comportamiento
 *   seguro por defecto: detrás de un proxy se resuelve la IP real).
 */

function resolverTrustProxy(valorEnv, isProduction) {
  if (valorEnv === undefined) return isProduction ? 1 : 0;
  const saltos = Number(valorEnv);
  return Number.isFinite(saltos) ? saltos : 1;
}

module.exports = resolverTrustProxy;

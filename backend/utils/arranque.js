/**
 * util: decide si el backend ejecuta setup.js al arrancar el servidor.
 * --------------------------------------------------------------------
 * FASE 2 (cierre-produccion): las migraciones (DDL) se ejecutan FUERA del
 * arranque del servidor con `pnpm migrate` (servicio `migrate` en
 * docker-compose.prod.yml), para que la cuenta de aplicación tenga solo
 * DML y ninguna rutina de DDL tenga que correr dentro del proceso vivo.
 *
 * Regla:
 *  - En DESARROLLO siempre migra al arrancar (experiencia actual, idempotente).
 *  - En PRODUCCIÓN NO migra salvo que RUN_MIGRATIONS_ON_BOOT=true
 *    (escapatoria de emergencias / primera puesta sin servicio migrate).
 *
 * Devuelve true/false: usado por server.js e importado directo en tests.
 */
function debeMigrarAlArrancar(env = process.env) {
  if (env.NODE_ENV === 'production') {
    return env.RUN_MIGRATIONS_ON_BOOT === 'true';
  }
  return true;
}

module.exports = { debeMigrarAlArrancar };

/**
 * migrate.js — Migraciones/seeds de la BD FUERA del arranque del servidor.
 * -----------------------------------------------------------------------
 * FASE 2 (cierre-produccion): en producción el backend ya NO ejecuta DDL
 * al arrancar (RUN_MIGRATIONS_ON_BOOT no definido) — esto lo corre el
 * servicio `migrate` de docker-compose.prod.yml (o `pnpm migrate` a mano).
 *
 * Reutiliza 1:1 `setupDatabase` de setup.js (tablas, migraciones
 * idempotentes, sesiones, seeds de referencia, gate de demo, admin) para
 * NO duplicar la lógica. Es seguro ejecutarlo en cada `up` (todo es
 * CREATE IF NOT EXISTS / INSERT IGNORE / migraciones verificadas).
 *
 * Uso:   pnpm migrate    (equivale a: node database/migrate.js)
 *        NODE_ENV=production pnpm migrate   → sin cuentas/ventas demo
 */
const setupDatabase = require('./setup');

async function main() {
  try {
    await setupDatabase();
    console.log('✅ Migrate: migración completa (BD lista para la aplicación)');
    process.exitCode = 0;
  } catch (err) {
    console.error(`❌ Migrate: fallo — ${err.code || ''} ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

/**
 * FASE 2 (cierre-produccion): la decisión de migrar al arranque debe ser
 * determinista y distinta entre desarrollo y producción.
 *
 *  - Desarrollo: SIEMPRE migra (setup.js en cada arranque, idempotente).
 *  - Producción: NO migra salvo RUN_MIGRATIONS_ON_BOOT=true — el DDL vive
 *    en `pnpm migrate` / servicio `migrate` de compose, y server.js
 *    verifica que la BD repose ya migrada (tabla de negocio presente).
 */
const { debeMigrarAlArrancar } = require('./arranque');

describe('debeMigrarAlArrancar — arranque sin DDL en producción (fase 2)', () => {
  it('DESARROLLO migra siempre (incluido explícito y contraseñas de escapatoria falsas)', () => {
    expect(debeMigrarAlArrancar({})).toBe(true);
    expect(debeMigrarAlArrancar({ NODE_ENV: 'development' })).toBe(true);
    expect(debeMigrarAlArrancar({ RUN_MIGRATIONS_ON_BOOT: 'false' })).toBe(true);
  });

  it('producción NO migra por defecto (DDL ejecuta pnpm migrate)', () => {
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production' })).toBe(false);
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production', RUN_MIGRATIONS_ON_BOOT: 'false' })).toBe(false);
  });

  it('producción con la escapatoria RUN_MIGRATIONS_ON_BOOT=true migrará al arrancar', () => {
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production', RUN_MIGRATIONS_ON_BOOT: 'true' })).toBe(true);
  });

  it('la escapatoria exige el literal "true" (TRUE/1/espacios no cuentan: sin ambigüedades de parseo)', () => {
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production', RUN_MIGRATIONS_ON_BOOT: 'TRUE' })).toBe(false);
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production', RUN_MIGRATIONS_ON_BOOT: '1' })).toBe(false);
    expect(debeMigrarAlArrancar({ NODE_ENV: 'production', RUN_MIGRATIONS_ON_BOOT: ' yes ' })).toBe(false);
  });
});

-- =====================================================================
-- JADDA SPORTS - Usuarios y privilegios para produccion (FASE 2)
-- ---------------------------------------------------------------------
-- Separa DOS cuentas con privilegios distintos: la aplicacion recibe
-- menor privilegio puro (DML) y un "migrador" que solo existe para
-- ejecutar el DDL de `pnpm migrate` (servicio `migrate` en
-- docker-compose.prod.yml).
--
-- 1. jadda_migrator (%).
--    Ejecuta:  docker compose -f docker-compose.prod.yml run --rm migrate
--    Privilegios (solo sobre jadda_sports_db.*):
--      SELECT, INSERT, UPDATE, DELETE ....... seeds/migraciones de datos
--      CREATE, DROP, ALTER, INDEX, REFERENCES .. tablas y migraciones DDL
--      CREATE (global, *.) ................... crea la BD si no existe
--      ALTER (global, *.) .................... migraciones dentro de la BD
--
-- 2. jadda_app (%).
--    Conecta el backend en producción (DB_USER del servicio backend).
--    Privilegios (DML, solo sobre jadda_sports_db.*):
--      SELECT, INSERT, UPDATE, DELETE ........ operacion diaria de la app
--    NOTA FASE 2: setup.js YA NO corre al arrancar el servidor en
--    producción (el DDL vive en el servicio `migrate`), así que la app
--    puede ser DML-only pura (sin CREATE/ALTER/INDEX/REFERENCES).
--    Escapatoria de emergencia: si defines RUN_MIGRATIONS_ON_BOOT=true,
--    usa la cuenta de migrador en DB_USER (necesita DDL).
-- =====================================================================

-- =====================================================================
-- CONTRASENA = VARIABLE, nunca en el codigo:
--   Este archivo trae placeholders __CAMBIAR_PASSWORD_MIGRATOR__ y
--   __CAMBIAR_PASSWORD_APP__ (asi ninguna clave queda publicada en el
--   repositorio). Antes de ejecutarlo, genera la COPIA LOCAL con las
--   claves reales y no la versiones (scripts\sql\usuarios-produccion.local.sql
--   esta en .gitignore):
--
--   PowerShell (desde la raiz del proyecto):
--     $pwMig = 'LA_CLAVE_SECRETA_MIGRADOR'
--     $pwApp = 'LA_CLAVE_SECRETA_APP'
--     $sql = (Get-Content scripts\sql\usuarios-produccion.sql -Raw)`
--       -Replace '__CAMBIAR_PASSWORD_MIGRATOR__', $pwMig `
--       -Replace '__CAMBIAR_PASSWORD_APP__', $pwApp
--     Set-Content scripts\sql\usuarios-produccion.local.sql -Value $sql -NoNewline -Encoding ascii
--     docker cp scripts\sql\usuarios-produccion.local.sql jadda_mysql_prod:/tmp/users.sql
--     docker exec jadda_mysql_prod sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /tmp/users.sql'
--     docker exec jadda_mysql_prod sh -c 'rm -f /tmp/users.sql'
--     Remove-Item scripts\sql\usuarios-produccion.local.sql
--   Y en .env de la raíz:  MIGRATE_DB_PASSWORD = $pwMig ; DB_PASSWORD = $pwApp
-- =====================================================================

-- 1) Cuenta migradora: TODO el DDL/DML que setup.js (migrate.js) ejecuta
CREATE USER IF NOT EXISTS 'jadda_migrator'@'%' IDENTIFIED BY '__CAMBIAR_PASSWORD_MIGRATOR__';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON jadda_sports_db.* TO 'jadda_migrator'@'%';
GRANT CREATE, ALTER ON *.* TO 'jadda_migrator'@'%';

-- 2) Cuenta de la aplicación: DML-only pura (FASE 2)
CREATE USER IF NOT EXISTS 'jadda_app'@'%' IDENTIFIED BY '__CAMBIAR_PASSWORD_APP__';
GRANT SELECT, INSERT, UPDATE, DELETE ON jadda_sports_db.* TO 'jadda_app'@'%';

FLUSH PRIVILEGES;

-- Verificacion rapida (debe listar los privilegios anteriores):
SHOW GRANTS FOR 'jadda_migrator'@'%';
SHOW GRANTS FOR 'jadda_app'@'%';

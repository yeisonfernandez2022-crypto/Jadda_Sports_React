-- =====================================================================
-- JADDA SPORTS - Usuarios y privilegios para produccion
-- ---------------------------------------------------------------------
-- Principio de menor privilegio: la aplicacion NO debe conectarse como
-- root. Este script crea un usuario dedicado (jadda_app) restringido a
-- la base de datos del sistema.
--
-- Privilegios otorgados (solo sobre jadda_sports_db.*):
--   SELECT, INSERT, UPDATE, DELETE ........ operacion diaria (DML)
--   CREATE, ALTER, INDEX, REFERENCES ...... arranque del backend: setup.js
--       ejecuta CREATE TABLE IF NOT EXISTS y migraciones idempotentes
--       (ALTER TABLE) en cada inicio; sin estos privilegios el contenedor
--       backend no levanta.
--
-- NO se otorgan: DROP, GRANT, FILE, PROCESS, SHUTDOWN ni acceso a otras
-- bases de datos (mysql.*, information_schema escritura, etc.).
--
-- Endurecimiento opcional (esquema congelado, sin auto-setup):
--   REVOKE CREATE, ALTER, INDEX, REFERENCES ON jadda_sports_db.* FROM 'jadda_app'@'%';
-- =====================================================================

-- =====================================================================
-- CONTRASENA = VARIABLE, nunca en el codigo:
--   Este archivo trae el placeholder __CAMBIAR_PASSWORD__ en vez de una
--   contraseña real (asi ninguna clave queda publicada en el repositorio).
--   Antes de ejecutar, genera la COPIA LOCAL con la clave real y no la
--   versiones (scripts\sql\usuarios-produccion.local.sql esta en
--   .gitignore):
--
--   PowerShell (desde la raiz del proyecto):
--     $pw = 'LA_CLAVE_SECRETA_REAL'
--     (Get-Content scripts\sql\usuarios-produccion.sql -Raw)`
--       -Replace '__CAMBIAR_PASSWORD__', $pw |
--       Set-Content scripts\sql\usuarios-produccion.local.sql -NoNewline -Encoding ascii
--     docker cp scripts\sql\usuarios-produccion.local.sql jadda_mysql:/tmp/users.sql
--     docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /tmp/users.sql'
--     docker exec jadda_mysql sh -c 'rm -f /tmp/users.sql'
--     Remove-Item scripts\sql\usuarios-produccion.local.sql
-- =====================================================================

CREATE USER IF NOT EXISTS 'jadda_app'@'%' IDENTIFIED BY '__CAMBIAR_PASSWORD__';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON jadda_sports_db.* TO 'jadda_app'@'%';
FLUSH PRIVILEGES;

-- Verificacion rapida (debe listar los privilegios anteriores):
SHOW GRANTS FOR 'jadda_app'@'%';

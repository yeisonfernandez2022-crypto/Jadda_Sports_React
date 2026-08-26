-- =====================================================================
-- JADDA SPORTS - Usuarios y privilegios para produccion
-- ---------------------------------------------------------------------
-- Principio de menor privilegio: la aplicacion NO debe conectarse como
-- root. Este script crea un usuario dedicado (jadda_app) restringido a
-- la base de datos del sistema.
--
-- Uso (desde la raiz del proyecto):
--   docker cp scripts\sql\usuarios-produccion.sql jadda_mysql:/tmp/users.sql
--   docker exec jadda_mysql sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD < /tmp/users.sql'
--   docker exec jadda_mysql sh -c 'rm -f /tmp/users.sql'
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
--
-- SEGURIDAD: rota esta clave antes de una entrega real y no la subas a
-- repositorios publicos (colocala en el .env del backend).
-- =====================================================================

CREATE USER IF NOT EXISTS 'jadda_app'@'%' IDENTIFIED BY 'J4dd4#App2026';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON jadda_sports_db.* TO 'jadda_app'@'%';
FLUSH PRIVILEGES;

-- Verificacion rapida (debe listar los privilegios anteriores):
SHOW GRANTS FOR 'jadda_app'@'%';

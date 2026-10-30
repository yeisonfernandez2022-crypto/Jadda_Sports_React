---
name: jadda-database
description: "Use when working with the JADDA SPORTS MySQL database (jadda_sports_db, 38 tables in backend/database/setup.js) — adding tables or columns via the MIGRACIONES pattern, running SQL inside Docker from PowerShell/Windows, regenerating schema.sql, seeding demo data, or querying the DB for debugging."
---

# Base de datos de JADDA SPORTS (MySQL 8.0)

Hechos verificados contra `backend/database/setup.js` (3420 líneas) y docker-compose.yml.

## Lo esencial

- MySQL **8.0** en el contenedor `jadda_mysql`, BD **`jadda_sports_db`**, utf8mb4, timezone -05:00 (America/Bogota), puerto SOLO en 127.0.0.1:3306. Volumen nombrado `mysql_data`; `docker compose down -v` lo borra (el siguiente `up` recrea tablas+seeds con setup.js).
- `backend/database/setup.js` corre al ARRANCAR el servidor (`server.js` lo requiere): crea tablas si no existen, aplica migraciones idempotentes, siembra referencia y demo.

## Las 38 tablas de CREATE_TABLES_RAW

`ROLES, USUARIOS, DIRECCIONES, PROVEEDORES, CATEGORIAS, DESCUENTOS, PRODUCTOS, PRODUCTO_VARIANTES, PRODUCTO_IMAGENES, PRODUCTO_CARACTERISTICAS, METODOS_PAGO, VENTAS, DETALLE_VENTAS, ENVIOS, MOVIMIENTOS_STOCK, FAVORITOS, HISTORIAL, CARRITO, RESENAS, PQR, RETOS, RETOS_USUARIOS, RETO_EVIDENCIAS, NOTIFICACIONES, DEVOLUCIONES, DEVOLUCIONES_EVIDENCIAS, SOLICITUDES_VENDEDOR, VENDEDORES, CHAT, CHAT_MENSAJE, PLANTILLAS_PLANES, PLANES_USUARIO, USUARIOS_METODOS_PAGO, AVISOS_STOCK, PAGOS_EVENTOS, NEWSLETTER_SUSCRIPTOS, NEWSLETTER_ENVIOS` + tabla aparte `sessions` (schema oficial de express-mysql-session).

Generalidades del esquema: nombres en MAYÚSCULAS y español; PKs auto-increment `ID_*`; clave de usuario `USUARIOS.ID_USUARIO` (roles: 1=admin, 4=cliente, 6=vendedor); `VENTAS.ESTADO` ∈ `COMPLETADA/CONFIRMADA/PENDIENTE/PENDIENTE_PAGO/CANCELADA/ENVIADA`, `ENVIOS.ESTADO_ENVIO` ∈ `PENDIENTE/POR_EMPAQUETAR/EMPACADO/EN_CAMINO/ENVIADA/ENTREGADO/CANCELADO`. Stock por variante `PRODUCTO_VARIANTES.STOCK`; `DETALLE_VENTAS` guarda `ID_VARIANTE` y `SUBTOTAL`.

## Migraciones idempotentes (patrón obligatorio)

Toda modificación de esquema se añade como entrada de `const MIGRACIONES = [...]` en setup.js: verifica en `INFORMATION_SCHEMA.COLUMNS` y solo ejecuta si no existe:

```js
{
  tabla: 'ENVIOS',
  columna: 'COSTO_ENVIO',
  alterSql: 'ALTER TABLE ENVIOS ADD COLUMN COSTO_ENVIO DECIMAL(10,2) NOT NULL DEFAULT 0',
  mensaje: 'columna COSTO_ENVIO agregada a ENVIOS (cálculo de envío)',
}
```

- Para tablas nuevas usa `createSql` (CREATE TABLE IF NOT EXISTS) en vez de `columna`/`alterSql`. Tablas de este estilo ya entrando por MIGRACIONES: RETO_EVIDENCIAS, NOTIFICACIONES, DEVOLUCIONES, AVISOS_STOCK, PAGOS_EVENTOS, CHAT/CHAT_MENSAJE.
- Hay migraciones de DATOS idempotentes (rol 6 'Vendedor', vinculación de productos a vendedores). Después del array: RETOS_ADICIONALES y `seedAdminUser`.
- **Tras cualquier cambio de esquema** regenera el dump para BD nuevas: `node backend/database/exportarSchema.js` (reconstruye `schema.sql` desde CREATE_TABLES_RAW+SEED+DEMO+createSql). `schema.sql` es para importar en Workbench en BD NUEVAS; las BD existentes NO lo importan — sus cambios llegan con las migraciones al reiniciar `jadda_backend`.
- Producción: sin `RUN_MIGRATIONS_ON_BOOT=true` el servidor NO migra al arrancar (exige BD ya creada; corre una vez `docker compose -f docker-compose.prod.yml run --rm migrate`).

## Seeds y demo

- `SEED_DATA` (siempre): roles, 15+ categorías, proveedores, catálogo (~104 productos con variantes/imagenes/frases técnicas), descuentos, retos, plantillas de planes; `DEMO_DATA` se omite con `DEMO_DATA=false` o en producción sin `LOAD_DEMO_DATA=true`.
- Admin: `seedAdminUser` crea al admin con `ADMIN_EMAIL`/`ADMIN_PASSWORD` del `backend/.env` en cada arranque (si le borras, vuelve).
- `INSERT IGNORE` es idempotente pero NO corrige datos ya existentes: para cambiar un valor de seed edita la fila del bloque sin depender de UPDATEs posteriores (vuelven al reiniciar).

## Ejecutar SQL en Docker desde Windows PowerShell (gotchas reales)

- PowerShell pierde las comillas al pasar SQL inline a `docker exec`: escribe el SQL en un archivo, `docker cp archivo.sql jadda_mysql:/tmp/` y `docker exec jadda_mysql sh -c "mysql -u root -p'<pass>' jadda_sports_db < /tmp/archivo.sql"`.
- Cuenta las filas con `-N` (sin encabezados) para salida apigen tabular: `mysql -N -u root -p'<pass>' ... -e "SELECT ..."`; nunca mezcles SELECTs con comillas dobles dentro de here-strings de PS 5.1 (backticks se interpretan como escapes).
- Verificar conexión: `docker exec jadda_mysql sh -c "mysqladmin ping -h 127.0.0.1"`.
- Si creas una BD nueva fuera del volumen (p. ej. importar schema.sql en el host), usa el mismo `DB_PASSWORD` de `backend/.env` que usa el backend.

## Reglas FK al borrar datos de prueba

Borras en cascada manual respetando FKs y SIEMPRE en transacción. Orden reciente usado y probado para eliminar una venta: `CHAT_MENSAJE → CHAT → DEVOLUCIONES → DETALLE_VENTAS → ENVIOS → PLANES_USUARIO → VENTAS` (con `SET FOREIGN_KEY_CHECKS=0/1` alrededor si hay dependencias cruzadas). Cuidado con FK Intl de CARRITO/FAVORITOS/HISTORIAL al purgar USUARIOS.

## Cuándo tocar la BD en vivo

El asistente SÍ puede aplicar cambios a la BD viva; informa siempre qué ejecutó y deja stock/resto del estado como estaba (restaurar `PRODUCTO_VARIANTES.STOCK` a mano si una sonda lo alteró).

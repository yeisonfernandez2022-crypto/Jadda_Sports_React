<!-- Completado con el proyecto real JADDA SPORTS al cierre del Sprint 1 (Semana 2),
     siguiendo la plantilla starter del bootcamp. Las verificaciones en vivo (Docker,
     volumen, migraciones) se corrieron el 2026-11-11 y se citan como evidencia. -->

# Sprint 1 — Dominio y Persistencia — Review

## 1. Objetivo del Sprint

Construir (y en el proyecto real, **validar y acreditar con evidencia**) el modelo de dominio del alcance
de este sprint — **usuarios con confirmación OTP y rol** + **catálogo de productos con variantes e
imágenes** — junto con el **esquema de datos y migraciones** que lo persisten desde una base de datos
vacía, y el servicio de base de datos en Docker con volumen persistente.

**Nota honesta sobre el punto de partida**: JADDA SPORTS no arranca de cero — el dominio ya está
implementado (38 tablas, 61 RFs verificados). Este sprint aplicó la técnica del taller de modelado
sobre el alcance real del sprint: se verificó que el esquema y las migraciones existentes cumplan los
criterios (modelo con entidades/relaciones/cardinalidad, migraciones desde BD vacía sin pasos
manuales, volumen persistente) y se documentó el mapeo en este entregable. El código nuevo con TDD
del bootcamp quedó demostrado en el Sprint 0 (endpoint `GET /api/envio/tarifas`, test RED→GREEN).

## 2. Modelo de Dominio Construido

Alcance del sprint = núcleo de catálogo + clientes base. Fuentes: ERD versionado
(`docs/diagrams/base-de-datos.md`) y diccionario de datos.

| Entidad / Value Object | Atributos clave | Relaciones |
|---|---|---|
| `ROLES` | `ID_ROL` (1 Admin · 4 Comprador · 6 Vendedor), `NOMBRE_ROL` | `1:N` hacia `USUARIOS` (un rol, muchos usuarios) |
| `USUARIOS` | `ID_USUARIO` PK, `EMAIL` UNIQUE, `CONTRASENA` (hash bcrypt), `CONFIRMADO`, `TOKEN` (hash del código OTP), `TOKEN_EXPIRA` (15 min), `ID_ROL` FK, `AUTH_PROVIDER` (`local`/`google`), `PROVIDER_ID`, `DEBE_CAMBIAR_PASSWORD`, `ULTIMA_CONEXION/ULTIMA_IP/ULTIMA_UBICACION`, `FOTO_URL` | `N:1` con `ROLES`; `1:N` con `DIRECCIONES`, `RESENAS`, `FAVORITOS`, `HISTORIAL` |
| OTP (Value Object, no tabla) | código de 6 dígitos, guardado **solo como hash bcrypt** en `USUARIOS.TOKEN` con vigencia 15 min | pertenece a un `USUARIOS` en curso de confirmación |
| `DIRECCIONES` | `ID_DIRECCION` PK, `ID_USUARIO` FK, `ETIQUETA`, `DIRECCION`, `BARRIO`, `CIUDAD`, `DEPARTAMENTO`, `CODIGO_POSTAL`, `TELEFONO`, `ES_PRINCIPAL` | `N:1` con `USUARIOS` |
| `CATEGORIAS` | `ID_CATEGORIA` PK, `NOMBRE_CATEGORIA` UNIQUE (índice `uq_categoria_nombre`), `DESCRIPCION` | `1:N` hacia `PRODUCTOS` y `PLANTILLAS_PLANES` |
| `PROVEEDORES` | `ID_PROVEEDOR` PK, `NOMBRE_PROVEEDOR` | `1:N` hacia `PRODUCTOS` (opcional) |
| `DESCUENTOS` | `ID_DESCUENTO` PK, `DESCRIPCION` (código), `PORCENTAJE`, `FECHA_INICIO/FECHA_FIN`, `USADO` (cupones RETO- de un solo uso), `MONTO_MINIMO` | `1:N` hacia `PRODUCTOS` vía `PRODUCTOS.ID_DESCUENTO` |
| `PRODUCTOS` | `ID_PRODUCTO` PK, `NOMBRE`, `DESCRIPCION`, `PRECIO`, `MARCA`, `ID_CATEGORIA` FK, `ID_PROVEEDOR` FK, `ID_VENDEDOR` FK (NULL = JADDA), `ESTADO_PUBLICACION` (`NULL`/`PENDIENTE`/`APROBADO`/`RECHAZADO`), `ID_DESCUENTO` FK | `N:1` con `CATEGORIAS`/`PROVEEDORES`/`DESCUENTOS`/`VENDEDORES`; `1:N` con `PRODUCTO_VARIANTES`, `PRODUCTO_IMAGENES`, `PRODUCTO_CARACTERISTICAS` |
| `PRODUCTO_VARIANTES` | `ID_VARIANTE` PK, `ID_PRODUCTO` FK, `COLOR`, `NOMBRE_ATRIBUTO`, `ATRIBUTO`, `STOCK`; constraint único `uq_variante` | `N:1` con `PRODUCTOS`; `1:N` con `DETALLE_VENTAS`, `CARRITO`, `AVISOS_STOCK` |
| `PRODUCTO_IMAGENES` | `ID_IMAGEN` PK, `ID_PRODUCTO` FK, `URL_IMAGEN`, `ORDEN` (1 = portada) | `N:1` con `PRODUCTOS` (galería ordenada) |
| `PRODUCTO_CARACTERISTICAS` | `ID_CARACTERISTICA` PK, `ID_PRODUCTO` FK, `NOMBRE`, `VALOR` | `N:1` con `PRODUCTOS` (ficha técnica) |
| `METODOS_PAGO` | `ID_METODO` PK, `NOMBRE_METODO`, `DESCRIPCION` (catálogo de referencia: 16 métodos, incluye Wompi) | `1:N` referenciado por `USUARIOS_METODOS_PAGO` y `VENTAS` |

**Agregados identificados**: `Catálogo` = raíz `PRODUCTOS` con `VARIANTES` + `IMAGENES` +
`CARACTERISTICAS` como hijos (se persisten y se leen juntos); `Cuenta` = raíz `USUARIOS` con
`DIRECCIONES` (y luego métodos de pago). La variante es el invariante de stock: el catálogo no se
vende sin variante (`addToCart` siempre exige `ID_VARIANTE`).

## 3. Esquema de Datos y Migraciones

- **Motor de base de datos**: **MySQL 8.0** en desarrollo (Docker, imagen `mysql:8.0`) y
  **TiDB Cloud Starter** en producción (compatible MySQL, puerto 4000, TLS forzado). Local
  production-ready con el mismo `docker-compose.prod.yml` y su MySQL local como rollback.
- **Migraciones escritas esta semana**: **ninguna nueva** — el esquema del alcance del sprint ya
  existe y se valida. El mecanismo vigente (fuente única `backend/database/setup.js`):
  - `CREATE_TABLES_RAW` (línea 82): 38 sentencias `CREATE TABLE IF NOT EXISTS` — esquema completo
    para BD nuevas.
  - `SEED_DATA`: `INSERT IGNORE` de datos de referencia (ROLES, 15 CATEGORIAS, METODOS_PAGO,
    DESCUENTOS, 105+ productos con variantes/imágenes/características, retos, planes). Idempotente:
    se puede ejecutar en cada arranque sin duplicar ni pisar datos.
  - `MIGRACIONES` (línea 2426): ALTERs idempotentes para BD existentes que consultan
    `INFORMATION_SCHEMA` antes de aplicar (p. ej. `MONTO_MINIMO` en `DESCUENTOS`,
    `FECHA_EXPIRA_PAGO` en `VENTAS`, `ESTADO_PUBLICACION`/`ID_VENDEDOR` en `PRODUCTOS`,
    `OBSERVACION`/`RUTA` nullable en `RETO_EVIDENCIAS`, índice `uq_categoria_nombre`).
  - `schema.sql` regenerable con `node backend/database/exportarSchema.js` (archivo SQL único para
    Workbench / BD nuevas).
- **¿Aplicables desde una base de datos vacía sin pasos manuales?**: **Sí.** Al levantar el backend
  (`docker compose up`), `server.js` requiere `database/setup` que: (1) se conecta con reintentos,
  (2) crea la BD si no existe, (3) ejecuta `CREATE_TABLES_RAW`, (4) siembra con `INSERT IGNORE`,
  (5) aplica las migraciones idempotentes. **Cero pasos manuales** — verificado históricamente al
  recrear el volumen (`docker compose down -v` + `up` → tablas + seeds recreados).

## 4. Estado Docker de la Semana

- [x] Servicio de base de datos presente en `docker-compose.yml` — se llama **`database`**
      (el checklist de la plantilla dice `db`; **Ruling del proyecto: NO se renombra** — cambiar el
      nombre rompería `depends_on`, el `proxy` de Vite y la documentación de despliegue; la
      equivalencia `db` ↔ `database` queda documentada aquí).
- [x] Volumen persistente configurado — volumen nombrado `mysql_data:/var/lib/mysql` (volumen
      Docker real: `proyectojaddasports_mysql_data`).
- [x] Verificado en vivo (2026-11-11): contenedor `jadda_mysql` **Up 4 days (healthy)** con el
      healthcheck `mysqladmin ping` del compose; volumen listado por `docker volume ls`;
      `docker compose down` **sin** `-v` conserva los datos (el volumen sobrevive).
- **Nota**: no es gate bloqueante esta semana — ver la guía Docker del bootcamp.

## 5. Historias Completadas

Alcance del sprint según el mapa de `entregable-s01-plan-de-trabajo.md` §4 (Sprint 1 = HU-001, HU-006).

| Historia | PR (enlace) | Revisada por |
|---|---|---|
| HU-001 — Registro con confirmación por código OTP (hash + 15 min) y rol | PR pendiente de abrir por el propietario: `compare/Develop...feature/sprint1-dominio-persistencia` (el código está en main/Develop; este PR acredita la validación del esquema `USUARIOS`: `CONFIRMADO`, `TOKEN` hash, `TOKEN_EXPIRA`, `ID_ROL`) | Propietario del repo (ceremonia Sprint Review) |
| HU-006 — Catálogo con variantes, imágenes ordenadas y ficha técnica | Mismo PR (esquema `PRODUCTOS`/`PRODUCTO_VARIANTES` con `uq_variante`/`STOCK`, `PRODUCTO_IMAGENES` con `ORDEN`, `PRODUCTO_CARACTERISTICAS`, visibilidad `ESTADO_PUBLICACION`) | Propietario del repo (ceremonia Sprint Review) |

**Estado CI**: el workflow (`ci.yml`) corre en cada push a la rama; el PR se abre desde la URL
`compare` (el link `pull/new/` de GitHub defaultea a `main` — no usar).

## 6. Historias No Completadas

| Historia | Motivo |
|---|---|
| (ninguna del alcance de este sprint) | HU-002 (sesiones/RBAC) pertenece al **Sprint 2** por el mapa del S01 — no quedó pendiente de este sprint. |

## 7. Demo

Qué se muestra en vivo al instructor:

1. **BD desde cero sin pasos manuales**: `docker compose down -v` + `docker compose up -d` → los logs
   del backend muestran `Setup de BD OK` (tablas creadas + seeds `INSERT IGNORE` + migraciones) — el
   catálogo queda servible de inmediato por la API (`GET /api/productos`).
2. **Volumen persistente**: `docker compose down` (sin `-v`) + `up -d` → los datos siguen ahí
   (volumen `proyectojaddasports_mysql_data`).
3. **Modelo de dominio**: ERD de `docs/diagrams/base-de-datos.md` (40 relaciones con cardinalidad)
   y `schema.sql` importable en MySQL Workbench.
4. **Idempotencia real**: reiniciar el backend corre setup de nuevo sin duplicar datos
   (`INSERT IGNORE` + ALTERs que consultan `INFORMATION_SCHEMA`).
5. **Reglas que el esquema no garantiza** (adelanto del Sprint 4): stock y cupón se cobran dentro de
   transacciones con `SELECT ... FOR UPDATE` + guards condicionales (`AND STOCK >= ?` → 409;
   `USADO=0→1` del cupón) — no son expresables como DDL.

## 8. % de Avance Acumulado del Proyecto

**~22 %** de las semanas del plan (Sprint 0 + Sprint 1 de 8 sprints de desarrollo + Semana 1).
Nota honesta: el *código* del dominio core ya estaba implementado antes del bootcamp (proyecto
preexistente con 38 tablas y 61 RFs verificados); el porcentaje acredita las semanas del plan
cerradas con criterios verificados, no líneas de código nuevas.

## 9. Retrospectiva Breve

**¿Qué salió bien?**
- El dominio es **real y maduro** (38 tablas, 40 relaciones con cardinalidad en el ERD): el sprint
  pudo validar en lugar de reconstruir, y la evidencia (Docker vivo, migraciones idempotentes) es
  comprobable al momento.
- Las migraciones idempotentes (`INFORMATION_SCHEMA` antes de ALTER + `INSERT IGNORE` en seeds)
  hacen que "BD vacía → sistema funcionando" sea un solo `docker compose up` — el criterio más duro
  del checklist se cumple de fábrica.
- El Sprint 0 dejó el patrón TDD (RED→GREEN) y las convenciones de commit; heredarlas evita
  improvisar.

**¿Qué no salió bien?**
- La plantilla del checklist nombra el servicio `db` y el proyecto usa `database` — se resolvió con
  una Ruling documentada (no renombrar) en vez de romper el compose.
- **No existe `down()` por migración**: el proyecto no usa una herramienta de migraciones con
  up/down. La reversión de un cambio de modelado depende del respaldo previo (`scripts/backup.ps1`,
  dumps en `backups/mysql/` con retención 7 días) + ALTER manual — no es automático.
- La ceremonia del PR (apertura, review y merge a `Develop`) depende del propietario del repo: los
  enlaces quedan "pendientes de abrir" hasta que la sesión de Sprint Review los ejecute.

**¿Qué vamos a cambiar en el Sprint 2?**
- Autenticación y autorización (HU-002): validar sesiones `express-session` + Passport (local y
  OAuth Google), OTP por correo, RBAC (`esAdmin`/`esVendedor`) y el bloqueo de vendedores
  compradores con la misma técnica de verificación contra el checklist (mapear, no rehacer).
- Antes de tocar cualquier área de migración: crear el respaldo primero (protocolo ya existente) —
  cubre el hueco del `down()` ausente.
- Empujar la rama del sprint **antes** del cierre para que la ceremonia de PR no quede colgando del
  instructor.

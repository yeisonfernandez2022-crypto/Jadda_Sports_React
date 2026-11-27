# 📘 Plan de Implantación — JADDA SPORTS

<!-- Documento generado a partir de docs/implantacion/plan-implantacion-template.md.
Cada sección del plan corresponde a un entregable semanal: el archivo "entregable-sNN-…"
(documento completo con evidencia) y esta ficha es el índice ejecutivo que lo referencia.
Solo datos sintéticos: nada de IPs, usuarios ni contraseñas reales. -->

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos con marketplace de vendedores |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Versión del plan | v1.0 (cierre 2026-11-27: evidencia S01–S09 + smoke público + UAT) |
| Fecha | 2026-11-27 |

## Resumen de fases 5–10

| Fase | Estado documentado | Evidencia |
|---|---|---|
| 5. Instalación y despliegue | Instalación local, gate Docker y **smoke público** verificados | [S04 §Estado Docker](../entregables-asesoria/entregable-s04-sprint-3-review.md) · [S09 §1](../entregables-asesoria/entregable-s09-cierre-final.md) · §5.2 |
| 6. Configuración y verificación | Integración, CORS, variables, orden de arranque y smoke verificados; inventario por ambiente documentado | [S06 §CORS y variables](../entregables-asesoria/entregable-s06-sprint-5-review.md) · §6 |
| 7. Seguridad, usuarios y permisos | Gestión de secretos, RBAC, rate limit y auditoría OWASP documentados; cuentas y puertos inventariados; firewall gestionado por Render | [S04 §Estado Docker](../entregables-asesoria/entregable-s04-sprint-3-review.md) · §7 · `docs/auditoria/estado-brechas.md` |
| 8. Pipeline y monitoreo | CI, cobertura, integridad FK y **rollback de BD** documentados; monitoreo y rollback de app **pendientes operativos** | [S08 §2–5](../entregables-asesoria/entregable-s08-sprint-7-review.md) · §8 |
| 9. Mantenimiento y capacitación | Calendario y matriz de soporte definidos; capacitación formal pendiente | [S09 §4, §6](../entregables-asesoria/entregable-s09-cierre-final.md) · §9 |
| 10. Aceptación y entrega | Gate Docker, UAT de 38 casos y acta firmada electrónicamente el 2026-11-27 | [S09 §1, §5–6](../entregables-asesoria/entregable-s09-cierre-final.md) · [UAT](../aceptacion/pruebas-aceptacion.md) · §10 |

## Mapa de semanas y entregables

| Semana | Entregable (documento completo) | Secciones de este plan que cubre | Estado |
|---|---|---|---|
| S01 | [entregable-s01-ficha-tecnica.md](../entregables/entregable-s01-ficha-tecnica.md) (2026-10-20) | §1 Ficha técnica y requisitos | ✅ |
| S02 | [entregable-s02-planes.md](../entregables/entregable-s02-planes.md) (2026-10-21) | §2 Migración · §3 Respaldo · §5 Instalación (v0) | ✅ |
| S03 | [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md) (2026-10-21) | §4 Hosting y dominio | ✅ |
| S04 | [entregable-s04-sprint-3-review.md](../entregables-asesoria/entregable-s04-sprint-3-review.md) | §5 Despliegue · evidencia de contenedores, variables de entorno y respuesta HTTP | ✅ Smoke público verificado 2026-11-26; instalación local documentada |
| S05 | [entregable-s05-sprint-4-review.md](../entregables-asesoria/entregable-s05-sprint-4-review.md) | §2 Ejecución de reglas · §6 Verificación en contenedor | ✅ Reglas y verificación documentadas; inventario por ambiente en §6 |
| S06 | [entregable-s06-sprint-5-review.md](../entregables-asesoria/entregable-s06-sprint-5-review.md) | §6 Integración frontend-backend, variables, CORS y arranque | ✅ Integración, Docker e inventario por ambiente verificados (§6) |
| S07 | [entregable-s07-sprint-6-review.md](../entregables-asesoria/entregable-s07-sprint-6-review.md) | §5 Despliegue · §8 orden de arranque y healthchecks | 🟡 Healthchecks y orden verificados; monitoreo y rollback de app pendientes (§8) |
| S08 | [entregable-s08-sprint-7-review.md](../entregables-asesoria/entregable-s08-sprint-7-review.md) | §8 Pruebas y CI · §10 criterios de prueba | 🟡 Cobertura y CI documentados; UAT cerrada; monitoreo y capacitación pendientes |
| S09 | [entregable-s09-cierre-final.md](../entregables-asesoria/entregable-s09-cierre-final.md) | §5 Gate de instalación · §10 Aceptación y hand-off | ✅ Gate Docker aprobado; UAT y acta firmadas 2026-11-27 (alcance declarado) |

> Regla del módulo: en la semana 9 este documento debe permitir que **otro equipo instale el
> proyecto desde cero sin ayuda**. Comandos copiables y criterios verificables siempre.

---

## 1. Ficha técnica y requisitos mínimos — Semana 1 (CE-1, CE-2) ✅

Documento fuente: **[entregable-s01-ficha-tecnica.md](../entregables/entregable-s01-ficha-tecnica.md)** (inventario completo, `docker stats`, plataforma física recomendada y bitácora del script).

| Aspecto | Resumen | Evidencia |
|---|---|---|
| Arquitectura | Monolito de 3 capas orquestado con Docker Compose: SPA React + TypeScript (Vite), API REST Node/Express, BD MySQL 8.0.46 | docker-compose.yml |
| Servicios que lo componen | `jadda_frontend` (5173), `jadda_backend` (5000), `jadda_mysql` (3306); extras: SMTP, Cloudinary, app móvil Expo opcional | §1.2 del entregable S01 |
| Sistema operativo | Windows 11 Home 25H2 (equipo disponible); para servidor dedicado se recomienda **Ubuntu Server 24.04 LTS** | §1.3 del entregable S01 |
| Consumo medido | Reposo 1,01 GiB · pico 1,18 GiB y ≈4 núcleos con 20 usuarios concurrentes (8.000 peticiones, 0 errores, 513 req/s) | §1.4 + `docker stats` |
| Requisitos mínimos | CPU ≥ 4 vCPU · RAM ≥ 8 GB · disco libre ≥ 40 GB · Docker ≥ 24 + Compose v2 | §1.5 matriz completa |
| Verificación con script | `scripts/verificar-requisitos.sh` sobre `servidor-local-jadda` (Git Bash): **OK 22 · AVISOS 0 · FALLAS 0 → CUMPLE LOS REQUISITOS MÍNIMOS** | salida reproducida en §1.7 del entregable S01 |

Acción correctiva: ninguna (el equipo supera todos los umbrales). Pendiente condicional: si se
compila un servidor dedicado, re-ejecutar el script allí con `MIN_CPU=4 MIN_RAM_GB=8 MIN_DISK_GB=40`.

> **Nota vigente 2026-11-20:** esta ficha conserva las mediciones del entorno local de S01. La producción pública actual corre en **Render Free (SPA + API) + TiDB Cloud**; los requisitos de hardware de esta sección aplican al despliegue Docker autogestionado/rollback, no al PaaS. Ver [`../estado-del-proyecto.md`](../estado-del-proyecto.md) §1.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Inventariar recursos del destino; ejecutar `scripts/verificar-requisitos.sh`; registrar salida. | DevOps / QA | CPU ≥ 4 vCPU, RAM ≥ 8 GB, disco libre ≥ 40 GB y salida sin fallas, como evidencia S01 §1.7. |

## 2. Plan de migración de datos — Semanas 2 y 5 (CE-3) ✅ (S02) · ⬜ (S05 ejecución)

Documento fuente: **[entregable-s02-planes.md §2](../entregables/entregable-s02-planes.md)**.

| Elemento | Decisión |
|---|---|
| Objetivo medible | Migrar BD (35 tablas · 2.519 filas en la evidencia S02; 36 desde 2026-10-24 con `PAGOS_EVENTOS`; **39 al 2026-11-20**, sin filas nuevas), `.env` y medio de Cloudinary a otro equipo, con conteos idénticos aprobados, en ventana ≤ 2 h |
| Estrategia | **Big bang** (monolito con una sola BD transaccional; el dump de 0,25 MB se restaura en segundos) |
| Ventana | 23:00–01:00 (baja actividad); estimado de ejecución 60–75 min + rollback |
| Origen → destino | Volumen `mysql_data` → dump lógico (`mysqldump --single-transaction`) → mismo esquema reproducido por `setup.js` |
| Insumos | Dump + `.env` reales por canal externo seguro + repo git (los medios ya viven en Cloudinary; el repo no versiona binarios — solo `.gitkeep`) |
| Validaciones | Loop `COUNT(*)` en las 35 tablas (diff vacío) · SHA-256 del dump + línea `Dump completed on` · `200` en `/api/productos` · smoke E2E |
| Rollback | Restaurar el dump previo o re-levantar el origen (**el `down -v` del origen queda prohibido durante la ventana**) |
| Riesgos cubiertos | Shell de WSL sin distro (usar Git Bash), `.env` perdidos, drift de datos en la ventana, versión MySQL distinta, admin bloqueado |

Semana 5: se agregará aquí la evidencia de la migración **ejecutada** (los conteos de
entregable-s02 §3.5 sirven de línea base origen/destino).

**Evidencia del simulacro de cierre (2026-11-26):** dump lógico de **310.763 B** (SHA-256
`EA0A0392BF74A8531018403B42B64F942CD7860AF55F8969C5014B9491DB21BC`), restauración en **3.195 ms**
con **39 tablas y 2.904 filas idénticas** al origen, y re-migración en **1.570 ms** que deja el esquema
en 45 FK/0 colgantes. El simulacro valida el restore y el rollback; **no** sustituye una migración a un
segundo host físico, que sigue pendiente porque el proyecto no dispone de un segundo servidor.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Tomar dump consistente, restaurarlo en destino y comparar conteos de todas las tablas. | Administrador de BD / QA | Diferencia de conteos vacía en las 39 tablas del simulacro local 2026-11-26 (2.904 filas idénticas); migración a un segundo host pendiente. |
| Ejecutar smoke de API y smoke E2E tras migrar. | QA | `/api/productos` devuelve 200 y smoke 3/3 en producción (2026-11-26); smoke post-restore local pendiente. |
| Conservar origen hasta aprobar el destino; ejecutar rollback si falla un criterio. | DevOps / administrador de BD | Reversión completada en **3.195 ms**, dentro de la ventana ≤2 h descrita en S02; simulacro local aprobado. |

## 3. Plan de respaldo — Semanas 2 y 6 (CE-4) ✅ (S02) · ⬜ (S6 parcial: cifrado)

Documento fuente: **[entregable-s02-planes.md §3](../entregables/entregable-s02-planes.md)**.

| Aspecto | Decisión |
|---|---|
| Qué se respalda | BD completa (**39 tablas**, dump lógico con rutinas/triggers/events) · medios zip de `frontend/public/images` (solo lo que cae a disco como fallback; el histórico vive en Cloudinary — la carpeta queda vacía en git con `.gitkeep`) · `.env` cifrado por canal externo · repo (git) |
| Objetivos | **RPO 24 h · RTO 1 h** (respaldo diario 23:30; la restauración de prueba real tomó 3,4 s) |
| Herramientas | `scripts/respaldar.sh` (mysqldump **dentro** del contenedor, tamaño>1KB + SHA-256) · `scripts/backup.ps1` (respaldo + rotación) |
| Política 3-2-1 | Copia 1: disco local `backups/mysql/` · Copia 2: disco externo/USB semanal desconectado · Copia 3: nube (Drive/OneDrive) semanal |
| Retención | 7 días con rotación (`-RetencionDias 7`), diario a las 23:30 vía `schtasks` |
| Cifrado | Pendiente (mejora MC → GPG en copias fuera del sitio; se cierra en S06) |
| Restauración probada | 8 pasos con comandos copiables; prueba real en base aparte: **3.195 ms** (2026-11-26), **39/39 tablas idénticas (2.904 filas)**, SHA-256 del dump `EA0A0392…DB21BC`; antes: 3.371 ms/35 tablas (S02) |
| Calendario de pruebas | Mensual: restauración en base aparte + diff · trimestral: entorno completo y rotación de medios · semanal: revisión de `backups/backup.log` |

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Generar respaldo con `scripts/respaldar.sh`, verificar tamaño y SHA-256. | Operaciones / administrador de BD | Archivo >1 KB y hash registrado, conforme al procedimiento S02; el simulacro de cierre generó 310.763 B con hash verificado. |
| Restaurar en una BD separada y comparar conteos. | Administrador de BD / QA | Restauración de prueba documentada: **39/39 tablas idénticas y 2.904 filas** (2026-11-26). |
| Mantener copias local, externa y nube según retención. | Operaciones | Script y rotación de 7 días listos; la tarea diaria de las 23:30 **no está programada** y las copias externa/nube están pendientes. |

## 4. Hosting y dominio — Semana 3 (CE-1) ✅

Documento completo con evidencia: [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md).

| Ítem | Decisión |
|---|---|
| Hosting | Propio (on-premise, LAN de la tienda) sobre equipo torre con Docker — justificado con mediciones de S01; ruta de crecimiento documentada hacia VPS |
| Dominio elegido | `jaddasports.com` (por comprar) con `www` (tienda SPA) y `api` (API directa / app móvil) |
| Registros DNS | A/A/CAA/TXT planeados (simbólicos, sin IPs reales); la práctica local simula el DNS con `curl --resolve` |
| Reverse proxy | **Caddy** (`deploy/Caddyfile` + `deploy/docker-compose.caddy.yml`) publicando `frontend:80` (nginx interno de la SPA, Fase 3)/`backend:5000` por los dominios elegidos; FALLBACK equivalente ya probado con nginx en el módulo A — un solo gateway a la vez |
| HTTPS | `tls internal` (CA local de Caddy) probado con `curl --resolve`; producción real = quitar la línea → Let's Encrypt o certificados de CA (deploy/certs) |
| Transferencia de archivos | `git clone` + secretos por canal externo (S02 §5); imágenes se construyen en destino; medios ya en Cloudinary |

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Confirmar dominio/DNS del entorno y resolverlo contra el reverse proxy. | DevOps / redes | Registros aprobados resuelven al destino; dominio real permanece por comprar según S03. |
| Levantar un único gateway y validar HTTPS. | DevOps | Respuesta HTTPS válida por el proxy seleccionado; S03 documenta prueba local con Caddy y certificado interno. |
| Registrar decisión entre instalación propia y hosting administrado. | Product Owner / DevOps | Entorno, dominio y responsables aprobados; despliegue público actual descrito en S09 §6 y verificación vigente en §5 por completar. |

## 5. Plan de instalación y despliegue — Semanas 2 y 4 (CE-1, CE-5)

<!-- 📝 Prerrequisitos, pasos numerados y verificables para instalar en servidor local y en la
nube, versión liberada, costos estimados. Semana 10 (opcional): subsección 5.10 con la
instalación automatizada (cloud-init + Ansible). -->

### 5.1 Instalación en servidor local (v0, entregada en S02) ✅

Documento fuente: **[entregable-s02-planes.md §5](../entregables/entregable-s02-planes.md)** (alcance, ambientes, roles, prerrequisitos y cronograma).

| # | Acción | Comando / referencia | Resultado esperado |
|---|---|---|---|
| 1 | Verificar requisitos | `bash scripts/verificar-requisitos.sh` (Git Bash en Windows) | Salida 0, "CUMPLE LOS REQUISITOS MINIMOS" |
| 2 | Clonar repositorio | `git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git` | Carpeta del proyecto en el destino |
| 3 | Copiar `.env` reales | por canal seguro (git los ignora) | `backend/.env` presente antes de arrancar |
| 4 | Levantar contenedores | `docker compose up -d` | 3 contenedores `Up`; `setup.js` crea 39 tablas + seeds |
| 5 | (Opcional) Restaurar datos reales | `docker exec -i jadda_mysql sh -c '…' < backups/mysql/<respaldo>.sql` | Conteos iguales a §3.5 del entregable S02 |
| 6 | Verificar despliegue | `curl http://localhost:5173/api/productos` | `200` vía proxy |
| 7 | Rotar contraseña admin | Perfil → Seguridad con la cuenta del `.env` | Contraseña fuera del repo/historial |
| 8 | Activar respaldos | tarea 23:30 (`schtasks`) + `bash scripts/respaldar.sh` | `backups/mysql/<fecha>_*.sql` con SHA-256 |

Cronograma aprobado en S02: **≤ 2 h** con 45 min de contingencia; punto de no retorno =
`docker compose down -v` en el destino con el volumen ya migrado.

### 5.2 Despliegue en producción / servidor dedicado (S04) — ✅ verificado 2026-11-26

**Estado:** implementación y gate Docker documentados; el **smoke del servicio público** se ejecutó el
2026-11-26 a las 23:02 -05 con estas rutas y latencias:

| Ruta | Código | Latencia |
|---|---:|---:|
| `https://jadda-frontend.onrender.com/` | **200** | 495 ms |
| `https://jadda-backend.onrender.com/health` | **200** | 416 ms |
| `https://jadda-backend.onrender.com/api/productos?limit=1` | **200** | 604 ms |

- **Versión liberada:** `v1.0.0-462-gee3c6c5` (`git describe`).
- **Infraestructura:** Render Free (SPA + API) + **TiDB Cloud Starter**; HTTPS de plataforma.
- **Costo:** **$0/mes** (planes gratuitos; limitación: cold start de ~1 min y suspensión por inactividad).
- **Limitación declarada:** el smoke prueba disponibilidad y lectura de catálogo, no una transacción de
  pago real; la pasarela Wompi sigue en sandbox.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Clonar el commit de entrega y preparar `.env` desde `.env.example` con secretos por canal seguro. | DevOps / responsable de despliegue | Clon limpio; `.env` presente y no versionado. |
| 2. Ejecutar `docker compose up -d` y esperar los healthchecks. | DevOps / responsable de despliegue | `jadda_mysql` y `jadda_backend` en `healthy`; `jadda_frontend` en `Up`, como en S09 §1. |
| 3. Comprobar `/health`, `/api/productos` y `/` en el entorno que se libera. | QA / responsable de despliegue | **3/3 rutas 200** en el smoke público 2026-11-26 (495/416/604 ms). |
| 4. Registrar versión liberada, URL y costo del entorno. | Product Owner / responsable de despliegue | **Registrado:** `v1.0.0-462-gee3c6c5`, URLs de Render, **$0/mes**. |

### 5.3 Instalación y despliegue por fase

El procedimiento local detallado de §5.1 permanece como guía. La secuencia de arriba
debe repetirse para cada liberación, registrando la evidencia del entorno concreto; no
se da por verificado un smoke público a partir de una prueba local.

## 6. Configuración y verificación — Semana 5 (CE-1) — ✅ verificado 2026-11-27

**Estado:** S06 documenta CORS, variables de entorno, proxy y orden de arranque; S09 acredita un
arranque desde `.env.example`. El inventario por ambiente se completa aquí y el smoke público 2026-11-26
confirma que la configuración activa responde 200 en las tres rutas.

### 6.1 Inventario de variables por ambiente

| Variable | Servicio | Dev | Prod | Ejemplo (placeholder) |
|---|---|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `database` | Obligatoria | Obligatoria | `__DEFINIR__` |
| `DB_PASSWORD` | backend | Solo rollback local | Obligatoria | `__DEFINIR__` |
| `TIDB_HOST` / `TIDB_PORT` / `TIDB_USER` / `TIDB_PASSWORD` | backend | Obligatorias si el compose apunta a TiDB | Obligatorias | `gateway…` / `4000` / `__DEFINIR__` |
| `DB_SSL` | backend | `true` con TiDB | `true` | `true` |
| `DB_NAME` | backend | `jadda_sports_db` | `jadda_sports_db` | `jadda_sports_db` |
| `SESSION_SECRET` | backend | Recomendada | **Obligatoria** (fail-fast) | `__DEFINIR__` |
| `NODE_ENV` | backend | `development` | `production` | `production` |
| `CORS_ORIGINS` | backend | No | Sí (dominios Render) | `https://…` |
| `TRUST_PROXY` | backend | `1` si hay proxy | `2` (borde + nginx) | `2` |
| `PAYMENT_GATEWAY` + `WOMPI_*` (4) | backend | Vacío (modo simulado) | **Obligatorias** (Wompi) | `wompi` / `pub_test_…` |
| `ALLOW_SIMULATED_PAYMENTS` | backend | Permitido | Solo demo explícita | `false` |
| `BREVO_API_KEY` / `EMAIL_USER` / `EMAIL_PASS` | backend | Opcional | Recomendada | `__DEFINIR__` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | backend | Opcional | Opcional (login Google) | `__DEFINIR__` |
| `FRONTEND_URL` | backend | `http://localhost:5173` | URL pública | `https://…` |
| `CLOUDINARY_URL` | backend | Opcional (fallback disco) | Recomendada | `cloudinary://…` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | backend | Opcional | Opcional (se prefiere `crear-admin.js`) | `admin@example.com` |
| `GLOBAL_RATELIMIT_MAX` / `GLOBAL_RATELIMIT_RESTRICCION_LOCAL` | backend | `300` / `true` | `300` / `false` | — |
| `VITE_API_URL` / `VITE_PROXY_TARGET` | frontend | Opcional | Build usa `/api` | `http://localhost:5000` |

**Diferencias clave:** dev usa TiDB Cloud por defecto y permite datos demo; producción exige
`NODE_ENV=production`, `SESSION_SECRET`, `PAYMENT_GATEWAY=wompi` + 4 llaves y `TRUST_PROXY=2`, y no
siembra demos. CI usa MySQL efímero y credenciales de prueba que mueren con el runner.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Comparar variables requeridas por `docker-compose.yml`, `.env.example` y `backend/config/db.js`. | DevOps | Inventario §6.1 completo; cada variable tiene servicio, obligatoriedad y placeholder sin secreto. |
| 2. Inyectar secretos en el destino fuera de Git y arrancar la pila. | DevOps | No hay credenciales reales en archivos versionados; los servicios arrancan (S09 §1). |
| 3. Verificar salud y API con las rutas del §5.2. | QA | **3/3 rutas 200** en el smoke público 2026-11-26. |
| 4. Registrar divergencias entre dev, prueba y producción. | QA / DevOps | Tabla §6.1 con las diferencias clave; no quedan divergencias sin documentar. |

## 7. Seguridad, usuarios y permisos — Semana 6 (CE-1) — ✅ verificado 2026-11-27

**Estado:** S04 documenta que BD, secretos y puertos se configuran por entorno; S09 registra la
gestión de credenciales admin. En el cierre se completó la matriz de cuentas, se confirmó la
exposición de puertos y se localizaron las pruebas negativas de acceso. Queda **una acción de
operación pendiente**: activar `DB_USER=jadda_app` en TiDB Cloud producción (hoy el backend usa una
cuenta con más privilegios de los necesarios).

### 7.1 Matriz de cuentas y privilegios

| Capa | Cuenta | Alcance | Privilegios | Dueño | Estado |
|---|---|---|---|---|---|
| SO / host | Usuario Windows del desarrollador | Máquina local | Docker Desktop + acceso al repo | Yeison Fernández | Activa |
| SO / contenedores | `root` dentro de cada contenedor | Contenedor | Proceso del servicio | Docker | Activa (efímera) |
| MySQL dev | `root` (solo `127.0.0.1:3306`) | `jadda_sports_db` | Todos (entorno local) | Desarrollo | Activa |
| MySQL prod (compose) | `root` | Solo bootstrap del contenedor | Todos | DevOps | Activa; no expuesta |
| MySQL prod (compose) | `jadda_migrator` | `jadda_sports_db.*` | SELECT/INSERT/UPDATE/DELETE + CREATE/ALTER/INDEX/REFERENCES; **sin DROP ni `*.*`** | DevOps | Definida en `scripts/sql/usuarios-produccion.sql` |
| MySQL prod (compose) | `jadda_app` | `jadda_sports_db.*` | **Solo DML** (SELECT/INSERT/UPDATE/DELETE) | DevOps | Definida; el backend la usa en compose prod |
| TiDB Cloud | Usuario del dashboard | `jadda_sports_db` | Según consola de TiDB | Yeison Fernández | Activa; **pendiente** crear/usar `jadda_app` de menor privilegio |
| Aplicación | Roles 1–6 (`ADMIN`, `CLIENTE`, `VENDEDOR`, …) | API | RBAC por middleware `esAdmin` / `esVendedor` / `verificarSesion` | Product Owner | Verificado por pruebas |
| Aplicación | Admin inicial | Panel | Todas las rutas admin | Yeison Fernández | Creado con `crear-admin.js`; rotación pendiente tras primer acceso |
| Terceros | Cloudinary, Wompi, Brevo/Gmail, Google OAuth | APIs externas | Llaves por variable de entorno | Yeison Fernández | Activas en sandbox/servicio |

### 7.2 Exposición de puertos y firewall

| Entorno | Servicio | Puerto publicado | Justificación |
|---|---|---|---|
| Dev (`docker-compose.yml`) | MySQL | `127.0.0.1:3306` | Solo loopback: ni la BD ni la API quedan en la LAN |
| Dev | Backend | `127.0.0.1:5000` | Solo loopback; para móvil físico se usa `adb reverse` |
| Dev | Frontend | `127.0.0.1:5173` | Solo loopback |
| Prod (`deploy/compose.prod.yaml`) | MySQL / backend / frontend | **Sin `ports`** | Solo accesibles por la red interna de Docker |
| Prod | Nginx | `80` y `443` | Única puerta pública; 80 redirige a HTTPS |
| Render | SPA y API | `443` gestionado por la plataforma | HTTPS de Render; no hay puertos propios que administrar |
| TiDB Cloud Starter | MySQL | `4000` con TLS | Abierto por la plataforma; acceso con usuario/contraseña y `DB_SSL=true` |

**Firewall:** en local no se abre nada fuera de loopback; en Render el borde y el TLS son gestionados
por la plataforma; en el compose prod solo nginx publica puertos. No hay una regla de firewall propia
que auditar en Render, y eso se declara como dependencia del proveedor.

### 7.3 Secretos y credenciales

- **Archivos versionados:** solo `.env.example` (raíz, backend, frontend, móvil y tests). `backend/.env`
  y cualquier `.env` real están ignorados; `git ls-files` no lista ningún `.env` de secretos.
- **Búsqueda de llaves reales:** `git grep` de `pub_prod_`, `prv_prod_`, `sk_live_`, `AKIA…` y bloques
  `BEGIN … PRIVATE KEY` solo devuelve texto de documentación/avisos, **ninguna credencial**.
- **Placeholders:** `scripts/sql/usuarios-produccion.sql` usa `__CAMBIAR_PASSWORD_*__`; la copia con
  claves reales (`.local.sql`) está en `.gitignore` y se borra tras ejecutarla.
- **Rotación pendiente:** la contraseña del admin real debe rotarse tras el primer acceso y la cuenta de
  TiDB debe migrar a `jadda_app` (DML-only). Ambas quedan como acción del propietario, no como deuda
  oculta.

### 7.4 Pruebas negativas de acceso ejecutadas

| Control | Evidencia | Resultado |
|---|---|---|
| RBAC admin | `tests/backend/middlewares/roles.test.js` | Sin sesión → **401**; rol ≠ 1 → **403**; admin pasa |
| RBAC vendedor | `tests/backend/middlewares/roles.test.js` | Sin sesión → 401; rol ≠ 6 → 403; sin fila ACTIVA → 403 |
| Sesión requerida | `tests/backend/middlewares/roles.test.js` | Sin sesión → 401 JSON |
| CSRF por `Origin` | `tests/backend/middlewares/proteccionOrigen.test.js` | Origin ajeno → **403**; `null` → 403; mismo origen y CORS permitido pasan |
| Rate limit | `tests/backend/middlewares/rateLimiter.test.js` + `rateLimiter.limits.test.js` | Al superar el tope → **429**; cubo por usuario/IP y default `max=10` fijado |
| Fuerza bruta | `tests/backend/integration/fuerza-bruta.test.js` | 10 logins fallidos bloquean la cuenta; correo inexistente → 401 |
| Rutas admin | `tests/backend/integration/admin-panel.test.js` | Dashboard sin sesión → 401; el resto exige admin |
| Gates de rutas | `tests/backend/routes/*.gates.test.js` | 401/403 en checkout, pagos, planes, productos, retos, vendedor y sesión |

**Cobertura de la verificación:** 43 archivos de prueba contienen aserciones 401/403 y 3 archivos
cubren 429. Las pruebas corren en la suite de 1123 unitarias + 132 de integración; no son sondas
manuales sin repetibilidad.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Inventariar cuentas y permisos de sistema operativo, MySQL/TiDB y aplicación. | DevOps / administrador de BD | Matriz §7.1 completa con alcance, privilegios y dueño. |
| 2. Revisar exposición de puertos y reglas de firewall del entorno. | DevOps / seguridad | Tabla §7.2: dev en loopback, prod solo nginx 80/443, Render/TiDB gestionados por el proveedor. |
| 3. Confirmar que los secretos no están en Git y rotar credenciales iniciales. | Seguridad / administrador de BD | `git ls-files` sin `.env` reales; `git grep` de llaves sin hallazgos; rotación de admin y `jadda_app` **pendiente del propietario**. |
| 4. Ejecutar pruebas negativas de acceso con cuentas de menor privilegio. | QA / administrador de BD | §7.4: 401/403/429 verificados por pruebas automatizadas; la prueba con `jadda_app` en TiDB queda pendiente de activar la cuenta. |

## 8. Pipeline de despliegue y monitoreo — Semana 7 (CE-1, CE-5) — ✅ pipeline · 🟡 monitoreo y rollback de app

**Estado:** el workflow de CI define **11 jobs** (lint/TypeScript, unit backend, integración con MySQL,
unit frontend, audit de dependencias, build, imágenes de producción, E2E Playwright, evidencia de
commits de test, cobertura backend y smoke legacy). El job E2E quedó fijado a Chromium en el commit
`ff278c3`. La **cobertura fusionada** corre con trinquete 80 y la **integridad FK** tiene script propio.
El monitoreo externo de `/health` y el rollback de la **aplicación** siguen pendientes operativos; el
rollback de **base de datos** sí se ejecutó y se midió.

### 8.1 Pipeline vigente

| Etapa | Job / comando | Qué verifica | Estado |
|---|---|---|---|
| 1. Estática | `lint-and-typecheck` | `tsc -b`, typecheck de tests y ESLint | Definido |
| 2. Backend unitario | `backend-tests` | 1123 pruebas, 80 archivos | Definido |
| 3. Backend integración | `backend-integration-tests` | 132 pruebas con MySQL 8 real (3307) | Definido |
| 4. Frontend unitario | `frontend-tests` | 855 pruebas, 87 archivos | Definido |
| 5. Dependencias | `security-audit` | `pnpm audit` de las capas | Definido |
| 6. Build | `build` | Build de producción del SPA | Definido |
| 7. Imágenes prod | `build-imagenes-prod` | Dockerfiles de backend y frontend | Definido |
| 8. E2E | `e2e-playwright` | 20 specs en Chromium | Definido |
| 9. Evidencia | `evidencia-individual` | Commits de prueba del ciclo | Definido |
| 10. Cobertura | `cobertura-backend` | Fusión unit+integración, umbral 80 | Definido |
| 11. Humo legacy | `e2e-smoke` | `tests/smoke.mjs` (25 checks) | Definido; el job legacy se conserva por compatibilidad |

**Limitación honesta:** el cierre se hizo con cambios **sin commitear**, así que no hay un run nuevo de
CI que citar. El último run registrado en S09 fue **8/9 jobs verdes** con el job legacy omitido por
diseño; la cifra de 11 jobs es la del workflow vigente, no la de aquel run. El primer push del cierre
debe confirmar los 11 jobs.

### 8.2 Monitoreo de disponibilidad

| Qué | Cómo | Estado |
|---|---|---|
| Salud del backend | Render `healthCheckPath: /health` (definido en `render.yaml`) | Activo: Render reinicia el servicio si `/health` deja de responder 200 |
| Disponibilidad externa | No hay sonda programada ni canal de alerta | **Pendiente** |
| Errores de aplicación | Logs de Render (consola del servicio) | Disponible, sin alertas |
| Base de datos | Panel de TiDB Cloud (métricas y conexiones) | Disponible, sin alertas |
| Integridad FK | `node backend/scripts/auditar-fk.js` (manual) | Script listo; no programado |

**Procedimiento propuesto (no activado):** workflow programado cada 15 minutos que consulte
`https://jadda-backend.onrender.com/health` y `https://jadda-frontend.onrender.com/`; si una ruta deja
de responder 200 dos veces seguidas, abrir un issue o enviar correo al propietario. El umbral de dos
fallos evita el ruido del cold start de Render Free (~1 min).

### 8.3 Rollback

| Nivel | Procedimiento | Evidencia | Estado |
|---|---|---|---|
| Base de datos | Dump lógico → restaurar en BD aparte → comparar conteos → re-migrar | Dump **310.763 B**, SHA-256 `EA0A0392…DB21BC`; restore **3.195 ms**; **39 tablas / 2.904 filas idénticas**; re-migración **1.570 ms** deja 45 FK/0 colgantes | ✅ Ejecutado 2026-11-26 |
| Aplicación (compose) | Relanzar la imagen previa `jadda-prod-backend:latest` con el mismo `.env` | El contenedor previo falla al arrancar si falta `PAYMENT_GATEWAY=wompi` + llaves o `ALLOW_SIMULATED_PAYMENTS=true` | 🟡 No ejecutado |
| Aplicación (Render) | Dashboard → servicio → *Rollback to this deploy* sobre el deploy anterior, o `git revert` + push | Render conserva los deploys previos | 🟡 Procedimiento documentado, no ensayado |
| Esquema | `node database/migrate.js` es idempotente; la limpieza de FK legada se repite sin efecto | Re-migración medida en 1.570 ms | ✅ Verificado en local |

**Comando de rollback de app en compose (cuando se autorice):**
`docker run --rm -e PAYMENT_GATEWAY=wompi -e WOMPI_PUBLIC_KEY=… -e WOMPI_PRIVATE_KEY=… -e WOMPI_INTEGRITY_KEY=… -e WOMPI_EVENTS_SECRET=… jadda-prod-backend:latest`
o, para una demo sin pasarela real, `-e ALLOW_SIMULATED_PAYMENTS=true`. No se ejecutó porque el entorno
de prueba no tenía las llaves y no se quiso simular una configuración de producción.

### 8.4 Respaldo diario

- `scripts/backup.ps1` y `scripts/restaurar-backup.ps1` están probados; `scripts/respaldar.sh` cubre
  Linux. La rotación de 7 días está implementada.
- **No** hay tarea programada a las 23:30 en esta máquina; el respaldo de TiDB Cloud Starter se hace
  desde su consola y no se ha ejecutado contra producción.
- Programación pendiente (Windows): `schtasks /Create /SC DAILY /ST 23:30 /TN "JADDA backup" /TR "powershell -File scripts\backup.ps1"`.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Ejecutar el workflow de CI del commit candidato. | Dev / QA | 11 jobs definidos; el primer push del cierre debe confirmarlos en verde. |
| 2. Construir imágenes de producción y comprobar healthchecks. | DevOps | `build-imagenes-prod` definido; healthchecks de compose prod validados con `config --quiet`. Las pruebas dentro de las imágenes siguen pendientes. |
| 3. Revisar disponibilidad y errores del servicio desplegado. | Operaciones | `/health` activo en Render; monitor externo y alertas **pendientes** (procedimiento en §8.2). |
| 4. Ejecutar rollback controlado en entorno de prueba. | DevOps / QA | BD: **3.195 ms**, 2.904 filas idénticas. App: procedimiento documentado, **no ejecutado** (§8.3). |

## 9. Mantenimiento, soporte y capacitación — Semana 8 (CE-5) — ✅ calendario y soporte · 🟡 capacitación formal

**Estado:** S09 deja riesgos, deuda técnica y hand-off documentados. En el cierre se define el calendario
de mantenimiento y la matriz de soporte; la **capacitación formal con participantes externos no se
ejecutó** y se declara pendiente.

### 9.1 Calendario de mantenimiento

| Frecuencia | Actividad | Responsable | Evidencia |
|---|---|---|---|
| Diaria (23:30) | Respaldo de BD con `scripts/backup.ps1` + revisión de `backups/backup.log` | Operaciones | **Tarea no programada aún**; script probado |
| Semanal | Revisión de logs de Render, errores 5xx y espacio de TiDB | Operaciones | Manual; sin alerta automatizada |
| Mensual | Restauración en BD aparte + comparación de conteos; `pnpm audit` | QA / DevOps | Simulacro 2026-11-26 aprobado |
| Trimestral | Actualización de dependencias, revisión de credenciales y prueba de rollback | DevOps / Seguridad | Procedimiento documentado |
| Por release | `tsc -b`, lint, unitarias, integración, build, smoke y cobertura | Dev / QA | CI de 11 jobs |

### 9.2 Matriz de soporte

| Severidad | Definición | Tiempo objetivo | Canal | Dueño |
|---|---|---|---|---|
| P1 | Sitio caído, pérdida de datos o brecha de seguridad | Atención el mismo día, según disponibilidad | Issue en GitHub + contacto directo | Yeison Fernández |
| P2 | Flujo crítico roto (compra, pago, devolución) sin alternativa | 1 día hábil | Issue en GitHub | Yeison Fernández |
| P3 | Función secundaria degradada | 3 días hábiles | Issue en GitHub | Yeison Fernández |
| P4 | Cosmético o mejora | Próximo ciclo | Plan de mejora continua | Yeison Fernández |

No hay SLA contractual ni turno 24/7; la matriz es una guía de priorización, no una obligación horaria.

### 9.3 Capacitación

- **Material listo:** `docs/aceptacion/guia-capacitacion.md` con sesiones de 45/30/60 min para cliente,
  vendedor y administrador; manuales de instalación, técnico y usuario final.
- **Ejecución:** no hubo sesión formal con participantes externos ni lista de asistencia. La
  transferencia de este cierre es documental. Queda como pendiente del propietario.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Acordar calendario de revisión de dependencias, respaldos, logs y disponibilidad. | Operaciones / Product Owner | Calendario §9.1 con frecuencia, responsable y evidencia. |
| 2. Definir niveles de soporte, horario y canal de escalamiento. | Product Owner / soporte | Matriz §9.2 aprobada; sin SLA contractual declarado. |
| 3. Capacitar al equipo en despliegue, respaldo/restauración y atención de incidentes. | DevOps / soporte | Guía y manuales entregados; **sesión práctica pendiente** (no ejecutada). |
| 4. Revisar deuda técnica y pendientes del hand-off S09 §6. | Product Owner / Dev | `docs/calidad/informe-final-cierre.md` §5 con 10 pendientes priorizados. |

## 10. Aceptación y entrega — Semana 9 (CE-1 a CE-5) — ✅ UAT y acta firmadas

**Estado:** el gate Docker de clon limpio figura como aprobado en S09 §1; la demo integrada está descrita
en S09 §5 y las pruebas de reglas/flujo están registradas en S05. En el cierre se ejecutaron los **38
casos UAT** en modalidad automatizada + inspección y se firmó el acta electrónicamente el 2026-11-27,
con alcance declarado (web completa, móvil parcial 61/67 ≈ 91,0 %).

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Ejecutar el gate Docker desde un clon limpio. | QA / equipo receptor | Tres contenedores arrancan; `/health`, `/api/productos` y `/` responden 200 (S09 §1). |
| 2. Ejecutar la demo integrada y las pruebas de aceptación acordadas. | QA / Product Owner | **38 casos revisados: 37 aprobados, 1 parcial, 0 fallos (97,4 %)**; evidencia en `docs/aceptacion/pruebas-aceptacion.md`. |
| 3. Hacer un simulacro de instalación/recuperación por el equipo receptor. | Equipo receptor / DevOps | Restauración de BD probada (3.195 ms, 2.904 filas idénticas); instalación por un tercero **no ejecutada** (no hay equipo receptor externo). |
| 4. Entregar repositorio, documentación, accesos por canal seguro y acta. | Product Owner / DevOps | Repositorio y documentación entregados; secretos fuera de Git; **acta firmada electrónicamente 2026-11-27** (`docs/aceptacion/acta-entrega.md`). |

**Limitaciones de la aceptación:** no hubo cliente externo ni revisor independiente; la firma es
electrónica y el mismo firmante representa ambos roles. Se declara en el acta y en el informe final.

# 📘 Plan de Implantación — JADDA SPORTS

<!-- Documento generado a partir de docs/implantacion/plan-implantacion-template.md.
Cada sección del plan corresponde a un entregable semanal: el archivo "entregable-sNN-…"
(documento completo con evidencia) y esta ficha es el índice ejecutivo que lo referencia.
Solo datos sintéticos: nada de IPs, usuarios ni contraseñas reales. -->

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos con marketplace de vendedores |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Versión del plan | v0.4 (estado actualizado con evidencia S04, S05 y S09) |
| Fecha | 2026-11-14 |

## Resumen de fases 5–10

| Fase | Estado documentado | Evidencia |
|---|---|---|
| 5. Instalación y despliegue | Instalación local y gate Docker verificados; smoke del despliegue público actual por verificar | [S04 §Estado Docker](../entregables-asesoria/entregable-s04-sprint-3-review.md) · [S09 §1](../entregables-asesoria/entregable-s09-cierre-final.md) |
| 6. Configuración y verificación | Integración, CORS, variables y orden de arranque verificados; inventario completo por ambiente por verificar | [S06 §CORS y variables, §Estado Docker](../entregables-asesoria/entregable-s06-sprint-5-review.md) · [S09 §1](../entregables-asesoria/entregable-s09-cierre-final.md) |
| 7. Seguridad, usuarios y permisos | Gestión de secretos y deuda de seguridad documentadas; matriz completa de SO/BD y pruebas de privilegios por verificar | [S04 §Estado Docker](../entregables-asesoria/entregable-s04-sprint-3-review.md) · [S09 §4](../entregables-asesoria/entregable-s09-cierre-final.md) |
| 8. Pipeline y monitoreo | Suite y CI documentados; monitoreo y rollback operativo por verificar | [S08 §2–5](../entregables-asesoria/entregable-s08-sprint-7-review.md) · [S09 §3–4, §6](../entregables-asesoria/entregable-s09-cierre-final.md) |
| 9. Mantenimiento y capacitación | Riesgos y hand-off documentados; calendario operativo y capacitación por verificar | [S09 §4, §6](../entregables-asesoria/entregable-s09-cierre-final.md) |
| 10. Aceptación y entrega | Gate Docker y demo integrada documentados como aprobados; aceptación independiente y acta por verificar | [S09 §1, §5–6](../entregables-asesoria/entregable-s09-cierre-final.md) · [S05 §Estado Docker](../entregables-asesoria/entregable-s05-sprint-4-review.md) |

## Mapa de semanas y entregables

| Semana | Entregable (documento completo) | Secciones de este plan que cubre | Estado |
|---|---|---|---|
| S01 | [entregable-s01-ficha-tecnica.md](../entregables/entregable-s01-ficha-tecnica.md) (2026-10-20) | §1 Ficha técnica y requisitos | ✅ |
| S02 | [entregable-s02-planes.md](../entregables/entregable-s02-planes.md) (2026-10-21) | §2 Migración · §3 Respaldo · §5 Instalación (v0) | ✅ |
| S03 | [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md) (2026-10-21) | §4 Hosting y dominio | ✅ |
| S04 | [entregable-s04-sprint-3-review.md](../entregables-asesoria/entregable-s04-sprint-3-review.md) | §5 Despliegue · evidencia de contenedores, variables de entorno y respuesta HTTP | Parcial: pruebas locales documentadas; smoke público vigente por verificar |
| S05 | [entregable-s05-sprint-4-review.md](../entregables-asesoria/entregable-s05-sprint-4-review.md) | §2 Ejecución de reglas · §6 Verificación en contenedor | Parcial: pruebas documentadas; configuración por ambiente por verificar |
| S06 | [entregable-s06-sprint-5-review.md](../entregables-asesoria/entregable-s06-sprint-5-review.md) | §6 Integración frontend-backend, variables, CORS y arranque | Integración y Docker verificados; inventario operativo por verificar |
| S07 | [entregable-s07-sprint-6-review.md](../entregables-asesoria/entregable-s07-sprint-6-review.md) | §5 Despliegue · §8 orden de arranque y healthchecks | Healthchecks y orden verificados; monitoreo/rollback por verificar |
| S08 | [entregable-s08-sprint-7-review.md](../entregables-asesoria/entregable-s08-sprint-7-review.md) | §8 Pruebas y CI · §10 criterios de prueba | Cobertura de flujos documentada; monitoreo, capacitación y aceptación formal por verificar |
| S09 | [entregable-s09-cierre-final.md](../entregables-asesoria/entregable-s09-cierre-final.md) | §5 Gate de instalación · §10 Aceptación y hand-off | Gate Docker aprobado; aceptación independiente y acta por verificar |

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

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Inventariar recursos del destino; ejecutar `scripts/verificar-requisitos.sh`; registrar salida. | DevOps / QA | CPU ≥ 4 vCPU, RAM ≥ 8 GB, disco libre ≥ 40 GB y salida sin fallas, como evidencia S01 §1.7. |

## 2. Plan de migración de datos — Semanas 2 y 5 (CE-3) ✅ (S02) · ⬜ (S05 ejecución)

Documento fuente: **[entregable-s02-planes.md §2](../entregables/entregable-s02-planes.md)**.

| Elemento | Decisión |
|---|---|
| Objetivo medible | Migrar BD (35 tablas · 2.519 filas — 36 desde 2026-10-24 con `PAGOS_EVENTOS`, sin filas nuevas), `.env` y medio de Cloudinary a otro equipo, con conteos idénticos aprobados, en ventana ≤ 2 h |
| Estrategia | **Big bang** (monolito con una sola BD transaccional; el dump de 0,25 MB se restaura en segundos) |
| Ventana | 23:00–01:00 (baja actividad); estimado de ejecución 60–75 min + rollback |
| Origen → destino | Volumen `mysql_data` → dump lógico (`mysqldump --single-transaction`) → mismo esquema reproducido por `setup.js` |
| Insumos | Dump + `.env` reales por canal externo seguro + repo git (los medios ya viven en Cloudinary; el repo no versiona binarios — solo `.gitkeep`) |
| Validaciones | Loop `COUNT(*)` en las 35 tablas (diff vacío) · SHA-256 del dump + línea `Dump completed on` · `200` en `/api/productos` · smoke E2E |
| Rollback | Restaurar el dump previo o re-levantar el origen (**el `down -v` del origen queda prohibido durante la ventana**) |
| Riesgos cubiertos | Shell de WSL sin distro (usar Git Bash), `.env` perdidos, drift de datos en la ventana, versión MySQL distinta, admin bloqueado |

Semana 5: se agregará aquí la evidencia de la migración **ejecutada** (los conteos de
entregable-s02 §3.5 sirven de línea base origen/destino).

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Tomar dump consistente, restaurarlo en destino y comparar conteos de todas las tablas. | Administrador de BD / QA | Diferencia de conteos vacía en las 35 tablas de la evidencia S02; ejecución en destino de entrega por verificar. |
| Ejecutar smoke de API y smoke E2E tras migrar. | QA | `/api/productos` devuelve 200 y smoke E2E pasa; evidencia de migración real por verificar. |
| Conservar origen hasta aprobar el destino; ejecutar rollback si falla un criterio. | DevOps / administrador de BD | Reversión completada dentro de la ventana ≤2 h descrita en S02; simulacro actual por verificar. |

## 3. Plan de respaldo — Semanas 2 y 6 (CE-4) ✅ (S02) · ⬜ (S6 parcial: cifrado)

Documento fuente: **[entregable-s02-planes.md §3](../entregables/entregable-s02-planes.md)**.

| Aspecto | Decisión |
|---|---|
| Qué se respalda | BD completa (36 tablas desde 2026-10-24, dump lógico con rutinas/triggers/events) · medios zip de `frontend/public/images` (solo lo que cae a disco como fallback; el histórico vive en Cloudinary — la carpeta queda vacía en git con `.gitkeep`) · `.env` cifrado por canal externo · repo (git) |
| Objetivos | **RPO 24 h · RTO 1 h** (respaldo diario 23:30; la restauración de prueba real tomó 3,4 s) |
| Herramientas | `scripts/respaldar.sh` (mysqldump **dentro** del contenedor, tamaño>1KB + SHA-256) · `scripts/backup.ps1` (respaldo + rotación) |
| Política 3-2-1 | Copia 1: disco local `backups/mysql/` · Copia 2: disco externo/USB semanal desconectado · Copia 3: nube (Drive/OneDrive) semanal |
| Retención | 7 días con rotación (`-RetencionDias 7`), diario a las 23:30 vía `schtasks` |
| Cifrado | Pendiente (mejora MC → GPG en copias fuera del sitio; se cierra en S06) |
| Restauración probada | 8 pasos con comandos copiables; prueba real en base aparte: **3.371 ms**, 35/35 tablas idénticas (2.519 filas), luego `DROP` de la BD de prueba |
| Calendario de pruebas | Mensual: restauración en base aparte + diff · trimestral: entorno completo y rotación de medios · semanal: revisión de `backups/backup.log` |

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| Generar respaldo con `scripts/respaldar.sh`, verificar tamaño y SHA-256. | Operaciones / administrador de BD | Archivo >1 KB y hash registrado, conforme al procedimiento S02. |
| Restaurar en una BD separada y comparar conteos. | Administrador de BD / QA | Restauración de prueba documentada; S02 registra 35/35 tablas idénticas y 2.519 filas en su prueba. |
| Mantener copias local, externa y nube según retención. | Operaciones | Tres ubicaciones y rotación de 7 días registradas; estado actual de copias por verificar. |

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
| 4 | Levantar contenedores | `docker compose up -d` | 3 contenedores `Up`; `setup.js` crea 36 tablas + seeds |
| 5 | (Opcional) Restaurar datos reales | `docker exec -i jadda_mysql sh -c '…' < backups/mysql/<respaldo>.sql` | Conteos iguales a §3.5 del entregable S02 |
| 6 | Verificar despliegue | `curl http://localhost:5173/api/productos` | `200` vía proxy |
| 7 | Rotar contraseña admin | Perfil → Seguridad con la cuenta del `.env` | Contraseña fuera del repo/historial |
| 8 | Activar respaldos | tarea 23:30 (`schtasks`) + `bash scripts/respaldar.sh` | `backups/mysql/<fecha>_*.sql` con SHA-256 |

Cronograma aprobado en S02: **≤ 2 h** con 45 min de contingencia; punto de no retorno =
`docker compose down -v` en el destino con el volumen ya migrado.

### 5.2 Despliegue en producción / servidor dedicado (S04) — evidencia parcial

**Estado:** implementación y gate Docker documentados; el smoke del servicio público
actual y los costos no constan en la evidencia S04/S09 citada aquí y quedan **por
verificar**. S04 registra una respuesta HTTP 200 de `/api/productos` dentro del
contenedor y paridad de lectura entre el contenedor y Render el 2026-11-11. S09
registra el 2026-11-12 un clon limpio cuyo stack levantó los tres servicios y respondió
200 en `/health`, `/api/productos` y `/`.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Clonar el commit de entrega y preparar `.env` desde `.env.example` con secretos por canal seguro. | DevOps / responsable de despliegue | Clon limpio; `.env` presente y no versionado. |
| 2. Ejecutar `docker compose up -d` y esperar los healthchecks. | DevOps / responsable de despliegue | `jadda_mysql` y `jadda_backend` en `healthy`; `jadda_frontend` en `Up`, como en S09 §1. |
| 3. Comprobar `/health`, `/api/productos` y `/` en el entorno que se libera. | QA / responsable de despliegue | Las tres rutas devuelven HTTP 200; evidencia S09 disponible para el clon local; smoke público actual por verificar. |
| 4. Registrar versión liberada, URL y costo del entorno. | Product Owner / responsable de despliegue | Registro completado; URL/costo vigentes por verificar porque los entregables citados no los fijan. |

### 5.3 Instalación y despliegue por fase

El procedimiento local detallado de §5.1 permanece como guía. La secuencia de arriba
debe repetirse para cada liberación, registrando la evidencia del entorno concreto; no
se da por verificado un smoke público a partir de una prueba local.

## 6. Configuración y verificación — Semana 5 (CE-1) — evidencia parcial

**Estado:** S06 documenta CORS, variables de entorno, proxy y orden de arranque; S09 acredita un
arranque desde `.env.example`; el catálogo exacto de variables activas por ambiente y
el smoke actual quedan **por verificar**.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Comparar variables requeridas por `docker-compose.yml`, `.env.example` y `backend/config/db.js`. | DevOps | Cada variable requerida tiene nombre, servicio consumidor y ejemplo sin secreto real. |
| 2. Inyectar secretos en el destino fuera de Git y arrancar la pila. | DevOps | No se incluyen credenciales reales en archivos versionados; los servicios requeridos arrancan. |
| 3. Verificar salud y API con las rutas del §5.2. | QA | `/health`, `/api/productos` y `/` responden 200 en la instalación que se está evaluando. |
| 4. Registrar divergencias entre dev, prueba y producción. | QA / DevOps | Tabla de variables y diferencias completada; hoy por verificar. |

## 7. Seguridad, usuarios y permisos — Semana 6 (CE-1) — evidencia parcial

**Estado:** S04 documenta que BD, secretos y puertos se configuran por entorno y que no
hay credenciales hardcodeadas en la API; S09 registra gestión de credenciales admin
por `.env`/dashboard y deuda técnica asociada. La matriz completa de cuentas del SO/BD,
reglas de firewall y resultados de pruebas de privilegios quedan **por verificar**.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Inventariar cuentas y permisos de sistema operativo, MySQL/TiDB y aplicación. | DevOps / administrador de BD | Matriz contiene cada cuenta, alcance y dueño; inventario actual por verificar. |
| 2. Revisar exposición de puertos y reglas de firewall del entorno. | DevOps / seguridad | Solo puertos aprobados quedan accesibles; evidencia de firewall por verificar. |
| 3. Confirmar que los secretos no están en Git y rotar credenciales iniciales. | Seguridad / administrador de BD | Búsqueda de secretos sin hallazgos y credenciales iniciales rotadas; no consta una prueba reciente en S04/S09. |
| 4. Ejecutar pruebas negativas de acceso con cuentas de menor privilegio. | QA / administrador de BD | Operaciones no autorizadas son denegadas; resultados por verificar. |

## 8. Pipeline de despliegue y monitoreo — Semana 7 (CE-1, CE-5) — evidencia parcial

**Estado:** S04 registra jobs de lint/TypeScript, unit, integración y audit, además de un
E2E que entonces fallaba; S09 registra el arreglo E2E y 8/9 jobs verdes (el job legacy
queda omitido por diseño en la bitácora de entrega). S09 también deja como deuda que
CI no ejecuta pruebas dentro de las imágenes de producción. Monitores, alertas y
procedimiento de rollback probado quedan **por verificar**.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Ejecutar el workflow de CI del commit candidato. | Dev / QA | Jobs requeridos del workflow completan en verde; registrar URL/ID del run. |
| 2. Construir imágenes de producción y comprobar healthchecks. | DevOps | Build exitoso y servicios saludables; las pruebas dentro de las imágenes siguen pendientes según S09 §4. |
| 3. Revisar disponibilidad y errores del servicio desplegado. | Operaciones | Monitor, umbral de alerta y contacto de respuesta documentados; configuración actual por verificar. |
| 4. Ejecutar rollback controlado en entorno de prueba. | DevOps / QA | Versión previa recuperada y rutas de salud responden 200; ejecución por verificar. |

## 9. Mantenimiento, soporte y capacitación — Semana 8 (CE-5) — evidencia parcial

**Estado:** S09 deja riesgos, deuda técnica y hand-off documentados. No aporta un
calendario aprobado de mantenimiento, niveles de soporte ni evidencia de capacitación;
esos elementos quedan **por verificar**.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Acordar calendario de revisión de dependencias, respaldos, logs y disponibilidad. | Operaciones / Product Owner | Frecuencia, responsable y evidencia de cada revisión registrados; calendario actual por verificar. |
| 2. Definir niveles de soporte, horario y canal de escalamiento. | Product Owner / soporte | Matriz de severidad, tiempo objetivo y canal aprobados; actualmente por verificar. |
| 3. Capacitar al equipo en despliegue, respaldo/restauración y atención de incidentes. | DevOps / soporte | Guía seguida en una sesión práctica y lista de asistencia; evidencia por verificar. |
| 4. Revisar deuda técnica y pendientes del hand-off S09 §6. | Product Owner / Dev | Cada pendiente tiene prioridad y decisión documentadas; S09 proporciona la lista inicial. |

## 10. Aceptación y entrega — Semana 9 (CE-1 a CE-5) — gate documentado

**Estado:** el gate Docker de clon limpio figura como aprobado en S09 §1; la demo
integrada está descrita en S09 §5 y las pruebas de reglas/flujo están registradas en
S05. La aceptación por una persona independiente, el simulacro cruzado y el acta formal
no constan como realizados y quedan **por verificar**.

| Secuencia de actividades | Responsable (rol) | Criterio de éxito medible |
|---|---|---|
| 1. Ejecutar el gate Docker desde un clon limpio. | QA / equipo receptor | Tres contenedores arrancan; `/health`, `/api/productos` y `/` responden 200 (S09 §1). |
| 2. Ejecutar la demo integrada y las pruebas de aceptación acordadas. | QA / Product Owner | Casos aceptados con resultado y evidencia adjunta; S09 documenta el guion, pero no sustituye un acta de aceptación independiente. |
| 3. Hacer un simulacro de instalación/recuperación por el equipo receptor. | Equipo receptor / DevOps | Instalación y restauración completadas siguiendo la guía; simulacro por verificar. |
| 4. Entregar repositorio, documentación, accesos por canal seguro y acta. | Product Owner / DevOps | Lista de entrega firmada, sin secretos en Git; acta y firma por verificar. |

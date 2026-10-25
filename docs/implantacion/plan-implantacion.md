# 📘 Plan de Implantación — JADDA SPORTS

<!-- Documento generado a partir de docs/implantacion/plan-implantacion-template.md.
Cada sección del plan corresponde a un entregable semanal: el archivo "entregable-sNN-…"
(documento completo con evidencia) y esta ficha es el índice ejecutivo que lo referencia.
Solo datos sintéticos: nada de IPs, usuarios ni contraseñas reales. -->

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos con marketplace de vendedores |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Versión del plan | v0.3 (semanas S01–S03 completadas) |
| Fecha | 2026-10-21 |

## Mapa de semanas y entregables

| Semana | Entregable (documento completo) | Secciones de este plan que cubre | Estado |
|---|---|---|---|
| S01 | [entregable-s01-ficha-tecnica.md](../entregables/entregable-s01-ficha-tecnica.md) (2026-10-20) | §1 Ficha técnica y requisitos | ✅ |
| S02 | [entregable-s02-planes.md](../entregables/entregable-s02-planes.md) (2026-10-21) | §2 Migración · §3 Respaldo · §5 Instalación (v0) | ✅ |
| S03 | [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md) (2026-10-21) | §4 Hosting y dominio | ✅ |
| S04 | — | §5 Despliegue (semana 4) | ⬜ pendiente |
| S05 | — | §2 (evidencia ejecución) · §6 Configuración | ⬜ pendiente |
| S06 | — | §3 (cierre de respaldo) · §7 Seguridad | ⬜ pendiente |
| S07 | — | §8 Pipeline y monitoreo | ⬜ pendiente |
| S08 | — | §9 Mantenimiento y capacitación | ⬜ pendiente |
| S09 | — | §10 Aceptación y entrega | ⬜ pendiente |

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

## 4. Hosting y dominio — Semana 3 (CE-1) ✅

Documento completo con evidencia: [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md).

| Ítem | Decisión |
|---|---|
| Hosting | Propio (on-premise, LAN de la tienda) sobre equipo torre con Docker — justificado con mediciones de S01; ruta de crecimiento documentada hacia VPS |
| Dominio elegido | `jaddasports.com` (por comprar) con `www` (tienda SPA) y `api` (API directa / app móvil) |
| Registros DNS | A/A/CAA/TXT planeados (simbólicos, sin IPs reales); la práctica local simula el DNS con `curl --resolve` |
| Reverse proxy | **Caddy** (`deploy/Caddyfile` + `deploy/docker-compose.caddy.yml`) publicando `frontend:5173`/`backend:5000` por los dominios elegidos; FALLBACK equivalente ya probado con nginx en el módulo A — un solo gateway a la vez |
| HTTPS | `tls internal` (CA local de Caddy) probado con `curl --resolve`; producción real = quitar la línea → Let's Encrypt o certificados de CA (deploy/certs) |
| Transferencia de archivos | `git clone` + secretos por canal externo (S02 §5); imágenes se construyen en destino; medios ya en Cloudinary |

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

### 5.2 Despliegue en producción / servidor dedicado (S04) ⬜ pendiente

<!-- 📝 Se completa en la semana 4: despliegue del release en el servidor definitivo
(docker-compose.prod.yml / MODE=preview), versión liberada (tag git) y costos estimados. -->

## 6. Configuración y verificación — Semana 5 (CE-1) ⬜ pendiente

<!-- 📝 Variables de entorno por ambiente (sin valores reales), servicios, healthchecks,
smoke tests. -->

## 7. Seguridad, usuarios y permisos — Semana 6 (CE-1) ⬜ pendiente

<!-- 📝 Matriz de usuarios/roles (sistema operativo y base de datos), políticas de acceso,
firewall, manejo de secretos, resultados de pruebas de privilegios. -->

## 8. Pipeline de despliegue y monitoreo — Semana 7 (CE-1, CE-5) ⬜ pendiente

<!-- 📝 Diagrama del pipeline, procedimiento de rollback, monitores configurados. -->

## 9. Mantenimiento, soporte y capacitación — Semana 8 (CE-5) ⬜ pendiente

<!-- 📝 Plan de mantenimiento, niveles de soporte, plan de capacitación, enlaces a ayudas en
línea. -->

## 10. Aceptación y entrega — Semana 9 (CE-1 a CE-5) ⬜ pendiente

<!-- 📝 Resultado de pruebas de aceptación, resultado del simulacro cruzado, acta de entrega
con niveles de servicio acordados. -->

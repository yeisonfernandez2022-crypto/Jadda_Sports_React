# Inventario de brechas — auditoría continua JADDA SPORTS

> Documento **vivo**: inventario de hallazgos por área con prioridad, evidencia,
> acción y forma de verificación. Cada "resuelto" apunta a archivo/sección y a la
> verificación efectivamente ejecutada en el entorno disponible.
> Método: inspección de `AGENTS.md` + docs + código (fuente de verdad), con
> comprobación de vigencia de cada brecha antes de actuar.
>
> Fecha base: **2026-10-21** · Plan por fases (1 fase = varias brechas del mismo área):
> 1️⃣ Seguridad → 2️⃣ Disponibilidad/Observabilidad → 3️⃣ Rendimiento/Escalabilidad →
> 4️⃣ Arquitectura/BD → 5️⃣ CI-CD/Pruebas → 6️⃣ UX/Accesibilidad/Mantenibilidad →
> 7️⃣ Privacidad/Costos y cierre.

Leyenda de estado: ✅ resuelto (con evidencia) · 🟡 parcial · ⬜ pendiente (Fase N)
Prioridad: **P1** datos/credenciales · **P2** abuso/DoS/corte · **P3** robustez · **P4** mejora.

---

## Base previa ya cerrada (revisión de seguridad 2026-10-21, commit `098dca27`)

| # | Hallazgo (cerrado) | Evidencia |
|---|---|---|
| B0-1 | OTP: código plano → hash bcrypt + `USUARIOS.TOKEN VARCHAR(255)` (migración idempotente) y validación de entrada en 3 flujos | `authController.js` (registro/actualizarPassword/endurecidos) |
| B0-2 | Datos demo aislados en producción (`DEMO_DATA`/`NODE_ENV`, `seedAdminUser` production-safe) | `setup.js` (gate `sembrarDemo`) |
| B0-3 | Estáticos privados con autorización por RECURSO (`/images/usuarios`, `/images/devoluciones`), 403 antes que 404, anti-traversal | `server.js` (`servirArchivoPrivado`) |
| B0-4 | Subidas: 25 MB × 5, MIME real + coherencia MIME↔extensión (`validarSubida.js`), multer streaming | `retoRoutes`, `devolucionRoutes`, `utils/validarSubida.js` |
| B0-5 | Google OAuth web vía `/userinfo` con `email_verified` | `config/passport.js` |
| B0-6 | Perfil de producción completo (prod compose, nginx, Dockerfiles.prod, `.dockerignore`, imagen sin `.env`) probado puerta a puerta | `docker-compose.prod.yml`, `deploy/nginx.conf`, 04-despliegue |

## Área 1 — Seguridad — **Fase 1 (esta fase)**

| ID | Brecha | Pri | Evidencia (archivo · sección) | Acción tomada | Verificación | Estado |
|---|---|---|---|---|---|---|
| S-08 | **req.ip detrás del proxy**: rate limiting agrupaba a TODOS los clientes en la IP de nginx (buckets colisionales en prod) | P2 | `backend/server.js` sin `trust proxy`; `rateLimiter.js:39` usa `req.ip` | `app.set('trust proxy', TRUST_PROXY ?? (prod?1:0))` | código + `node --check`; efecto real del 429 por IP verificable en prod (externo) | ✅ |
| S-09 | **CSRF**: falta de defensa específica para clientes web en peticiones mutantes (POST/PUT/PATCH/DELETE) | P2 | ausencia de middleware CSRF en `server.js` | middleware `proteccionOrigen` (verificación de Origin, modelo móvil-compatible) | **tests 10/10** + **E2E vivo**: Origin ajeno POST→403 · sin Origin→401 normal · Origin permitido→401 · GET→200 | ✅ |
| S-10 | CORS hardcodeado en `server.js` (solo orígenes dev) sin forma de extender por entorno | P4 | `server.js` bloque CORS | `config/origenesAdmitidos.js` + env `CORS_ORIGINS` (mantiene base dev intacta) | `node --check`; UI/móvil intactos; test unitario de `CORS_ORIGINS` | ✅ |
| S-11 | Sin cabeceras de seguridad en el stack **nginx** (Caddy sí las tenía) | P3 | `deploy/nginx.conf` sin `add_header` | headers idénticos al Caddyfile (HSTS 15552000, nosniff, Referrer-Policy, X-Frame) + `server_tokens off` | **`nginx -t` ok** (con upstream sustituido — fuera de la red compose los hostnames no resuelven, artefacto del test) | ✅ |
| S-12 | Sesión/cookies: revisado — `httpOnly`, `sameSite=lax`, `secure=prod`, `maxAge` 24 h, secret obligatorio en prod, store MySQL | — | `server.js` bloque sesión | sin cambios estructurales; **warning nuevo** si dev corre sin secreto | configuración leída y log del warning | ✅ (ya existía bien) |
| S-13 | `DB_USER=root` fijo en prod compose (sin opción de menor privilegio) | P3 | `docker-compose.prod.yml` env backend | `${DB_USER:-root}` (usa `jadda_app` si se define; comportamiento por defecto sin cambio) | `docker compose config --quiet` exit 0 | ✅ (opcional activable) |
| S-14 | Sin análisis de dependencias en CI | P3 | `.github/workflows/ci.yml` sin audit | job `security-audit`: `pnpm audit --prod --audit-level high` (backend+frontend), `continue-on-error` = informativa | YAML insertado sin romper jobs; **1ª ejecución en Actions pendiente de observar** | 🟡 (ver en CI real) |
| S-15 | Inyección SQL — muestreo | P2 | grep `query(\`...${` → solo `where` estructural parameterizado (notificaciones) y `TRUNCATE` de tablas fijas en setup de tests | patrón OK documentado; **auditoría completa pendiente** | análisis estático de muestra | 🟡 (auditoría exhaustiva externa) |
| S-16 | XSS — muestreo | P3 | React escapa por defecto; `escapeHtml` en Swal; único `innerHTML=""` (limpiar, no inyectar) | patrón OK documentado | análisis estático de muestra | 🟡 (auditoría completa externa) |
| S-17 | No declarar conformidad OWASP/ASVS | — | §11 de la guía de seguridad | declarado explícitamente | — | ⬜ (evaluación formal externa) |
| S-18 | Sin rate limit GLOBAL (solo rutas sensibles lo tienen) | P3 | `rateLimiter.js` aplicado por ruta | evaluar límite global en memoria (un umbral agresivo afectaría navegación legítima) | — | ⬜ Fase 2-3 (decisión de umbral) |

> Detalle operativo de los controles → `../implantacion/05-guia-seguridad.md`.

## Área 2 — Disponibilidad y recuperación

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| D-1 | Sin health check del **backend** (el restart policy solo cubre caídas del proceso, no un servicio colgado) | P2 | `docker-compose.prod.yml` backend sin healthcheck | healthcheck HTTP interno `/health` liviano | ⬜ Fase 2 |
| D-2 | Health checks de MySQL presentes en dev y prod (`mysqladmin ping`) | — | compose dev/prod | ya resuelto, documentar | ✅ |
| D-3 | Sin sonda para el SPA en el proxy (nginx podría servir un frontend en blanco sin que nadie lo note) | P4 | — | probe GET del SPA vía proxy | ⬜ Fase 2 |
| D-4 | Timeouts de dependencias externas: correo (nodemailer), Cloudinary, ip-api | P3 | llamadas sin timeout explícito en `utils/correo.js`, `utils/cloudinary.js` | timeouts + captura (ya son best-effort); verificar y estandarizar | ⬜ Fase 2 |
| D-5 | Respaldo/restore probado con conteos idénticos (S02) y RPO/RTO objetivos documentados | — | `entregable-s02-planes.md` (3.371 ms restore, 2.519 filas) | mantener cadencia mensual | ✅ (ya hecha) / cadencia externa |
| D-6 | "Alta disponibilidad": NO declararla — arquitectura de instancia única | — | arquitectura actual | declaración explícita en docs | ✅ (ya correcto) |

## Área 3 — Observabilidad

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| O-1 | Logger de peticiones es un bloque vacío (placeholder) | P3 | `backend/server.js` bloque "LOGGER DE PETICIONES" | log estructurado mínimo (método, ruta, status, duración, req-id) sin datos personales | ⬜ Fase 2 |
| O-2 | Sin identificador de solicitud correlacionable proxy↔backend | P4 | — | `x-request-id` (recibir o generar) + log | ⬜ Fase 2 |
| O-3 | Sin métricas mínimas documentadas (p50/p95/p99, errores, CPU/mem) | P3 | `resultados-mediciones.md` solo de S01 | guía de medición + script de carga reproducible | ⬜ Fase 3 |
| O-4 | Error handler de Express log larga stack a consola (OK) pero sin id de solicitud, y respuestas 500 genéricas (OK) | P4 | `server.js` manejo errores | enriquecer con req-id | ⬜ Fase 2 |
| O-5 | Dashboards/alertas externas: no aplicables con la infraestructura actual | — | despliegue on-premise de instancia única | documentar requisitos si se contrata proveedor de monitoreo | ⬜ Fase 2 (decisión externa) |

## Área 4 — Escalabilidad y rendimiento

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| ESC-1 | Consultas/reportes admin sin paginación real (carga `LIMIT 200` razonable pero no paginado por UI) | P3 | adminController (`obtenerUsuarioDetalle`, reportes) | audit de consultas gruesas + límites | ⬜ Fase 3 |
| ESC-2 | Sin prueba de carga reproducible (k6/Artillery) ni umbrales | P3 | — | scripts + umbrales (sin resultados inventados) | ⬜ Fase 3 |
| ESC-3 | Índices ausentes/N+1 pendientes de auditar (top ventas usa subconsultas) | P3 | productoController/adminController | auditar EXPLAIN en las 3 consultas críticas | ⬜ Fase 3 |
| ESC-4 | Límites documentados: 1 instancia Express, session MySQL OK, rate limit memoria | — | 05-guia-seguridad §7 | ya documentado | 🟡 (matriz completa en Fase 3) |
| ESC-5 | Sin CDN para el SPA (Cloudinary sí cachea los medios servidos desde su dominio) | P4 | arquitectura de medios | documentar si aplica | ⬜ Fase 7 (costos) |

## Área 5 — Arquitectura y BD

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| ARQ-1 | Separación rutas/controllers OK; controladores con mezcla de acceso a datos y lógica (p. ej. `adminController`) | P4 | estructura del archivo | refactor puntual solo donde se toque | 🟡 (criterio "no masiva") |
| ARQ-2 | Migraciones idempotentes + `schema.sql` exportado: schema de BD nueva == migraciones de BD vieja (verificado tras fix `//` S03) | — | `setup.js`, `schema.sql` (220.860 B) | check de paridad en CI (diff exportarSchema) | 🟡 (agregar verificación en CI Fase 5) |
| ARQ-3 | Contratos de API documentados (manual técnico detalle; sin OpenAPI máquina-legible) | P4 | `manuales/manual-tecnico.md` | OpenAPI de endpoints críticos (auth/checkout/productos) si vale la pena | ⬜ Fase 4 |
| ARQ-4 | Integridad referencial: FKs declaradas en la mayoría; MOVIMIENTOS_STOCK, DEVOLUCIONES con auditoría (`RNF-016`) | — | schema.sql | revisión de FKs faltantes | ⬜ Fase 4 |
| ARQ-5 | Errores comunes del API sin listado normativo (401/403/404/400/409/429 dispersos) | P4 | rutas/docs | tabla de códigos y mensajes por endpoint crítico | ⬜ Fase 4 |

## Área 6 — Calidad y pruebas

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| CAL-1 | Suite actual: backend unit (38 con los 10 nuevos de CSRF), backend integración (MySQL real vía CI), frontend vitest 51, E2E Playwright (CI) + smoke legacy 23 checks | — | `backend/utils/*.test.js`, nuevo `middlewares/proteccionOrigen.test.js` | añadir pruebas de cada cambio nuevo | ✅ del cambio (Fase 1) |
| CAL-2 | Cobertura real reportada (backend thresholds 30% — declarada en vitest.config) | P4 | `vitest.config.mjs` `thresholds` | mantener umbrales honestos; no inflar | ✅ (ya está medido en CI) |
| CAL-3 | Pruebas de seguridad automatizadas adicionales (CSRF/auth cubiertas en Fase 1; faltan spoofing de X-Forwarded-For, fuerza bruta de OTP, etc.) | P3 | — | ampliar con cada cambio | 🟡 por fase |

## Área 7 — CI/CD y despliegues

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| CI-1 | Workflow: pnpm frozen-lockfile, typecheck+lint, backend unit+integración (MySQL efímera), frontend tests, build backend/frontend, E2E Playwright + smoke legacy — bien montado | — | ci.yml | mantener; las credenciales CI ya son efímeras/proyecto de prueba | ✅ (ya corre) |
| CI-2 | Sin paridad de schema en CI (ver ARQ-2) ni audit (ver S-14, 🟡) | P3 | ci.yml | job o step nuevo (no-bloqueo primero) | 🟡 Fase 5 |
| CI-3 | Imágenes prod sin `.env`/`node_modules` host (Dockerfiles + .dockerignore verificados 2026-10-21) | — | `backend/Dockerfile.prod`, `.dockerignore` | ya resuelto | ✅ |
| CI-4 | Perfiles dev/prod separados; test corre directo Node + MySQL efímera (sin Docker) | — | compose dev/prod, ci.yml | ya correcto | ✅ |
| CI-5 | Guía de despliegue/migraciones/rollback: pasos en 03/04; el rollback no está documentado paso a paso | P3 | 03/04 despliegue | agregar procedimiento rollback a 04 | ⬜ Fase 5 |

## Área 8 — UX y accesibilidad

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| UX-1 | Navegación por teclado/foco en flujos críticos (login, carrito, checkout, admin) — no revisada sistemáticamente | P3 | — | revisión por flujos con arreglos concretos (foco visible/labels) | ⬜ Fase 6 |
| UX-2 | Contraste de color no medido sistemáticamente | P4 | CSS principal | medir (paleta roja/blanca) y ajustar solo donde falle | ⬜ Fase 6 |
| UX-3 | Mensajes de error/loading: presentes en catálogo/carrito/checkout; consistencia por revisar | P4 | varias vistas | estandarización mínima | ⬜ Fase 6 |
| UX-4 | WCAG AA: NO declarar sin auditoría completa | — | presente guía | declarar alcance limitado + herramienta auxiliar (axe en E2E?) | ⬜ Fase 6 |

## Área 9 — Mantenibilidad

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| MAN-1 | Tipos `any` evitables en el TS del frontend (barrido con grep pendiente) | P4 | `frontend/src` | arreglar solo en archivos que se toquen (sin barrido masivo) | ⬜ continuo por fase |
| MAN-2 | Duplicación puntual (p. ej. textos de estado de envío en web/móvil/backend) | P4 | varios archivos | unificar solo cuando se toque | 🟡 |
| MAN-3 | Documentación actualizada en cada cambio (RF/HU/RNF al día, README indexado) | — | repo | mantener en cada fase | ✅ |

## Área 10 — Privacidad y costos

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| PRV-1 | Política de privacidad documentada en la web (footer) — revisar minimización, retención, eliminación y exportación de datos | P3 | `PoliticaPrivacidad.tsx`, BD | guía de procedimientos de derechos ARCO (Ley 1581 de 2012) — NO asesoría legal | ⬜ Fase 7 |
| PRV-2 | La geolocalización del login envía la IP a un tercero (`ip-api.com`) sin estar declarado en la política | P2 | `authController.registrarConexion` | decidir: desactivar, seudonimizar o documentar + política | ⬜ Fase 7 |
| PRV-3 | Los logs no deben incluir PII: aplicar criterio al implementar O-1 | P3 | — | al aplicar O-1 (Fase 2) | ⬜ Fase 2 |
| COST-1 | Proveedores externos: Cloudinary (medios), Gmail/Nodemailer (correos), ip-api (geo) | P3 | backend/.env.example | inventario con control de consumo y enlaces de pricing oficiales (sin valores no verificados) | ⬜ Fase 7 |
| COST-2 | Operación on-premise (hosting propio S03): costos de servidor, energía y operación ya documentados en S01/S03 | P4 | docs entregables | mantener inventario al día | 🟡 |

---

## Pendientes externos / del responsable (consolidado)

| # | Acción | Por qué no la hace el repo |
|---|---|---|
| E-1 | Rotar contraseña del admin real (Perfil → Seguridad) y la de `jadda_app` si se activa | intervención humana |
| E-2 | CA real / dominio público y limpieza de `tls internal` al publicar | requiere dominio y DNS reales |
| E-3 | Ejecutar la evaluación formal OWASP/ASVS si se exige conformidad | auditor externo |
| E-4 | Observar la 1ª corrida del job `security-audit` en GitHub Actions y decidir si pasa a bloqueante | requiere el repo en GitHub con Actions activos |
| E-5 | Prueba de carga contra entorno real dedicado (Fase 3) con interpretación de resultados | entorno/medición dedicada |
| E-6 | Verificar en prod real que rate limiting agrupa por IP cliente (efecto de S-08) | producción real |
| E-7 | Política de datos personales con asesoría legal colombiana (Ley 1581 de 2012 / SIC) | decisión legal del titular del proyecto |
| E-8 | Cadencia mensual de backup/restore (S02 lo deja definido) | operación |

## Historial de fases

| Fase | Fecha | Área | Cambios | Verificación corrida |
|---|---|---|---|---|
| 1 | 2026-10-21 | Seguridad | trust proxy (S-08) · CSRF Origin (S-09) · CORS por env (S-10) · headers nginx (S-11) · DB_USER configurable (S-13) · audit CI (S-14) · guía 05 + este inventario | vitest **38/38** (28 previos + 10 CSRF) · E2E curl **4 pruebas** (403/401/401/200) · `node --check` ×4 · `nginx -t` syntax ok · `docker compose config --quiet` exit 0 · dev stack UP intacto |

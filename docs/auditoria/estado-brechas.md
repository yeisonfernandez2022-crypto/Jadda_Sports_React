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
| S-15 | Inyección SQL — muestreo | P2 | grep `$\{` exhaustivo 2026-10-22: SOLO quedan 3, todas seguras — `where` estructural de notificaciones (orden fijo), ALTER de índices con nombre/columna fijos en `setup.js` y `LIMIT 15` constante literal (`reporteVendedorDatos.js`); en reportes/admin-vendedor la granularidad pasó a util con lista cerrada (`utils/agrupacionVentas.js` + tests) y los `LIMIT` variables son `LIMIT ?` con parámetro | eliminadas las interpolaciones alimentables por el cliente (granularidad + límite) en dashboards y reportes | grep + **tests unitarios de la util (9 asesiones: whitelists, inyección cae a 'dia')** · auditoría formal de 100% endpoints pendiente | 🟡 (cierre de interpolaciones 2026-10-22; auditoría exhaustiva externa) |
| S-16 | XSS — muestreo | P3 | React escapa por defecto; `escapeHtml` en Swal; único `innerHTML=""` (limpiar, no inyectar) | patrón OK documentado | análisis estático de muestra | 🟡 (auditoría completa externa) |
| S-17 | No declarar conformidad OWASP/ASVS | — | §11 de la guía de seguridad | declarado explícitamente | — | ⬜ (evaluación formal externa) |
| S-18 | Sin rate limit GLOBAL (solo rutas sensibles lo tienen) | P3 | `server.js`: techo global **300 pet./min por IP** (`GLOBAL_RATELIMIT_MAX`) sobre TODAS las rutas tras el logger, exento de `/health`, `/api/health` y `/images/`; IPs privadas/loopback fuera del cubo hasta `GLOBAL_RATELIMIT_RESTRICCION_LOCAL=false` (/tests: tabla 05-guia-seguridad) | techo anti-abuso añadido manteniendo los límites sensibles por ruta (login 5-10, etc.) | código + limitation deterministic por proceso documentado (rateLimiter.js: réplicas ⇒ límites multiplicados, ver sección LIMITACIÓN) | ✅ Fase 3 |

> Detalle operativo de los controles → `../implantacion/05-guia-seguridad.md`.

## Área 2 — Disponibilidad y recuperación

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| D-1 | Sonda de disponibilidad del backend: `/health` liviano + healthcheck en compose dev y prod | P2 | endpoint `/health` (server.js, sin BD ni sesión, montado ANTES del logger para que los pings no ensucien el log); healthcheck `node -e fetch` en `docker-compose.yml` y `docker-compose.prod.yml` (la imagen node no trae curl/wget) | E2E dev: contenedor recreado → `jadda_backend Healthy`; `curl /health` → 200 `{"ok":true,...}` | ✅ Fase 2 |
| D-2 | Health checks de MySQL presentes en dev y prod (`mysqladmin ping`) | — | compose dev/prod | ya resuelto, documentar | ✅ |
| D-3 | Sonda del SPA: healthcheck del contenedor frontend en prod + nginx con `depends_on` que espera backend+frontend **healthy** | P4 | frontend prod: sonda `node -e fetch http://127.0.0.1:5173/` (start_period 60 s por el build); nginx prod con `condition: service_healthy` | sync: vuelta a levantar con `docker compose -f docker-compose.prod.yml up -d` | ✅ Fase 2 (config validada `config --quiet`; la sonda idéntica del backend sí se probó E2E en dev) |
| D-4 | Timeouts de dependencias externas verificados y estandarizados | P3 | nodemailer: `connectionTimeout/greetingTimeout/socketTimeout` 10/10/20 s (`config/mailer.js`); Cloudinary: `timeout` 60 s en ambas configs, `CLOUDINARY_TIMEOUT_MS` adjustable (`utils/cloudinary.js`); ip-api: ya tenía AbortController 2,5 s; fetch de Cloudinary en `correo.js`: ya tenía `AbortSignal.timeout(8000)` | envíos/subidas siguen siendo best-effort con fallback a disco — ahora un SMTP/S3 caído falla rápido en vez de colgar el socket | ✅ Fase 2 |
| D-5 | Respaldo/restore probado con conteos idénticos (S02) y RPO/RTO objetivos documentados | — | `entregables/entregable-s02-planes.md` (3.371 ms restore, 2.519 filas) | mantener cadencia mensual | ✅ (ya hecha) / cadencia externa |
| D-6 | "Alta disponibilidad": NO declararla — arquitectura de instancia única | — | arquitectura actual | declaración explícita en docs | ✅ (ya correcto) |

## Área 3 — Observabilidad

| ID | Brecha | Pri | Evidencia | Acción propuesta | Estado |
|---|---|---|---|---|---|
| O-1 | Logger estructurado de peticiones (reemplaza el placeholder vacío) | P3 | `middlewares/registroPeticiones.js`: UNA línea JSON por petición al `finish` — t/nivel/metodo/ruta SIN query/status/ms, IP y cuerpo excluidos (cero PII) | `docker logs jadda_backend`: líneas JSON reales verificadas (`{"nivel":"http","req":"...","metodo":"GET","ruta":"/api/productos","status":200,"ms":13}`) | ✅ Fase 2 |
| O-2 | Id de solicitud correlacionable proxy↔backend | P4 | mismo middleware: recibe `x-request-id` del proxy si es seguro (`^[A-Za-z0-9._-]{8,64}$`) o genera 12 hex; lo devuelve en `X-Request-Id` | curl con `x-request-id: prueba-correlacion-9` → el header VUELVE en la respuesta y la línea del log conserva ese id | ✅ Fase 2 |
| O-3 | Sin métricas mínimas documentadas (p50/p95/p99, errores, CPU/mem) | P3 | `resultados-mediciones.md` solo de S01 | guía de medición + script de carga reproducible | ⬜ Fase 3 |
| O-4 | Error handler enriquecido con req-id + fix: honra `err.status` del body-parser | P4 | log JSON `nivel:'error'` correlacionable con la línea http por `req`; stack impreso aparte; la respuesta incluye `reqId`; JSON malformado → **400** (antes 500 fijo) y límite excedido → 413 | E2E: POST con body no-JSON → HTTP 400 `{error:"Petición rechazada",reqId}` y en el log el error y la petición comparten el mismo id | ✅ Fase 2 |
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
| CAL-1 | Suite actual: backend unit (43 = 28 base + 10 CSRF + 5 registro de peticiones), backend integración (MySQL real vía CI), frontend vitest 51, E2E Playwright (CI) + smoke legacy 23 checks | — | `middlewares/proteccionOrigen.test.js`, `middlewares/registroPeticiones.test.js` | añadir pruebas de cada cambio nuevo | ✅ del cambio (Fases 1-2) |
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
| PRV-3 | Criterio de PII aplicado en el nuevo logger de peticiones | P3 | el logger omite IP/query/cuerpo (solo pathname truncado); los flujos de seguridad que SÍ necesitan IP la siguen registrando (CSRF al bloquear, avisos de login) | aserción anti-IP en tests (`registroPeticiones.test.js`: la línea no contiene la IP del req falso) | 🟡 (criterio por flujo completo en Fase 7) |
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
| 2 | 2026-10-21 | Disponibilidad / Observabilidad | `/health` backend (D-1) · healthcheck frontend + nginx depends_on healthy (D-3) · timeouts nodemailer/Cloudinary (D-4; ip-api y fetch correo ya los tenían) · log estructurado JSON sin PII (O-1) · `x-request-id` (O-2) · error handler con req-id + err.status (O-4) · PRV-3 parcial | vitest **43/43** (5 nuevos) · dev recreate → `jadda_backend Healthy` por la sonda · E2E: `/health` 200 · id externo devuelto en `X-Request-Id` · POST JSON malformado **400 con reqId** (antes 500) · error y petición comparten id en el log · `node --check` ×5 · `config --quiet` dev y prod |

## Trabajo paralelo — preparación para producción (rama `chore/produccion`, 2026-10-22)

> Plan separado de hardening pre-producción en 6 fases (un commit por fase):
> 1 secretos · 2 datos demo/secretos fuera de git · 3 hardening backend ·
> 4 checkout con bloqueo de fila (FOR UPDATE) · 5 media ya en Cloudinary: assets
> fuera del repo + seeds puro-Cloudinary + purga de historial documentada ·
> 6 pasarela de pagos (patrón genérico; proveedor concreto por decidir).

| Fase | Commit | Alcance | Verificación |
|---|---|---|---|
| F1 Secretos | `7fbed4e` | seedAdminUser sin contraseñas por defecto (prod exige env, fail-fast); fail-fast prod de `SESSION_SECRET`/`DB_PASSWORD` en server.js/db.js/setup.js; MySQL sin `tu_password_secreto` en código (compose ya usa `${...}`); scripts/tests/frontend leen credenciales SOLO de entorno (fail-fast si faltan); `scripts/sql/usuarios-produccion.sql` con placeholder `__CAMBIAR_PASSWORD__`; `.env.example`/README/docs alineados | backend vitest **57/57** · tsc OK · lint 0 errores · `git grep` sin literales (conserva solo bitácoras históricas y CI efímero) |
| F2 Datos demo | `4b2da56` | gate `debeSembrarDemo()` (DEMO_DATA=false apaga; prod omite salvo `LOAD_DEMO_DATA=true`; seeds de referencia siempre); 23 binarios de subidas de usuarios fuera de git (`git rm --cached`, `.gitkeep` preservados) | backend vitest **48/48** tras el gate · `git ls-files` sin PNG/JPG/MP4 de subidas · dev intacto (seed 98 + demo 684) |
| F3 Hardening backend | `5814dc0` | util `utils/agrupacionVentas.js` (granularidad lista cerrada + `LIMIT ?`) en dashboards admin + reportes vendedor; magic bytes + tope 6 MB por archivo en `POST /api/productos/imagenes`; helmet con CORP `cross-origin` (HSTS/CSP solo prod); `/api/health` (readiness BD) exenta del rate limit; avatar/reporte/axis: cierre ordenado SIGTERM/SIGINT (close → sessionStore → pool, red 10 s); sin logs de PII (email/foto en login); sin `192.168.1.7` en CORS; passport avisa en prod si faltan CALLBACK_URL; `tests/.env.example` con VENDOR_* | backend vitest + 9 tests nuevos · curl `/health` 200 · `/api/health` 200 `bd:ok` · headers helmet visibles (CORP cross-origin, nosniff, SAMEORIGIN) · `node --check` ×8 |
| F4 Checkout concurrente | `3b85b9d`/`407232c` | `SELECT ... FOR UPDATE` por variante + revalidación de stock DENTRO de la transacción del checkout; guard `AND STOCK >= ?` con `affectedRows===1` (409 si otro comprador ganó la fila); sobreventa imposible en BD innodb-MVCC; `PENDIENTE_PAGO` activable con `PAYMENT_GATEWAY` (`COMPLETADA` cuando está vacío): correos/notificaciones post-commit solo si no hay pasarela; cancelar y las 3 UIs soportan el estado nuevo | backend vitest **57/57** · integración **16/16 ×2** (MySQL real p.3307; 2 checkouts concurrentes → 200 + 409, stock 0, 1 VENTA/1 DETALLE/SALIDA) · tsc FE+FE-móvil OK · import del schema en `jadda_mysql_test`: 310 filas, 310 cloud, 0 locales |
| F5 Media solo-Cloudinary | `b5037b7` | ~366 archivos de imágenes/videos (~66,9 MiB) fuera del repo (`git rm`; quedan `.gitkeep` en las 5 carpetas de subidas para bind-mounts + favicon raíz); seeds puro-Cloudinary (PRODUCTO_IMAGENES 310 filas con las URLs de la BD viva; retos/devoluciones demo rotas → RUTA NULL; producto 46 con 1 imagen como en la real); `index.html` preconnect+preload Cloudinary; purga del historial con `git filter-repo` documentada (`auditoria/purga-media-filter-repo.md`) | import del `schema.sql` en `jadda_mysql_test`: 310/310 cloud y 0 locales, productos 104, p46=1 · vitest backend **57/57** · integración **16/16 ×2** · tsc/eslint OK |
| F6 Pasarela Wompi | (sin commit de archivos históricos — integrado con la sesión actual) | **EJECUTADO 2026-10-24**: integración real de Wompi en modo **sandbox** (dinero de prueba). Endpoints SIMD `/api/pagos/*`: sesión de pago POST `/pagar` (referencia JADDA- idempotente + widget con firma `integrity:`), pull GET `/estado/:id`, webhook POST `/webhook` con firma HMAC SHA256 + re-verificación de la transacción vía API (no se confía en el payload solo) + idempotencia EXTERNO_ID+CHECKSUM en tabla `PAGOS_EVENTOS` (36 tablas, en setup.js + schema.sql), `expirarVentasPendientes()` *job* cada 15 min (48 h → CANCELADA con reingreso stock + MOVIMIENTOS ENTRADA); checkout con pasarela emite 0 avisos (los correos/notificaciones se disparan cuando el pago se CONFIRMA con el mismo flujo del checkout: comprador y admin); UI: CompraExitosa con polling 3.5 s + botón PAGAR CON WOMPI; DetalleCompra + MisCompras botón pagar si PENDIENTE_PAGO; ResumenCompra no pide tarjeta y redirige al widget directo. Llaves sandbox solo en `backend/.env` (`.env.example` placeholders); `esAmbientePruebas` detecta el modo (sandbox/prod sin tocar código). Docs detallados en `docs/auditoria/pasarela-pagos-plan.md` §5 (convenciones reales de la API, incl. GET `/v1/transactions?reference=` con llave privada) | sonde E2E 25/25 (transacción sandbox real APPROVED, webhook válido/inválido, expiración con stock) · sonda UI Playwright 10/10 (0 errores consola) · backend vitest **68/68** (11 nuevos de crypto/firman) · frontend 51/51 · tsc OK |
| F7 Purga del historial | `ee0c920`/`0534a8b` | `git filter-repo --invert-paths` ejecutado tras publicar (requirió force-push de `main` y `chore/produccion`): purga los 8 directorios basura del historial — media F5 (`frontend/public/{images,videos}`, `backend/uploads`) + los 3 `.pnpm-store` enterrados (raíz 122 MiB packed, frontend 66 MiB, backend 8 MiB) + `tests/node_modules` + `tests/playwright-report` — y blobs >1 MB (ninguno legítimo quedó afectado: verify 2026-10-22); 2 refs `refs/codex/turn-diffs` retenían árboles viejos → borradas antes del GC; `.gitkeep` de contraseñas de regenerados con `git add -f` (6 archivos; `backend/uploads` vive en `.gitignore` por diseño) | bundle de respaldo 163,9 MB verificado (`git bundle verify` OK + clone de prueba con HEAD idéntico) · diff de árboles pre/post: EXACTAMENTE los 6 `.gitkeep` perdidos, cero archivos legítimos · pack local **81,53 → 3,77 MiB** · clone fresco desde GitHub: **4,60 MiB, 586 archivos, HEAD `0534a8b`** · `main` y `chore/produccion` en remoto |

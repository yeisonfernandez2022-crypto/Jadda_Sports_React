# Hallazgos del Trimestre — Bootcamp de Testing ADSO

> Proyecto: JADDA SPORTS · Responsable: Yeison Fernández (líder único) · Corte: 2026-11-13
>
> Consolidado de los hallazgos REALES del trimestre (S1–S9). Cada fila lleva **detección** (cómo se encontró) y **evidencia verificable** (commit, test o sonda documentada en la bitácora del repo). Nada es hipotético: si no se puede señalar la evidencia, no está en la lista.

## Resumen

| Estado | Cantidad |
|---|---|
| Corregido (defecto con fix en el código) | 20 |
| Proceso (mejora de flujo de trabajo, no código) | 2 |
| Pendiente (survivor de mutante) | 1 |
| **Total** | **23** |

---

## 1. Capa Datos (4 corregidos)

| # | Hallazgo | Detección | Evidencia | Estado |
|---|---|---|---|---|
| 1 | Seed demo de USUARIOS (ids 40–44) con **21 columnas vs 22 valores** (faltaba `ULTIMA_IP`): el INSERT falla y todo el encadenado dependiente (DIRECCIONES → SOLICITUDES → VENDEDORES → productos de vendedor) siembra 0 filas — `/api/admin/compras` con `ES_DE_VENDEDOR=true` devolvía 0 de 47. | Log de boot «Setup [demo]: statement falló (ER_WRONG_VALUE_COUNT_ON_ROW)» ×5 + contador mecánico de columnas/valores | Commit `e1b8560`; E2E 40/40 con BD recreada desde cero (`VENDEDORES=7`, 33 ventas de vendedor) | Corregido |
| 2 | Comentario `//` (sintaxis JS) dentro del SQL de `CREATE_TABLES_RAW`: el lote multi-statement muere en la 2ª tabla y una **BD nueva quedaba sin tablas** (500 en toda la API). | Arranque limpio con BD fresca durante la prueba del gateway (S03) | Comentario migrado a `--` + `schema.sql` regenerado (2026-10-21) | Corregido |
| 3 | Bloque DEMO v1 incoherente: `INSERT IGNORE` descartó usuarios con PK duplicada **sin avisar** (ids 26/28/35 perdidos) y sembró reseñas de compradores que no habían comprado (violaba la regla del controlador). | Validación del bloque en una BD desechable con FK checks encendidos ANTES de aplicar | `DEMO_DATA` reescrito de cero (2026-10-25) + módulo `demoComprasResenas.js`: 29 ventas que respaldan 177 reseñas; 0 productos visibles sin reseña (2026-11-10) | Corregido |
| 4 | Fila `RESENAS` con CALIFICACION/COMENTARIO NULL de una cuenta marcador contaminaba `GET /api/productos/1/resenas`. | Sonda de API del barrido de reseñas | Fila purgada; cuenta marcador conservada (2026-11-10) | Corregido |

## 2. Capa Backend (10 corregidos)

| # | Hallazgo | Detección | Evidencia | Estado |
|---|---|---|---|---|
| 5 | Guard de foto de perfil escrito para rutas `/images/...` murió tras la migración de medios a Cloudinary: cada re-login social **pisaba la FOTO_URL propia** del usuario. | Reproducción E2E por API (subir foto → logout → re-login) contra local y prod; el guard inspeccionaba URLs de otra época | Helper `esFotoPropia` + `GUARD_SQL_FOTO_PROPIA` + 5 tests en `tests/backend/utils/cloudinary.test.js` (2026-11-11) | Corregido |
| 6 | `bcrypt.hash('...', 10)` sin `await` guardó el string `"[object Promise]"` (16 chars) como CONTRASENA: el INSERT y el COMMIT salieron con hash corrupto **sin error alguno**. | Auto-verificación `bcrypt.compare` del propio script de creación de admins | Re-corrida idempotente con `await` (2026-11-11); regla: auto-verificar SIEMPRE el hash almacenado al crear cuentas | Corregido |
| 7 | Rate limiter por IP no aplicaba en producción: **23 logins erróneos seguidos SIN 429** (el `req.ip` variaba por petición detrás del edge rotante del PaaS). | Sondas A/B en vivo contra prod (11 XFF únicos + 12 forjados, 11×401) + A/B semántico de `trust proxy` con el express exacto del repo | Clave del cubo `u{ID}` con sesión + normalización de ruta (`/estado/:N` comparten cubo) + límites por ruta; +2 tests del limitador (2026-11-09) | Corregido |
| 8 | Subida de imágenes rota en prod («Unexpected token '<'») — **doble causa**: (a) `express.json({limit:'1mb'})` global consumía el body antes de los parsers de 10/25 MB por ruta (413) y (b) la location regex de nginx anidada dentro de `/api/` no hereda `proxy_pass` (404 HTML del SPA). | Sonda A/B con el body crudo (backend directo → 413 JSON; SPA → 404 HTML) | Skip EARLY del parser global en las 2 rutas de subida + regex a nivel de servidor con snippet `proxy-backend.conf` compartido — commit `0d0b71b` (2026-11-08) | Corregido |
| 9 | `express-mysql-session` **descarta `ssl`** (whitelist en `prepareOptionsForMySQL2`) → el pool interno del store abría sin TLS contra la BD cloud («insecure transport prohibited»), y SOLO para peticiones con cookie (las sondas anónimas nunca tocaban el store). | Lectura del código empaquetado de la librería + sonda con `Cookie: connect.sid=probe` | Constructor `MySQLStore(options, connection)` con pool externo TLS-capable — commit `81ef0d7` (2026-11-08) | Corregido |
| 10 | El migrador de `setup.js` abría su `createConnection` campo a campo: el objeto config con `ssl` NO viaja completo → el mismo síntoma del hallazgo 9, causa distinta. | Log de boot del deploy real («Setup: MySQL no listo ×29») | Spread condicional `...(dbConfig.ssl ? { ssl: dbConfig.ssl } : {})` — commit `06d7718` (2026-11-08) | Corregido |
| 11 | Firma Wompi con prefijo `integrity:<hash>` → 422 «La firma es inválida»; el bundle del widget copia el param VERBATIM a `transaction.signature`. | Sonda A/B contra la API sandbox (prefijo → 422 firma; hash plano → pasa esa validación) | Hash plano en `urlCheckoutWompi` + test actualizado (2026-10-26) | Corregido |
| 12 | `estadoVenta` respondía DECLINADA sin cancelar la venta → la pantalla de compra exitosa mostraba «¡Gracias por tu compra!» con un pago rechazado. | Log real del usuario (Nequi ERROR «Número no válido en Sandbox») | Estado `pagoDeclinado` separado + botón «VOLVER A PAGAR CON WOMPI» + polling que no se detiene en DECLINADA (v8d, 2026-10-27) | Corregido |
| 13 | El vendedor podía «revivir» ventas CANCELADAS o confirmar ventas PENDIENTE_PAGO (el job de expiración perdería la venta; inventario fantasma). | Auditoría OWASP r2 contra el código (A03/A08) | Guards de transición en `actualizarEstadoVenta` con idempotencia adelantada (2026-11-09) | Corregido |
| 14 | Timbre de notificaciones: (a) `filtroUsuario` generaba el WHERE **sin paréntesis** (la precedencia OR/AND rompía el filtro) y (b) `marcarLeida` pasaba los params INVERTIDOS → abrir el timbre marcaba todo como leído. | SQL real contra la BD + repro del contador | Paréntesis en el filtro + orden de params corregido; verificado marcando UNA notificación (2026-08-09) | Corregido |

## 3. Capa Frontend (6 corregidos)

| # | Hallazgo | Detección | Evidencia | Estado |
|---|---|---|---|---|
| 15 | El body de error 500 (JSON válido) guardado crudo en estado → `n.filter is not a function` / `v.forEach is not a function` en Principal y Catálogo durante ventanas del backend. | Crash real durante una ventana de BD | Helper `leerListaJson` (`r.ok` + `Array.isArray` antes del estado) en los 5 lectores — commits `5ce635f`/`b9d099b` (2026-10-26 / 2026-11-08) | Corregido |
| 16 | Formulario de newsletter sin `noValidate`: la validación NATIVA del `<input type="email">` interceptaba el submit y el Swal «CORREO INVÁLIDO» de marca era inalcanzable. | Sonda Playwright con texto inválido | `noValidate` + validación/toasts propios (2026-11-02) | Corregido |
| 17 | `{0 && …}` con `r.COMPLETADO` numérico (MySQL) renderizaba el 0 como texto: «00» fantasma en Mis Retos. | Sonda de text nodes (TreeWalker) | `Number(x) === 1` + condicionales booleanos (2026-11-02) | Corregido |
| 18 | Click sobre el LABEL de un radio de pago re-dispatch un click al contenedor: el handler del toggle se ejecutaba DOS veces y deseleccionaba el método al alternar. | Repro UI (teoría del doble evento label→input→burbuja) | Filtrar targets input/label antes del toggle (2026-10-27) | Corregido |
| 19 | Foto recién subida servía `index.html` 200 (el `sirv` de Vite cacheaba el listado de `public/`; Docker Desktop no propagaba carpetas NUEVAS) → imagen «dañada» y navbar sin foto. | Sonda con status/content-type del recurso | `express.static` desde el backend + proxy `/images/perfiles` (2026-08-08) | Corregido |
| 20 | El registro con dirección de una sola parte guardaba el literal «Sin especificar» en CIUDAD/DEPARTAMENTO y el checkout lo trataba como campo lleno. | Repro del flujo de envío tras registro parcial | Guardar `''` + normalización en el checkout + `direccionIncompleta` (2026-10-26) | Corregido |

## 4. Proceso (2)

| # | Hallazgo | Detección | Evidencia | Estado |
|---|---|---|---|---|
| 21 | Reescritura de historia con un mailmap erróneo fusionó TODOS los autores a una cuenta: una frase ambigua del usuario («los otros soy yo») se interpretó mal y un mailmap de más destruye información no recuperable localmente. | Restablecimiento desde el `git bundle` creado 1 minuto antes (protocolo bundle + verify ANTES de cada rewrite) | Verificación por API: exactamente 4 colaboradores reales (2026-11-11) | Proceso |
| 22 | `git add` de un doc grande capturó un blob corrupto (texto de tool-call empotrado en una línea del archivo). | Revisión del contenido antes de pushear | Cirugía por script (borrar línea corrupta + duplicada) y verificación con `includes('tool_call')` — regla: editar archivos grandes con herramientas de edición, no con scripts ad-hoc (2026-11-10) | Proceso |

## 5. Pendiente (1)

| # | Hallazgo | Detección | Evidencia | Estado |
|---|---|---|---|---|
| 23 | `backend/middlewares/rateLimiter.js`: el default `max=10` (cuando la llamada no pasa límite) **no tiene aserción en ningún test** — el mutante `max:10 → max:11` sobrevive a toda la suite. Los 7 tests del limitador cubren las reglas explícitas (por usuario/IP, normalización de ruta), no el default. | Ejercicio de mutantes (T6): el mutante ESCAPÓ de la suite | Hallazgo documentado en el PR del cierre; test pendiente en el handoff de `pendiente-cobertura-80.md` (pedir el default y recibir 429 en la petición 11) | Pendiente |

---

### Moraleja del trimestre

El hallazgo más valioso no es ninguno de los 20 corregidos: es el **23**. Un mutante que se hace pasar por un test verde prueba que esa aserción no existe — y solo el ejercicio de mutación lo destapa. Ese es el argumento central de la sustentación: los tests que no pueden fallar no son tests.

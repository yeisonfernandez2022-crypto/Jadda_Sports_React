# Plan — Auditoría OWASP Top 10 ronda 2 (backend completo)

Fecha: 2026-11-09 · Entrada: 3 auditorías read-only (A01/A07, A03/A08, A05/A02/A09/A10) sobre 25 controllers > 23 routes > middlewares > utils > config. Fix list consolidada, con análisis de impacto en consumidores web/móvil antes de cada edición.

## Lote A — Rate limits + limitador interno
- A1 `middlewares/rateLimiter.js`: clave del cubo = `u{ID_USUARIO}` cuando hay sesión (inmune al `req.ip` roto detrás del edge rotante — evidencia: P-probe prod, 23 logins erróneos sin 429); ruta paramétrica normalizada (`\d+` → `:N`).
- A2 rate límites por ruta: checkout `/procesar` 5/15m · retos `/progreso` 10/15m, `/unirme` 10/15m, `DELETE evidencias` 10/15m · auth `/foto` 10/15m · chat `/iniciar` 10/15m + `POST mensajes` 30/min · pqr POST 5/15m · direcciones POST/PUT/DELETE 20/15m · metodos-pago POST/PUT/DELETE 20/15m · plan `/generar` 10/15m.
- A3 tests rateLimiter: cubo por usuario + normalización de ruta (+2 casos).

## Lote B — Integridad de negocio (IDOR/estados/inventario)
- B1 `vendedorController.actualizarEstadoVenta`: bloques (target PENDIENTE_PAGO) · (desde PENDIENTE_PAGO solo → CANCELADA vía helper) · (revivir CANCELADA). El resto de transiciones queda libre.
- B2 `vendedorController` crear/actualizar producto: descuento vinculado SOLO si existe, no es RETO- y no está vencido; inválido → null silencioso (el form puede pre-cargar un descuento ya expirado: un 400 rompería la edición).
- B3 `planController.marcarDia`: `AND pu.ID_USUARIO = ?` en el UPDATE.
- B4 `retoController.aprobar/rechazarEvidencia`: UPDATE condicional `AND ESTADO='pendiente'` + guard affectedRows (doble cupón imposible).
- B5 `productoController.buildSearchWhere`: escape de `% _ \`, guard de `?search` como array.
- B6 Visibilidad de productos ocultos (ESTADO_PUBLICACION): relacionados (lectura del origen), características, variantes, reseñas, agregarAlCarrito, obtenerCarrito.

## Lote C — Escaping de correos / integridad de archivos / config
- C1 `utils/correo.js` exporta `escaparHtml`; adoptan: pagosController (post-pago Wompi), productoController (aviso stock), retoController (aprobado/rechazado), vendedorController (rechazo solicitud), devolucionController (decisión), authController (plantilla OTP).
- C2 Excel: prefijo `'` en strings de usuario que empiecen por `= + - @ \t \r` (reporteExcel + reporteVendedorExcel).
- C3 `correoValido`: registro/recuperar/reenviar validan formato; checkout descarta `correo` inválido (fallback EMAIL de la cuenta, luego null).
- C4 `FOTO_URL` en PUT /perfil: solo `/images/…` o Cloudinary (o null); valor ajeno → se ignora sin error.
- C5 Magic bytes en base64 legacy: subirFotoPerfil + guardarMaterial (detectarFormato → null → 400 formato del caller).
- C6 `/health` sin el proveedor de correo.
- C7 Newsletter: correo crudo de suscriptor fuera del log (seguroLog).
- C8 OAuth state: comparación timing-safe.
- C9 Filenames de evidencia: `crypto.randomBytes` en vez de `Math.random` (devoluciones + retos).
- C10 Anti-enumeración: recuperar/reenviar/validar/update-password/confirmar responden 200 genérico o 400 ambiguo para correos inexistentes (sin envío). Registro MANTIENE 409 (revelación auto-infligida estándar, cambiarla rompe la UX del registro). Copy del AuthModal ajustado + hint.
- C11 `confirmar-cambio-email`: contador de intentos por cuenta (mismo helper de los otros flujos OTP).
- C12 `origenesAdmitidos.js`: localhost/8081 solo fuera de producción (los dominios reales viajan por CORS_ORIGINS; mismo-origen no pasa por la lista).

## Fuera de alcance (decisión documentada)
- TRUST_PROXY: render.yaml/deploy default 2 es CORRECTO contra forja con la cadena `[XFF, real, hop]` (prueba A/B local con express 5.2.1 del repo). El sondeo en prod (23 logins erróneos sin 429) indica que el valor DESPLEGADO no coincide — acción del usuario: verificar TRUST_PROXY=2 y que NO exista DISABLE_RATE_LIMIT en el Environment de Render.
- Registro 409 por correo duplicado: se conserva (ver C10).
- `rejectUnauthorized=false` de DB_SSL sin CA: escape hatch documentado (del fix anterior).

## Verificación final
`node --check` de todo lo tocado · `npx vitest run` backend completo · migrations `setup.js` · `npx tsc -b` (AuthModal tocado) · restart + `/health`.

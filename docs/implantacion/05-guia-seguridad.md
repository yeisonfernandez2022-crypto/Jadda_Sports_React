# Guía de seguridad y configuración de producción

> Módulo A · Complemento del despliegue de producción (`04-despliegue-produccion.md`).
> Documenta los controles de seguridad implementados en el código y su configuración.
> El inventario completo de hallazgos por área vive en `../auditoria/estado-brechas.md`.
> **Nota honesta:** este proyecto NO declara conformidad OWASP/ASVS — eso exige una
> evaluación formal con auditor externo (ver §11).

Fecha: 2026-10-21 · Fase 1 del plan de cierre de brechas.

---

## 1. Modelo del sistema (supuestos de seguridad)

| Aspecto | Decisión vigente |
|---|---|
| Arquitectura | Monolito Express detrás de UN proxy (nginx XOR Caddy), una sola instancia |
| Autenticación | **Sesión cookie** (`express-session`, store MySQL `express-mysql-session`) — no JWT |
| Clientes | Web (SPA React, same-origin en producción) · Móvil (Expo/RN vía axios `withCredentials`) · curl/tests |
| Roles | `ID_ROL` 1 = admin · 6 = vendedor · resto = cliente (middlewares `esAdmin`/`esVendedor`) |
| Proxy | nginx (`deploy/nginx.conf`) o Caddy (`deploy/Caddyfile`); TLS termina en el proxy |

## 2. Sesiones y cookies

`backend/server.js` — bloque `app.use(session(...))`:

| Atributo | Desarrollo | Producción | Nota |
|---|---|---|---|
| `httpOnly` | true | true | El JS del navegador no puede leer la cookie |
| `secure` | false | **true** (con `NODE_ENV=production`) | Requiere HTTPS; nginx/Caddy lo terminan |
| `sameSite` | `lax` | `lax` | Mitiga CSRF; el callback OAuth (GET top-level) sigue funcionando |
| `maxAge` | 24 h | 24 h | El store limpia expiradas cada 15 min |
| `secret` | fallback fijo con **aviso en el log** | **obligatorio** (arranca con error si falta) | `SESSION_SECRET` |

- La sesión vive en MySQL (sobrevive reinicios del backend, no del volumen).
- Recomendación al rotar el secreto: las sesiones activas se invalidan (los clientes vuelven a loguear) — hacer en ventana baja.

## 3. Defensa CSRF (nuevo, Fase 1)

**Middleware:** `backend/middlewares/proteccionOrigen.js` — aplicado globalmente tras CORS.

**Regla:** en peticiones que MUTAN (`POST/PUT/PATCH/DELETE`) se verifica la cabecera `Origin`:

1. Origin ausente → **pasa** (app móvil nativa, curl, tests, server-to-server: no existe la técnica CSRF fuera del navegador).
2. Origin == host efectivo de la petición (`x-forwarded-host`/`host`, puerto normalizado 80/443) → **pasa** (same-origin detrás del proxy).
3. Origin en la lista admitida (§4) → pasa.
4. Origin literal `"null"` → **403** (contexto opaco/sandbox).
5. Cualquier otro Origin → **403 `{ok:false,msg:"Origen no permitido"}`** + aviso en el log con IP.
6. GET/HEAD/OPTIONS nunca se bloquean.

**Defensas que ya existían y se mantienen:** cookies `SameSite=Lax` (los POST cross-site de navegadores ya no llevan la cookie) y frontend same-origin en producción (el navegador solo habla con su propia origin).

**¿Por qué no un token CSRF doble-submit?** El móvil nativo **no puede leer** la cookie `httpOnly` para calcular el token; exigiría un endpoint extra y headers custom en todo el cliente móvil. La verificación de Origin cubre la misma amenaza sin romper el cliente móvil.

**Verificado en vivo (2026-10-21):** POST con Origin `https://atacante.ejemplo` → 403 · POST sin Origin → sigue a autenticación (401 credenciales) · POST con Origin `localhost:5173` → pasa · GET con Origin ajeno → 200. Tests unitarios: 10 casos en `middlewares/proteccionOrigen.test.js`.

## 4. CORS y lista de orígenes

`backend/config/origenesAdmitidos.js` — fuente única para CORS y para la defensa CSRF:

- Base (desarrollo): `localhost:5173`, `127.0.0.1:5173`, `localhost:8081`, `127.0.0.1:8081`, `192.168.1.7:8081`.
- Producción/dominios propios: variable `CORS_ORIGINS` (coma separada, sin slash final).
  ```env
  CORS_ORIGINS=https://www.jaddasports.com,https://jaddasports.com
  ```
- En la topología de producción (04) todo es same-origin vía proxy: CORS queda en blanco si no se usa otra origin.

## 5. Proxy confiable y `req.ip`

```js
app.set('trust proxy', process.env.TRUST_PROXY ?? (NODE_ENV==='production' ? 1 : 0));
```

- **Antes de este cambio** el backend, detrás de nginx, veía la IP del proxy para todos los clientes → el rate limiting por IP agrupaba a **todos** en un cubo.
- Con 1 salto de confianza, `req.ip` = último elemento de `X-Forwarded-For` (el que vio el proxy de confianza) — el cliente no puede falsificarlo encolando entradas propias.
- nginx envía `X-Real-IP` y `X-Forwarded-For` (`$proxy_add_x_forwarded_for`); Caddy hace lo equivalente.
- Ajuste si cambia la topología (2 saltos: CDN + reverse proxy): `TRUST_PROXY=2`.

## 6. Cabeceras de seguridad

Ambos proxies envían el MISMO set (coherencia entre las dos opciones de gateway):

| Header | Valor | Efecto |
|---|---|---|
| `Strict-Transport-Security` | `max-age=15552000` | 180 días de HTTPS forzado en el navegador |
| `X-Content-Type-Options` | `nosniff` | evita sniffing MIME |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | no filtra URLs completas al salir |
| `X-Frame-Options` | `SAMEORIGIN` | anti clickjacking |
| `Server` | (sin cabecera en Caddy; `server_tokens off` en nginx) | no publica versión |

Las respuestas del backend llevan además `Cache-Control: no-store, no-cache, must-revalidate, private` (evita que el botón Atrás muestre datos de sesión).

## 7. Rate limiting (ventana deslizante por IP, 15 min, en memoria)

`backend/middlewares/rateLimiter.js` — sin dependencias; se apaga con `NODE_ENV=test` o `DISABLE_RATE_LIMIT=true` (usado en CI). Marco `req.ip` ya resuelto (§5), el límite es **por IP real**.

| Ruta | Límite |
|---|---|
| `POST /api/auth/login` | 10 / 15 min |
| `registro` 5 · `confirmar` 10 · `recuperar-password` 5 · `verificar-codigo` 10 · `update-password` 10 · `reenviar-codigo` 5 | conservador |
| `cambiar-email` 5 · `confirmar-cambio-email` 10 · `verificar-password` 10 (con sesión) | 15 min |
| `POST /api/contacto` | 5 / 15 min |
| devoluciones: crear/subir evidencias 10 · admin listar 60 · procesar 30 | protección admin |
| productos: recomendados 30 · CRUD categorías 30 · descuentos 30 (admin/vendedor) | abuso de escritura |
| vendedor: solicitud 10 · CRUD productos 30 · reportes 60 · excel/pdf 20 | consumo de recursos |

Límites conocidos del control (documentados, no ocultos): en memoria por proceso (resetea con reinicio del contenedor; suficiente para 1 instancia, no para multi-instancia) y **no hay rate limit global** — brecha S-18 del inventario.

## 8. Límites de tamaño y subidas

| Capa | Límite | Motivo |
|---|---|---|
| `express.json` global | **1 MB** | cualquier endpoint "normal" |
| `POST /api/auth/foto` | 10 MB (ruta específica) | foto base64 legacy |
| `POST /api/productos/imagenes` | 25 MB (ruta específica) | imágenes base64 admin |
| Multer (retos y devoluciones) | **25 MB × 5 archivos**, streaming a disco | sin boom de memoria |
| `validarSubida.js` | MIME real + coherencia MIME↔extensión, whitelist | evita ejecución de contenido |
| nginx `client_max_body_size` | 200 m (margen sobre 5×25 MB) | referencial |

Los límites de petición y contenido fueron endurecidos en la revisión 2026-10-21 (ver inventario, base previa #4).

## 9. Autorización y propiedad de recursos (resumen con referencias)

- **RBAC por rol** en cada router sensible (`esAdmin` en `/api/admin`, `esVendedor`/`esAdminOVendedor` en vendedor/productos) — RNF-014/réf. manual técnico.
- **Propiedad por dueño** verificada en: estáticos privados (`/images/usuarios`, `/images/devoluciones` — autorización ANTES que existencia, 403 no 404), compras, devoluciones, retos, chats (hilos aislados por PARTE tras escalación), dirección de compras (`PUT /api/compras/:id/direccion` con bloqueo si el envío salió).
- **Bloqueos de negocio**: vendedores no compran (doble validación API + UI); admin no abre tickets de soporte; pedidos con productos de vendedor los gestiona el vendedor (admin solo lectura).
- **Webhook de pagos (`POST /api/pagos/webhook`)**: la única ruta sin sesión se autentica por **firma** (SHA256 hex de las propiedades de la firma del evento + timestamp + secreto de eventos, comparación timing-safe en `utils/pagos.js`); evento sin firma válida → **403** y fila `FIRMA_INVALIDA` en `PAGOS_EVENTOS`; el cuerpo del evento NO se confía: tras validar, la transacción se re-consulta contra la API de Wompi antes de confirmar la venta; idempotencia por `UNIQUE (EXTERNO_ID, CHECKSUM)` en `PAGOS_EVENTOS`; la ruta lee el **raw body** (si express parseara el JSON y lo re-serializara, la firma no cuadraría).

## 10. Secretos, credenciales y análisis de dependencias

- Secretos SOLO por entorno: `.env` raíz (compose) + `backend/.env` (correo/Cloudinary/OAuth/pasarela), ambos gitignoreados; `backend/.env.example` con placeholders.
- Llaves de la pasarela: `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_KEY` / `WOMPI_EVENTS_SECRET` en `backend/.env` (los prefijos `pub_test_/pris_test_` definen ambiente sandbox; nunca en git). `PAYMENT_GATEWAY` vacío desactiva todo el flujo.
- `docker-compose.prod.yml` exige `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`${VAR:?}` hace fallar el arranque si falta).
- **Usuario BD de menor privilegio recomendado**: `DB_USER=jadda_app` (script `scripts/sql/usuarios-produccion.sql`); por defecto el compose sigue usando `root` (compatibilidad) — decisión del responsable.
- **Migrador de DDL (`jadda_migrator`) también de mínimo privilegio** (cierre-produccion-2 punto 5): SOLO `SELECT/INSERT/UPDATE/DELETE + CREATE/ALTER/INDEX/REFERENCES` sobre `jadda_sports_db.*` — SIN `DROP` (el DDL real de setup.js no hace DROP: `CREATE TABLE IF NOT EXISTS` + `ALTER` + `INSERT IGNORE`) y SIN privilegios globales `*.*` (la antigua línea `GRANT CREATE, ALTER ON *.*` quedó eliminada: otorgaba capacidad de crear/alterar bases arbitrarias). setup.js ahora verifica `information_schema.SCHEMATA` antes de intentar crear la BD: si no existe en producción, falla en ~0,5 s con las instrucciones para crearla a mano (antes: 30 reintentos ≈ 90 s con un error que no se cura). Verificado localmente: migración completa aplicada y re-aplicada (idempotente) por una cuenta con SOLO estos grants.
- **CI**: job `security-audit` (pnpm audit `--prod --audit-level high` en backend y frontend) con `continue-on-error` — informativa, sin falsos bloqueos; los high/critical se revisan en cada release (primera ejecución a vigilar en GitHub Actions).
- Las contraseñas se guardan con bcrypt; los códigos OTP se hashean y exponen 6 caracteres para escribir (TOKEN 255).

## 11. No verificado / requiere obra externa (honestidad del alcance)

| Tema | Estado | Qué falta |
|---|---|---|
| OWASP/ASVS | **no declarado** | evaluación formal con auditor externo |
| Penetration testing | no ejecutado | tercería o suite de pentest dedicada |
| WAF / protección DDoS | no aplica (despliegue LAN/on-premise) | si se publica a Internet: CDN/WAF (proveedor, decisión y costo) |
| Rotación de credenciales admin | **pendiente del usuario** | `Perfil → Seguridad` (el hash por defecto existió en historial git) |
| CA real / dominio público | pendiente | quitar `tls internal` del Caddyfile o `cert.pem` de CA en `deploy/certs` (04 §5) |
| Rate limit distribuido | fuera de alcance 1 instancia | store compartido si se escala horizontal (eso exigiría memoria/BD extra) |
| Pasarela de pagos | **sandbox ejecutado** (Wompi, 2026-10-24 — 25/25 sondas E2E en contenedor) | para pagos reales: cuenta de Wompi de producción, reemplazar llaves `*_test_` por `pub_prod_/pris_prod_` en `backend/.env` y registrar la URL de eventos |
| Auditoría de dependencias bloqueante | informativa hoy | pasar a bloqueante cuando la base de dependencias esté limpia |

## 12. Checklist mínimo de puesta en producción (resumen)

1. `.env` raíz con los 5 secretos obligatorios + `backend/.env` (correo/Cloudinary/OAuth) — ver 04 §2.
2. `SESSION_SECRET` de 32+ bytes aleatorios (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. `DEMO_DATA=false` ya va en el compose prod; verificar que no existan datos demo tras el arranque.
4. `DB_USER=jadda_app` (recomendado) + ejecutar `scripts/sql/usuarios-produccion.sql` y rotar su contraseña.
5. Rotar/definir la contraseña real del admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) y cambiarla en el primer login.
6. Certificados TLS reales (o sustituir por Caddy con dominio real, sin `tls internal`).
7. Verificación post-arranque: smoke de 04 §4 + comprobar cabeceras (`curl -I`) y rate limit (429 después del límite).
8. Respaldos activos (`scripts/backup.ps1`/`respaldar.sh`, S02) y restauración probada mensual.

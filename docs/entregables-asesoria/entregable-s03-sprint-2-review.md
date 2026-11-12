# Sprint 2 — Autenticación y Autorización — Review

> Entregable de la **Semana 3** del bootcamp (`week-03-sprint_2_autenticacion_y_autorizacion`,
> archivo `3-proyecto/starter/entregable-s03-sprint-2-review.md`), aplicado al proyecto
> **JADDA SPORTS** (Express 5 + express-session + Passport, React 19 SPA, app móvil Expo).
> Formato espejo de `entregable-s02-sprint-1-review.md`.
>
> **Nota honesta de preexistencia**: HU-002 estaba implementada en el proyecto antes del
> bootcamp (61 RFs verificados). El trabajo del sprint fue **verificar contra el checklist**,
> documentar la evidencia con línea exacta de código, auditar el `.env.example` sin secretos
> y dejar la rama `feature/sprint2-autenticacion` con este entregable. No se reescribió
> autenticación que ya funcionaba (regla: «si ya está en el proyecto no hacer nada»).

## 1. Objetivo del Sprint

Verificar y evidenciar que el sistema cumple los criterios de la Semana 3: login con hashing
uniforme ante credenciales inexistentes/incorrectas, sesión end-to-end (cookie httpOnly +
store en MySQL), autorización por rol en los endpoints sensibles (admin/vendedor/perfil),
`.env.example` sin secretos reales y rama `feature/*` por historia con PR a `develop`.
HU del sprint: **HU-002** (`docs/HUs/HU-002.md`) — registro con verificación OTP, inicio
de sesión, OAuth social y control de acceso por roles.

## 2. Modelo de Autenticación Elegido

- **Sesión o token (JWT)**: **SESIÓN** (`express-session` + `express-mysql-session`).
- **Razón de la elección**: el proyecto **no** usa el stack de referencia del bootcamp
  (FastAPI): es Express 5 sobre Node. Se eligió sesión sobre JWT por decisión de seguridad
  y simplicidad operativa:
  1. **Credencial nunca vive en el cliente**: la cookie `connect.sid` es `httpOnly`
     (inaccesible a JS), `sameSite: lax` y `secure` en producción — JWT en `localStorage`
     sería robable por XSS en una SPA de 45 páginas.
  2. **Revocación inmediata**: la sesión vive en la tabla `sessions` de MySQL (store
     persistente en `server.js` L264, `crearSessionStore()`) — cerrar sesión o bloquear
     una cuenta invalida la sesión real; con JWT stateless habría que esperar la expiración.
  3. **Anti fijación de sesión**: el login regenera el ID de sesión antes de autenticar
     (`req.session.regenerate()` en `authController.js` L841-845) — un ID fijado por un
     atacante no sobrevive al login.
  4. **Misma API para 3 clientes** (web, móvil, admin): los clientes nativos consumen
     los mismos endpoints con cookies; `proteccionOrigen` deja pasar peticiones sin
     header `Origin` (nativas/curl/tests) y valida el origen solo en el navegador.
- **Librería de hashing usada**: **bcrypt** (costo 10). La contraseña JAMÁS se compara con
  `=`: `bcrypt.compare(password, user.CONTRASENA)` en `authController.js` L818. El código
  OTP también se guarda hasheado (columna `USUARIOS.TOKEN` VARCHAR(255), hash de 60 chars
  con vigencia 15 min) — nunca en claro.
- **Pregunta guía — «login uniforme ante correo inexistente vs. contraseña incorrecta»**:
  implementado con dos capas en `exports.login` (`authController.js` L777-823):
  1. **Mensaje idéntico**: ambas ramas responden el MISMO `401 {"message": "Correo o
     contraseña incorrectos"}` (L797 y L822) — no se revela si el correo existe.
  2. **Tiempo uniforme**: la rama de correo inexistente ejecuta `bcrypt.compare(password,
     hashFingido())` (L795) para que la latencia de un bcrypt real iguale la de la rama
     con cuenta — el tiempo de respuesta no es un oráculo de existencia.
  3. **El 403 de cuenta sin verificar solo sale con contraseña CORRECTA** (L831-833:
     `{"message": "Debes verificar tu correo", requiereVerificacion: true}`) — el login
     no sirve para sondear qué correos están registrados.
  4. Capas anti fuerza bruta: ventana de bloqueo por cuenta en BD (L786-809: 429 tras
     `MAX_INTENTOS_LOGIN` fallidos en 15 min, evaluada en SQL), rate limit por IP/usuario
     (`rateLimit({ max: 10 })` en la ruta, 15 min) y contador OTP con tope de reenvíos.

## 3. Historias Completadas

| Historia de Usuario | PR mergeado |
|---|---|
| **HU-002** — Registro con verificación por correo (OTP), inicio de sesión, login social con Google y autorización por roles (cliente / vendedor / administrador) | Rama `feature/sprint2-autenticacion` creada desde `origin/Develop`. PR: `https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/compare/Develop...feature/sprint2-autenticacion` (apertura/merge = acción del propietario en el navegador; no hay `gh` CLI en este entorno) |

**Criterios verificados (HU-002, citados del código real):**
- CA-002.x registro → OTP: código de 6 dígitos hasheado en `USUARIOS.TOKEN` (15 min),
  reenvío con tope por correo y por IP (`reenviar-codigo` 5/15 min + `MAX_REINTENTOS`
  3/30 min), anti-enumeración: correo inexistente responde 200 genérico sin enviar.
- CA-002.x login → sesión: `POST /api/auth/login` autentica con bcrypt, regenera sesión,
  limpia contadores de intentos y serializa al usuario vía Passport
  (`serializeUser` guarda el email; `deserializeUser` carga `req.user` con `ID_ROL`).
- CA-002.4 mensaje exacto: `401 "Correo o contraseña incorrectos"` (verbatim en L797/L822).
- CA-002.5 mensaje exacto: `403 "Debes verificar tu correo"` (verbatim en L832).
- OAuth Google: única estrategia social (Facebook fue retirado por decisión del propietario,
  2026-11-07). La estrategia web valida el email del perfil vía `userinfo` de OpenID
  Connect con el `accessToken` y **exige `email_verified`** (`backend/config/passport.js`).
  Crea el usuario (rol 4, `CONFIRMADO=1`) con hash aleatorio no verificable
  (`contrasenaNoVerificable()`), de modo que la cuenta social no pueda loguearse por la
  vía local. El flujo móvil usa `verifyIdToken` de `google-auth-library` (mismo resultado,
  sin navegador). El `state` anti-CSRF de OAuth está cubierto por tests
  (`tests/backend/routes/authRoutes.test.js`: state incorrecto → 403, sin state → 403,
  state correcto → 302 a la ruta segura; `rutaRetornoSegura` rechaza open-redirects).
- RBAC: ver sección 5.

## 4. Historias No Completadas

**Ninguna dentro del alcance del sprint** (HU-002 cubre los criterios de la semana).
Limitaciones conocidas y documentadas (no impiden el criterio de la semana):

- **Rate limiter en memoria** (`rateLimiter.js`): estado por proceso — con N réplicas los
  límites se multiplicarían. Documentado en el propio archivo; aceptable para la topología
  actual (1 réplica). La defensa por cuenta (bloqueo en BD) es independiente de réplicas.
- **Ceremonia de PR**: la apertura del PR y el merge a `develop` son acciones del
  propietario en el navegador (enlaces listos en la sección 3).
- **Fuera de alcance por diseño**: el rol Invitado (ID_ROL 5) no tiene endpoints propios;
  Facebook login retirado a propósito (queda solo Google).

## 5. Tabla de Roles Implementada

Muestra representativa (el mapa completo de la API vive en `backend/README.md` y
`docs/manuales/manual-tecnico.md`). Los roles sembrados: `ROLES` 1 Admin · 2-4
(cliente/otros) · 5 Invitado · 6 Vendedor (`setup.js` L604-606 + L2995).

| Endpoint | Rol(es) permitido(s) |
|---|---|
| `POST /api/auth/registro` · `/login` · `/confirmar` · `/recuperar-password` · `/verificar-codigo` · `/update-password` · `/reenviar-codigo` | Público (con rate limit por IP: 5-10/15 min según ruta — `authRoutes.js` L47-60) |
| `GET /api/auth/perfil` · `POST /api/auth/cambiar-password` · `/cambiar-email` · `/verificar-password` | Cualquier sesión activa (cliente, vendedor o admin) |
| `GET /api/productos` · `/api/productos/categorias` · `/api/productos/descuentos` | Público (catálogo de tienda abierta, por diseño) |
| `GET/POST/PUT/DELETE /api/carrito*` | Cliente autenticado — **vendedor explícitamente bloqueado**: `403 "Los vendedores no pueden comprar en la tienda..."` (`carritoController` y `checkoutController` rechazan `ID_ROL === 6`) |
| `POST /api/checkout/procesar` | Cliente autenticado (vendedor 403; total 100 % recalculado en servidor) |
| `GET/POST/DELETE /api/favoritos` · `/api/direcciones` · `/api/usuarios/metodos-pago` · `/api/compras*` | Sesión + **ownership**: el controlador filtra por `ID_USUARIO` de la sesión (ver/actualizar datos ajenos → 403/404) |
| `GET /api/compras/:id/factura` | Dueño de la venta (sesión + check de propiedad) |
| `router.use(esAdmin)` → todo `/api/admin/*` (órdenes, usuarios, productos, categorías, reportes, dashboard) | **Admin** (`ID_ROL = 1`): sin sesión → `401 "Debes iniciar sesión"`; con sesión sin rol → `403 "No tienes permisos de administrador"` (`esAdmin.js` L5-13; `adminRoutes.js` L8) |
| `GET /api/devoluciones/admin` · `POST /api/devoluciones/admin/:id/procesar` | Admin (por ruta, `devolucionRoutes.js` L64-65) |
| `GET /api/newsletter/suscritos` · `POST /api/newsletter/enviar` | Admin (`newsletterRoutes.js` L15-16) |
| `/api/vendedor/*` (mi-tienda, productos, ventas, empresa, devoluciones, chats) | **Vendedor** (`ID_ROL = 6` + fila en `VENDEDORES` con `ESTADO='ACTIVO'` → `req.vendedor`; sesión ausente → 401, sin rol → `403 "Solo los vendedores pueden realizar esta acción"`, inactivo → `"Tu cuenta de vendedor no está activa"`) |
| `POST /api/productos/imagenes` (subida de imágenes de producto) | `esAdminOVendedor` — admin sube para cualquier producto; vendedor solo para los suyos (`productoRoutes.js` L11) |
| `POST /api/cupones/validar` | Público con rate limit (30/min) por diseño de tienda — PERO los cupones `RETO-` exigen sesión DENTRO del mismo endpoint: sin sesión → `401 "Los cupones de reto son personales..."`, ajeno → `403 "Este cupón de reto no pertenece a tu cuenta"` |
| `GET /api/chat/no-leidos` · `/api/notificaciones/no-leidas` | Sesión (por rol: cliente / vendedor / admin reciben rutas de retorno distintas) |

- **Pregunta guía — «un endpoint sin protección de rol y por qué»**: el inventario
  confirma que los endpoints públicos son los de una tienda abierta por diseño (catálogo,
  ofertas, contacto, newsletter, validación de cupones de tienda) — no son "sin protección
  por descuido" sino rutas de invitado, todas con rate limiting. Todo lo que expone datos
  personales o de gestión usa `verificarSesion` (con ownership en controlador), `esAdmin`
  o `esVendedor`. El hallazgo de mayor matiz es `POST /api/cupones/validar`: público,
  pero con la lógica de cupones personales protegida dentro del propio controlador.
- El middleware `proteccionOrigen` (global en mutaciones) añade una capa CSRF: origen
  ajeno → 403; origen ausente (clientes nativos) → pasa. Convive con `sameSite: lax`.

## 6. Demo

Guion de demostración en vivo (lo que se muestra al instructor):

1. **Login con credenciales incorrectas** (correo inexistente Y contraseña mala, dos
   veces): ambas responden el MISMO `401 "Correo o contraseña incorrectos"` con latencia
   similar (hash fingido) — anti-enumeración.
2. **Cuenta sin verificar**: login con contraseña correcta → `403 "Debes verificar tu
   correo"` + flujo de reenvío OTP (código hasheado, 15 min).
3. **Login correcto** → `200` + cookie `connect.sid` (httpOnly, visible en DevTools sin
   contenido JS); `GET /api/auth/perfil` con la cookie → datos del usuario.
4. **RBAC en vivo**: cliente autenticado llama `GET /api/admin/usuarios` →
   `403 "No tienes permisos de administrador"`; sin sesión → `401 "Debes iniciar sesión"`;
   admin → `200`.
5. **Vendedor no compra**: cuenta de vendedor intenta `POST /api/carrito/agregar` →
   `403 "Los vendedores no pueden comprar en la tienda..."`.
6. **Fijación de sesión**: se muestra en los logs que el login regenera el ID de sesión
   (la cookie cambia tras autenticar).

## 7. Estado Docker de esta Semana

- [x] `docker compose up db be` levanta backend + base de datos

> **Ruling** (heredada y documentada en el entregable S02): los servicios del proyecto se
> llaman **`database`** y **`backend`** (no `db`/`be` como la plantilla). **NO se renombró**:
> cambiar el nombre rompería `docker-compose.yml`, `depends_on`, los proxies de nginx/vite
> y la documentación. El comando equivalente es `docker compose up -d database backend`.

- **Evidencia** (comando ejecutado en vivo al cierre del sprint):

```
$ docker compose up -d database backend
 Container jadda_mysql   Running
 Container jadda_backend Running

$ docker ps --filter "name=jadda" --format "{{.Names}} | {{.Status}} | {{.Ports}}"
jadda_backend  | Up 30 hours (healthy) | 127.0.0.1:5000->5000/tcp
jadda_frontend | Up 30 hours           | 127.0.0.1:5173->5173/tcp
jadda_mysql    | Up 4 days  (healthy)  | 127.0.0.1:3306->3306/tcp
```

Idempotente: `up -d` sobre contenedores ya levantados reporta `Running` sin recrear nada.
El backend está `healthy` (healthcheck `GET /health` sin BD, montado antes del logger) y la
sesión store usa la MISMA política TLS del pool hacia TiDB (S02). **Nota honesta**: el
backend de esta estación apunta a la BD gestionada TiDB Cloud (no al MySQL local del
compose, que sigue sano como servicio dev de referencia) — la evidencia de boot del stack
completo con BD local quedó cubierta en el S02 (`docker compose down -v` + `up`).

## 8. % de Avance Acumulado del Proyecto

**~28 %** de las semanas del plan (Sprint 0 + Sprint 1 + Sprint 2 de 8 sprints de
desarrollo + Semana 1). Sprint 2 aporta **+6 pts**: HU-002 verificada criterio por criterio
contra el código (login uniforme, sesión end-to-end con store MySQL, OAuth con
`email_verified`, RBAC con 401/403 exactos, `.env.example` de 151 líneas con SOLO
placeholders y `ADMIN_*` opcionales), tabla de roles inventariada y evidencia Docker
en vivo. Nota honesta: el código preexistía — el porcentaje acredita semanas del plan
cerradas con criterios verificados, no líneas nuevas.

## 9. Roles del Equipo (Sprint 2)

| Integrante | Rol |
|---|---|
| **Yeison** (propietario del repo) | Product Owner — prioriza y aprueba los PRs a `develop` desde el navegador; valida la demo en el navegador/móvil |
| **Asistente IA (OpenCode)** | Scrum Master — aplica el checklist de la semana y mantiene el ledger de decisiones · **Dev** — rama `feature/*`, commits por convención del Sprint 0 · **QA** — suites automatizadas (backend 214/214 unit, 22/22 integración) + sondeos Docker/HTTP como evidencia |

Nota honesta: el equipo real es de dos (propietario + asistente IA); los cuatro roles
Scrum se cubren en parejas, rotando la responsabilidad de QA hacia las suites
automatizadas en lugar de una segunda persona. La apertura/merge de PRs y la sesión de
Sprint Review con el instructor son las únicas acciones pendientes del propietario.

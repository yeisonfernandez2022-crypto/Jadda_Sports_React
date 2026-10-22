# Revisión técnica del proyecto — 20 de octubre de 2026

## Alcance

Revisión estática del repositorio actual: backend Express/MySQL, frontend React/Vite, app Expo, Docker Compose, CI, esquema/arranque de base de datos y pruebas versionadas. No se ejecutaron pruebas ni análisis dinámicos. Las observaciones describen el código visible en esta revisión; los cambios locales existentes (incluidos `backend/middlewares/rateLimiter.js`, `docker-compose.yml` y archivos bajo `tests/`) se consideran parte del estado de trabajo, no cambios realizados durante esta auditoría.

## Resumen

El proyecto tiene una base funcional amplia: separación por backend, web y móvil; consultas parametrizadas en buena parte del backend; setup de base de datos idempotente en intención; pruebas unitarias, cobertura y humo E2E en CI. Antes de exponerlo a usuarios reales, hay que cerrar primero el riesgo de cuentas demo administrativas y credenciales por defecto. También se deben proteger las evidencias privadas, hacer obligatoria la configuración segura de sesiones y reservar el apagado del rate limit para pruebas.

## Hallazgos priorizados

### Crítico — El arranque crea datos demo y credenciales administrativas conocidas

`setupDatabase` ejecuta el bloque `DEMO_DATA` tanto cuando encuentra tablas existentes como al crear una base nueva (`backend/database/setup.js`, líneas 3344 y 3365). Ese bloque contiene usuarios con `ID_ROL=1` en las líneas 1606–1608. Además, `seedAdminUser` usa `Losquiero7` si `ADMIN_PASSWORD` no está definido y actualiza la contraseña del administrador objetivo en cada arranque (`backend/database/setup.js`, líneas 2347–2356). El README publica el usuario/contraseña por defecto (`README.md`, líneas 138–145).

**Impacto:** un despliegue que reutilice la configuración de desarrollo puede crear o reactivar accesos administrativos conocidos y mezclar pedidos, usuarios y evidencias de demostración con datos reales.

**Acción recomendada:** separar explícitamente datos demo de migraciones y semillas de producción; no sembrar usuarios con rol administrador desde datos fijos; exigir `ADMIN_PASSWORD` fuerte durante el bootstrap de producción y no volver a restablecer la contraseña en cada inicio. Añadir una comprobación de arranque que falle si falta una configuración obligatoria.

### Alto — Las evidencias de devoluciones y archivos de usuario se sirven sin autorización

Express publica `uploads/usuarios` y `uploads/devoluciones` mediante `express.static` (`backend/server.js`, líneas 132–141). Las rutas de evidencia se forman con una carpeta derivada del nombre de usuario y un nombre de archivo basado en tiempo/aleatoriedad (`backend/routes/devolucionRoutes.js`, líneas 21–28; `backend/utils/carpetaUsuario.js`, líneas 10–26). Por tanto, conocer o adivinar la URL permite pedir el archivo sin pasar por autorización de la devolución.

**Impacto:** evidencia de devoluciones, que puede contener fotos o videos personales, puede quedar accesible fuera del flujo autenticado. Los archivos de retos también se publican bajo `/images/usuarios`.

**Acción recomendada:** guardar contenido privado fuera del directorio estático y servirlo mediante un endpoint que compruebe propiedad/rol; si se necesita acceso compartido, usar URLs firmadas y con vencimiento. Verificar también que los datos demo no apunten a rutas públicas inexistentes o reutilizables.

### Alto — El secreto de sesión tiene valor por defecto y la cookie no usa transporte seguro

La sesión usa `jadda_secret_key` si falta `SESSION_SECRET` y configura `cookie.secure: false` (`backend/server.js`, líneas 97–103). Esto permite iniciar el servidor con una clave conocida y hace que la cookie no requiera HTTPS. El repositorio ya tiene `.env.example`, pero el servidor no falla al arrancar si falta el secreto.

**Impacto:** en un despliegue accesible por HTTP o con la clave por defecto, las sesiones quedan expuestas a robo o falsificación.

**Acción recomendada:** validar al arranque un secreto aleatorio de alta entropía; configurar `Secure`, `HttpOnly`, `SameSite` y duración explícita para producción; habilitar `trust proxy` solo con la topología de proxy conocida. Mantener ajustes HTTP exclusivamente para el entorno local.

### Alto — El rate limit está apagado en Compose y el limitador no comparte estado

El cambio local actual en `docker-compose.yml`, línea 43, define `DISABLE_RATE_LIMIT=true`. El middleware lo interpreta como apagado global (`backend/middlewares/rateLimiter.js`, líneas 15–35). Sin esa variable, el contador vive en un `Map` por proceso, así que un reinicio lo borra y varias réplicas aplican límites independientes.

**Impacto:** si se publica este Compose o se reutiliza esa variable en un entorno accesible, login, registro y recuperación quedan sin protección contra automatización. El modo en memoria no ofrece límites fiables al escalar.

**Acción recomendada:** retirar el apagado del Compose compartido y activar el bypass solo en pruebas aisladas; usar un limitador distribuido (por ejemplo Redis) para despliegues con más de un proceso y definir límites adicionales por cuenta/operación sensible.

### Alto — Límites de petición demasiado altos amplifican denegación de servicio

El parser global acepta JSON y formularios de 100 MB (`backend/server.js`, líneas 75–76). Las cargas de evidencia permiten hasta 8 archivos de 100 MB por petición (800 MB en total; `backend/routes/devolucionRoutes.js`, líneas 29–33) y los retos aceptan 10 de 100 MB (`backend/routes/retoRoutes.js`, líneas 35–36). El filtro de devoluciones valida la extensión del nombre, no el contenido real del archivo (`backend/routes/devolucionRoutes.js`, líneas 25–30).

**Impacto:** consumo elevado de RAM, disco, ancho de banda y conexiones; posibilidad de almacenar archivos cuyo contenido no corresponde a la extensión declarada.

**Acción recomendada:** reducir el límite JSON global a un tamaño pequeño y definir tamaños por ruta; fijar límites totales por solicitud y por usuario; validar firma/MIME real, transcodificar o escanear archivos y aplicar cuotas/limpieza de temporales.

### Alto — La inicialización de base de datos puede ocultar migraciones incompletas

`ejecutarBloqueSQL` captura fallos por sentencia, cuenta los errores y solo los registra como advertencias (`backend/database/setup.js`, líneas 3243–3304). El llamador ignora el resultado de `SEED_DATA` y `DEMO_DATA` y continúa con el setup (`backend/database/setup.js`, líneas 3334–3356). Esto es útil para tolerar conflictos de datos de ejemplo, pero no distingue fallos tolerables de fallos que dejan el esquema o los datos de referencia incompletos.

**Impacto:** el proceso puede iniciar con tablas/datos parciales y mostrar errores más tarde en endpoints de negocio; la causa queda alejada del momento del fallo.

**Acción recomendada:** versionar migraciones como unidades identificables, guardar su versión aplicada y hacer que un fallo de DDL o migración obligatoria detenga el arranque. Mantener semillas demo en un paso separado y con resultado explícito.

### Medio — OAuth depende de URLs locales y usa `state` como ruta sin validación

Los callbacks de Google y Facebook concatenan `req.query.state` a `http://localhost:5173` y reciben `from` del usuario sin validarlo (`backend/routes/authRoutes.js`, líneas 36–76). Las estrategias OAuth también tienen callback URLs locales fijas (`backend/config/passport.js`, líneas 30 y 86). Los callbacks añaden nombre y foto del usuario a la URL de retorno.

**Impacto:** OAuth no funciona de forma portable fuera del entorno local; un `state` mal formado puede generar redirecciones inesperadas dentro de la aplicación y la información personal termina en el historial/referrer del navegador.

**Acción recomendada:** parametrizar URLs públicas por entorno; conservar estado OAuth con protección CSRF y validar la ruta de retorno contra rutas relativas permitidas; evitar poner datos de perfil en query strings.

### Medio — Módulos grandes elevan el costo de cambios y revisiones

Hay controladores de 1.000–1.270 líneas (`productoController.js`, `vendedorController.js`, `adminController.js`, `authController.js`) y páginas/componentes de 800–1.200 líneas (`ResumenCompra.tsx`, `ProductDetailPage.tsx`, `AdminProductos.tsx`, `AuthModal.tsx`). El servidor concentra middleware, sesión, archivos, rutas, errores y arranque. En el backend hay además verificaciones de sesión declaradas de forma local en varias rutas.

**Impacto:** lógica de negocio, persistencia, notificaciones y transporte HTTP se mezclan; es más fácil introducir regresiones y más difícil probar reglas de autorización de forma uniforme.

**Acción recomendada:** extraer servicios de dominio (checkout, devoluciones, reportes, chat), validadores de entrada compartidos y middleware único de sesión/rol. Dividir páginas por secciones funcionales o hooks cuando se toque cada flujo, conservando cambios pequeños y cubiertos.

### Medio — La cobertura mínima no equivale a cobertura de riesgo

El backend permite umbrales de 30% y el frontend umbrales de 28–37% (`backend/vitest.config.mjs`, líneas 31–36; `frontend/vitest.config.ts`, líneas 27–32). El backend excluye del cálculo `server.js`, `database/setup.js` y `config/**`; el frontend excluye páginas y componentes de pruebas. En el árbol inspeccionado solo aparecen pruebas frontend para `reglasCupon`, `ProductCard` y `AuthModal`, además de una prueba básica de integración de backend. La cifra total real de cobertura no se midió en esta revisión.

**Impacto:** el CI puede permanecer verde aunque falten pruebas en autenticación, autorización por rol, checkout, privacidad de archivos y migraciones.

**Acción recomendada:** cubrir primero casos de acceso horizontal/vertical, operaciones de dinero/stock, recuperación de contraseña, subida/descarga de evidencia y bootstrap de base vacía; elevar umbrales gradualmente y evitar excluir módulos críticos sin una razón documentada.

### Medio — CI deja móvil fuera de la verificación automática

El workflow actual prueba lint/TypeScript y build de frontend, pruebas de backend y smoke E2E, pero no instala ni ejecuta lint, TypeScript o build de Expo (`.github/workflows/ci.yml`). La app móvil tiene su propio workspace/lockfile, por lo que puede degradarse sin bloquear cambios en `main`.

**Acción recomendada:** añadir al CI un job móvil con instalación congelada, lint y chequeo TypeScript; agregar export/build de Expo si el tiempo y los secretos requeridos lo permiten.

## Plan sugerido

1. **Antes de producción:** eliminar cuentas demo administrativas y contraseñas públicas; exigir secretos; proteger evidencias privadas; asegurar rate limiting.
2. **Endurecimiento de entradas:** reducir límites de cuerpo/archivos, validar contenido real y añadir cuotas/retención.
3. **Confiabilidad de BD:** separar demos de producción, versionar migraciones y fallar cuando una migración necesaria falle.
4. **Calidad continua:** añadir pruebas centradas en autorización y flujos críticos, integrar la app móvil al CI y elevar cobertura por dominio.
5. **Mantenibilidad:** dividir controladores/páginas de mayor tamaño con refactors incrementales.

## Límites de esta revisión

Este informe es una revisión estática y no constituye una prueba de penetración ni confirma explotabilidad en una instancia desplegada. No se ejecutaron pruebas, escáneres de dependencias ni consultas a la base de datos. Antes de producción conviene validar cada hallazgo en la configuración efectiva del entorno y repetir la revisión después de los cambios.

## Revisión posterior de cambios — 20 de octubre de 2026

Se comparó el estado actual de `main` (HEAD `3a5c122c`) con los hallazgos anteriores y se revisaron los contratos de la estrategia OAuth instalada. El árbol estaba limpio al comenzar esta comprobación.

### Mejoras confirmadas

- **Contraseña admin existente:** `seedAdminUser` ya no actualiza la contraseña en cada arranque. Ahora hace falta `SEED_ADMIN_PASSWORD=true` para forzar el cambio. Esto resuelve el restablecimiento recurrente, pero sigue usando `yeison`/`Losquiero7` al crear el primer admin y sigue registrando esa contraseña en el log de bootstrap. `DEMO_DATA` continúa insertando filas administrativas con hashes estáticos, en cada arranque (`backend/database/setup.js`, líneas 1604–1608 y 3344–3375). El hallazgo crítico queda **parcialmente resuelto**.
- **CI:** se agregó un job de integración backend con MySQL real y un job Playwright con browser instalado; el build depende de los jobs de calidad. Es una mejora de cobertura de flujo. El workflow aún conserva otro job E2E legacy además de Playwright, lo que duplica arranque de servicios y tiempo. No hay job de lint/TypeScript/build móvil.
- **Carrito:** las cantidades ahora se validan como enteros entre 1 y 99 antes de consultar/actualizar stock (`backend/controllers/carritoController.js`).
- **Datos de pago:** checkout ya omite los campos `cvv` y `numero` antes de guardar el JSON (`backend/controllers/checkoutController.js`). La protección es parcial porque mantiene `...resto`: una clave alternativa enviada por cliente puede persistir datos sensibles. Es preferible crear el objeto persistido desde una lista explícita de campos permitidos.
- **Callbacks OAuth en Passport:** Google y Facebook ahora aceptan URLs callback por variables de entorno. Las rutas de callback y redirección siguen usando `http://localhost:5173` y el `state` recibido se usa como ruta sin validación (`backend/routes/authRoutes.js`, líneas 36–76), por lo que la portabilidad sigue incompleta.

### Hallazgo nuevo — Google OAuth probablemente falla en todos los inicios

La estrategia `passport-google-oauth20` instalada obtiene un `profile` desde el endpoint UserInfo y lo normaliza a `id`, `displayName`, `name`, `emails` y `photos`; no incluye `id_token` (`backend/node_modules/passport-google-oauth20/lib/profile/openid.js`). El callback de la aplicación usa `profile.id_token || accessToken` y entrega ese valor a `googleClient.verifyIdToken` (`backend/config/passport.js`, líneas 34–45). El segundo argumento es un OAuth access token, no un OpenID Connect ID token, y `verifyIdToken` valida específicamente ID tokens. Con el flujo configurado (`scope: ['profile', 'email']`) el caso normal pasa el access token a un verificador de ID token y falla. Tratar esto como **bloqueo de login Google hasta corregirlo y probar el flujo real**. Alternativas: confiar en el perfil UserInfo obtenido por la estrategia HTTPS, o implementar un flujo OpenID Connect que capture y valide el ID token real.

### Siguen pendientes

- Evidencias de devolución y archivos de usuario siguen servidos públicamente desde Express static (`backend/server.js`, líneas 132–141).
- `SESSION_SECRET` todavía cae en `jadda_secret_key` y la cookie sigue con `secure: false` (`backend/server.js`, líneas 97–103).
- `DISABLE_RATE_LIMIT=true` continúa en `docker-compose.yml`; el contador normal sigue siendo local al proceso (`backend/middlewares/rateLimiter.js`).
- Límites globales de 100 MB y evidencias de hasta 800 MB por solicitud siguen vigentes; el filtro de devolución sigue basado en extensión.
- El setup continúa ejecutando `DEMO_DATA`; los fallos internos de sentencias se reportan como advertencias y no detienen el arranque.
- Los umbrales de cobertura siguen en 30% backend y 28–37% frontend, con exclusiones de componentes críticos.
- La separación de controladores y componentes grandes sigue pendiente.

Esta comprobación fue estática. No se ejecutaron Playwright, pruebas unitarias ni el flujo de Google OAuth; el fallo de Google se deduce del contrato real de la estrategia instalada y requiere una prueba de autenticación para confirmación en entorno configurado.

## Revisión de cambios locales — 20 de octubre de 2026

Se revisaron los cambios locales actuales en `backend/controllers/authController.js` y `backend/server.js`. No se modificó código de la aplicación durante esta revisión.

### Cambios útiles, aún incompletos

- **Códigos OTP:** `generarSeguridad` ahora usa `crypto.randomInt`, y los flujos de recuperación, reenvío y cambio de email guardan códigos con bcrypt y comparan con `bcrypt.compare`. Esto mejora la aleatoriedad y evita almacenar esos códigos en texto claro en esos flujos.
- **Archivos privados:** `/images/usuarios` y `/images/devoluciones` ahora requieren una sesión. Ya no son descargables anónimamente, pero el middleware solo autentica; no comprueba que `req.user` sea dueño de la carpeta o devolución. Cualquier usuario con sesión que conozca una URL puede seguir solicitando el archivo de otra cuenta. La autorización por recurso sigue pendiente.

### Bloqueo nuevo en verificación de códigos

El cambio de OTP está incompleto y probablemente rompe los flujos de registro y los códigos almacenados:

1. Registro aún guarda `codigo` sin hash (`backend/controllers/authController.js`, línea 256), pero `confirmarCuenta` ahora lo compara como hash (`línea 317`). El código recién enviado por registro no coincidirá.
2. Reenvío, recuperación y cambio de correo guardan un hash bcrypt de unos 60 caracteres (`líneas 358–359, 385–386 y 783–786`), mientras que `USUARIOS.TOKEN` sigue declarado `VARCHAR(6)` (`backend/database/setup.js`, línea 71). En MySQL estricto las escrituras pueden fallar por longitud; si se truncaran, la comparación tampoco podría funcionar.

**Acción prioritaria:** usar un solo helper de generación/almacenamiento/verificación para todos los flujos OTP, actualizar el ancho de `TOKEN` y añadir migración idempotente a bases existentes antes de desplegar el cambio. Confirmar registro, verificación, reenvío, recuperación y cambio de email con pruebas de integración.

### Rate limiter — sigue apagado en desarrollo

La configuración mantiene `DISABLE_RATE_LIMIT=true` en `docker-compose.yml` (línea 43), y el middleware lo convierte en bypass total (`backend/middlewares/rateLimiter.js`, líneas 15–35). CI también lo declara globalmente y en ambos jobs E2E (`.github/workflows/ci.yml`, líneas 15, 285 y 405), donde el bypass es razonable para ejecutar el humo. En Compose local, sin embargo, el login, registro, recuperación, contacto y demás rutas limitadas no tienen protección mientras esa variable esté presente. Retirarla del Compose por defecto y limitarla a los comandos/servicios de test. Además, el rate limit normal es un `Map` en memoria, no compartido entre instancias.

### Estado restante confirmado

- El bootstrap aún siembra `DEMO_DATA` y las cuentas administrativas de demostración, conserva `Losquiero7` como contraseña por defecto y no falla por falta de configuración de producción.
- El secreto de sesión predeterminado, `cookie.secure: false`, límites de cuerpo/archivo altos y validación de archivos por extensión siguen igual.
- Los callbacks de OAuth siguen redirigiendo al localhost y Google OAuth conserva el problema de pasar un access token a `verifyIdToken`.
- El CI mejoró con integración MySQL y Playwright, pero conserva un segundo job E2E legacy; cobertura mínima y exclusiones se mantienen; móvil sigue fuera del CI.

Esta revisión fue estática. No se ejecutaron pruebas automatizadas; los flujos OTP deben probarse antes de dar por seguro el cambio, porque el tipo de columna y la ruta de registro muestran incompatibilidades directas.

## Postscriptum 2026-10-22 — estado de los hallazgos

Verificado otro día contra el código real (rama `chore/produccion`). El inventario vivo con la evidencia de cada corrección está en `docs/auditoria/estado-brechas.md`.

| Hallazgo de esta revisión | Estado al 2026-10-22 |
| :--- | :--- |
| Evidencias privadas servidas como static público | **Cerrado** — `/images/usuarios` y `/images/devoluciones` se sirven desde `server.js` con autorización por recurso (auxiliares `servirArchivoPrivado`: dueño/vendedor/admin, 403 antes de 404); verificado E2E (401 sin sesión, 403 no dueño, 200 dueño/admin) |
| Credenciales/secretos por defecto | **Cerrado** — fail-fast en producción sin `SESSION_SECRET`/`DB_PASSWORD`, cookie `Secure` en producción y `trust proxy` configurado; `DISABLE_RATE_LIMIT` retirado de `docker-compose.yml` y limitado a los jobs E2E del CI |
| Límites de subida elevados y validación por extensión | **Cerrado** — evidencias 25 MB ×5 con lista blanca de MIME real + coherencia extensión↔MIME (`utils/validarSubida.js`); imágenes de producto 6 MB por archivo con magic bytes (`utils/formatoImagen.js`); JSON global reducido a 1 MB (el comentario de `retoRoutes.js` que menciona "100 MB" quedó obsoleto: mandan los límites de `validarSubida.js`) |
| Google OAuth roto (access token a `verifyIdToken`) | **Cerrado** — la estrategia web ya no llama `verifyIdToken`: usa `fetch` a `openidconnect.googleapis.com/v1/userinfo` con el access token y exige `email_verified` (prueba del flujo real con claves sigue pendiente) |
| OTP: código plano en registro + `TOKEN VARCHAR(6)` vs bcrypt | **Cerrado** — `USUARIOS.TOKEN VARCHAR(255)` con migración idempotente en `setup.js`; el registro también guarda hash bcrypt y todos los flujos comparan con `bcrypt.compare` |
| Bootstrap: `DEMO_DATA` y admin por defecto sin configuración | **Cerrado** — portilla `debeSembrarDemo()` omite las semillas demo en producción y `seedAdminUser` falla rápido si no existen `ADMIN_EMAIL`/`ADMIN_PASSWORD` (sin contraseñas por defecto en prod) |

### Sigue vivo (sin cambios desde esta revisión)

- Doble job E2E en el CI (Playwright + humo legacy): se mantiene la duplicación de arranque de servicios.
- La app móvil sigue fuera del CI (sin job de lint/TypeScript/build de Expo).
- Cobertura: los umbrales sí existen (30% backend, 28–37% frontend) pero son bajos y excluyen módulos críticos; la cifra total real se sigue sin medir en cada entrega.
- No se corrigió el `...resto` de `DATOS_PAGO` ni la validación del `state` de OAuth; controladores grandes siguen pendientes de división incremental.

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

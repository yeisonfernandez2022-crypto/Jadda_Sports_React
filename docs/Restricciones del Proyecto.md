# Restricciones del Proyecto — Jadda Sports

## Restricciones Técnicas

### Stack
- **Backend:** Node.js con Express 5 obligatorio. No se permite Python, PHP ni otros lenguajes.
- **Frontend web:** React con TypeScript y Vite. No se permiten otros frameworks (Angular, Vue).
- **Base de datos:** MySQL 8.0 exclusivamente. No se permite PostgreSQL, MongoDB, etc.
- **App móvil:** React Native con Expo SDK 54. No se permite Kotlin, Swift ni Flutter.
- **Contenedores:** Docker + Docker Compose para todos los entornos.

### Base de Datos
- Toda la comunicación con MySQL se realiza mediante `mysql2` con consultas parametrizadas. No se permite SQL crudo sin parametrizar para prevenir inyección SQL.
- Las tablas se crean automáticamente al arrancar el backend mediante `database/setup.js` con `CREATE TABLE IF NOT EXISTS`.
- Los datos de referencia (categorías, proveedores, productos) se siembran con `INSERT IGNORE` en el mismo script.
- El esquema se define exclusivamente en `setup.js` — no se permiten migraciones manuales ni herramientas ORM.
- El asistente sí puede aplicar cambios de BD directamente (via `setup.js`/`docker exec`); informa siempre qué ejecutó. Ver `AGENTS.md`.

### Autenticación
- Sesiones manejadas con `express-session` + MySQL store.
- Autenticación OAuth mediante Passport.js con estrategias Google y Facebook.
- Contraseñas hasheadas con bcrypt obligatoriamente.
- En producción, usar HTTPS y configurar `cookie: { secure: true }`.

### Frontend
- Estilos con Bootstrap 5 + CSS personalizado. No se permite Tailwind ni styled-components.
- Íconos con FontAwesome (clases `fas`/`far`). No se permite Material Icons ni iconos SVG inline.
- Las rutas se definen en `App.tsx` usando React Router.
- El carrito flotante (`FloatingCart`) y menú (`MiniCartMenu`) se renderizan globalmente desde `AppLayout` en `App.tsx`.

### Móvil
- File-based routing con Expo Router.
- Bottom tabs para navegación principal (inicio, catálogo, carrito, perfil).
- La URL base de la API debe configurarse mediante variable de entorno `EXPO_PUBLIC_API_URL`, no hardcodeada.

## Restricciones de Desarrollo

### Flujo de Trabajo
- Los cambios se prueban dentro de Docker. **Web (único comando):** `pnpm build; $env:MODE = "preview"; docker compose up` (PowerShell, desde la raíz, requiere build previo). **Móvil:** `cd movil; pnpm install; npx expo start --dev-client`.
- Si el frontend muestra errores de parseo después de editar archivos, ejecutar `docker restart jadda_frontend`.
- No se permite hacer commit sin verificar antes con `git status`, `git diff` y `git log --oneline -10`.
- Nunca se fuerzan pushes ni se usan `--force` o `--hard`.

### Seguridad
- Las variables de entorno con credenciales reales (.env) **nunca** se suben al repositorio.
- Se utiliza `.env.example` con valores placeholder como plantilla para nuevos entornos.
- Las credenciales reales se comparten por canales externos (WhatsApp, Telegram, password manager).
- La carpeta `mysql_data/` está en `.gitignore` y no se versiona.

### Documentación
- Los requerimientos funcionales se documentan en `docs/RFs/RF-NNN.md`.
- Las historias de usuario se documentan en `docs/HUs/HU-NNN.md`.
- Los requerimientos no funcionales se documentan en `docs/RNFs/RNF-NNN.md`.
- Formato obligatorio: tablas de identificación, descripción, entradas, proceso, salidas, endpoints asociados.

### Despliegue
- El proyecto se despliega localmente con Docker Compose en `preview` (único soportado para entrega).
- La base de datos se resetea con `docker compose down -v` y se levanta con `pnpm build; $env:MODE = "preview"; docker compose up`.
- El backend se expone en el puerto 5000, el frontend en el 5173.

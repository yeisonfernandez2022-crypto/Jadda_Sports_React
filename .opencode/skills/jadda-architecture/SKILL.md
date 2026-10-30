---
name: jadda-architecture
description: "Use when working anywhere in the JADDA SPORTS repo and you need the real tech stack, repository layout, Docker services, ports, request flow, or the boot order of backend/server.js before editing any code. Also use to orient yourself before running the jadda-frontend, jadda-backend, jadda-database, jadda-security or jadda-testing skills."
---

# Arquitectura de JADDA SPORTS

Hechos verificados contra el código real (no supuestos). Si algo aquí contradice
el código, el código gana: actualiza esta skill a continuación.

## Stack real (package.json de cada capa)

| Capa | Carpeta | Stack verificado |
|---|---|---|
| API | `backend/` | Node 22 (imagen `node:22-alpine`), **Express 5.2.1**, CommonJS, mysql2 3.20.0, express-session 1.19.0 + Passport 0.7.0, Wompi sandbox, vitest 5 |
| Web | `frontend/` | **React 19.2.4** + TypeScript 5.9.3 + **Vite 8** (SPA, `type: module`), Bootstrap 5.3.8, SweetAlert2, react-router-dom 7.13.2, axios 1.15.0 |
| Móvil | `movil/` | **Expo ~54** (SDK), React Native 0.81.5, React 19.1.0, **expo-router ~6** (file-based), axios con cookies |
| E2E | `tests/` | Playwright 1.48.2 (`playwright-core` + `@playwright/test`) |
| DB | contenedor `jadda_mysql` | MySQL 8.0, BD `jadda_sports_db`, utf8mb4 |

**No existe JWT** en el backend; la sesión es cookie `express-session`.
**No existe Next.js/Remix** — el web es una SPA de React que consume `/api/*`.

## Servicios Docker (docker-compose.yml de la raíz)

| Contenedor | Puerto (SOLO 127.0.0.1) | Volumen / montaje clave |
|---|---|---|
| `jadda_mysql` | 3306 | volumen nombrado `mysql_data` |
| `jadda_backend` | 5000 | bind mount `./backend:/app` (edición en caliente con nodemon); `node_modules` vive en el volumen `backend_modules`; imágenes montadas: `./frontend/public/images/{productos,perfiles,retos,usuarios,devoluciones}` → `/app/uploads/*` |
| `jadda_frontend` | 5173 | bind mount `./frontend:/app`, `node_modules` en volumen `frontend_modules`; `MODE=preview` → `pnpm build && pnpm preview`, si no → `pnpm dev` |

- Comandos del contenedor backend: `sh -c "pnpm install --no-frozen-lockfile && pnpm dev"`.
- Healthchecks: backend `GET /health` (node fetch, la imagen no trae curl), MySQL `mysqladmin ping`. El frontend depende de backend healthy.
- Compose adicionales: `docker-compose.test.yml` (MySQL 8.0 de pruebas en host **3307**, BD `jadda_sports_test`), `docker-compose.prod.yml` (nginx:alpine serviendo `dist`, backend `node server.js`, sin puertos expuestos salvo 80/443), `deploy/docker-compose.caddy.yml` (gateway `jaddasports.com`).

## Flujo de una petición web

```
Navegador  →  :5173 Vite (SPA + proxy)  →  :5000 Express (/api/*, /images/*)  →  MySQL :3306
```

- `frontend/vite.config.ts` proxy (server Y preview) hacia `http://backend:5000`
  (`VITE_PROXY_TARGET` lo cambia): `/api`, `/images/perfiles`, `/images/usuarios`,
  `/images/devoluciones`, `/images/productos`. Las imágenes se sirven POR EL BACKEND,
  no por Vite, porque los archivos recién subidos no llegan al contenedor de Vite al instante.
- El móvil apunta directo al backend (`EXPO_PUBLIC_API_URL`, default `http://10.2.178.124:5000`,
  Android emulador `10.0.2.2`), ver `movil/constants/api.ts`.

## Orden de arranque de `backend/server.js` (línea por línea verificado)

1. `dotenv` + `require('./database/setup')` (auto-crear tablas + seeds al arrancar).
2. **Fail-fast en producción**: sin `SESSION_SECRET` o `DB_PASSWORD` → `process.exit(1)`.
3. `trust proxy` (utils/trustProxy.js: 1 salto en prod, 0 en dev).
4. `helmet` (CSP/HSTS solo producción), health `GET /health` y `GET /api/health` (SELECT 1).
5. Log de peticiones `registrarPeticion` (JSON de 1 línea, `X-Request-Id`, sin PII).
6. **Rate limit global**: 300/min por IP (env `GLOBAL_RATELIMIT_MAX`), exentas `/health`, `/api/health`, `/images/*`.
7. CORS (`config/origenesAdmitidos.js`, `credentials: true`) + `proteccionOrigen` (403 si Origin ajeno en mutaciones).
8. `express.json({limit:'1mb'})`, sesión con **MySQLStore** (tabla `sessions`, 24 h), Passport, anti-caché.
9. Estáticos: `/images/productos` y `/images/perfiles` públicos; `/images/usuarios` y `/images/devoluciones` con autorización por recurso.
10. **23 mounts API** (líneas 376-398): `auth, productos, carrito, proveedores, direcciones, favoritos, historial, compras, cupones, checkout, pqr, retos, planes, admin, usuarios/metodos-pago, contacto, envio, newsletter, notificaciones, devoluciones, vendedor, chat, pagos` — cada uno en `backend/routes/<nombre>Routes.js`.
11. Error handler global (honra `err.status`; JSON malformado → 400; envía `reqId`).
12. Jobs: newsletter automática cada `NEWSLETTER_INTERVAL_HORAS` (default 72 h) y, si la pasarela está activa, expiración de pagos cada **1 min**.

## Dónde vive cada cosa

- Controllers: `backend/controllers/*.js` (25 archivos, un archivo por dominio).
- Routes: `backend/routes/*Routes.js` (montan controllers + middlewares de rate/sesión).
- Middlewares: `backend/middlewares/` (`authMiddleware.js`=verificarSesion, `esAdmin.js`, `esVendedor.js`, `rateLimiter.js`, `proteccionOrigen.js`, `registroPeticiones.js`).
- Utilidades: `backend/utils/` (pagos, envio, reglasCupones, facturaPdf, estadoPedido, correo, cloudinary, cancelacionVenta, reembolsosCancelacion, movimientosStock, numeroPedido, validarSubida…).
- BD: `backend/database/setup.js` (schema completo + migraciones idempotentes + seeds), `schema.sql`, `exportarSchema.js`.
- Frontend: `frontend/src/pages` (34), `frontend/src/admin` (16), `frontend/src/components` (22), `frontend/src/context` (4 contexts), `frontend/src/utils` (helpers espejo del backend), `frontend/src/css` (1 CSS por página con prefijo propio).
- Móvil: `movil/app/` (rutas expo-router: `(tabs)`, `producto/[id]`, `perfil/*`, `vendedor/*`, `chat/[id]`), `movil/context/`, `movil/components/`.
- Docs funcionales: `docs/RFs/`, `docs/HUs/`, `docs/RNFs/` (61 RF / 61 HU / 17 RNF, numerados); auditoría e implantación en `docs/calidad/`, `docs/implantacion/`, `docs/auditoria/`.

## Reglas de oro del proyecto

- Nada se expone a la LAN: MySQL, backend y frontend publican SOLO en 127.0.0.1 (ver compose).
- El total/descuento/envío de una compra se calcula SIEMPRE en el servidor (`backend/utils/envio.js`, `reglasCupones.js`); el frontend solo muestra.
- Todo cambio de esquema pasa por `MIGRACIONES` en setup.js (idempotente) y se regenera `schema.sql`.
- Correo/notificaciones NUNCA bloquean la petición (try/catch, envío best-effort).

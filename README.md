# ⚽ JADDA SPORTS

> **Plataforma de comercio electrónico especializada en artículos deportivos** — tienda web, API REST y app móvil en un solo ecosistema.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL%208%20%2F%20TiDB%20Cloud-4479a1?logo=mysql&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61dafb?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-media-3448c5?logo=cloudinary&logoColor=white)

---

## 📋 Resumen

Jadda Sports es una tienda deportiva en línea con **tres frentes**:

| Capa | Descripción |
|------|-------------|
| 🖥️ **Frontend Web** | SPA en React + TypeScript + Vite, con panel administrativo completo |
| ⚙️ **API REST** | Backend monolítico Node.js + Express 5 con sesiones y autenticación OAuth |
| 📱 **App Móvil** | React Native + Expo (Expo Router), conectada al mismo backend, con actualizaciones **OTA vía EAS** |

La base de datos es **TiDB Cloud** (MySQL compatible, serverless) compartida por dev y producción, y se **auto-configura al arrancar** el backend (crea tablas + datos de referencia; demo opcional con `DEMO_DATA=true`). El arranque es idempotente: basta `docker compose up`.

---

## ✨ Funcionalidades destacadas

### Usuario
- Catálogo con búsqueda por prefijo, filtros por categoría/precio y selector de variantes (color + talla)
- Carrito flotante con minicarrito y checkout seguro (total recalculado 100 % en el servidor)
- Envío real por departamento (gratis a partir de $800.000) y dirección de pedido
- Cuenta con verificación por **código de 6 dígitos** (15 min), recuperación de contraseña y cooldowns anti-spam
- Login social (Google) y foto de perfil subida desde el navegador
- Perfil completo: datos, seguridad (última conexión), direcciones, métodos de pago guardados, mis compras
- **Factura PDF** descargable y adjunta al email de confirmación (con imágenes incrustadas)
- Cancelar pedido, devoluciones (aprobación admin con reingreso de stock) y notificaciones de estado (email + in-app)
- Reseñas con estrellas, favoritos con deshacer, recientemente vistos y **recomendaciones por compras previas**
- **Retos deportivos** con evidencias en foto/video y cupones de descuento `RETO-XXXX-XXXX`
- **Planes de entrenamiento** con progreso de días
- Aviso de reposición de stock ("Avísame cuando vuelva"), compartir en redes sociales, newsletter, contacto y PQRS
- **Chat** cliente ↔ vendedor ↔ JADDA, con escalación de devoluciones y censura de lenguaje ofensivo
- **Cupones de reto** con compra mínima escalada según el porcentaje y panel de cupones disponibles en el checkout

### Vendedor (marketplace)
- Solicitud de cuenta desde el formulario público (empresa/NIT opcionales si es informal) y aprobación/rechazo por el admin
- Panel propio: productos con estados `Pendiente/Aprobado/Rechazado`, ventas de sus artículos, devoluciones negociadas por chat y reportes con descarga Excel/PDF
- Sus productos se publican solo tras aprobación; JADDA conserva la administración de productos y órdenes

### Administrador
- **Dashboard rediseñado**: KPIs (ingresos/pedidos 30 días), tarjeta HOY con % vs ayer, gráfica de ventas 30 días, top 5 más vendidos, pendientes por revisar
- **Productos**: tabla con búsqueda, filtro por categoría, columnas ordenables y paginación; editor con **galería de imágenes ordenable** (portada 1ª) y **vista previa como cliente** del detalle
- Órdenes con cambio de estado/envío (notifica al cliente), factura PDF y **modo solo lectura en ventas de vendedores**
- Gestión de usuarios (detalle con compras, retos y datos de vendedor), solicitudes de vendedor, retos, devoluciones y categorías
- **Chats** de soporte y devoluciones escaladas, con contadores de no leídos
- Reportes de ventas por rango de fechas, ranking de más vendidos y **descarga Excel/PDF** (con fórmulas y gráficas)

---

## 🏗️ Arquitectura

```
                    ┌─────────────────┐   ┌──────────────────┐
                    │  Frontend Web   │   │    App Móvil     │
                    │  React 19 :5173 │   │  Expo (OTA/EAS)  │
                    └────────┬────────┘   └────────┬─────────┘
                             │  HTTP (fetch/axios) │
                    ┌────────▼─────────────────────▼───┐
                    │           API REST               │
                    │  Express 5 (sesiones + OAuth)    │
                    └────────────────┬─────────────────┘
                                     │ mysql2 (pool, TLS)
                     ┌───────────────▼────────────────┐
                     │   TiDB Cloud  :4000 (TLS)      │
                     │   MySQL compatible · 38 tablas │
                     └────────────────────────────────┘
```

- **Frontend** — SPA con renderizado cliente, lazy-loading de rutas, ErrorBoundary y páginas de loading/404 propias.
- **Backend** — API monolítica: sesiones persistentes en MySQL (express-session), Passport.js para OAuth, rate limiting en memoria, RBAC (`esAdmin`).
- **Base de datos** — **TiDB Cloud Starter** (MySQL 8 compatible, serverless, TLS forzado, puerto 4000): la **misma BD para dev y producción** — un cambio aplicado en desarrollo es visible en producción al instante y viceversa. `backend/database/setup.js` crea las **38 tablas** + datos de referencia en cada arranque (idempotente + migraciones automáticas), con `schema.sql` para BD nuevas. La BD local de Docker queda como *rollback* (bloque comentado en `docker-compose.yml`).
- **Móvil** — App Expo que consume el mismo backend; las actualizaciones JS se publican con `eas update` (OTA) sin pasar por la tienda.
- **Media** — imágenes y videos en **Cloudinary** (CDN, carpeta `jadda/`): el repo no versiona binarios (solo `.gitkeep` en las carpetas de subidas) y las subidas nuevas caen a disco solo como fallback.

---

## 🚀 Inicio rápido

### Con Docker — Web (único comando soportado)

> **Requiere haber hecho la build antes.** En PowerShell, desde la raíz del proyecto:

```powershell
pnpm build; $env:MODE = "preview"; docker compose up
```

> 1. `pnpm build` compila el frontend (`tsc -b && vite build` -> `frontend/dist/`).
> 2. `$env:MODE = "preview"` hace que el contenedor `jadda_frontend` ejecute `pnpm build && pnpm preview --host --port 5173` en vez de `pnpm dev` (sirve el bundle compilado, no hot-reload).
> 3. `docker compose up` levanta MySQL + API + Frontend preview. Al arrancar, `backend/database/setup.js` crea las 38 tablas + datos de referencia (demo opcional con `DEMO_DATA=true`; los admins se gestionan con `backend/scripts/crear-admin.js`).
> - URL: **http://localhost:5173** (frontend), **http://localhost:5000** (API).
> - **BD:** el backend apunta por defecto a **TiDB Cloud** (variables `TIDB_*` en el `.env` de la raíz). Para usar la BD local de Docker: descomenta el bloque de rollback en `docker-compose.yml` y vuelve a levantar.
> - Si el Vite muestra errores viejos: `docker restart jadda_frontend`.
> - Para volver a dev: cierra la terminal o `$env:MODE = ""` + `docker compose up`.

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:5000 |
| MySQL    | localhost:3306 |

### Sin Docker (solo para desarrollo sin preview)

```bash
# Backend (por defecto apunta a TiDB Cloud con las credenciales de backend/.env;
# para MySQL local cambia DB_HOST=database y DB_PORT=3306 en backend/.env)
cd backend
cp .env.example .env     # editar credenciales
pnpm install
pnpm dev

# Frontend
cd frontend
pnpm install
pnpm run dev
```

### Móvil — Expo Dev Client (único comando soportado)

```bash
cd movil
pnpm install   # solo la primera vez, descarga dependencias
npx expo start --dev-client
```

> Escanea el QR con el APK dev-client del teléfono (cada arranque genera un QR distinto). Si no conecta por WiFi, añade `--tunnel`. Requiere `EXPO_PUBLIC_API_URL` en `movil/.env`.

### Cuentas de administrador

Los admins se gestionan con el script seguro `backend/scripts/crear-admin.js` (contraseña tecleada oculta o por JSON; hashea con bcrypt, valida fortaleza y unicidad, y auto-verifica el hash):

```bash
docker exec -it jadda_backend node scripts/crear-admin.js --email admin@jaddasports.com --usuario admin.ops
```

Las variables `ADMIN_EMAIL`/`ADMIN_PASSWORD` son **opcionales**: si existen, el arranque solo verifica/crea el admin con ellas; si no existen, el seed se omite con un log (y en producción avisa solo si la BD se quedó sin ningún admin). El panel se abre en `/admin`.

---

## 🧪 Pruebas y calidad

| Suite | Comando | Estado |
|-------|---------|--------|
| Backend (Vitest: unitarias + integración con MySQL real) | `pnpm --prefix backend test` | 208 pruebas (incluye checkout concurrente) |
| Frontend (Vitest + Testing Library) | `pnpm --prefix frontend test` | 65 pruebas |
| Cobertura con umbrales | `pnpm --prefix backend test:coverage && pnpm --prefix frontend test:coverage` | Reportes en `backend/coverage/` y `frontend/coverage/` |
| E2E Playwright (2 navegadores) | `pnpm --prefix tests exec playwright test` | 20 specs × Chromium/Edge = 40 ejecuciones |
| E2E de humo (Playwright Core) | `node tests/smoke.mjs` | 23 checks contra la app levantada |
| Lint | `pnpm --prefix frontend lint` | 0 errores (advertencias heredadas) |
| TypeScript | `pnpm --prefix frontend exec tsc -b` | Sin errores |

> `node tests/smoke.mjs` requiere los contenedores arriba (`jadda_frontend`, `jadda_backend`, `jadda_mysql`) y un navegador Edge/Chromium. Se puede apuntar a otro entorno con `API_URL`, `WEB_URL`, `ADMIN_EMAIL`, `ADMIN_PASS`, `VENDOR_EMAIL` y `VENDOR_PASS`.
>
> El CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta lint, typecheck, pruebas unitarias e integración con cobertura, build, E2E Playwright y el humo E2E contra MySQL efímero.

---

## 📚 Documentación

| Recurso | Contenido |
|---------|-----------|
| [`docs/README.md`](docs/README.md) | Índice general con tabla de estados y stack |
| [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md) | Estado real: implementado, parcial y pendiente (actualizado 2026-10) |
| [`docs/manuales/backend-usuario.md`](docs/manuales/backend-usuario.md) | Documentación técnica del backend (controllers, rutas, BD) |
| [`movil/docs/README.md`](movil/docs/README.md) | **App móvil**: índice, stack, estructura, cómo correr y OTA/EAS |
| [`movil/docs/RFs-movil.md`](movil/docs/RFs-movil.md) | **App móvil**: cobertura de RFs con estados y pendientes (corte 2026-11-11) |
| [`docs/entregables/`](docs/entregables/) | Entregables S01–S05 (ficha técnica, planes, hosting/dominio, despliegue, configuración/verificación) |
| [`docs/planeacion/plan de trabajo.md`](docs/planeacion/plan%20de%20trabajo.md) | Fases, módulos y cronograma |
| [`docs/planeacion/Restricciones del Proyecto.md`](docs/planeacion/Restricciones%20del%20Proyecto.md) | Stack, seguridad y workflow |
| [`docs/RFs/`](docs/RFs/) | 61 requisitos funcionales (RF-001 a RF-061) |
| [`docs/HUs/`](docs/HUs/) | 61 historias de usuario (HU-001 a HU-061) |
| [`docs/RNFs/`](docs/RNFs/) | 17 requisitos no funcionales (RNF-001 a RNF-017) |
| [`docs/diagrams/`](docs/diagrams/) | Diagramas de arquitectura, BD y flujos |
| [`docs/calidad/`](docs/calidad/) | Marco ISO/IEC 25010, evaluación y plan de mejora |
| [`docs/implantacion/`](docs/implantacion/) | Preparación, migración, respaldos y despliegue |
| [`docs/manuales/`](docs/manuales/) | Manuales de instalación, técnico y usuario final |
| [`docs/aceptacion/`](docs/aceptacion/) | Pruebas de aceptación, acta de entrega y capacitación |

---

## 🔐 Variables de entorno

- `.env` (raíz, gitignoreado) — `TIDB_HOST/PORT/USER/PASSWORD` para la interpolación de `docker-compose.yml` (BD TiDB Cloud) y la contraseña de la BD local (`MYSQL_ROOT_PASSWORD`).
- `backend/.env.example` — credenciales BD, secretos OAuth, correo SMTP, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (opcionales), pasarela Wompi y `FRONTEND_URL`.
- `frontend/.env.example` — `VITE_API_URL`.
- `movil/.env.example` — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_FRONT_URL`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

> Los `.env` reales están en `.gitignore`; los ejemplos contienen solo placeholders. Si el backend dev arranca con `DB_HOST` vacío (sin `TIDB_*` en la raíz), reparar con `powershell -ExecutionPolicy Bypass -File scripts\restaurar-backend-tidb.ps1`.

---

## 🤝 Flujo de contribución

1. Rama desde `main` con el tipo y tu usuario: `feat/usuario`, `fix/usuario`, `docs/usuario` (existe también la rama de integración `Develop`).
2. Un commit por rama, formato convencional: `feat:`, `fix:` o `docs:` + descripción corta en imperativo.
3. Pull Request hacia `Develop` (o directo a `main` para hotfixes) con un revisor asignado; se integra con *Rebase and merge* (1 commit por PR).

---

## 👥 Equipo

| Integrante | GitHub |
|------------|--------|
| Yeison Fernandez | [@yeisonfernandez2022-crypto](https://github.com/yeisonfernandez2022-crypto) |
| Duglas Montenegro | [@duglismontenegro-create](https://github.com/duglismontenegro-create) |
| Miguel Castro | [@angelcastro09-max](https://github.com/angelcastro09-max) |
| Johan Castro | [@johanestivencastropena8-lgtm](https://github.com/johanestivencastropena8-lgtm) |

# ⚽ JADDA SPORTS

> **Plataforma de comercio electrónico especializada en artículos deportivos** — tienda web, API REST y app móvil en un solo ecosistema.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8-4479a1?logo=mysql&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61dafb?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white)

---

## 📋 Resumen

Jadda Sports es una tienda deportiva en línea con **tres frentes**:

| Capa | Descripción |
|------|-------------|
| 🖥️ **Frontend Web** | SPA en React + TypeScript + Vite, con panel administrativo completo |
| ⚙️ **API REST** | Backend monolítico Node.js + Express 5 con sesiones y autenticación OAuth |
| 📱 **App Móvil** | React Native + Expo (Expo Router), conectada al mismo backend |

La base de datos se **auto-configura al arrancar** (crea tablas + datos de referencia + demo), lo que hace el proyecto 100 % portable: basta `pnpm build` + `docker compose up` en `preview`.

---

## ✨ Funcionalidades destacadas

### Usuario
- Catálogo con búsqueda por prefijo, filtros por categoría/precio y selector de variantes (color + talla)
- Carrito flotante con minicarrito y checkout seguro (total recalculado 100 % en el servidor)
- Envío real por departamento (gratis a partir de $800.000) y dirección de pedido
- Cuenta con verificación por **código de 6 dígitos** (15 min), recuperación de contraseña y cooldowns anti-spam
- Login social (Google / Facebook) y foto de perfil subida desde el navegador
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
                        ┌─────────────────┐
                        │  Frontend Web   │
                        │  React 19 :5173 │
                        └────────┬────────┘
                                 │ HTTP (fetch / axios)
                        ┌────────▼────────┐
                        │  API REST       │
                        │  Express 5 :5000│
                        └────────┬────────┘
                                 │ mysql2 (pool)
                         ┌────────▼────────┐
                         │  MySQL 8 :3306  │
                         │  35 tablas      │
                         └─────────────────┘
```

- **Frontend** — SPA con renderizado cliente, lazy-loading de rutas, ErrorBoundary y páginas de loading/404 propias.
- **Backend** — API monolítica: sesiones persistentes en MySQL (express-session), Passport.js para OAuth, rate limiting en memoria, RBAC (`esAdmin`).
- **Base de datos** — 35 tablas creadas automáticamente en cada arranque por `backend/database/setup.js` (idempotente + migraciones + demo poblado), con `schema.sql` para BD nuevas.
- **Móvil** — App Expo que consume el mismo backend.

---

## 🚀 Inicio rápido

### Con Docker — Web (único comando soportado)

> **Requiere haber hecho la build antes.** En PowerShell, desde la raíz del proyecto:

```powershell
pnpm build; $env:MODE = "preview"; docker compose up
```

> 1. `pnpm build` compila el frontend (`tsc -b && vite build` -> `frontend/dist/`).
> 2. `$env:MODE = "preview"` hace que el contenedor `jadda_frontend` ejecute `pnpm build && pnpm preview --host --port 5173` en vez de `pnpm dev` (sirve el bundle compilado, no hot-reload).
> 3. `docker compose up` levanta MySQL + API + Frontend preview. Al arrancar, `backend/database/setup.js` crea las 35 tablas + datos de referencia + demo poblado y el admin por defecto.
> - URL: **http://localhost:5173** (frontend), **http://localhost:5000** (API).
> - Si el Vite muestra errores viejos: `docker restart jadda_frontend`.
> - Para volver a dev: cierra la terminal o `$env:MODE = ""` + `docker compose up`.

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:5000 |
| MySQL    | localhost:3306 |

### Sin Docker (solo para desarrollo sin preview)

```bash
# Backend (requiere MySQL en localhost:3306)
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

### Cuenta de administrador (seed)

`setup.js` crea la cuenta admin a partir de las variables `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `backend/.env` (placeholders en `backend/.env.example`; los valores reales **no** se publican en el repositorio — configúrelos en su `.env` y cámbielos desde *Perfil → Seguridad* tras el primer acceso). El panel se abre en `/admin`.

---

## 🧪 Pruebas y calidad

| Suite | Comando | Estado |
|-------|---------|--------|
| Backend (Vitest, MySQL mockeado) | `pnpm --prefix backend test` | 28 pruebas |
| Frontend (Vitest + Testing Library) | `pnpm --prefix frontend test` | 51 pruebas |
| Cobertura con umbrales | `pnpm test:coverage` | Reportes en `backend/coverage/` y `frontend/coverage/` |
| E2E de humo (Playwright Core) | `pnpm test:e2e` | 23 checks contra la app levantada |
| Lint | `pnpm --prefix frontend lint` | 0 errores (advertencias heredadas) |
| TypeScript | `pnpm --prefix frontend exec tsc -b` | Sin errores |

> `pnpm test:e2e` requiere los contenedores arriba (`jadda_frontend`, `jadda_backend`, `jadda_mysql`) y un navegador Edge/Chromium. Se puede apuntar a otro entorno con `API_URL`, `WEB_URL`, `ADMIN_EMAIL`, `ADMIN_PASS`, `VENDOR_EMAIL` y `VENDOR_PASS`.
>
> El CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta lint, typecheck, pruebas con cobertura, build y el humo E2E contra un MySQL efímero.

---

## 📚 Documentación

| Recurso | Contenido |
|---------|-----------|
| [`docs/README.md`](docs/README.md) | Índice general con tabla de estados y stack |
| [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md) | Estado real: implementado, parcial y pendiente (actualizado 2026-10) |
| [`docs/backend-usuario.md`](docs/backend-usuario.md) | Documentación técnica del backend (controllers, rutas, BD) |
| [`docs/plan de trabajo.md`](docs/plan%20de%20trabajo.md) | Fases, módulos y cronograma |
| [`docs/Restricciones del Proyecto.md`](docs/Restricciones%20del%20Proyecto.md) | Stack, seguridad y workflow |
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

- `backend/.env.example` — credenciales MySQL, secretos OAuth, correo SMTP, `ADMIN_EMAIL`/`ADMIN_PASSWORD` y `FRONTEND_URL`.
- `frontend/.env.example` — `VITE_API_URL`.

> Los `.env` reales están en `.gitignore`; los ejemplos contienen solo placeholders.

---

## 👥 Equipo

| Integrante |
|------------|
| Yeison Fernandez |
| Duglas Montenegro |
| Miguel Castro |
| Juan Arias |

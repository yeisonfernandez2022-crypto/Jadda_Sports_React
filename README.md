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

La base de datos se **auto-configura al arrancar** (crea tablas + datos de referencia), lo que hace el proyecto 100 % portable: basta `docker compose up`.

---

## ✨ Funcionalidades destacadas

### Usuario
- Catálogo con búsqueda por prefijo, filtros por categoría/precio y selector de variantes (color + talla)
- Carrito flotante con minicarrito y checkout seguro (total recalculado 100 % en el servidor)
- Envío real por departamento (gratis a partir de $200.000) y dirección de pedido
- Cuenta con verificación por **código de 6 dígitos** (15 min), recuperación de contraseña y cooldowns anti-spam
- Login social (Google / Facebook) y foto de perfil subida desde el navegador
- Perfil completo: datos, seguridad (última conexión), direcciones, métodos de pago guardados, mis compras
- **Factura PDF** descargable y adjunta al email de confirmación (con imágenes incrustadas)
- Cancelar pedido, devoluciones (aprobación admin con reingreso de stock) y notificaciones de estado (email + in-app)
- Reseñas con estrellas, favoritos con deshacer, recientemente vistos y **recomendaciones por compras previas**
- **Retos deportivos** con evidencias en foto/video y cupones de descuento `RETO-XXXX-XXXX`
- **Planes de entrenamiento** con progreso de días
- Aviso de reposición de stock ("Avísame cuando vuelva"), compartir en redes sociales, newsletter, contacto y PQRS

### Administrador
- **Dashboard rediseñado**: KPIs (ingresos/pedidos 30 días), tarjeta HOY con % vs ayer, gráfica de ventas 30 días, top 5 más vendidos, pendientes por revisar
- **Productos**: tabla con búsqueda, filtro por categoría, columnas ordenables y paginación; editor con **galería de imágenes ordenable** (portada 1ª) y **vista previa como cliente** del detalle
- Órdenes con cambio de estado/envío (notifica al cliente) y factura PDF
- Retos (aprobar/rechazar evidencias), devoluciones, CRUD de categorías
- Reportes de ventas por rango de fechas y ranking de más vendidos

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
                        │  33 tablas      │
                        └─────────────────┘
```

- **Frontend** — SPA con renderizado cliente, lazy-loading de rutas, ErrorBoundary y páginas de loading/404 propias.
- **Backend** — API monolítica: sesiones persistentes en MySQL (express-session), Passport.js para OAuth, rate limiting en memoria, RBAC (`esAdmin`).
- **Base de datos** — 33 tablas creadas automáticamente en cada arranque por `backend/database/setup.js` (idempotente + migraciones), con `schema.sql` para BD nuevas.
- **Móvil** — App Expo que consume el mismo backend.

---

## 🚀 Inicio rápido

### Con Docker (recomendado)

```bash
docker compose up -d --build
```

> Al arrancar, `setup.js` crea las tablas, los datos de referencia y el usuario administrador por defecto. Si el Vite dev server muestra errores de parseo viejos: `docker restart jadda_frontend`.

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:5000 |
| MySQL    | localhost:3306 |

### Sin Docker

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

# Móvil
cd movil
pnpm install
npx expo start
```

### Cuenta de administrador (seed)

| Campo | Valor |
|-------|-------|
| Correo | `yeison` (configurable con `ADMIN_EMAIL` en `.env`) |
| Contraseña | `Losquiero7` (configurable con `ADMIN_PASSWORD`) |
| Acceso | Panel `/admin` |

---

## 📚 Documentación

| Recurso | Contenido |
|---------|-----------|
| [`docs/README.md`](docs/README.md) | Índice general con tabla de estados y stack |
| [`docs/backend-usuario.md`](docs/backend-usuario.md) | Documentación técnica del backend (controllers, rutas, BD) |
| [`docs/plan de trabajo.md`](docs/plan%20de%20trabajo.md) | Fases, módulos y cronograma |
| [`docs/Restricciones del Proyecto.md`](docs/Restricciones%20del%20Proyecto.md) | Stack, seguridad y workflow |
| [`docs/RFs/`](docs/RFs/) | 49 Requisitos funcionales (RF-001…RF-049) |
| [`docs/HUs/`](docs/HUs/) | 39 Historias de usuario (HU-001…HU-039) |
| [`docs/RNFs/`](docs/RNFs/) | 15 Requisitos no funcionales (RNF-001…RNF-015) |
| [`docs/diagrams/`](docs/diagrams/) | Diagramas de arquitectura, BD y flujos |

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

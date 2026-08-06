# JADDA SPORTS

Plataforma de comercio electrónico especializada en artículos deportivos. Compuesta por frontend web (React + Vite), API REST (Node.js + Express) y app móvil (React Native + Expo).

---

## Stack Tecnológico

| Capa | Tecnologías |
|------|------------|
| **Frontend Web** | React 19, TypeScript, Vite 8, Bootstrap 5, React Router 7 |
| **Backend** | Node.js 22, Express 5, MySQL 8, Passport.js, express-session |
| **App Móvil** | React Native 0.81, Expo 54, Expo Router |
| **Infraestructura** | Docker, Docker Compose |

---

## Arquitectura

```
                    ┌─────────────┐
                    │  Frontend    │
                    │  :5173       │
                    └──────┬──────┘
                           │ HTTP (fetch/axios)
                    ┌──────▼──────┐
                    │  Backend    │
                    │  :5000      │
                    └──────┬──────┘
                           │ mysql2
                    ┌──────▼──────┐
                    │  MySQL 8    │
                    │  :3306      │
                    └─────────────┘
```

- **Frontend**: SPA con React, renderizado del lado del cliente, consumo de API REST.
- **Backend**: API REST monolítica con Express, sesiones persistentes en MySQL, autenticación Passport.
- **Base de datos**: MySQL 8 con 33 tablas, auto-creación en startup vía `setup.js`.
- **Móvil**: App Expo conectada al mismo backend.

---

## Inicio Rápido

### Con Docker (recomendado)

```bash
docker compose up -d --build
o
pnpm build; $env:MODE = "preview"; docker compose up

```

| Servicio | URL |
|----------|-----|
| Backend | `http://localhost:5000` |
| Frontend | `http://localhost:5173` |
| MySQL | `localhost:3306` |

> Al arrancar, el backend ejecuta `setup.js` que crea todas las tablas y datos de referencia automáticamente.

### Sin Docker

```bash
# Backend
cd backend
cp .env.example .env   # editar credenciales
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

---

## Funcionalidades

### Usuario
- Catálogo con búsqueda por prefijo (`LIKE 'word%'`)
- Variantes de producto (color, talla) con selector modal
- Carrito de compras flotante (draggable, aparece solo con items)
- Autenticación local (email + password) y OAuth (Google, Facebook)
- Registro con verificación por código de 6 dígitos
- Perfil de usuario (editar datos, cambiar contraseña)
- Direcciones de envío múltiples
- Reseñas de productos con estrellas
- Favoritos sincronizados con backend
- Historial de productos vistos
- Órdenes de compra con detalle y seguimiento de envío
- Factura por email con imágenes de productos
- Planes de entrenamiento personalizados según compras
- Retos deportivos con cupones de descuento
- PQRS (peticiones, quejas, reclamos)

### Administrador
- Dashboard con estadísticas (productos, órdenes, usuarios, ingresos)
- Gestión de productos (CRUD completo con variantes e imágenes)
- Gestión de órdenes (cambio de estado, detalle expandible)
- Gestión de usuarios (rol, confirmación, proveedor OAuth)

---

## Documentación

Toda la documentación del proyecto está en la carpeta `docs/`:

| Archivo | Contenido |
|---------|-----------|
| `docs/README.md` | Índice general con tabla de estados |
| `docs/backend-usuario.md` | Documentación técnica del backend (controllers, rutas, BD) |
| `docs/plan de trabajo.md` | Fases del proyecto, módulos y cronograma |
| `docs/Restricciones del Proyecto.md` | Stack, seguridad y workflow |
| `docs/RFs/` | Requisitos funcionales (RF-001 a RF-039) |
| `docs/HUs/` | Historias de usuario (HU-001 a HU-039) |
| `docs/RNFs/` | Requisitos no funcionales (RNF-001 a RNF-011) |
| `docs/diagrams/` | Diagramas de arquitectura, BD y flujos |

---

## Variables de Entorno

Ver `backend/.env.example` y `frontend/.env.example` para la lista completa de variables requeridas.

---

## Equipo

- **Yeison Fernandez**
- **Duglas Montenegro**
- **Miguel Castro**
- **Juan Arias**

# Jadda Sports

Plataforma de tienda deportiva con frontend web (React + Vite), backend API (Node.js + Express), y app móvil (React Native + Expo).

## Stack

| Capa | Tecnologías |
|------|-------------|
| Frontend web | React 19, TypeScript, Vite, Bootstrap 5, React Router 7, Axios |
| Backend | Node.js, Express 5, MySQL 8, Passport.js, JWT, Nodemailer |
| Móvil | React Native 0.81, Expo 54, Expo Router, Axios |
| Infra | Docker, Docker Compose |

## Estructura

```
jadda-sports/
├── frontend/          # Web app (React + Vite)
├── backend/           # API REST (Express)
├── movil/             # App móvil (Expo)
├── docker-compose.yml
└── README.md
```

## Docker (producción local)

```bash
docker compose up -d --build
```

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- MySQL: `localhost:3306`

Al arrancar, el backend ejecuta `setup.js` que crea tablas + seed de datos automáticamente.

### Resetear base de datos

```bash
docker compose down -v
docker compose up -d
```

## Sin Docker

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

## Variables de Entorno (backend)

```
DB_HOST=database
DB_USER=root
DB_PASSWORD=tu_password_secreto
DB_NAME=jadda_sports_db
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
```

## Funcionalidades

- Catálogo con búsqueda, filtros, ordenamiento
- Variantes de producto (color, talla) con selector modal
- Carrito de compras flotante (draggable)
- Autenticación: local, Google OAuth, Facebook OAuth
- Registro con verificación por email
- Reseñas de productos con estrellas
- Favoritos
- Pasarela de pago (PSE / Nequi / tarjeta)
- PQR
- App móvil con Expo (inicio, catálogo, login, registro)

## Equipo

- Yeison Fernandez
- Duglas Montenegro
- Miguel Castro
- Juan Arias

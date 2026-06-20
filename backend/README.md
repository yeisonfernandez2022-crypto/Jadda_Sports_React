# Backend - Jadda Sports API

API REST con Node.js, Express 5, MySQL 8.

## Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **DB:** MySQL 8 con `mysql2`
- **Auth:** Passport.js (Google, Facebook), JWT, bcrypt
- **Sesiones:** express-session + MySQL store
- **Email:** Nodemailer
- **Hot reload:** Nodemon

## Rutas

| Ruta | Descripción |
|------|-------------|
| `GET /api/productos` | Listar productos (con búsqueda, categoría) |
| `GET /api/productos/:id` | Detalle con imágenes, variantes, características |
| `GET /api/productos/:id/variantes` | Variantes del producto |
| `GET /api/productos/:id/resenas` | Reseñas del producto |
| `POST /api/productos/:id/resenas` | Agregar reseña (autenticado) |
| `POST /api/auth/registro` | Registro de usuario |
| `POST /api/auth/login` | Login (local) |
| `GET /api/auth/usuario` | Obtener usuario autenticado |
| `GET /api/auth/logout` | Cerrar sesión |
| `GET /api/auth/google` | Login con Google |
| `GET /api/auth/facebook` | Login con Facebook |
| `POST /api/carrito` | Agregar al carrito |
| `GET /api/carrito` | Obtener carrito del usuario |
| `PUT /api/carrito/:id` | Actualizar cantidad |
| `DELETE /api/carrito/:id` | Eliminar item del carrito |
| `POST /api/checkout` | Procesar pago |
| `GET /api/compras` | Historial de compras |
| `POST /api/direcciones` | CRUD direcciones |
| `POST /api/favoritos` | CRUD favoritos |
| `POST /api/cupones` | Validar cupón |
| `POST /api/pqr` | Crear PQR |
| `GET /api/productos/relacionados/:id` | Productos relacionados |

## Inicio rápido

```bash
pnpm install
pnpm dev
```

Requiere MySQL corriendo en `localhost:3306`. Las tablas y seed se crean automáticamente al arrancar via `setup.js`.

## Variables de Entorno (`.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_HOST` | `database` | Host MySQL |
| `DB_USER` | `root` | Usuario MySQL |
| `DB_PASSWORD` | `tu_password_secreto` | Contraseña MySQL |
| `DB_NAME` | `jadda_sports_db` | Nombre BD |
| `PORT` | `5000` | Puerto servidor |
| `JWT_SECRET` | `yeison123456` | Secreto JWT |
| `GOOGLE_CLIENT_ID` | — | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth |
| `FACEBOOK_CLIENT_ID` | — | Facebook OAuth |
| `FACEBOOK_CLIENT_SECRET` | — | Facebook OAuth |
| `EMAIL_USER` | — | Correo Nodemailer |
| `EMAIL_PASS` | — | App password |
| `SESSION_SECRET` | `jadda_secret_key` | Secreto sesión |

## Docker

El backend está dockerizado. Ver `docker-compose.yml` en la raíz del proyecto.

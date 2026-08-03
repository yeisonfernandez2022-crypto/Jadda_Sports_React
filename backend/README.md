# Backend — JADDA SPORTS API

API REST para tienda deportiva. Node.js + Express 5 + MySQL 8.

---

## Stack

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Node.js | 22 | Runtime |
| Express | 5 | Framework HTTP |
| MySQL | 8 | Base de datos relacional |
| mysql2 | 3.x | Driver MySQL con pool |
| Passport.js | 0.7 | Estrategias OAuth (Google, Facebook) |
| express-session | 1.x | Sesiones persistentes |
| express-mysql-session | 3.x | Almacén de sesiones en MySQL |
| bcryptjs | 2.x | Hash de contraseñas |
| Nodemailer | 6.x | Envío de correos (Gmail) |
| Nodemon | 3.x | Recarga automática en desarrollo |

---

## Rutas de la API

### Autenticación (base: `/api/auth`)

| Método | Ruta | Auth | Body / Params | Respuesta |
|--------|------|------|---------------|-----------|
| POST | `/registro` | No | `{nombre, apellido, correo, password, telefono}` | `{message}` |
| POST | `/login` | No | `{email, password}` | `{message, nombre, usuario}` |
| POST | `/confirmar` | No | `{email, codigo}` | `{message}` |
| POST | `/reenviar-codigo` | No | `{email}` | `{message}` |
| POST | `/recuperar-password` | No | `{email}` | `{message}` |
| POST | `/verificar-codigo` | No | `{email, codigo}` | `{message}` |
| POST | `/update-password` | No | `{email, codigo, password}` | `{message}` |
| POST | `/cambiar-password` | Sí | `{password_actual, password_nueva}` | `{ok, msg}` |
| GET | `/perfil` | Sí | — | `{ok, usuario}` |
| PUT | `/perfil` | Sí | `{nombre, apellido, telefono, ...}` | `{ok, msg}` |
| POST | `/logout` | Sí | — | `{ok, msg}` |
| GET | `/google` | No | query: `from` | Redirección Google |
| GET | `/google/callback` | No | query: `state` | Redirección frontend |
| GET | `/google-client-id` | No | — | `{clientId}` |

### Productos (base: `/api/productos`)

| Método | Ruta | Auth | Parámetros | Respuesta |
|--------|------|------|------------|-----------|
| GET | `/` | No | query: `search` | Array de productos |
| GET | `/:id` | No | — | Producto + imágenes + variantes |
| GET | `/relacionados/:id` | No | — | Array (4 productos) |
| GET | `/categorias` | No | — | Array de categorías |
| GET | `/descuentos` | No | — | Descuentos vigentes |
| GET | `/:id/variantes` | No | — | Array de variantes |
| POST | `/:id/variantes` | No | `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{ID_VARIANTE}` |
| PUT | `/variantes/:idVariante` | No | `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{message}` |
| DELETE | `/variantes/:idVariante` | No | — | `{message}` |
| GET | `/:id/caracteristicas` | No | — | Array de características |
| POST | `/:id/caracteristicas` | No | `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{ID_CARACTERISTICA}` |
| GET | `/caracteristicas/:idCaracteristica` | No | — | Objeto característica |
| PUT | `/caracteristicas/:idCaracteristica` | No | `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{message}` |
| DELETE | `/caracteristicas/:idCaracteristica` | No | — | `{message}` |
| GET | `/:id/resenas` | No | — | Array de reseñas |
| POST | `/:id/resenas` | Sí | `{comentario, calificacion}` | `{message}` |
| POST | `/` | No | Body completo de producto | `{message, id}` |
| PUT | `/:id` | No | Body completo | `{message}` |
| DELETE | `/:id` | No | — | `{message}` |

### Carrito (base: `/api/carrito`)

| Método | Ruta | Auth | Parámetros | Respuesta |
|--------|------|------|------------|-----------|
| GET | `/` | Sí | — | Array del carrito |
| POST | `/agregar` | Sí | `{id_producto, id_variante, cantidad}` | `{ok, msg}` |
| PUT | `/actualizar/:id_carrito` | Sí | `{cantidad}` | `{ok, msg}` |
| DELETE | `/eliminar/:id_carrito` | Sí | — | `{ok, msg}` |

### Checkout (base: `/api/checkout`)

| Método | Ruta | Auth | Parámetros | Respuesta |
|--------|------|------|------------|-----------|
| POST | `/procesar` | Sí | `{metodoPago, paymentData, totalFinal, direccion, ...}` | `{ok, ventaId, referencia, planGenerado}` |

### Compras (base: `/api/compras`)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/` | Sí | Array de compras con productos |

### Direcciones (base: `/api/direcciones`)

| Método | Ruta | Auth | Parámetros |
|--------|------|------|------------|
| GET | `/` | Sí | — |
| POST | `/` | Sí | `{direccion, ciudad, departamento, ...}` |
| PUT | `/:id_direccion` | Sí | Mismo body |
| DELETE | `/:id_direccion` | Sí | — |

### Favoritos (base: `/api/favoritos`)

| Método | Ruta | Auth | Parámetros |
|--------|------|------|------------|
| GET | `/` | Sí | — |
| POST | `/` | Sí | `{id_producto}` |
| DELETE | `/:id_favorito` | Sí | — |

### Historial (base: `/api/historial`)

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/` | Sí |
| POST | `/` | Sí |

### Cupones (base: `/api/cupones`)

| Método | Ruta | Auth | Parámetros |
|--------|------|------|------------|
| POST | `/validar` | No | `{codigo}` |

### PQR (base: `/api/pqr`)

| Método | Ruta | Auth | Parámetros |
|--------|------|------|------------|
| POST | `/` | Sí | `{tipo, asunto, descripcion}` |

### Planes (base: `/api/planes`)

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/` | Sí |
| POST | `/generar` | Sí |
| POST | `/marcar-dia/:id_plan` | Sí |

### Retos (base: `/api/retos`)

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/` | Sí |
| GET | `/mis-retos` | Sí |
| GET | `/evidencias/:id_reto_usuario` | Sí |
| POST | `/unirse/:id_reto` | Sí |
| POST | `/progreso/:id_reto_usuario` | Sí |
| POST | `/completar/:id_reto_usuario` | Sí |
| GET | `/admin/evidencias` | Sí |
| POST | `/admin/evidencias/:id_evidencia/aprobar` | Sí |
| POST | `/admin/evidencias/:id_evidencia/rechazar` | Sí |

### Admin (base: `/api/admin`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/dashboard` | Sí | Estadísticas + órdenes recientes |
| GET | `/compras` | Sí | Todas las órdenes con detalle |
| PUT | `/compras/:id/estado` | Sí | Cambiar estado de orden |
| GET | `/usuarios` | Sí | Listar todos los usuarios |

### Proveedores (base: `/api/proveedores`)

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/` | No |

---

## Inicio Rápido

```bash
pnpm install
pnpm dev     # Dev con nodemon en :5000
```

Requiere MySQL en `localhost:3306`. Las tablas y datos de referencia se crean automáticamente al iniciar.

---

## Variables de Entorno (`.env`)

| Variable | Default | Requerido | Descripción |
|----------|---------|-----------|-------------|
| `DB_HOST` | `database` | Sí | Host MySQL |
| `DB_USER` | `root` | Sí | Usuario MySQL |
| `DB_PASSWORD` | `tu_password_secreto` | Sí | Contraseña MySQL |
| `DB_NAME` | `jadda_sports_db` | Sí | Nombre de BD |
| `PORT` | `5000` | No | Puerto del servidor |
| `SESSION_SECRET` | `jadda_secret_key` | No | Secreto para cookies de sesión |
| `GOOGLE_CLIENT_ID` | — | Para OAuth | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | — | Para OAuth | Google OAuth 2.0 Secret |
| `FACEBOOK_CLIENT_ID` | — | Para OAuth | Facebook App ID |
| `FACEBOOK_CLIENT_SECRET` | — | Para OAuth | Facebook App Secret |
| `EMAIL_USER` | — | Para emails | Correo Gmail para Nodemailer |
| `EMAIL_PASS` | — | Para emails | App password de Google |

---

## Docker

El backend está dockerizado. Ver `docker-compose.yml` en la raíz del proyecto.

```bash
# Reconstruir y levantar
docker compose up -d --build

# Ver logs del backend
docker logs jadda_backend -f

# Resetear base de datos
docker compose down -v
docker compose up -d
```

---

## Base de Datos

- **Motor:** MySQL 8
- **Pool de conexiones:** `mysql2.createPool` (máx. 10 conexiones)
- **Reintentos:** Hasta 5 intentos con 2s de espera para sincronizar con Docker
- **Auto-setup:** `database/setup.js` crea 22 tablas + seed data en cada inicio
- **Sesiones:** Almacenadas en MySQL vía `express-mysql-session` (expiración 24h)

Para más detalles sobre cada tabla y sus columnas, ver `docs/backend-usuario.md` en la raíz del proyecto.

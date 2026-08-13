# ⚙️ Backend — JADDA SPORTS API

> API REST monolítica para la tienda deportiva Jadda Sports. **Node.js 22 + Express 5 + MySQL 8**, con sesiones persistentes, autenticación OAuth y auto-setup de base de datos.

![Node](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8-4479a1?logo=mysql&logoColor=white)
![Passport](https://img.shields.io/badge/Passport.js-0.7-34e27a)

---

## 🧱 Stack

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Node.js | 22 | Runtime |
| Express | 5 | Framework HTTP |
| MySQL | 8 | Base de datos relacional |
| mysql2 | 3.x | Driver con pool de conexiones |
| Passport.js | 0.7 | Estrategias OAuth (Google, Facebook) |
| express-session | 1.x | Sesiones persistentes en cookie |
| express-mysql-session | 3.x | Almacén de sesiones en MySQL |
| bcryptjs | 2.x | Hash de contraseñas |
| Nodemailer | 6.x | Correos transaccionales (Gmail SMTP) |
| multer | 2.x | Subida multipart de evidencias (retos) |
| pdfkit | — | Generación de facturas PDF |
| Nodemon | 3.x | Recarga automática en desarrollo |

---

## 🔌 Rutas de la API

### Autenticación (base: `/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/registro` | No | Registro (valida email/nombre/password, genera usuario único) |
| POST | `/login` | No | Login con sesión (rate limit 10/15min) |
| POST | `/social-login` | No | Login/registro social (Google, Facebook) |
| POST | `/confirmar` | No | Confirmar cuenta con código de 6 dígitos |
| POST | `/reenviar-codigo` | No | Reenviar código de verificación |
| POST | `/recuperar-password` | No | Solicitar recuperación de contraseña |
| POST | `/verificar-codigo` | No | Validar código de recuperación |
| POST | `/update-password` | No | Actualizar contraseña con código |
| POST | `/cambiar-password` | Sí | Cambiar contraseña (valida la actual) |
| POST | `/cambiar-email` | Sí | Solicitar cambio de correo (envía código al nuevo) |
| POST | `/confirmar-cambio-email` | Sí | Confirmar el cambio de correo |
| POST | `/verificar-password` | Sí | Verificar contraseña actual (acciones sensibles) |
| GET | `/perfil` | Sí | Perfil del usuario (incluye última conexión/ubicación) |
| PUT | `/perfil` | Sí | Actualizar datos personales (validado por campo) |
| POST | `/foto` | Sí | Subir foto de perfil (base64 ≤ 10 MB) |
| GET/POST | `/google`, `/google/callback` | No | OAuth con Google |
| GET/POST | `/facebook`, `/facebook/callback` | No | OAuth con Facebook |
| POST | `/logout` | Sí | Cerrar sesión |

### Productos (base: `/api/productos`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | No | Listado con búsqueda prefix, stock, rating |
| GET | `/:id` | No | Producto + imágenes ordenadas + variantes |
| GET | `/relacionados/:id` | No | 4 productos relacionados |
| GET | `/recomendados` | Sí | Recomendaciones por compras previas (RF-038) |
| GET | `/categorias` | No | Categorías (con descripción y total de productos) |
| POST / PUT / DELETE | `/categorias`, `/categorias/:id` | Admin | CRUD de categorías (RF-027, nombre único) |
| GET | `/descuentos` | No | Descuentos vigentes |
| POST | `/imagenes` | Admin | Subida base64 → con `idProducto` a `Producto_NN/img_N.ext` (carpeta del producto), sin él a `/subidas/` |
| POST | `/` | Admin | Crear producto (acepta `IMAGENES[]` y variantes) |
| PUT | `/:id` | Admin | Actualizar producto (reemplaza imágenes con ORDEN 1..N) |
| DELETE | `/:id` | Admin | Eliminar producto |
| GET | `/:id/variantes` | No | Variantes del producto |
| POST | `/:id/variantes` | Admin | Agregar variante |
| PUT / DELETE | `/variantes/:idVariante` | Admin | Actualizar / eliminar variante |
| POST | `/variantes/:idVariante/suscribir` | Sí | Suscribirse al aviso de reposición (RF-035) |
| GET | `/variantes/:idVariante/suscripcion` | Sí | Estado de la suscripción |
| DELETE | `/variantes/:idVariante/suscribir` | Sí | Cancelar suscripción |
| GET | `/:id/caracteristicas` | No | Ficha técnica |
| POST / PUT / DELETE | `/caracteristicas*` | Admin | CRUD de características |
| GET / POST | `/:id/resenas` | — | Reseñas (crear requiere sesión) |

### Carrito (base: `/api/carrito`)

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/` | Sí |
| POST | `/agregar` | Sí (`{id_producto, id_variante, cantidad}`) |
| PUT | `/actualizar/:id_carrito` | Sí |
| DELETE | `/eliminar/:id_carrito` | Sí |

### Checkout (base: `/api/checkout`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/procesar` | Sí | Transacción completa: valida stock, cupones y descuentos; total calculado en servidor; genera venta, envío, factura PDF adjunta al email y plan de entrenamiento |

### Compras (base: `/api/compras`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | Sí | Compras con productos + variantes |
| GET | `/:id` | Sí | Compra individual |
| GET | `/:id/factura` | Sí | Factura PDF (RF-021) |
| PUT | `/:id/direccion` | Sí | Actualizar dirección de envío |
| POST | `/:id/cancelar` | Sí | Cancelar pedido (notifica email + in-app) |

### Envío (base: `/api/envio`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/calcular?departamento=&subtotal=` | No | Tarifa por departamento (gratis ≥ $200.000) |

### Direcciones / Favoritos / Historial

| Base | Rutas | Auth |
|------|-------|------|
| `/api/direcciones` | GET `/`, POST `/`, PUT `/:id_direccion`, DELETE `/:id_direccion` | Sí |
| `/api/favoritos` | GET `/`, POST `/`, DELETE `/:id_favorito` | Sí |
| `/api/historial` | GET `/`, POST `/` | Sí |

### Retos (base: `/api/retos`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/`, `/mis-retos`, `/evidencias/:id_reto_usuario` | Sí | Retos, inscripciones y evidencias propias |
| POST | `/unirse/:id_reto` | Sí | Unirse a un reto |
| POST | `/progreso/:id_reto_usuario` | Sí | Reportar avance (multipart `materiales[]` foto/video hasta 100 MB o base64 legacy) |
| DELETE | `/evidencias/:id_evidencia` | Sí | Eliminar avance propio (solo si sigue en revisión) |
| GET | `/admin/evidencias` | Admin | Evidencias por revisar |
| POST | `/admin/evidencias/:id/aprobar` · `/rechazar` | Admin | Aprobar (suma cantidad, genera cupón `RETO-`) / rechazar |

### Devoluciones (base: `/api/devoluciones`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/` | Sí | Solicitar devolución (ventas COMPLETADAS propias) |
| GET | `/` | Sí | Mis solicitudes |
| GET | `/admin` | Admin | Todas las solicitudes con cliente/producto |
| POST | `/admin/:id/procesar` | Admin | APROBADA reingresa stock + notifica; RECHAZADA solo estado |

### Admin (base: `/api/admin`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/dashboard` | Admin | KPIs, hoy vs ayer, serie 30 días, top 5, órdenes/usuarios recientes |
| GET | `/pendientes` | Admin | Contadores: evidencias, devoluciones, stock bajo, avisos |
| GET | `/compras` | Admin | Todas las órdenes con detalle |
| PUT | `/compras/:id/estado` | Admin | Cambiar estado (notifica, RF-025) |
| PUT | `/compras/:id/envio` | Admin | Cambiar estado de envío (notifica, RF-025) |
| GET | `/compras/:id/factura` | Admin | Factura PDF |
| GET | `/reportes/ventas?desde=&hasta=` | Admin | Ingresos, órdenes, ticket, unidades, serie diaria (RF-032) |
| GET | `/analytics/mas-vendidos?desde=&hasta=&limite=` | Admin | Ranking de más vendidos (RF-034) |
| GET | `/usuarios` | Admin | Listado de usuarios |

### Otras bases

| Base | Rutas | Auth |
|------|-------|------|
| `/api/proveedores` | GET `/` | No |
| `/api/cupones` | POST `/validar` | No |
| `/api/pqr` | POST `/` | Sí |
| `/api/planes` | GET `/`, POST `/generar`, POST `/marcar-dia/:id_plan` | Sí |
| `/api/usuarios/metodos-pago` | GET `/`, POST `/`, PUT `/:id/principal`, DELETE `/:id` | Sí |
| `/api/notificaciones` | GET `/`, GET `/no-leidas`, POST `/leer-todas`, POST `/:id/leida` | Sí |
| `/api/contacto` | POST `/` | No (rate limit 5/15min) |
| `/api/newsletter` | POST `/` | No |
| `/api/devoluciones` | (ver arriba) | — |

---

## 🚀 Inicio rápido

```bash
pnpm install
pnpm dev     # Dev con nodemon en :5000
```

Requiere MySQL en `localhost:3306`. Las tablas y datos de referencia se crean automáticamente al iniciar.

---

## 🔐 Variables de entorno (`.env`)

| Variable | Default | Requerido | Descripción |
|----------|---------|-----------|-------------|
| `DB_HOST` | `database` | Sí | Host MySQL |
| `DB_USER` | `root` | Sí | Usuario MySQL |
| `DB_PASSWORD` | `tu_password_secreto` | Sí | Contraseña MySQL (debe coincidir con docker-compose) |
| `DB_NAME` | `jadda_sports_db` | Sí | Nombre de la base de datos |
| `PORT` | `5000` | No | Puerto del servidor |
| `SESSION_SECRET` | `jadda_secret_key` | No | Secreto de la cookie de sesión |
| `FRONTEND_URL` | `http://localhost:5173` | No | URL del frontend (correos y URLs absolutas) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `yeison` / `Losquiero7` | No | Credenciales del admin que crea `setup.js` |
| `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` | — | Para OAuth | Credenciales de OAuth (placeholders en `.env.example`) |
| `EMAIL_USER` / `EMAIL_PASS` | — | Para emails | Cuenta Gmail + app password para Nodemailer |

> ⚠️ Los fallos de envío de correo **nunca bloquean** el flujo principal (try/catch + logging). El rate limiting es en memoria (se reinicia con el contenedor).

---

## 🐳 Docker

```bash
# Reconstruir y levantar
docker compose up -d --build

# Logs del backend
docker logs jadda_backend -f

# Reset total (borra el volumen mysql_data; setup.js lo recrea todo)
docker compose down -v
docker compose up -d

# Reiniciar para aplicar migraciones/mounts nuevos
docker restart jadda_backend
```

---

## 🗄️ Base de datos

- **Motor:** MySQL 8, pool de `mysql2.createPool` (máx. 10 conexiones) con reintentos al arranque.
- **Auto-setup:** `database/setup.js` ejecuta 33 `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` de datos de referencia en **cada inicio** (idempotente), aplica **migraciones** (ALTERs y tablas nuevas) y garantiza la cuenta admin.
- **BD nuevas:** importar `database/schema.sql` (generado con `exportarSchema.js`) en MySQL Workbench.
- **Sesiones:** almacenadas en MySQL vía `express-mysql-session` (expiración 24 h).

Para el detalle de cada tabla y columna, ver `docs/backend-usuario.md`.

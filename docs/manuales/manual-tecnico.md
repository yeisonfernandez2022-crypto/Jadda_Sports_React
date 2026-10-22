# Manual Técnico — JADDA SPORTS

**Versión del documento:** 1.1 · 2026-10-22
**Audiencia:** desarrolladores y administradores técnicos
**Documentación complementaria:** `docs/diagrams/` (arquitectura, BD, flujos) · `docs/RFs/` (49 requisitos) · `docs/implantacion/` (despliegue)

---

## 1. Visión general

E-commerce deportivo multiplataforma: **tienda web** (React 19 + TypeScript + Vite), **app móvil** (React Native/Expo) y **panel de administración** integrado en la web, sobre un **API Express** con MySQL 8. Incluye marketplace de vendedores externos, gamificación (retos con cupones), planes de entrenamiento generados por compra, devoluciones/reembolsos con evidencias multimedia, facturación PDF, notificaciones in-app + correo y newsletter automática.

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend web | React 19, TypeScript, Vite 5, React Router, Bootstrap (parcial), SweetAlert2, react-icons |
| Móvil | React Native, Expo SDK 54, expo-router, AsyncStorage |
| Backend | Node.js 22, Express 4, express-session + Passport.js (Google/Facebook/local), multer 2.2 (subidas streaming), pdfkit (facturas), nodemailer |
| Base de datos | MySQL 8.0, driver mysql2, pool de conexiones |
| Infraestructura | Docker Compose: 3 servicios (`jadda_mysql`, `jadda_backend`, `jadda_frontend`) + volúmenes |

**Autenticación:** sesiones de servidor con cookie `httpOnly` (NO JWT). El middleware central es `verificarSesion`; roles vía `esAdmin` (rol 1) y `esVendedor` (rol 6).

## 3. Estructura del repositorio

```
backend/
├── controllers/        # lógica por dominio (auth, producto, checkout, devolucion, ...)
├── routes/             # definición de endpoints + middlewares
├── middlewares/        # esAdmin, esVendedor, rateLimiter (en memoria)
├── utils/              # envio.js, facturaPdf.js, estadoPedido.js, correo.js,
│                       # movimientosStock.js, carpetaUsuario.js
├── database/
│   ├── setup.js        # FUENTE DE VERDAD DEL ESQUEMA: crea tablas, migraciones
│   │                   # idempotentes y seeds; corre en cada arranque
│   ├── schema.sql      # exportación oficial para BD nuevas (Workbench)
│   └── exportarSchema.js
├── uploads/            # archivos subidos (bind mounts a frontend/public/images)
└── server.js           # arranque: setup → static /images → rutas → scheduler newsletter

frontend/
├── src/pages|admin|vendedor/   # vistas cliente, administración y vendedor
├── src/context/                # AuthContext, CartContext, FavoritosContext...
├── public/images/              # imágenes servidas; destino real de las subidas
└── vite.config.ts              # proxy /api,/images → backend (server Y preview)

movil/app/               # pantallas Expo Router ((tabs), producto/[id], perfil)
docs/                    # RFs, HUs, RNFs, diagramas, implantación, manuales, calidad
scripts/                 # backup.ps1, restaurar-backup.ps1, mediciones-rnf.ps1, sql/
```

## 4. Modelo de datos (35 tablas)

Esquema completo y seeds: `backend/database/schema.sql`. Agrupación funcional:

| Dominio | Tablas principales |
|---------|--------------------|
| Usuarios y acceso | USUARIOS (roles 1 admin/6 vendedor/cliente, CONFIRMADO, TOKEN/TOKEN_EXPIRA, DEBE_CAMBIAR_PASSWORD, ULTIMA_CONEXION), ROLES, DIRECCIONES, USUARIOS_METODOS_PAGO, sessions (persistencia de sesiones en BD) |
| Catálogo | CATEGORIAS, PRODUCTOS (+ID_VENDEDOR, ESTADO_PUBLICACION NULL/PENDIENTE/APROBADO/RECHAZADO), PRODUCTO_IMAGENES (ORDEN), PRODUCTO_VARIANTES (STOCK), PRODUCTO_CARACTERISTICAS, PROVEEDORES, DESCUENTOS (+USADO para cupones RETO-, MONTO_MINIMO), RESEÑAS |
| Ventas | CARRITO, VENTAS (+ID_METODO, PENDIENTE_PAGO/COMPLETADA/CANCELADA), DETALLE_VENTAS (+ID_VARIANTE), ENVIOS (ESTADO_ENVIO, COSTO_ENVIO, FECHA_ENTREGA), MOVIMIENTOS_STOCK |
| Post-venta | DEVOLUCIONES (multi-producto, estados SOLICITADA/MAS_PRUEBAS/APROBADA/RECHAZADA) + DEVOLUCIONES_EVIDENCIAS |
| Gamificación | RETOS, RETOS_USUARIOS, RETO_EVIDENCIAS (+OBSERVACION, RUTA conservada tras revisión) |
| Marketplace | SOLICITUDES_VENDEDOR, VENDEDORES |
| Comunicación | NOTIFICACIONES (globales o por usuario), AVISOS_STOCK, CHAT + CHAT_MENSAJE (soporte, vendedor y devoluciones con escalación a soporte), PQR |
| Otros | PLANTILLAS_PLANES + PLANES_USUARIO, HISTORIAL, NEWSLETTER/suscripción (JSON en backend/data/) |

Regla de oro: cualquier cambio de esquema se hace en `setup.js` (CREATE_TABLES_RAW + lista `MIGRACIONES` idempotente) y se regenera `schema.sql` con `node backend/database/exportarSchema.js`.

## 5. Mapa de API

Prefijo global `/api`. Autenticación indicada entre corchetes.

### Auth — `/api/auth`
`POST registro` (apellido obligatorio; guarda hash bcrypt del código en `TOKEN`, expira 15 min) · `POST login` [rate 10/15 min] · `POST social-login` · `POST confirmar` (código 6 dígitos) · `POST reenviar-codigo` · recuperar contraseña (`recuperar-password`, `verificar-codigo`, `update-password`) · OAuth Google/Facebook (`/google`, `/facebook` + callbacks) · [sesión] `GET perfil`, `PUT perfil`, `POST foto`, `POST cambiar-password`, `POST cambiar-email` + `confirmar-cambio-email` (valida contraseña actual), `POST verificar-password`, `POST logout`.

### Catálogo — `/api/productos`
`GET /` (búsqueda prefijo, rating, stock) · `GET categorias|descuentos|recomendados` · `GET :id`, `:id/variantes`, `:id/caracteristicas`, `:id/resenas`, `relacionados/:id` · `POST :id/resenas` [sesión] · CRUD productos/categorías/descuentos/características/variantes [esAdmin] · `POST imagenes` (JSON base64, hasta 8 imágenes de ≤6 MB por archivo) [esAdmin o esVendedor] · avisos de stock (`variantes/:id/suscribir`) [sesión].

### Carrito y checkout
`/api/carrito`: agregar/actualizar/eliminar [sesión] · `/api/checkout/procesar` [sesión]: **el servidor recalcula totales**, valida stock y cupones (compra mínima del cupón ANTES de la transacción), transacción completa (BEGIN/COMMIT/ROLLBACK) con `SELECT ... FOR UPDATE` por variante (409 si otra venta compró las últimas unidades), decrementa STOCK por variante + MOVIMIENTOS_STOCK SALIDA, genera pedido/envío/plan si aplica, correo con factura PDF adjunta. Con `PAYMENT_GATEWAY` definida la venta nace `PENDIENTE_PAGO` a la espera de confirmación por webhook (paso 6 del plan; vacío = nace `COMPLETADA` como siempre). Los vendedores (rol 6) NO pueden comprar: guard en carrito y checkout.

### Mis compras — `/api/compras` [sesión]
`GET /`, `GET :id`, `GET :id/factura` (PDF), `GET/POST :id/reembolso`, `PUT :id/direccion` (bloqueada si el envío salió), `POST :id/cancelar` (RN: no cancelable en EN_CAMINO/ENTREGADO; reingresa stock con movimiento ENTRADA).

### Devoluciones — `/api/devoluciones`
[sesión] crear solicitud multi-producto con evidencias (multer: hasta 5 archivos de 25 MB, MIME real por magic bytes), listar mis solicitudes, agregar evidencias en MAS_PRUEBAS, eliminar evidencia pendiente. [esAdmin] `GET admin`, `POST admin/:id/procesar` con 4 decisiones: devolver (reingresa stock + movimiento) / reembolsar / mas_pruebas / rechazar, con observación y notificación al usuario. Los vendedores gestionan las solicitudes de SUS productos (`/devoluciones` vendedor) y negocian en chat; la escalación a soporte JADDA crea hilos separados.

### Retos — `/api/retos`
[sesión] listado, `unirse/:id_reto`, `progreso/:id_reto_usuario` (multipart en `materiales`: máx 5 archivos de 25 MB — límites centralizados en `utils/validarSubida.js` — o legacy base64), mis retos/evidencias, eliminar avance pendiente. [esAdmin] revisión de evidencias (aprobar/rechazar con observación opcional; el material se conserva). Al completar la meta se emite cupón `RETO-XXXX-XXXX` de un solo uso.

### Admin — `/api/admin` [esAdmin en todo el router]
Dashboard agregado, pendientes (badges), órdenes (`compras` + estado venta/envío/factura/eliminar-canceladas), reportes (`reportes/ventas`, `reportes/excel`, `reportes/pdf` descargables, `analytics/mas-vendidos`), usuarios (`usuarios`, `usuarios/:id` detalle completo), productos de vendedor (`aprobar|rechazar`).

### Vendedor — `/api/vendedor`
Público: `POST solicitud` (empresa/NIT opcionales para vendedor informal, rate 10/15 min). [sesión] `GET solicitud`. [esVendedor] mi-tienda (KPIs), CRUD de sus productos (pasan a PENDIENTE hasta aprobación del admin), ventas (gestiona estado de SUS ventas), devoluciones de sus productos, chats, `reportes/excel|pdf`, empresa. [esAdmin] solicitudes + procesar (crea usuario rol 6 con contraseña temporal obligatoria a cambiar).

### Chat — `/api/chat` [sesión]
`iniciar` (SOPORTE, VENDEDOR por producto, DEVOLUCION por solicitud — idempotente), `conversaciones`, `no-leidos` (badge, por rol), `:id/mensajes` (GET+POST, filtro de groserías con asteriscos), `:id/escalar` (separado por PARTE: hilos individuales con JADDA, cerrando el hilo de acuerdo).

### Otros
`/health` + `/api/health` (sondas de disponibilidad, exentas del rate limiter) · `/api/envio/calcular` · `/api/notificaciones` (timbre; admin ve globales+propias) · `/api/newsletter` (suscripción pública, desuscripción, admin: suscritos + envío manual, scheduler cada `NEWSLETTER_INTERVAL_HORAS`) · `/api/contacto` (rate 5/15 min), `/api/pqr` · `/api/favoritos`, `/api/historial`, `/api/planes` (listar, generar, marcar-día), `/api/cupones` (`validar` + `disponibles` para el panel del checkout), `/api/metodos-pago`, `/api/proveedores`.

## 6. Seguridad implementada

| Mecanismo | Dónde |
|-----------|-------|
| Contraseñas bcrypt | authController |
| Sesiones cookie httpOnly + Passport | config/passport.js, server.js |
| RBAC | esAdmin/esVendedor aplicados por router |
| Rate limiting por IP (en memoria) | middlewares/rateLimiter.js — login 10/15 min, registro 5/15 min, contacto 5/15 min, etc.; límite global `{ventanaMs: 15 min, max: 10 por IP}` en server.js (desactivable con DISABLE_RATE_LIMIT) |
| Anti-enumeración | login devuelve mensaje único aunque el correo no exista |
| Validaciones de servidor | totales de checkout, stock, cupones usados, formatos email/teléfono/usuario |
| XSS en UI | escapeHtml antes de interpolar en Swal html |
| Menor privilegio BD | scripts/sql/usuarios-produccion.sql (jadda_app sin DROP ni grants globales) |
| Archivos sensibles fuera de git | .gitignore: `.env`, `mysql_data/`, `backups/` |

**Seguridad adicional (2026-10-21):** CSRF por verificación de Origin en mutaciones (`middlewares/proteccionOrigen.js`, 403 si el origin es ajeno o "null"), CORS configurable (`CORS_ORIGINS` + `config/origenesAdmitidos.js`), `trust proxy` para el rate limiter detrás de nginx, id de correlación `X-Request-Id` en logs y respuestas de error, cabeceras helmet, error handler que honra `err.status` (400/413/429 reales en vez de 500 genérico) y sondas `/health` + `/api/health` (la primera exenta del rate limiter; healthchecks de Docker en compose dev/prod).

## 7. Convenciones técnicas relevantes

- **Subidas**: con `CLOUDINARY_URL` configurada, las imágenes/videos se guardan en Cloudinary (`jadda/productos/*`, `jadda/perfiles/*`, `jadda/retos/*`, `jadda/devoluciones/*`); si falta o falla, multer escribe en `backend/uploads/*` (bind-mounts de `frontend/public/images/*`) y el backend sirve esas rutas con express.static. Límites: evidencias de retos/devoluciones 25 MB × 5 archivos con validación centralizada en `utils/validarSubida.js` (tipo real por magic bytes + coherencia MIME ↔ extensión); imágenes de producto ≤6 MB por archivo, hasta 8 por petición (`controllers/imagenController.js`).
- **Carpetas por usuario**: `uploads/usuarios/<usuario>/perfil|retos/r<id>/` (fallback local); en Cloudinary `jadda/perfiles/<usuario>/` y `jadda/retos/<usuario>/r<id>/`.
- **Correos**: nunca bloquean la respuesta (try/catch); imágenes incrustadas como data-URI leídas del disco.
- **Números de pedido**: hash estable de Knuth sobre ID_VENTA (sin columnas extra).
- **Proxy**: `vite.config.ts` replica el proxy en `server` y en `preview` (imprescindible para modo producción local).

## 8. Operación

- Despliegue y actualización: `docs/implantacion/03-guia-despliegue.md`.
- Respaldos/restauración verificados: `docs/implantacion/02-plan-migracion-respaldos.md`.
- Mediciones de rendimiento: `docs/calidad/resultados-mediciones.md`.
- Logs: `docker logs jadda_backend` / `docker logs jadda_frontend`.

## 9. Deuda técnica conocida

| Ítem | Impacto | Plan |
|------|---------|------|
| Rate limiter en memoria | Se reinicia con el contenedor; no apto multi-instancia | Migrar a store persistente si se escala |
| Sin HTTPS en LAN | Tráfico local sin cifrar | Reverse proxy con TLS si se publica externamente |
| Cobertura frontend | 36.6% statements / 39.4% branches / 35.7% funcs / 40.5% lines (`vitest run --coverage`, oct 2026; umbral exigido 33/32/28/37) — 3 archivos de test (AuthModal, ProductCard, reglasCupon) | Ampliar pruebas de componentes |
| App móvil | Falta bandeja de soporte del cliente y notificaciones push; checkout/reseñas implementados | Roadmap fase móvil |

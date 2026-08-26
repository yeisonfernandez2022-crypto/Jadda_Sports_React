# Manual Técnico — JADDA SPORTS

**Versión del documento:** 1.0 · 2026-08-24
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

## 4. Modelo de datos (33 tablas)

Esquema completo y seeds: `backend/database/schema.sql`. Agrupación funcional:

| Dominio | Tablas principales |
|---------|--------------------|
| Usuarios y acceso | USUARIOS (roles 1 admin/6 vendedor/cliente, CONFIRMADO, DEBE_CAMBIAR_PASSWORD, ULTIMA_CONEXION), ROLES, DIRECCIONES, USUARIOS_METODOS_PAGO |
| Catálogo | CATEGORIAS, PRODUCTOS (+ID_VENDEDOR, ESTADO_PUBLICACION NULL/PENDIENTE/APROBADO/RECHAZADO), PRODUCTO_IMAGENES (ORDEN), PRODUCTO_VARIANTES (STOCK), FICHAS/CARACTERISTICAS, PROVEEDORES, DESCUENTOS (+USADO para cupones RETO-), RESEÑAS |
| Ventas | CARRITO, VENTAS, DETALLE_VENTAS (+ID_VARIANTE), ENVIOS (ESTADO_ENVIO, COSTO_ENVIO, FECHA_ENTREGA), MOVIMIENTOS_STOCK |
| Post-venta | DEVOLUCIONES (multi-producto + evidencias, estados SOLICITADA/MAS_PRUEBAS/APROBADA/RECHAZADA) |
| Gamificación | RETOS, RETOS_USUARIOS, RETO_EVIDENCIAS (+OBSERVACION, RUTA conservada tras revisión) |
| Marketplace | SOLICITUDES_VENDEDOR, VENDEDORES |
| Comunicación | NOTIFICACIONES (globales o por usuario), AVISOS_STOCK, PQR/CONTACTO |
| Otros | PLANES_ENTRENAMIENTO, HISTORIAL, NEWSLETTER (JSON en backend/data/) |

Regla de oro: cualquier cambio de esquema se hace en `setup.js` (CREATE_TABLES_RAW + lista `MIGRACIONES` idempotente) y se regenera `schema.sql` con `node backend/database/exportarSchema.js`.

## 5. Mapa de API

Prefijo global `/api`. Autenticación indicada entre corchetes.

### Auth — `/api/auth`
`POST registro` · `POST login` [rate 10/min] · `POST social-login` · `POST confirmar` (código 6 dígitos) · `POST reenviar-codigo` · recuperar contraseña (`recuperar-password`, `verificar-codigo`, `update-password`) · OAuth Google/Facebook (`/google`, `/facebook` + callbacks) · [sesión] `GET perfil`, `PUT perfil`, `POST foto`, `POST cambiar-password`, `POST cambiar-email` + `confirmar-cambio-email` (valida contraseña actual), `POST verificar-password`, `POST logout`.

### Catálogo — `/api/productos`
`GET /` (búsqueda prefijo, rating, stock) · `GET categorias|descuentos|recomendados` · `GET :id`, `:id/variantes`, `:id/caracteristicas`, `:id/resenas`, `relacionados/:id` · `POST :id/resenas` [sesión] · CRUD productos/categorías/descuentos/características/variantes [esAdmin] · `POST imagenes` (base64 ≤25 MB) [esAdmin o esVendedor] · avisos de stock (`variantes/:id/suscribir`) [sesión].

### Carrito y checkout
`/api/carrito`: agregar/actualizar/eliminar [sesión] · `/api/checkout/procesar` [sesión]: **el servidor recalcula totales**, valida stock y cupones, transacción completa (BEGIN/COMMIT/ROLLBACK), decrementa STOCK por variante + MOVIMIENTOS_STOCK SALIDA, genera pedido/envío/plan si aplica, correo con factura PDF adjunta.

### Mis compras — `/api/compras` [sesión]
`GET /`, `GET :id`, `GET :id/factura` (PDF), `PUT :id/direccion` (bloqueada si el envío salió), `POST :id/cancelar` (RN: no cancelable en EN_CAMINO/ENTREGADO; reingresa stock con movimiento ENTRADA), `GET/POST :id/reembolso`.

### Devoluciones — `/api/devoluciones`
[sesión] crear solicitud multi-producto con evidencias (multer, hasta 8), listar mis solicitudes, agregar evidencias en MAS_PRUEBAS, eliminar evidencia pendiente. [esAdmin] `GET admin`, `POST admin/:id/procesar` con 4 decisiones: devolver (reingresa stock) / reembolsar / mas_pruebas / rechazar, notifica al usuario.

### Retos — `/api/retos`
[sesión] listado, unirse, reportar progreso (multipart hasta 10 archivos ≤100 MB o legacy base64), mis retos/evidencias, eliminar avance pendiente. [esAdmin] revisión de evidencias (aprobar/rechazar con observación opcional; el material se conserva). Al completar la meta se emite cupón `RETO-XXXX-XXXX` de un solo uso.

### Admin — `/api/admin` [esAdmin]
Dashboard agregado, pendientes (badges), órdenes (`compras` + estado venta/envío/factura/eliminar-canceladas), reportes (`reportes/ventas`, `analytics/mas-vendidos`), usuarios (`usuarios`, `usuarios/:id` detalle completo), productos de vendedor (`aprobar|rechazar`).

### Vendedor — `/api/vendedor`
Público: `POST solicitud` (empresa/NIT opcionales para vendedor informal). [sesión] `GET solicitud`. [esVendedor] mi-tienda (KPIs), CRUD de sus productos (pasan a PENDIENTE hasta aprobación del admin), ventas, empresa. [esAdmin] solicitudes + procesar (crea usuario rol 6 con contraseña temporal obligatoria a cambiar).

### Otros
`/api/envio/calcular` · `/api/notificaciones` (timbre; admin ve globales+propias) · `/api/newsletter` (suscripción pública, desuscripción, envío manual admin, scheduler cada `NEWSLETTER_INTERVAL_HORAS`) · `/api/contacto`, `/api/pqr` · `/api/favoritos`, `/api/historial`, `/api/planes`, `/api/cupones/validar`, `/api/metodos-pago`, `/api/proveedores`.

## 6. Seguridad implementada

| Mecanismo | Dónde |
|-----------|-------|
| Contraseñas bcrypt | authController |
| Sesiones cookie httpOnly + Passport | config/passport.js, server.js |
| RBAC | esAdmin/esVendedor aplicados por router |
| Rate limiting por IP (en memoria) | middlewares/rateLimiter.js — login 10/min, registro 5/15min, etc. |
| Anti-enumeración | login devuelve mensaje único aunque el correo no exista |
| Validaciones de servidor | totales de checkout, stock, cupones usados, formatos email/teléfono/usuario |
| XSS en UI | escapeHtml antes de interpolar en Swal html |
| Menor privilegio BD | scripts/sql/usuarios-produccion.sql (jadda_app sin DROP ni grants globales) |
| Archivos sensibles fuera de git | .gitignore: `.env`, `mysql_data/`, `backups/` |

## 7. Convenciones técnicas relevantes

- **Subidas**: multer escribe en `backend/uploads/*` que son bind-mounts de `frontend/public/images/*`; el backend sirve esas rutas con express.static (fuente siempre fresca) y Vite hace proxy.
- **Carpetas por usuario**: `uploads/usuarios/<usuario>/perfil|retos/r<id>/`.
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
| Dependencias legado | `jsonwebtoken` y middleware `verificarToken` sin uso; `resenaController.js` muerto | Remover en próxima limpieza |
| App móvil | Checkout y reseñas pendientes | Roadmap fase móvil |

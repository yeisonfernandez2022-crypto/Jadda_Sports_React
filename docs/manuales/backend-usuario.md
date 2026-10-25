# Backend — Módulo Usuario

Documentación de todos los controllers y rutas del backend orientados al usuario final (excluye panel admin).

> **Estado: revisado 2026-10-22 contra el código (tablas, endpoints y autenticaciones verificados una a una). Para las guías vivas y el estado real del sistema ver `docs/manuales/manual-tecnico.md` y `docs/auditoria/estado-brechas.md`.**

---

## 🔹 `authController.js`
**Ubicación:** `backend/controllers/authController.js`  
**Propósito:** Registro, inicio de sesión, confirmación de cuenta (código 6 dígitos), recuperación de contraseña, gestión de perfil y cierre de sesión. Usa `express-session` + `Passport.js` (no JWT).

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/auth/registro` | No | `registro` | body: `{nombre, apellido, email, password, telefono, direccion (opcional)}` | `{message}` — apellido obligatorio (400 si falta) |
| POST | `/api/auth/login` | No | `login` | body: `{email, password}` | `{message, nombre, usuario{ID_USUARIO, NOMBRE_USUARIO, EMAIL, TELEFONO, foto_url, ID_ROL, DEBE_CAMBIAR_PASSWORD}}` · 401 unificado "Correo o contraseña incorrectos" · 403 `{message, requiereVerificacion:true}` si no confirmó |
| POST | `/api/auth/confirmar` | No | `confirmarCuenta` | body: `{email, codigo}` | `{message}` |
| POST | `/api/auth/recuperar-password` | No | `recuperarPassword` | body: `{email}` | `{message}` |
| POST | `/api/auth/verificar-codigo` | No | `validarCodigoRecuperacion` | body: `{email, codigo}` | `{message}` — **no devuelve token**; solo valida que el código sea correcto |
| POST | `/api/auth/update-password` | No | `actualizarPassword` | body: `{email, codigo, password}` | `{message}` — el código se invalida tras el cambio |
| POST | `/api/auth/reenviar-codigo` | No | `reenviarCodigo` | body: `{email, tipo}` | `{message}` — `tipo`: `verify` o `recovery`; `email` es el campo (no `correo`) |
| POST | `/api/auth/social-login` | No | `socialLogin` | body: `{provider, accessToken}` | sesión + `{ok, usuario{}}` (app móvil, Google/Facebook) |
| GET | `/api/auth/perfil` | Sí | `obtenerPerfil` | — | `{ok, usuario{ID_USUARIO, NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, TELEFONO, TIPO_DOCUMENTO, NUMERO_DOCUMENTO, FOTO_URL, FECHA_REGISTRO, ID_ROL, ULTIMA_CONEXION, ULTIMA_IP, ULTIMA_UBICACION, DEBE_CAMBIAR_PASSWORD}}` |
| PUT | `/api/auth/perfil` | Sí | `actualizarPerfil` | body: solo campos presentes `{nombre, apellido, usuario, telefono, tipo_documento, numero_documento, foto_url}` | `{ok, message}` — `usuario`: 3-20 chars `a-zA-Z0-9._-` + único (409); `telefono` 7-10 dígitos; el **correo NO se cambia aquí** (ver `cambiar-email`) |
| POST | `/api/auth/foto` | Sí | `subirFotoPerfil` | body: `{foto}` (base64, límite 10mb) | `{ok, url}` — guarda en `uploads/usuarios/{USUARIO}/perfil/` y devuelve la URL `/images/usuarios/...` |
| POST | `/api/auth/cambiar-email` | Sí | `cambiarEmail` | body: `{email_nuevo, password}` | `{ok, message}` — guarda `EMAIL_PENDIENTE` + código al correo nuevo |
| POST | `/api/auth/confirmar-cambio-email` | Sí | `confirmarCambioEmail` | body: `{codigo}` | `{ok, message}` |
| POST | `/api/auth/verificar-password` | Sí | `verificarPassword` | body: `{password}` | `{ok, message}` |
| POST | `/api/auth/logout` | Sí | `logout` | — | `{ok, message}` |
| GET | `/api/auth/facebook` | No | passport Facebook OAuth | query: `state` | Redirige a Facebook |
| GET | `/api/auth/facebook/callback` | No | passport callback | query: `state` | Redirige a frontend |
| GET | `/api/auth/google` | No | passport Google OAuth | query: `state` | Redirige a Google |
| GET | `/api/auth/google/callback` | No | passport callback | query: `state` | Redirige a frontend |

### Tablas que utiliza
`USUARIOS` (incluye `TOKEN` VARCHAR(255), `TOKEN_EXPIRA`, `EMAIL_PENDIENTE`, `DEBE_CAMBIAR_PASSWORD`, `ULTIMA_CONEXION/ULTIMA_IP/ULTIMA_UBICACION`). ⚠️ La tabla `TOKENS_RECUPERACION` **no existe** en el código: los códigos de verificación/recuperación se guardan **hasheados con bcrypt** en `USUARIOS.TOKEN`.

### Dependencias
`bcryptjs` (hash de contraseñas), `crypto` (generación de tokens/códigos), `../config/mailer` (envío de emails), `passport` (estrategia Google OAuth)

### Notas
- El JWT legacy (`verificarToken`) y la dependencia `jsonwebtoken` fueron eliminados el 2026-10-20.
- El registro asigna `ID_ROL = 4` (Usuario) y valida el formato de correo + contraseña de mínimo 8 caracteres.
- El registro guarda el código de 6 dígitos **hasheado con bcrypt** en `USUARIOS.TOKEN` (no lo guarda en texto plano); misma política en recuperar contraseña.
- La confirmación usa un código de 6 dígitos con expiración de 15 minutos (`TOKEN_EXPIRA`).
- El login valida bcrypt **antes** de revisar `CONFIRMADO`: los 401 son genéricos (anti-enumeración) y el 403 "debes verificar tu correo" solo sale con credenciales correctas.
- Las contraseñas se hashean con `bcryptjs` (salt rounds = 10).
- Los códigos de verificación se comparan con bcrypt; `reenviar-codigo` devuelve 404 sin enviar si el correo no existe (anti email-bombing).
- El login registra `ULTIMA_CONEXION/ULTIMA_IP/ULTIMA_UBICACION` (geolocalización best-effort con ip-api.com, nunca bloquea la respuesta).
- Las rutas OAuth (Google/Facebook) redirigen al frontend con `?user` y `?photo` en la URL; la estrategia web de Google valida el perfil vía `openidconnect.googleapis.com/v1/userinfo` exigiendo `email_verified`.
- Rate limiting (15 min, por IP): registro 5, login 10, confirmar/verificar/update-password 10, recuperación/reenvío 5.

---

## 🔹 `productoController.js`
**Ubicación:** `backend/controllers/productoController.js`  
**Propósito:** CRUD de productos, consultas con filtros, productos relacionados, gestión de variantes, características (ficha técnica) y reseñas de clientes.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/productos` | No | `obtenerProductos` | query: `search` (opcional) | Array de productos con STOCK agregado (excluye variantes agotadas de `ESTADO_PUBLICACION` PENDIENTE/RECHAZADO) |
| GET | `/api/productos/:id` | No | `obtenerProductoPorId` | params: `id` | Producto + `IMAGENES`, `CARACTERISTICAS`, `VARIANTES`, `VENDEDOR_NOMBRE` |
| GET | `/api/productos/relacionados/:id` | No | `obtenerRelacionados` | params: `id` | Array de 4 productos relacionados |
| GET | `/api/productos/categorias` | No | `obtenerCategorias` | — | Array `{ID_CATEGORIA, NOMBRE_CATEGORIA, DESCRIPCION, TOTAL_PRODUCTOS}` |
| POST | `/api/productos/categorias` | Admin | `crearCategoria` | body: `{name, description}` | `{ok, msg, ID_CATEGORIA}` (RF-027) |
| PUT | `/api/productos/categorias/:id` | Admin | `actualizarCategoria` | body: `{name, description}` | `{ok, msg}` (RF-027) |
| DELETE | `/api/productos/categorias/:id` | Admin | `eliminarCategoria` | params: `id` | `{ok, msg}` (bloqueado si tiene productos) |
| POST | `/api/productos/descuentos` | Admin o Vendedor | `crearDescuento` | body: `{DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, MONTO_MINIMO (opcional)}` | `{ok, msg}` — el admin crea cualquier descuento; el vendedor crea cupones públicos con `MONTO_MINIMO` opcional |
| GET | `/api/productos/vendedores` | No | `obtenerVendedores` | — | Array de vendedores (para filtros) |
| GET | `/api/productos/descuentos` | No | `obtenerDescuentos` | — | Descuentos vigentes (`FECHA_FIN >= CURDATE()`) |
| GET | `/api/productos/:id/variantes` | No | `obtenerVariantes` | params: `id` | Array de variantes del producto |
| POST | `/api/productos/:id/variantes` | Admin (esAdmin) | `agregarVariante` | body: `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{ID_VARIANTE}` |
| PUT | `/api/productos/variantes/:idVariante` | Admin (esAdmin) | `actualizarVariante` | body: `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{message}` |
| DELETE | `/api/productos/variantes/:idVariante` | Admin (esAdmin) | `eliminarVariante` | params: `idVariante` | `{message}` |
| POST | `/api/productos/variantes/:idVariante/suscribir` | Sí | `suscribirAvisoStock` | — | `{ok, msg}` — crea fila AVISOS_STOCK |
| GET | `/api/productos/variantes/:idVariante/suscripcion` | Sí | `estadoSuscripcionAviso` | — | estado de la suscripción (RF-035) |
| DELETE | `/api/productos/variantes/:idVariante/suscribir` | Sí | `cancelarAvisoStock` | — | `{ok, msg}` |
| GET | `/api/productos/:id/caracteristicas` | No | `obtenerCaracteristicas` | params: `id` | Array de características |
| POST | `/api/productos/:id/caracteristicas` | Admin (esAdmin) | `agregarCaracteristica` | body: `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{ID_CARACTERISTICA}` |
| GET | `/api/productos/caracteristicas/:id` | Admin (esAdmin) | `obtenerCaracteristicaPorId` | params: `idCaracteristica` | Objeto característica |
| PUT | `/api/productos/caracteristicas/:id` | Admin (esAdmin) | `actualizarCaracteristica` | body: `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{message}` |
| DELETE | `/api/productos/caracteristicas/:id` | Admin (esAdmin) | `eliminarCaracteristica` | params: `idCaracteristica` | `{message}` |
| GET | `/api/productos/:id/resenas` | No | `obtenerResenasPorProducto` | params: `id` | Array de reseñas con `NOMBRE_USUARIO` |
| POST | `/api/productos/:id/resenas` | Sí (inline) | `agregarResena` | body: `{comentario, calificacion}` | `{message}` |
| POST | `/api/productos/imagenes` | Admin o Vendedor (esAdminOVendedor) | `subirImagenes` | body JSON base64 (≤6 MB por imagen, máx 8) | URLs `/images/productos/...` — subida al panel admin/vendedor (con `idProducto` posible) |
| POST | `/api/productos` | Admin (esAdmin) | `crearProducto` | body: completo (ver abajo) | `{message, id}` |
| PUT | `/api/productos/:id` | Admin (esAdmin) | `actualizarProducto` | body: completo | `{message}` |
| DELETE | `/api/productos/:id` | Admin (esAdmin) | `eliminarProducto` | params: `id` | `{message}` |
| GET | `/api/productos/recomendados` | Sí | `obtenerRecomendados` | — | `{origen: 'categorias'\|'populares', productos[]}` (RF-038) |

### Body de crear/actualizar producto
```json
{
  "NOMBRE": "string",
  "MARCA": "string",
  "PRECIO": "number",
  "DESCRIPCION": "string",
  "ID_CATEGORIA": "number",
  "ID_PROVEEDOR": "number (opcional)",
  "ID_DESCUENTO": "number (opcional)",
  "URL_IMAGEN": "string (opcional)",
  "COLOR": "string (opcional)",
  "TIPO_ATRIBUTO": "string (opcional)",
  "ATRIBUTO": "string (opcional)",
  "STOCK": "number (opcional)",
  "CARACTERISTICAS": "array (opcional)",
  "VARIANTES": "array (opcional, solo actualizar)"
}
```

### Tablas que utiliza
`PRODUCTOS`, `PRODUCTO_IMAGENES`, `PRODUCTO_VARIANTES`, `PRODUCTO_CARACTERISTICAS`, `RESENAS`, `CATEGORIAS`, `DESCUENTOS`, `USUARIOS`

### Notas
- La búsqueda (`search`) usa **prefijo** (`LIKE 'word%'`) con múltiples palabras separadas por espacio (todas deben coincidir).
- `obtenerProductos` agrega `STOCK` con `SUM(PV.STOCK)` e incluye `ID_VARIANTE_POR_DEFECTO` y `RATING`.
- `obtenerRelacionados` intenta 4 productos de la misma categoría; si no hay suficientes, completa con productos aleatorios de otras categorías.
- CRUD de categorías (RF-027): valida nombre único de 3-100 caracteres y bloquea el borrado si hay productos asociados.
- CRUD de variantes y características exige rol `Admin` vía `esAdmin`; los descuentos se crean con `esAdminOVendedor` (vendedores publican productos de su tienda que luego el administrador aprueba/rechaza con `ESTADO_PUBLICACION`).
- `obtenerRecomendados` (RF-038): productos de categorías compradas por el usuario (excluye CANCELADAS y productos ya comprados), ordenados por frecuencia de compra de la categoría; fallback a más vendidos. Requiere sesión y excluye agotados.
- `POST /:id/resenas` tiene middleware inline `req.isAuthenticated()` — **no** usa el middleware de ruta estándar.
- Las reseñas se devuelven con `NOMBRE_USUARIO` (JOIN con `USUARIOS`).
- Los endpoints de administrador (`POST /`, `PUT /:id`, `DELETE /:id`, variantes, características) pasan por el middleware `esAdmin` — el productoController es de uso de administración, no usuario final.

---

## 🔹 `carritoController.js`
**Ubicación:** `backend/controllers/carritoController.js`  
**Propósito:** CRUD del carrito de compras asociado al usuario autenticado.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/carrito` | Sí | `obtenerCarrito` | — | Array de items con `IMAGEN` |
| POST | `/api/carrito/agregar` | Sí | `agregarAlCarrito` | body: `{id_producto, id_variante, cantidad}` | `{ok, msg}` |
| PUT | `/api/carrito/actualizar/:id_carrito` | Sí | `actualizarCantidad` | body: `{cantidad}` | `{ok, msg}` |
| DELETE | `/api/carrito/eliminar/:id_carrito` | Sí | `eliminarDelCarrito` | params: `id_carrito` | `{ok, msg}` |

### Tablas que utiliza
`CARRITO`, `PRODUCTOS`, `PRODUCTO_VARIANTES`, `PRODUCTO_IMAGENES`

### Notas
- `agregarAlCarrito` valida que el `STOCK` de `PRODUCTO_VARIANTES` sea suficiente.
- `agregarAlCarrito` también rechaza a los **vendedores** (rol 6) con 403 «Los vendedores no pueden comprar en la tienda» — doble validación reiterada en el checkout.
- Si el mismo producto+variante ya existe en el carrito, incrementa la cantidad en lugar de crear duplicado.
- `obtenerCarrito` hace JOIN con `PRODUCTOS` y `PRODUCTO_IMAGENES` (imagen con `ORDEN = 1`).
- Todos los endpoints usan `verificarSesion` de `authMiddleware.js` (middleware externo basado en sesión).

---

## 🔹 `checkoutController.js`
**Ubicación:** `backend/controllers/checkoutController.js`  
**Propósito:** Procesar la compra completa: crear venta, detalle, envío, vaciar carrito, generar plan de entrenamiento y enviar factura por email.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/checkout/procesar` | Sí | `procesarCompra` | body completo (ver abajo) | `{ok, ventaId, referencia, planGenerado}` |

### Body
```json
{
  "metodoPago": "tarjeta|pse|nequi|daviplata",
  "paymentData": { "titular": "...", "numero": "...", "vencimiento": "...", "cvv": "...", "telefono": "...", "banco": "..." },
  "cuponCodigo": "string (opcional)",
  "descuentoAplicado": "number",
  "totalFinal": "number",
  "nombre": "string",
  "correo": "string",
  "telefono": "string",
  "direccion": "string",
  "barrio": "string",
  "ciudad": "string",
  "departamento": "string",
  "codigoPostal": "string",
  "observaciones": "string (opcional)"
}
```

### Flujo interno
1. Rechaza con 403 a los **vendedores** (rol 6) — «Los vendedores no pueden comprar en la tienda».
2. Mapea `metodoPago` → `ID_METODO` (`METODO_MAP`: tarjeta→2, pse→7, nequi→4, daviplata→5) y consulta el carrito del usuario con JOIN a `PRODUCTO_IMAGENES`.
3. Calcula **en el servidor** subtotal, descuento por producto (`DESCUENTO_PORCENTAJE`), descuento de cupón, costo de envío por departamento (`utils/envio.js`, gratis según el umbral `ENVIO_GRATIS_DESDE`) y total — los valores `totalFinal`/`descuentoAplicado` del cliente se ignoran.
4. Valida el cupón contra `DESCUENTOS` (búsqueda **exacta** por `TRIM(DESCRIPCION)`); si el cupón tiene `MONTO_MINIMO` y el carrito no lo alcanza responde 400 sin consumir el cupón.
5. **Valida stock por variante SIN decrementar**: si algún producto queda insuficiente responde 400 con mensaje por producto (los cupones RETO- no se marcan como usados).
6. Abre la transacción y **bloquea el stock de cada variante con `SELECT ... FOR UPDATE`**; el decremento exige `AND STOCK >= ?` — si la concurrencia deja la fila sin unidades responde **409** (stock vendido por otro) y hace rollback.
7. Por cada ítem: `UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK - ?` + `registrarMovimientoStock(SALIDA)` en `MOVIMIENTOS_STOCK`.
8. Genera referencia de pago: `SIM_{timestamp}_{idUsuario}` sin pasarela; con `PAYMENT_GATEWAY=wompi` la venta nace `PENDIENTE_PAGO` (la referencia real `JADDA-<idVenta>-<rand8>` la escribe `POST /api/pagos/pagar` con guard `AND ESTADO='PENDIENTE_PAGO'`), guardando `DATOS_PAGO` como JSON en columnas seguras (sin datos sensibles).
9. Inserta `DETALLE_VENTAS` por cada producto (incluyendo `ID_VARIANTE`).
10. Inserta `ENVIOS` con `ESTADO_ENVIO='PENDIENTE'` y `FECHA_ENVIO = DATE_ADD(NOW(), INTERVAL 3 DAY)` (fecha estimada) más `COSTO_ENVIO`.
11. Vacía el carrito (`DELETE FROM CARRITO`) y marca los cupones RETO- con `USADO = 1` dentro de la transacción (los cupones publicitarios ordinarios no se destruyen).
12. Genera plan de entrenamiento: busca plantilla por categoría del producto; si ninguna coincide, usa la primera disponible (fallback).
13. Al hacer COMMIT continua el post-commit best-effort: envía la factura por email (RF-021, PDF adjunto) y notifica al vendedor si la compra incluye productos de terceros (nunca bloquea la respuesta).
14. Con `PAYMENT_GATEWAY=wompi` la venta queda `PENDIENTE_PAGO` con los avisos post-commit silenciados: el cobro se cierra por `pagosController` (`/api/pagos`) — pull `GET estado/:idVenta` o webhook firmado confirman `APPROVED→CONFIRMADA` disparando ENTONCES los avisos, y `DECLINED/VOIDED` o 48 h sin pago pasa a `CANCELADA` reingresando stock (especificación y evidencia en `docs/auditoria/pasarela-pagos-plan.md`).

### Tablas que utiliza
`CARRITO`, `PRODUCTOS`, `PRODUCTO_IMAGENES`, `PRODUCTO_VARIANTES`, `VENTAS`, `DETALLE_VENTAS`, `ENVIOS`, `METODOS_PAGO`, `DESCUENTOS`, `PLANTILLAS_PLANES`, `PLANES_USUARIO`, `MOVIMIENTOS_STOCK`, `NOTIFICACIONES`

### Dependencias
`../config/mailer` (transporte nodemailer), `../config/db`

### Notas
- La compra completa corre **dentro de una transacción MySQL** (`BEGIN`/`COMMIT`/`ROLLBACK`) y bloquea el stock con `FOR UPDATE` por variante — la suite `backend/tests/integration/checkout-concurrencia.test.js` demuestra 2 checkouts simultáneos sobre el mismo stock → uno 200 y otro 409.
- El email de factura incluye: logo, tabla de productos con thumbnail 48×48, subtotales, descuento, total, dirección de envío, método de pago con detalles (titular + últimos 4 dígitos para tarjeta, teléfono para Nequi/Daviplata, banco para PSE), y banner de plan si se generó. Adjunta `factura-<id>.pdf` generado con pdfkit.
- Los errores de envío de email se capturan silenciosamente (no bloquean la compra); con `PAYMENT_GATEWAY=wompi` esos correos quedan silenciados durante el checkout y se envían cuando el pago se confirma (pull `/api/pagos/estado/:idVenta` o webhook firmado `/api/pagos/webhook`).

---

## 🔹 `pagosController.js`
**Ubicación:** `backend/controllers/pagosController.js` + `backend/routes/pagosRoutes.js` (montado en `/api/pagos`)
**Propósito:** Pasarela de pagos Wompi (sandbox desde 2026-10-24): activación de la venta, widget firmado, sondeo de estado y webhook con resto confirmable.

### Endpoints
| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/api/pagos/config` | Público | Si la pasarela está activa (`PAYMENT_GATEWAY=wompi` + llaves): `{ activo, ambiente, metodos[] }` del sandbox — UI de chips del checkout |
| POST | `/api/pagos/pagar` | Sesión + rate 8/5 min | Para una venta `PENDIENTE_PAGO` del dueño: fija `REFERENCIA_PAGO = JADDA-<idVenta>-<rand8>` con guard `AND ESTADO='PENDIENTE_PAGO'` (idempotente — repetir devuelve la MISMA URL), firma `integrity` (SHA256 ref+centavos+moneda+secreto) y devuelve `urlCheckout` del widget |
| GET | `/api/pagos/estado/:idVenta` | Sesión + rate 90/min | Pull: re-consulta la transacción en Wompi (`fetchWompi` con reintentos); `APPROVED→CONFIRMADA` disparando el MISMO flujo del checkout (factura+avisos+limpiar carrito); `DECLINED/VOIDED→CANCELADA` reingresando stock; `PENDING` sigue |
| POST | `/api/pagos/webhook` | Sin sesión + rate 60/min | Registra el evento en `PAGOS_EVENTOS` (UNIQUE `EXTERNO_ID+CHECKSUM` = idempotencia); **403 + fila `FIRMA_INVALIDA`** si el checksum SHA256 no cuadra; con firma válida re-obtiene la transacción vía API y confirma (no se confía en el payload) |

### Flujo interno
1. `utils/pagos.js` concentra el crypto y el cliente API: `gatewayActivo()`, `esAmbientePruebas()` (prefijo `pub_test_`), `firmaIntegridad`, `urlCheckoutWompi`, `verificarEventosWompi` (rutas `transaction.*` y `data.transaction.*`), `compararSegura` (timing-safe, rechaza vacíos) y `obtenerTransaccionWompi`/`buscarTransaccionesPorReferencia` (la búsqueda por referencia exige llave PRIVADA; la obtención por id basta con la pública).
2. El job de `server.js` cada 15 min (`expirarVentasPendientes`): ventas `PENDIENTE_PAGO` de más de 48 h → `CANCELADA` + movimiento ENTRADA + correo de cancelación.
3. La confirmación con pasarela activa reutiliza exactamente el post-commit clásico (antes silenciado):correo de compra con factura PDF, avisos in-app (comprador/admin/vendedor según corresponda) y `DELETE FROM CARRITO`.

### Tablas que utiliza
`VENTAS` (lectura/actualización de estado + `REFERENCIA_PAGO`), `PAGOS_EVENTOS`, `PRODUCTO_VARIANTES` (reingreso de stock), `MOVIMIENTOS_STOCK`, `DETALLE_VENTAS`, `CARRITO`, `NOTIFICACIONES`

### Dependencias
`../utils/pagos`, `../config/db`

### Notas
- Con `PAYMENT_GATEWAY` vacío el módulo responde "no activa" y el checkout clásico funciona igual que siempre (sin consultas a Wompi).
- La verificación por pull y el webhook desembocan en la misma función de confirmación: el cambio de estado solo aplica sobre ventas `PENDIENTE_PAGO` (guard en el UPDATE), así que no hay dobles correos ni dobles reingresos de stock entre pull y webhook.

---

## 🔹 `comprasController.js`
**Ubicación:** `backend/controllers/comprasController.js`  
**Propósito:** Historial de compras del usuario autenticado con detalle de productos.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/compras` | Sí | `obtenerCompras` | — | Array de compras con `productos[]` y `REEMBOLSO_ESTADOS` |
| GET | `/api/compras/:id` | Sí | `obtenerCompraPorId` | params: `id` | Compra completa (+ `planGenerado`, productos con variante) — usada por CompraExitosa/DetalleCompra |
| GET | `/api/compras/:id/factura` | Sí | `descargarFactura` | params: `id` | PDF de la factura (RF-021) |
| GET | `/api/compras/:id/reembolso` | Sí | `obtenerReembolso` | params: `id` | `{venta, reembolsos[], totalReembolso}` (RF-033) |
| PUT | `/api/compras/:id/direccion` | Sí | `actualizarDireccionCompra` | body: datos de envío | `{ok, msg}` — 400 si el pedido CANCELADO o ya en camino/entregado |
| POST | `/api/compras/:id/cancelar` | Sí | `cancelarCompra` | — | `{ok, msg}` — transacción RN-010: rechaza si `ENVIOS.ESTADO_ENVIO` es `EN_CAMINO`/`ENTREGADO`; reingresa stock + `MOVIMIENTOS_STOCK` |
| POST | `/api/compras/:id/reembolso` | Sí | `solicitarReembolso` | — | `{ok, msg}` — solo ventas CANCELADAS propias; 400 si ya hay solicitud activa (RF-033) |

### Tablas que utiliza
`VENTAS`, `METODOS_PAGO`, `ENVIOS`, `DETALLE_VENTAS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`

### Estructura de respuesta
```json
[{
  "ID_VENTA": 1,
  "FECHA_VENTA": "2026-06-22T...",
  "FECHA_ENTREGA": null,
  "TOTAL": 150000,
  "ESTADO": "COMPLETADA",
  "REFERENCIA_PAGO": "SIM_...",
  "DATOS_PAGO": "{\"titular\":\"...\"}",
  "METODO_PAGO": "Tarjeta débito",
  "DIRECCION_ENVIO": "...",
  "CIUDAD": "...",
  "ESTADO_ENVIO": "PENDIENTE",
  "REEMBOLSO_ESTADOS": "SOLICITADA,APROBADA",
  "productos": [{ "CANTIDAD": 1, "PRECIO_UNITARIO": 50000, "SUBTOTAL": 50000, "NOMBRE": "...", "ID": 1, "IMAGEN": "...", "COLOR": null, "NOMBRE_ATRIBUTO": null, "ATRIBUTO": null }]
}]
```

### Notas
- `DATOS_PAGO` es un string JSON que debe ser parseado en el frontend.
- `METODO_PAGO` es el nombre del método (JOIN con `METODOS_PAGO`), no el ID.
- Los totales se devuelven como número (convertidos con `Number()`).
- Cada producto trae los datos de variante (`COLOR`/`NOMBRE_ATRIBUTO`/`ATRIBUTO`) vía LEFT JOIN a `PRODUCTO_VARIANTES` (ventas viejas devuelven `null`).
- `REEMBOLSO_ESTADOS` es un GROUP_CONCAT de los estados activos de devolución (SOLICITADA/APROBADA/MAS_PRUEBAS) que habilita el botón «Ver estado de reembolso».

---

## 🔹 `direccionController.js`
**Ubicación:** `backend/controllers/direccionController.js`  
**Propósito:** CRUD de direcciones de envío del usuario autenticado.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/direcciones` | Sí | `obtenerDirecciones` | — | Array de direcciones |
| POST | `/api/direcciones` | Sí | `crearDireccion` | body: `{direccion, barrio, ciudad, departamento, ...}` | `{ok, msg, id}` |
| PUT | `/api/direcciones/:id_direccion` | Sí | `actualizarDireccion` | body: mismo que crear | `{ok, msg}` |
| DELETE | `/api/direcciones/:id_direccion` | Sí | `eliminarDireccion` | params: `id_direccion` | `{ok, msg}` |

### Body de crear/actualizar
```json
{
  "direccion": "string (obligatorio)",
  "ciudad": "string (obligatorio)",
  "departamento": "string (obligatorio)",
  "barrio": "string (opcional)",
  "codigo_postal": "string (opcional)",
  "telefono_contacto": "string (opcional)",
  "es_principal": "boolean",
  "etiqueta": "string (opcional, ej: Casa, Trabajo)"
}
```

### Tablas que utiliza
`DIRECCIONES`

### Notas
- Si `es_principal` es `true`, se desmarcan todas las demás direcciones del usuario antes de marcar la nueva.
- Solo el dueño puede modificar/eliminar sus direcciones (filtro por `ID_USUARIO`).
- Las direcciones se listan ordenadas por `ES_PRINCIPAL DESC`, luego por `ID_DIRECCION DESC`.

---

## 🔹 `favoritosController.js`
**Ubicación:** `backend/controllers/favoritosController.js`  
**Propósito:** Gestión de productos favoritos del usuario.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/favoritos` | Sí | `obtenerFavoritos` | — | Array de favoritos con datos del producto |
| POST | `/api/favoritos` | Sí | `agregarFavorito` | body: `{id_producto}` | `{ok, msg}` |
| DELETE | `/api/favoritos/:id_favorito` | Sí | `eliminarFavorito` | params: `id_favorito` | `{ok, msg}` |

### Tablas que utiliza
`FAVORITOS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`

### Notas
- `agregarFavorito` valida que el producto no esté ya en favoritos (duplicado → 400).
- Las respuestas incluyen imagen del producto (primer imagen con `ORDEN = 1`).

---

## 🔹 `historialController.js`
**Ubicación:** `backend/controllers/historialController.js`  
**Propósito:** Historial de productos vistos por el usuario (máximo 30 registros).

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/historial` | Sí | `obtenerHistorial` | — | Array de últimos 30 productos vistos |
| POST | `/api/historial` | Sí | `guardarHistorial` | body: `{id_producto}` | `{ok, msg}` |

### Tablas que utiliza
`HISTORIAL`, `PRODUCTOS`, `PRODUCTO_IMAGENES`

### Notas
- Si el producto ya existe en el historial del usuario, se actualiza `FECHA_VISTO` en lugar de insertar duplicado.
- Después de insertar, verifica que no haya más de 30 registros; si los hay, elimina los más antiguos.
- El frontend también guarda historial en `localStorage` como respaldo para usuarios no autenticados.

---

## 🔹 `cuponesController.js`
**Ubicación:** `backend/controllers/cuponesController.js`  
**Propósito:** Validación de cupones/códigos de descuento.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/cupones/validar` | No | `validarCupon` | body: `{codigo}` | `{ok, descuento: {id, descripcion, porcentaje}, monto_minimo, fecha_fin}` |
| GET | `/api/cupones/disponibles` | Sí | `listarParaCheckout` | — | `{tienda[] (promos públicas vigentes), personales[] (RETO- ganados, + TITULO del reto, usado/expirado)}` |

### Tablas que utiliza
`DESCUENTOS`, `RETOS_USUARIOS`, `RETOS`

### Notas
- La búsqueda del código es **exacta**: `WHERE TRIM(DESCRIPCION) = ?` (el collation `ai_ci` ya hace la comparación insensible a mayúsculas; un prefijo como «JADDA» con código JADDA10 ya **no** matchea).
- Valida que `FECHA_INICIO <= hoy <= FECHA_FIN` y expone `MONTO_MINIMO` cuando el cupón exige compra mínima.
- `/disponibles` alimenta el panel «Ver cupones disponibles y los tuyos» de `ResumenCompra`; excluye los vencidos y los `RETO-` ya usados.
- El endpoint `/validar` no requiere sesión (el checkout definitivo valida el cupón de nuevo en servidor dentro de la transacción).

---

## 🔹 `planController.js`
**Ubicación:** `backend/controllers/planController.js`  
**Propósito:** Planes de entrenamiento personalizados generados automáticamente según las compras del usuario.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/planes` | Sí | `misPlanes` | — | Array de planes con contenido parseado |
| POST | `/api/planes/generar` | Sí | `generarPlan` | body: `{id_venta}` | `{ok, msg}` |
| POST | `/api/planes/marcar-dia/:id_plan` | Sí | `marcarDia` | body: `{dia, dias_completados}` | `{ok, completado, progreso}` |

### Tablas que utiliza
`PLANES_USUARIO`, `PLANTILLAS_PLANES`, `CATEGORIAS`, `DETALLE_VENTAS`, `PRODUCTOS`

### Estructura de respuesta (GET /)
```json
[{
  "ID_PLAN": 1,
  "ID_USUARIO": 1,
  "ID_VENTA": 1,
  "ID_PLANTILLA": 1,
  "FECHA_INICIO": "2026-06-22",
  "COMPLETADO": 0,
  "TITULO": "De Couch a 5K",
  "PLAN_DESC": "Plan progresivo para empezar a correr",
  "DURACION_DIAS": 21,
  "NIVEL": "Principiante",
  "CONTENIDO": [{ "dia": 1, "actividad": "Caminata 20 min", "series": 1 }, ...],
  "NOMBRE_CATEGORIA": "Running"
}]
```

### Notas
- `CONTENIDO` es un JSON string en BD; se parsea automáticamente antes de devolverlo.
- `marcarDia` recibe el array completo de días completados y actualiza `COMPLETADO = 1` si todos los días están hechos.
- Los planes se generan automáticamente en `checkoutController` al comprar (no es necesario llamar a `generarPlan` manualmente).

---

## 🔹 `retoController.js`
**Ubicación:** `backend/controllers/retoController.js`  
**Propósito:** Retos deportivos: inscripción, reporte de progreso y generación automática de cupones de descuento al completarlos.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/retos` | Sí | `obtenerRetos` | — | Retos activos (vigentes hoy) |
| GET | `/api/retos/mis-retos` | Sí | `misRetos` | — | Retos del usuario con progreso, evidencias y cupón |
| POST | `/api/retos/unirse/:id_reto` | Sí | `unirseReto` | params: `id_reto` | `{ok, msg}` |
| POST | `/api/retos/progreso/:id_reto_usuario` | Sí | `reportarProgreso` | `multipart/form-data` (`materiales[]` máx 5 archivos 25 MB con `validarSubida.js`) o body legacy `{cantidad}` | `{ok, progreso, meta, completado}` — con material queda PENDIENTE hasta revisión |
| GET | `/api/retos/evidencias/:id_reto_usuario` | Sí | `misEvidencias` | params: `id_reto_usuario` | Array de evidencias con estado + `OBSERVACION` del equipo |
| DELETE | `/api/retos/evidencias/:id_evidencia` | Sí | `eliminarEvidencia` | params: `id_evidencia` | `{ok, msg}` — solo evidencias propias en `pendiente` (borra archivos, 400 si ya revisada) |
| GET | `/api/retos/admin/evidencias` | Admin | `adminEvidencias` | — | Todas las evidencias (con `RETO_DESCRIPCION`) |
| POST | `/api/retos/admin/evidencias/:id_evidencia/aprobar` | Admin | `aprobarEvidencia` | body: `{observacion (opcional)}` | `{ok, msg}` — suma `CANTIDAD`, genera cupón al llegar la meta, **conserva el material** |
| POST | `/api/retos/admin/evidencias/:id_evidencia/rechazar` | Admin | `rechazarEvidencia` | body: `{observacion (opcional máx 500)}` | `{ok, msg}` — el motivo se muestra al usuario («Ver motivo de la revisión») |

### Tablas que utiliza
`RETOS`, `RETOS_USUARIOS`, `RETO_EVIDENCIAS`, `DESCUENTOS`, `USUARIOS`, `NOTIFICACIONES`

### Flujo de recompensa (`generarCupon`)
1. Al aprobarse la evidencia que alcanza la meta, se genera un cupón con formato: `RETO-XXXX-XXXX` (4+4 caracteres aleatorios).
2. Se inserta en la tabla `DESCUENTOS` con 30 días de validez, `USADO = 0` (se marca al aplicarse en el checkout) y `MONTO_MINIMO` según el porcentaje (`utils/reglasCupones.js`: ≥10% → $200k, 7-9% → $150k, 5-6% → $100k, 3-4% → $50k).
3. Se actualiza `RETOS_USUARIOS.CUPON_GENERADO` con el código y se notifica al usuario (correo + in-app).

### Notas
- El reporte de progreso acepta parte del material por **multipart con multer** (`uploads/usuarios/{USUARIO}/retos/r{id_reto_usuario}/`), no base64; sin material suma directo.
- Si el reto ya fue completado, no permite reportar más progreso; el usuario puede eliminar sus evidencias aún en revisión.
- Al aprobar/rechazar ya NO se borra el material: el usuario lo conserva visible en «Mis avances enviados» y puede ver el motivo del rechazo.
- ❌ `POST /completar/:id_reto_usuario` **no existe** en `retoRoutes.js`: la aprobación del admin es quien cierra el reto.

---

## 🔹 `pqrController.js`
**Ubicación:** `backend/controllers/pqrController.js`  
**Propósito:** Creación de PQRS (peticiones, quejas, reclamos, sugerencias).

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/pqr` | Sí | `crearPqr` | body: `{tipo, asunto, descripcion, numeroPedido}` | `{ok, msg}` |

### Tablas que utiliza
`PQR`

### Notas
- `tipo`, `asunto` y `descripcion` son obligatorios.
- `numeroPedido` es opcional (para asociar la PQR a una compra).
- Se asigna estado `PENDIENTE` automáticamente.

---

## 🔹 `seguridadController.js`
**Ubicación:** `backend/controllers/seguridadController.js`  
**Propósito:** Cambio de contraseña desde el perfil del usuario.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/auth/cambiar-password` | Sí | `cambiarPassword` | body: `{password_actual, password_nueva}` | `{ok, msg}` |

### Tablas que utiliza
`USUARIOS`

### Notas
- La nueva contraseña debe tener al menos 8 caracteres.
- Verifica la contraseña actual con `bcrypt.compare()` antes de actualizar.
- La nueva contraseña se hashea con `bcrypt.hash()` (salt rounds = 10).

---

## 🔹 `metodoPagoController.js`
**Ubicación:** `backend/controllers/metodoPagoController.js`  
**Propósito:** Gestión de métodos de pago guardados por el usuario (para reutilizar en compras futuras).

### Endpoints (base: `/api/usuarios/metodos-pago`)

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/` | Sí | `obtenerMetodos` | — | Array de métodos guardados |
| POST | `/` | Sí | `guardarMetodo` | body: `{id_metodo, titular, telefono, banco, tipo}` | `{ok, msg, id}` |
| DELETE | `/:id` | Sí | `eliminarMetodo` | params: `id` | `{ok, msg}` |
| PUT | `/:id/principal` | Sí | `establecerPrincipal` | params: `id` | `{ok, msg}` |

### Tablas que utiliza
`USUARIOS_METODOS_PAGO`, `METODOS_PAGO`

### Notas
- No se almacenan datos sensibles (solo titular, teléfono, banco).
- `establecerPrincipal` desmarca cualquier otro método principal del usuario antes de marcar el nuevo.

---

## 🔹 `proveedorController.js`
**Ubicación:** `backend/controllers/proveedorController.js`  
**Propósito:** Listado de proveedores (usado en formularios de productos).

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/proveedores` | No | `obtenerProveedores` | — | Array `{ID_PROVEEDOR, NOMBRE_PROVEEDOR}` |

### Tablas que utiliza
`PROVEEDORES`

### Notas
- Endpoint público (sin autenticación).
- Ruta montada en server.js como `proveedoresRoutes` (archivo `routes/proveedores.js`).

---

## 🔹 `resenaController.js` (legacy — no utilizado)
**Ubicación:** `backend/controllers/resenaController.js`  
**Estado:** No está montado en `server.js`. Existe como código heredado.

### Endpoints (no funcionales)

| Método | Ruta | Auth | Función |
|--------|------|------|---------|
| GET | (no montado) | — | `obtenerResenas` |
| POST | (no montado) | — | `agregarResena` |

### Notas
- `productoController.js` ya implementa `obtenerResenasPorProducto` y `agregarResena` con soporte de sesión (`req.user.ID_USUARIO`).
- Este archivo puede eliminarse sin afectar funcionalidad.

---

# Backend — Módulo Admin

---

## 🔹 `devolucionController.js`
**Ubicación:** `backend/controllers/devolucionController.js`  
**Propósito:** Solicitudes de devolución (RF-033): el cliente crea la solicitud sobre productos de pedidos COMPLETADOS y el administrador aprueba (reingreso automático de stock) o rechaza.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/devoluciones` | Sí | `solicitarDevolucion` | `multipart/form-data`: `{id_venta, motivo, tipo, productos[] (cantidad), evidencias[] fotos/videos}` | `{ok, msg, ID_DEVOLUCION}` — crea un chat DEVOLUCION por vendedor |
| GET | `/api/devoluciones` | Sí | `misDevoluciones` | — | Array con producto, imagen, estado e `ID_CHAT` del hilo |
| POST | `/api/devoluciones/evidencias` | Sí | `subirEvidencias` | multipart | `{ok, msg}` — subida inicial (con la solicitud) |
| POST | `/api/devoluciones/:id/evidencias` | Sí | `agregarEvidencias` | multipart (más fotos/videos) | `{ok, msg}` — en MAS_PRUEBAS vuelve a SOLICITADA y notifica a JADDA |
| DELETE | `/api/devoluciones/evidencias/:idEvidencia` | Sí | `eliminarEvidencia` | params: `idEvidencia` | `{ok, msg}` — borra el archivo (Cloudinary o disco) |
| GET | `/api/devoluciones/admin` | Admin | `todas` | — | Array con cliente, producto, total, método de pago y dirección completa |
| POST | `/api/devoluciones/admin/:id/procesar` | Admin | `procesar` | body: `{decision: devolver\|reembolsar\|mas_pruebas\|rechazar, observacion}` | `{ok, msg}` — ❗ bloquea 403 si el producto es de un vendedor y no está ESCALADA (se gestiona en su chat) |

### Tablas que utiliza
`DEVOLUCIONES`, `DEVOLUCIONES_EVIDENCIAS`, `VENTAS`, `DETALLE_VENTAS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`, `PRODUCTO_VARIANTES`, `USUARIOS`, `NOTIFICACIONES`, `CHAT`, `CHAT_MENSAJE`, `METODOS_PAGO`

### Notas
- Solo se aceptan devoluciones de ventas COMPLETADAS del propio usuario; la cantidad no puede exceder lo comprado menos lo ya solicitado/aprobado; y la regla de 3 días post-entrega (`ENVIOS.FECHA_ENTREGA`) bloquea pedidos fuera de plazo con 400.
- `procesar` admite **4 decisiones**: `devolver` (reingreso de stock por variante real + `MOVIMIENTOS_STOCK` ENTRADA en transacción con `FOR UPDATE`), `reembolsar`, `mas_pruebas` (pide evidencias) y `rechazar` (observación obligatoria); normaliza el estado legacy del body (`APROBADA` → `devolver`).
- Cada solicitud notifica con ruta `/perfil/devolucion/{ID_VENTA}` y el correo lleva botón «Ver mi solicitud».
- Para productos de vendedores la solicitud crea un `CHAT` de tipo DEVOLUCION con ese vendedor (con censor de groserías `utils/groserias.js`); si se escala, JADDA abre dos hilos separados (uno por parte) y el admin gestiona con `PARTE`.
- Las evidencias se suben a Cloudinary (`jadda/devoluciones/{clave}`) con fallback a `uploads/devoluciones/`; la tabla `DEVOLUCIONES_EVIDENCIAS` guarda cada archivo.
- Las tablas `DEVOLUCIONES`/`DEVOLUCIONES_EVIDENCIAS` se auto-crean vía `MIGRACIONES.createSql` en `database/setup.js`.

---

## 🔹 `adminController.js`
**Ubicación:** `backend/controllers/adminController.js`  
**Propósito:** Panel de administración: dashboard con estadísticas, gestión de órdenes (con notificaciones de estado RF-025), facturas PDF (RF-021), reportes de ventas (RF-032), ranking de más vendidos (RF-034) y listado de usuarios.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/admin/dashboard` | Admin | `obtenerDashboard` | — | `{stats: {totalProductos, totalOrdenes, totalUsuarios, totalIngresos}, ordenesRecientes[]}` |
| GET | `/api/admin/compras` | Admin | `obtenerTodasLasCompras` | — | Array de todas las ventas con detalle de productos |
| PUT | `/api/admin/compras/:id/estado` | Admin | `actualizarEstadoCompra` | body: `{estado}` | `{ok, msg}` (dispara notificación RF-025) |
| PUT | `/api/admin/compras/:id/envio` | Admin | `actualizarEstadoEnvio` | body: `{estado_envio}` | `{ok, msg}` (dispara notificación RF-025) |
| GET | `/api/admin/compras/:id/factura` | Admin | `descargarFacturaAdmin` | — | PDF de la factura (RF-021) |
| GET | `/api/admin/reportes/ventas` | Admin | `reporteVentas` | query: `desde`, `hasta` (default 30 días) | `{totalOrdenes, totalIngresos, ticketPromedio, totalUnidades, serie[]}` |
| GET | `/api/admin/reportes/excel` | Admin | `descargarReporteExcel` | query: `desde`, `hasta` | .xlsx con 5 hojas y fórmulas (`reporte-jadda_<desde>_a_<hasta>.xlsx`) |
| GET | `/api/admin/reportes/pdf` | Admin | `descargarReportePdf` | query: `desde`, `hasta` | PDF ejecutivo con gráficas (`reporte-jadda_<desde>_a_<hasta>.pdf`) |
| GET | `/api/admin/analytics/mas-vendidos` | Admin | `masVendidos` | query: `desde`, `hasta`, `limite` | Ranking `[{ID, NOMBRE, IMAGEN, unidades, ingresos, stock}]` |
| GET | `/api/admin/usuarios` | Admin | `obtenerUsuarios` | — | Array de usuarios con rol |

### Tablas que utiliza
`VENTAS`, `USUARIOS`, `METODOS_PAGO`, `ENVIOS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`, `DETALLE_VENTAS`, `PRODUCTO_VARIANTES`, `ROLES`, `NOTIFICACIONES`

### Notas
- El middleware de sesión en `adminRoutes.js` es `esAdmin` (verifica rol de administrador, ID_ROL = 1).
- `obtenerPendientes` suma también pendientes de retos, devoluciones, productos sin publicar y solicitudes de vendedor (para los badges del sidebar).
- Los reportes descargables usan fuentes compartidas `utils/reporteDatos.js` + `utils/reporteExcel.js` (exceljs, fórmulas COUNTIFS/SUMIF) y `utils/reportePdf.js` (pdfkit con gráficas vectoriales).
- `obtenerDashboard` cuenta productos, ventas totales, usuarios registrados y suma de ingresos de ventas COMPLETADAS.
- `obtenerTodasLasCompras` incluye JOIN con `USUARIOS` para obtener nombre del cliente y productos con imágenes.
- `actualizarEstadoCompra` acepta cualquier string como estado (PENDIENTE, CONFIRMADA, ENVIADA, COMPLETADA, CANCELADA) y dispara `notificarCambioEstado` (RF-025).
- `reporteVentas` y `masVendidos` excluyen ventas CANCELADAS; `masVendidos` usa subconsultas para imagen y stock (un JOIN a `PRODUCTO_VARIANTES` multiplicaría las unidades).
- `obtenerUsuarios` incluye nombre del rol via JOIN con `ROLES`.

---

# Archivos de Configuración

---

## 🔹 `config/db.js`
**Ubicación:** `backend/config/db.js`  
**Propósito:** Pool de conexiones a MySQL con `mysql2/promise`. Incluye mecanismo de reintentos para sincronizar con Docker.

### Configuración
| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_HOST` | `database` | Host del servidor MySQL |
| `DB_USER` | `root` | Usuario |
| `DB_PASSWORD` | `''` | Contraseña |
| `DB_NAME` | `jadda_sports_db` | Nombre de la base de datos |

### Funcionamiento
- Crea un pool de conexiones (`connectionLimit: 10`, `queueLimit: 100`) con `mysql2/promise`.
- Exporta `promisePool` para usar `await db.query()` en los controladores.
- La función `verificarConexion()` reintenta hasta **30 veces con 3 s de espera** (con log por reintento) para dar tiempo a que MySQL arranque en Docker sin depender del healthcheck del contenedor.
- Usa un archivo `reinicio.tmp` para detectar si es el primer arranque y evitar logs repetitivos.

---

## 🔹 `config/passport.js`
**Ubicación:** `backend/config/passport.js`  
**Propósito:** Estrategias de autenticación OAuth (Google, Facebook) y serialización de sesión.

### Estrategias
| Proveedor | Strategy | Campos |
|-----------|----------|--------|
| Google | `passport-google-oauth20` | `profile.id`, `displayName`, `emails[0].value`, `photos[0].value` — en el flujo web valida el perfil vía `openidconnect.googleapis.com/v1/userinfo` (exige `email_verified`) |
| Facebook | `passport-facebook` | `id`, `displayName`, `emails[0].value`, `photos[0].value` |

### Serialización
- `serializeUser`: guarda el email del usuario en la sesión.
- `deserializeUser`: consulta `USUARIOS` por email y devuelve `{ID_USUARIO, NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, FOTO_URL, ID_ROL}` como `req.user`.

### Notas
- Si el usuario no existe al autenticarse con OAuth, se crea automáticamente con `ID_ROL = 4` (Usuario) y `CONFIRMADO = 1`.
- Las contraseñas de usuarios OAuth se guardan como el nombre del proveedor (`'google'` o `'facebook'`).
- La estrategia de Facebook usa `profileFields` para solicitar `id`, `displayName`, `emails`, `photos`.
- Si Facebook no proporciona email, la autenticación falla.

---

## 🔹 `config/mailer.js`
**Ubicación:** `backend/config/mailer.js`  
**Propósito:** Transporte de correo electrónico usando Nodemailer con Gmail.

### Configuración
```js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### Notas
- Usa el servicio SMTP de Gmail.
- `EMAIL_USER` debe ser un correo Gmail válido.
- `EMAIL_PASS` debe ser una contraseña de aplicación de Google (no la contraseña normal).
- Se usa para: bienvenida/verificación, recuperación de contraseña, factura de compra.

---

## 🔹 `middlewares/authMiddleware.js`
**Ubicación:** `backend/middlewares/authMiddleware.js`  
Exporta la función de sesión usada por las rutas.

### Funciones

| Función | Tipo | Descripción |
|---------|------|-------------|
| `verificarSesion` | Sesión Passport | Verifica `req.isAuthenticated()` de Passport. Usado por rutas del carrito. |

### Notas
- La mayoría de rutas usan su propia verificación inline (`req.isAuthenticated()`) en lugar de este middleware.

---

## 🔹 `database/setup.js`
**Ubicación:** `backend/database/setup.js`  
**Propósito:** Creación automática de tablas y seed de datos de referencia al arrancar el contenedor.

### Funcionamiento
1. Conecta a MySQL (sin base de datos inicial) con `mysql.createConnection`.
2. Ejecuta `CREATE DATABASE IF NOT EXISTS`.
3. Ejecuta el script `CREATE_TABLES_RAW` que contiene **35 `CREATE TABLE IF NOT EXISTS`**.
4. Ejecuta el script `SEED_DATA` con `INSERT IGNORE` para datos de referencia (imágenes del catálogo con URLs **Cloudinary**).
5. Aplica `MIGRACIONES` idempotentes (ALTERs, columnas nuevas y tablas adicionales) para BD existentes.
6. Reintenta hasta 10 veces con 3s de espera si MySQL no está listo; en producción falla rápido si faltan secretos (`SESSION_SECRET`, `DB_PASSWORD`) o si el admin no está sembrado (`seedAdminUser`).

### Tablas creadas
| Tabla | Propósito |
|-------|-----------|
| `ROLES` | Roles de usuario (Admin, Soporte, Proveedor, Usuario, Invitado, Vendedor) — 6 roles sembrados |
| `USUARIOS` | Cuentas de usuario (con `TOKEN`, `TOKEN_EXPIRA`, `DEBE_CAMBIAR_PASSWORD`, `ULTIMA_*`) |
| `DIRECCIONES` | Direcciones de envío |
| `PROVEEDORES` | Proveedores |
| `CATEGORIAS` | Categorías de productos (15 categorías) |
| `DESCUENTOS` | Cupones y descuentos (con `USADO` y `MONTO_MINIMO`) |
| `PRODUCTOS` | Catálogo de productos (con `ESTADO_PUBLICACION`, `ID_VENDEDOR`) |
| `PRODUCTO_VARIANTES` | Variantes (color, talla, stock) |
| `PRODUCTO_IMAGENES` | Imágenes de productos (URL Cloudinary + orden) |
| `PRODUCTO_CARACTERISTICAS` | Ficha técnica / características |
| `METODOS_PAGO` | Métodos de pago disponibles |
| `VENTAS` | Órdenes de compra (`PENDIENTE_PAGO`/`COMPLETADA`/`CANCELADA`, `DATOS_PAGO` JSON) |
| `DETALLE_VENTAS` | Productos por venta (con `ID_VARIANTE`) |
| `ENVIOS` | Datos de envío (con `COSTO_ENVIO`, `FECHA_ENTREGA`) |
| `MOVIMIENTOS_STOCK` | Registro entradas/salidas de stock |
| `PAGOS_EVENTOS` | Bitácora idempotente del webhook de Wompi (UNIQUE `EXTERNO_ID+CHECKSUM`; `ESTADO_PROCESADO` RECIBIDO/CONFIRMADA/CANCELADA/IGNORADO/FIRMA_INVALIDA) |
| `sessions` | Sesiones de express (persistencia MySQL) |
| `FAVORITOS` | Productos favoritos |
| `HISTORIAL` | Historial de productos vistos |
| `CARRITO` | Carrito de compras por usuario |
| `RESENAS` | Reseñas de productos |
| `PQR` | Peticiones, quejas, reclamos, sugerencias |
| `RETOS` / `RETOS_USUARIOS` | Retos deportivos e inscripciones |
| `RETO_EVIDENCIAS` | Evidencias de avances (con `OBSERVACION` y material conservado) |
| `NOTIFICACIONES` | Notificaciones in-app |
| `DEVOLUCIONES` / `DEVOLUCIONES_EVIDENCIAS` | Devoluciones/reembolsos con galería de evidencias |
| `SOLICITUDES_VENDEDOR` / `VENDEDORES` | Registro de vendedores (informal con empresa/NIT opcionales) |
| `CHAT` / `CHAT_MENSAJE` | Chats usuario↔vendedor↔admin (SOPORTE/VENDEDOR/DEVOLUCION, `PARTE` tras escalación) |
| `PLANTILLAS_PLANES` / `PLANES_USUARIO` | Planes de entrenamiento |
| `USUARIOS_METODOS_PAGO` | Métodos de pago guardados por usuario |
| `AVISOS_STOCK` | Suscripciones a aviso de reposición |

### Seed data
- 6 roles, 15 categorías, 104 productos con imágenes Cloudinary (310 registros en `PRODUCTO_IMAGENES`), métodos de pago, descuentos, proveedores, 16 retos activos, 7 plantillas de planes (más 3 añadidos: Ropa Activa, Cardio Quema Grasa, Home Fitness).
- Opcional: `DEMO_DATA !== 'false' && NODE_ENV !== 'production'` siembra además ~684 filas de datos demo (ventas, chats, retos) — **omitida** en producción.

### Notas
- `INSERT IGNORE` evita duplicados en cada reinicio del contenedor.
- Si se ejecuta `docker compose down -v`, el volumen `mysql_data` se elimina y en el próximo `up` se regenera todo desde cero.
- Usa `multipleStatements: true` para ejecutar todo como un solo script.
- Después de ejecutar, cierra la conexión con `connection.end()`.

---

# Archivos del Servidor

---

## 🔹 `server.js`
**Ubicación:** `backend/server.js`  
**Propósito:** Punto de entrada del backend. Configura middlewares globales, monta rutas, maneja errores y levanta el servidor Express.

### Middlewares globales (orden de carga)
1. `GET /health` — sonda de vida síncrona (sin BD, sin sesión, responde `{ok, estado}`), montada **antes** de todos los demás middlewares
2. `helmet` (headers de seguridad; CORP siempre, CSP/HSTS solo en producción)
3. `registrarPeticion` (middleware `middlewares/registroPeticiones.js`: UNA línea JSON por petición con `X-Request-Id` de correlación)
4. `cors` — orígenes de `config/origenesAdmitidos.js` + env `CORS_ORIGINS`, `credentials: true`
5. `proteccionOrigen` (defensa CSRF por verificación de Origin en mutaciones; Origin "null"/ajeno → 403)
6. `express.json()` y `express.urlencoded()` (límite 1mb; la subida de imágenes usa su propio límite 25mb en la ruta)
7. Rate limiter global en memoria (ventana 15 min, máx 10 peticiones por IP — `/health` y `/api/health` exentas)
8. `express-session` con `MySQLStore` (persistencia de sesiones en BD, expiración 24h; `SESSION_SECRET` obligatorio en producción)
9. `passport.initialize()` y `passport.session()` (`trust proxy` configurable con `TRUST_PROXY`, default 1 en prod)
10. Cache-Control: `no-store`
11. Estáticos: `/images/usuarios` y `/images/devoluciones` con **autorización por recurso** (`servirArchivoPrivado`: dueño/vendedor/admin; retos solo dueño), Cloudinary-first para medios

### Montaje de rutas

| Prefijo | Archivo de rutas |
|---------|------------------|
| `/api/auth` | `authRoutes.js` |
| `/api/productos` | `productoRoutes.js` (incluye subida de imágenes `/imagenes`) |
| `/api/carrito` | `carritoRoutes.js` |
| `/api/proveedores` | `routes/proveedores.js` |
| `/api/direcciones` | `direccionRoutes.js` |
| `/api/favoritos` | `favoritosRoutes.js` |
| `/api/historial` | `historialRoutes.js` |
| `/api/compras` | `comprasRoutes.js` |
| `/api/cupones` | `cuponesRoutes.js` |
| `/api/checkout` | `checkoutRoutes.js` |
| `/api/pqr` | `pqrRoutes.js` |
| `/api/retos` | `retoRoutes.js` |
| `/api/planes` | `planRoutes.js` |
| `/api/admin` | `adminRoutes.js` |
| `/api/usuarios/metodos-pago` | `metodoPagoRoutes.js` |
| `/api/contacto` | `contactoRoutes.js` |
| `/api/envio` | `envioRoutes.js` |
| `/api/newsletter` | `newsletterRoutes.js` |
| `/api/notificaciones` | `notificacionRoutes.js` |
| `/api/devoluciones` | `devolucionRoutes.js` |
| `/api/vendedor` | `vendedorRoutes.js` |
| `/api/chat` | `chatRoutes.js` |

### Sondas de salud
- `GET /health` (montada primero, sin BD) y `GET /api/health` (exenta del rate limiter) — ambas usadas por los healthchecks de Docker.
- El scheduler de newsletter (`NEWSLETTER_INTERVAL_HORAS`, default 72 h) también vive en `server.js`.

### Manejo de errores
- Middleware global `(err, req, res, next)` **honra `err.status`** del parser de Express (por ejemplo JSON malformado → 400 «Petición rechazada», límite de body excedido → 413) y responde `{error, mensaje, reqId}` con el id de correlación de la petición; sin `err.status` responde 500.
- Log de error en JSON (nivel error, correlacionable por el mismo `reqId`) + stack trace.

### Cierre ordenado (`SIGTERM`/`SIGINT`)
1. `server.close()` — deja de aceptar conexiones nuevas y espera a que las activas terminen (drain).
2. Cierra el `sessionStore` de MySQL.
3. Libera el pool de BD (timeout 10 s en total).

### Archivo de rastreo (`reinicio.tmp`)
- Detecta si es el primer arranque de Docker para mostrar logs de bienvenida.
- En reinicios normales (nodemon), solo muestra un mensaje breve.
- Se elimina en `SIGINT`/`SIGTERM` para que el próximo `docker compose up` muestre bienvenida completa.

---

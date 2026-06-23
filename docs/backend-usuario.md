# Backend — Módulo Usuario

Documentación de todos los controllers y rutas del backend orientados al usuario final (excluye panel admin).

---

## 🔹 `authController.js`
**Ubicación:** `backend/controllers/authController.js`  
**Propósito:** Registro, inicio de sesión, confirmación de cuenta (código 6 dígitos), recuperación de contraseña, gestión de perfil y cierre de sesión. Usa `express-session` + `Passport.js` (no JWT).

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| POST | `/api/auth/registro` | No | `registro` | body: `{nombre, apellido, correo, password, telefono}` | `{ok, msg}` |
| POST | `/api/auth/login` | No | `login` | body: `{correo, password}` | `{ok, msg, user}` |
| POST | `/api/auth/confirmar` | No | `confirmarCuenta` | body: `{codigo, correo}` | `{ok, msg}` |
| POST | `/api/auth/recuperar-password` | No | `recuperarPassword` | body: `{correo}` | `{ok, msg}` |
| POST | `/api/auth/verificar-codigo` | No | `validarCodigoRecuperacion` | body: `{correo, codigo}` | `{ok, msg, token}` |
| POST | `/api/auth/update-password` | No | `actualizarPassword` | body: `{token, password}` | `{ok, msg}` |
| POST | `/api/auth/reenviar-codigo` | No | `reenviarCodigo` | body: `{correo}` | `{ok, msg}` |
| GET | `/api/auth/perfil` | Sí | `obtenerPerfil` | — | `{ID_USUARIO, NOMBRE_USUARIO, CORREO, ...}` |
| PUT | `/api/auth/perfil` | Sí | `actualizarPerfil` | body: `{nombre, apellido, telefono, foto_url}` | `{ok, msg}` |
| POST | `/api/auth/logout` | Sí | `logout` | — | `{ok, msg}` |
| GET | `/api/auth/google` | No | passport Google OAuth | query: `from` | Redirige a Google |
| GET | `/api/auth/google/callback` | No | passport callback | query: `state` (ruta origen) | Redirige a frontend |
| GET | `/api/auth/google-client-id` | No | inline | — | `{clientId}` |

### Tablas que utiliza
`USUARIOS`, `ROLES`, `TOKENS_RECUPERACION`

### Dependencias
`bcryptjs` (hash de contraseñas), `crypto` (generación de tokens/códigos), `../config/mailer` (envío de emails), `passport` (estrategia Google OAuth)

### Notas
- El registro asigna `ID_ROL = 4` (Usuario).
- La confirmación usa un código de 6 dígitos con expiración de 15 minutos.
- El login usa `req.login()` de Passport para crear la sesión (cookie).
- Las contraseñas se hashean con `bcryptjs` (salt rounds = 10).
- Las rutas de redes sociales (Google) redirigen al frontend con `?user` y `?photo` en la URL.

---

## 🔹 `productoController.js`
**Ubicación:** `backend/controllers/productoController.js`  
**Propósito:** CRUD de productos, consultas con filtros, productos relacionados, gestión de variantes, características (ficha técnica) y reseñas de clientes.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/productos` | No | `obtenerProductos` | query: `search` (opcional) | Array de productos con STOCK agregado |
| GET | `/api/productos/:id` | No | `obtenerProductoPorId` | params: `id` | Producto + `IMAGENES`, `CARACTERISTICAS`, `VARIANTES` |
| GET | `/api/productos/relacionados/:id` | No | `obtenerRelacionados` | params: `id` | Array de 4 productos relacionados |
| GET | `/api/productos/categorias` | No | `obtenerCategorias` | — | Array `{ID_CATEGORIA, NOMBRE_CATEGORIA}` |
| GET | `/api/productos/descuentos` | No | `obtenerDescuentos` | — | Descuentos vigentes (`FECHA_FIN >= CURDATE()`) |
| GET | `/api/productos/:id/variantes` | No | `obtenerVariantes` | params: `id` | Array de variantes del producto |
| POST | `/api/productos/:id/variantes` | No | `agregarVariante` | body: `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{ID_VARIANTE}` |
| PUT | `/api/productos/variantes/:idVariante` | No | `actualizarVariante` | body: `{COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK}` | `{message}` |
| DELETE | `/api/productos/variantes/:idVariante` | No | `eliminarVariante` | params: `idVariante` | `{message}` |
| GET | `/api/productos/:id/caracteristicas` | No | `obtenerCaracteristicas` | params: `id` | Array de características |
| POST | `/api/productos/:id/caracteristicas` | No | `agregarCaracteristica` | body: `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{ID_CARACTERISTICA}` |
| GET | `/api/productos/caracteristicas/:id` | No | `obtenerCaracteristicaPorId` | params: `idCaracteristica` | Objeto característica |
| PUT | `/api/productos/caracteristicas/:id` | No | `actualizarCaracteristica` | body: `{NOMBRE_ATRIBUTO, VALOR_ATRIBUTO}` | `{message}` |
| DELETE | `/api/productos/caracteristicas/:id` | No | `eliminarCaracteristica` | params: `idCaracteristica` | `{message}` |
| GET | `/api/productos/:id/resenas` | No | `obtenerResenasPorProducto` | params: `id` | Array de reseñas con `NOMBRE_USUARIO` |
| POST | `/api/productos/:id/resenas` | Sí (inline) | `agregarResena` | body: `{comentario, calificacion}` | `{message}` |
| POST | `/api/productos` | No | `crearProducto` | body: completo (ver abajo) | `{message, id}` |
| PUT | `/api/productos/:id` | No | `actualizarProducto` | body: completo | `{message}` |
| DELETE | `/api/productos/:id` | No | `eliminarProducto` | params: `id` | `{message}` |

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
- `obtenerProductos` agrega `STOCK` con `SUM(PV.STOCK)` e incluye `ID_VARIANTE_POR_DEFECTO`.
- `obtenerRelacionados` intenta 4 productos de la misma categoría; si no hay suficientes, completa con productos aleatorios de otras categorías.
- `POST /:id/resenas` tiene middleware inline `req.isAuthenticated()` — **no** usa el middleware de ruta estándar.
- Las reseñas se devuelven con `NOMBRE_USUARIO` (JOIN con `USUARIOS`).
- Los endpoints `POST /`, `PUT /:id`, `DELETE /:id` **no tienen middleware de autenticación** — son accesibles sin sesión.

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
1. Mapea `metodoPago` → `ID_METODO` (`METODO_MAP`: tarjeta→2, pse→7, nequi→4, daviplata→5)
2. Consulta el carrito del usuario con JOIN a `PRODUCTO_IMAGENES`
3. Calcula subtotal, aplica descuento
4. Genera referencia de pago: `SIM_{timestamp}_{idUsuario}`
5. Inserta `VENTAS` con estado `COMPLETADA`, guarda `DATOS_PAGO` como JSON
6. Inserta `DETALLE_VENTAS` por cada producto
7. Inserta `ENVIOS` con estado `PENDIENTE` y `FECHA_ENVIO = NOW() + 3 días`
8. Vacía el carrito (`DELETE FROM CARRITO`)
9. Genera plan de entrenamiento: busca plantilla por categoría del producto; si ninguna coincide, usa la primera disponible (fallback)
10. Envía factura HTML por email con imágenes de productos, datos de pago y envío

### Tablas que utiliza
`CARRITO`, `PRODUCTOS`, `PRODUCTO_IMAGENES`, `VENTAS`, `DETALLE_VENTAS`, `ENVIOS`, `METODOS_PAGO`, `PLANTILLAS_PLANES`, `PLANES_USUARIO`

### Dependencias
`../config/mailer` (transporte nodemailer), `../config/db`

### Notas
- El email de factura incluye: logo, tabla de productos con thumbnail 48×48, subtotales, descuento, total, dirección de envío, método de pago con detalles (titular + últimos 4 dígitos para tarjeta, teléfono para Nequi/Daviplata, banco para PSE), y banner de plan si se generó.
- Los errores de envío de email se capturan silenciosamente (no bloquean la compra).

---

## 🔹 `comprasController.js`
**Ubicación:** `backend/controllers/comprasController.js`  
**Propósito:** Historial de compras del usuario autenticado con detalle de productos.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/compras` | Sí | `obtenerCompras` | — | Array de compras con `productos[]` |

### Tablas que utiliza
`VENTAS`, `METODOS_PAGO`, `ENVIOS`, `DETALLE_VENTAS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`

### Estructura de respuesta
```json
[{
  "ID_VENTA": 1,
  "FECHA_VENTA": "2026-06-22T...",
  "TOTAL": 150000,
  "ESTADO": "COMPLETADA",
  "REFERENCIA_PAGO": "SIM_...",
  "DATOS_PAGO": "{\"titular\":\"...\"}",
  "METODO_PAGO": "Tarjeta débito",
  "DIRECCION_ENVIO": "...",
  "CIUDAD": "...",
  "ESTADO_ENVIO": "PENDIENTE",
  "productos": [{ "CANTIDAD": 1, "PRECIO_UNITARIO": 50000, "SUBTOTAL": 50000, "NOMBRE": "...", "ID": 1, "IMAGEN": "..." }]
}]
```

### Notas
- `DATOS_PAGO` es un string JSON que debe ser parseado en el frontend.
- `METODO_PAGO` es el nombre del método (JOIN con `METODOS_PAGO`), no el ID.
- Los totales se devuelven como número (convertidos con `Number()`).

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
| POST | `/api/cupones/validar` | No | `validarCupon` | body: `{codigo}` | `{ok, descuento: {id, descripcion, porcentaje}}` |

### Tablas que utiliza
`DESCUENTOS`

### Notas
- Busca el código con `LIKE '%codigo%'` en la columna `DESCRIPCION`.
- Valida que `FECHA_INICIO <= hoy <= FECHA_FIN`.
- No requiere autenticación.

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
| GET | `/api/retos/mis-retos` | Sí | `misRetos` | — | Retos del usuario con progreso |
| POST | `/api/retos/unirse/:id_reto` | Sí | `unirseReto` | params: `id_reto` | `{ok, msg}` |
| POST | `/api/retos/progreso/:id_reto_usuario` | Sí | `reportarProgreso` | params: `id_reto_usuario`, body: `{cantidad}` | `{ok, progreso, meta, completado}` |
| POST | `/api/retos/completar/:id_reto_usuario` | Sí | `completarReto` | params: `id_reto_usuario` | `{ok, msg, cupon}` |

### Tablas que utiliza
`RETOS`, `RETOS_USUARIOS`, `DESCUENTOS`

### Flujo de recompensa (`generarCupon`)
1. Al completar un reto (progreso >= meta), se genera un cupón con formato: `RETO{ID_RETO}-{ID_USUARIO}-{RANDOM4}`.
2. Se inserta en la tabla `DESCUENTOS` con 30 días de validez.
3. Se actualiza `RETOS_USUARIOS.CUPON_GENERADO` con el código.

### Notas
- `reportarProgreso` incrementa el progreso acumulativo (no reemplaza).
- Si el reto ya fue completado, no permite reportar más progreso.
- `completarReto` fuerza la finalización manual si el progreso ya alcanzó la meta.

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

## 🔹 `adminController.js`
**Ubicación:** `backend/controllers/adminController.js`  
**Propósito:** Panel de administración: dashboard con estadísticas, gestión de órdenes y listado de usuarios.

### Endpoints

| Método | Ruta | Auth | Función | Parámetros | Respuesta |
|--------|------|------|---------|------------|-----------|
| GET | `/api/admin/dashboard` | Sí | `obtenerDashboard` | — | `{stats: {totalProductos, totalOrdenes, totalUsuarios, totalIngresos}, ordenesRecientes[]}` |
| GET | `/api/admin/compras` | Sí | `obtenerTodasLasCompras` | — | Array de todas las ventas con detalle de productos |
| PUT | `/api/admin/compras/:id/estado` | Sí | `actualizarEstadoCompra` | body: `{estado}` | `{ok, msg}` |
| GET | `/api/admin/usuarios` | Sí | `obtenerUsuarios` | — | Array de usuarios con rol |

### Tablas que utiliza
`VENTAS`, `USUARIOS`, `METODOS_PAGO`, `ENVIOS`, `PRODUCTOS`, `PRODUCTO_IMAGENES`, `DETALLE_VENTAS`, `ROLES`

### Notas
- El middleware de verificación de sesión es inline en `adminRoutes.js` — usa `req.isAuthenticated()` sin verificar rol de administrador.
- `obtenerDashboard` cuenta productos, ventas totales, usuarios registrados y suma de ingresos de ventas COMPLETADAS.
- `obtenerTodasLasCompras` incluye JOIN con `USUARIOS` para obtener nombre del cliente y productos con imágenes.
- `actualizarEstadoCompra` acepta cualquier string como estado (PENDIENTE, CONFIRMADA, ENVIADA, COMPLETADA, CANCELADA).
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
- Crea un pool de conexiones (máximo 10) con `mysql2.createPool()`.
- Exporta `promisePool` para usar `await db.query()` en los controladores.
- La función `verificarConexion()` reintenta hasta 5 veces con 2s de espera entre cada intento para dar tiempo a que MySQL arranque en Docker.
- Usa un archivo `reinicio.tmp` para detectar si es el primer arranque y evitar logs repetitivos.

---

## 🔹 `config/passport.js`
**Ubicación:** `backend/config/passport.js`  
**Propósito:** Estrategias de autenticación OAuth (Google, Facebook) y serialización de sesión.

### Estrategias
| Proveedor | Strategy | Campos |
|-----------|----------|--------|
| Google | `passport-google-oauth20` | `profile.id`, `displayName`, `emails[0].value`, `photos[0].value` |
| Facebook | `passport-facebook` | `id`, `displayName`, `emails[0].value`, `photos[0].value` |

### Serialización
- `serializeUser`: guarda el email del usuario en la sesión.
- `deserializeUser`: consulta `USUARIOS` por email y devuelve `{ID_USUARIO, NOMBRE_USUARIO, EMAIL, FOTO_URL}` como `req.user`.

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
**Propósito:** Middleware de autenticación. Contiene dos funciones exportadas.

### Funciones

| Función | Tipo | Descripción |
|---------|------|-------------|
| `verificarToken` | JWT (legacy) | Verifica token JWT en header `Authorization`. **No usado actualmente.** |
| `verificarSesion` | Sesión Passport | Verifica `req.isAuthenticated()` de Passport. Usado por rutas del carrito. |

### Notas
- `verificarToken` es código heredado del stack anterior (JWT). No se usa en ninguna ruta actual.
- La mayoría de rutas usan su propia verificación inline (`req.isAuthenticated()`) en lugar de este middleware.

---

## 🔹 `database/setup.js`
**Ubicación:** `backend/database/setup.js`  
**Propósito:** Creación automática de tablas y seed de datos de referencia al arrancar el contenedor.

### Funcionamiento
1. Conecta a MySQL (sin base de datos inicial) con `mysql.createConnection`.
2. Ejecuta `CREATE DATABASE IF NOT EXISTS`.
3. Ejecuta el script `CREATE_TABLES_RAW` que contiene 22 `CREATE TABLE IF NOT EXISTS`.
4. Ejecuta el script `SEED_DATA` con `INSERT IGNORE` para datos de referencia.
5. Reintenta hasta 10 veces con 3s de espera si MySQL no está listo.

### Tablas creadas
| Tabla | Propósito |
|-------|-----------|
| `ROLES` | Roles de usuario (Admin, Empleado, Proveedor, Usuario, Invitado) |
| `CATEGORIAS` | Categorías de productos (14 categorías) |
| `PRODUCTOS` | Catálogo de productos |
| `PRODUCTO_IMAGENES` | Imágenes de productos (URL + orden) |
| `PRODUCTO_VARIANTES` | Variantes (color, talla, stock) |
| `PRODUCTO_CARACTERISTICAS` | Ficha técnica / características |
| `USUARIOS` | Cuentas de usuario |
| `DIRECCIONES` | Direcciones de envío |
| `CARRITO` | Carrito de compras por usuario |
| `VENTAS` | Órdenes de compra |
| `DETALLE_VENTAS` | Productos por venta |
| `ENVIOS` | Datos de envío |
| `METODOS_PAGO` | Métodos de pago disponibles (15 registros) |
| `DESCUENTOS` | Cupones y descuentos |
| `FAVORITOS` | Productos favoritos |
| `HISTORIAL` | Historial de productos vistos |
| `RESENAS` | Reseñas de productos |
| `PQR` | Peticiones, quejas, reclamos |
| `PROVEEDORES` | Proveedores |
| `EMPLEADOS` | Empleados |
| `RETOS` / `RETOS_USUARIOS` | Retos deportivos |
| `PLANTILLAS_PLANES` / `PLANES_USUARIO` | Planes de entrenamiento |
| `USUARIOS_METODOS_PAGO` | Métodos de pago guardados por usuario |

### Seed data
- 5 roles, 14 categorías, 45+ productos con imágenes, 11 empleados, 15 métodos de pago, descuentos, proveedores, 4 retos activos, 6 plantillas de planes (más 3 adicionales: Ropa Activa, Cardio Quema Grasa, Home Fitness).

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
1. Logger de peticiones (solo POST/PUT)
2. `cors` — origen `http://localhost:5173`, `credentials: true`
3. `express.json()` y `express.urlencoded()`
4. `express-session` con `MySQLStore` (persistencia de sesiones en BD, expiración 24h)
5. `passport.initialize()` y `passport.session()`
6. Cache-Control: `no-store`

### Montaje de rutas

| Prefijo | Archivo de rutas |
|---------|------------------|
| `/api/auth` | `authRoutes.js` |
| `/api/productos` | `productoRoutes.js` |
| `/api/carrito` | `carritoRoutes.js` |
| `/api/proveedores` | `proveedores.js` |
| `/api/direcciones` | `direccionRoutes.js` |
| `/api/favoritos` | `favoritosRoutes.js` |
| `/api/historial` | `historialRoutes.js` |
| `/api/compras` | `comprasRoutes.js` |
| `/api/cupones` | `cuponesRoutes.js` |
| `/api/checkout` | `checkoutRoutes.js` |
| `/api/pqr` | `pqrRoutes.js` |
| `/api/retos` | `retoRoutes.js` |
| `/api/planes` | `planRoutes.js` |
| `/api/usuarios/metodos-pago` | `metodoPagoRoutes.js` |
| `/api/admin` | `adminRoutes.js` |

### Manejo de errores
- Middleware global captura cualquier error no controlado con `(err, req, res, next)`.
- Responde con `{error, mensaje}` y código 500.

### Archivo de rastreo (`reinicio.tmp`)
- Detecta si es el primer arranque de Docker para mostrar logs de bienvenida.
- En reinicios normales (nodemon), solo muestra un mensaje breve.
- Se elimina en `SIGINT`/`SIGTERM` para que el próximo `docker compose up` muestre bienvenida completa.

---

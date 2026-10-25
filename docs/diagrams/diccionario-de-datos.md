# 📖 Diccionario de Datos — JADDA SPORTS

> **Fuente de verdad:** `backend/database/schema.sql` (generado automáticamente por `backend/database/exportarSchema.js` a partir de `backend/database/setup.js`).
> **Corte:** 24/10/2026 · **Esquema:** `jadda_sports_db` (MySQL 8.0, único esquema `public`).
> **Alcance:** 36 tablas · 274 columnas · 45 llaves foráneas reales + 7 referencias lógicas **sin FK** (integridad a nivel aplicativo).

---

## 1. Convenciones de este documento

| Símbolo | Significado |
|---|---|
| **PK** | Clave primaria (todas son `AUTO_INCREMENT` excepto `sessions.session_id`) |
| **FK → TABLA.COLUMNA** | Llave foránea real declarada en el DDL |
| **`(lógica)`** | Referencia lógica: la columna existe y la integridad la garantiza el código (checkout/controllers), **no hay FK en el DDL** |
| **UQ** | Restricción `UNIQUE` |
| `Nulo` | `No` cuando el DDL declara `NOT NULL`; lo contrario admite `NULL` |
| `Defecto` | Valor `DEFAULT` declarado en el DDL |
| **`(accion)`** junto a una FK | Acción referencial (`ON DELETE CASCADE` / `SET NULL`); si no se indica, es `RESTRICT` implícito |

**Notas de nomenclatura (importantes para la sustentación):**

1. Las columnas van en su mayoría en `UPPERCASE` (convención heredada del diseño original). Dos columnas históricas quedaron en minúscula en `USUARIOS`: `telefono` y `foto_url`. **Consecuencia técnica:** `mysql2` devuelve las claves de `SELECT *` tal como se escriben las columnas; el backend normaliza (`user.FOTO_URL || user.foto_url`) en login/social para no romper la app móvil.
2. `PRODUCTOS.ID` es la PK con nombre genérico (diseño original), por eso sus FKs apuntan a `PRODUCTOS.ID` y no a `PRODUCTOS.ID_PRODUCTO`.
3. Los códigos/estados **no son ENUM de MySQL** salvo en `CHAT` y `CHAT_MENSAJE` (que usan `ENUM(...)`): el resto son `VARCHAR` cuyo dominio controla el backend (ver §4 Enumeraciones de dominio).
4. Datos que **NO viven en MySQL** (persisten en `backend/data/*.json` gestionado por el backend): progreso por día de los planes (`planes-progreso.json` ↔ tabla `PLANES_USUARIO`) y suscriptores del newsletter (`newsletter.json`). Es una decisión de diseño documentada del reboot (la tabla `PLANES_ENTRENAMIENTO` original se dividió en `PLANTILLAS_PLANES` + `PLANES_USUARIO`).

---

## 2. Resumen general (36 tablas por dominio)

| Grupo | Tablas | Propósito |
|---|---|---|
| Usuarios y roles | `ROLES`, `USUARIOS`, `DIRECCIONES`, `USUARIOS_METODOS_PAGO`, `NOTIFICACIONES`, `PQR`, `sessions` | Identidades, roles, direcciones, métodos de pago guardados, campanita in-app, PQR y sesiones de la SPA |
| Catálogo | `PROVEEDORES`, `CATEGORIAS`, `DESCUENTOS`, `PRODUCTOS`, `PRODUCTO_VARIANTES`, `PRODUCTO_IMAGENES`, `PRODUCTO_CARACTERISTICAS`, `MOVIMIENTOS_STOCK`, `AVISOS_STOCK` | Marcas/proveedores, categorías, cupones y descuentos, contenido del producto, inventario y trazabilidad de stock |
| Ventas y envíos | `METODOS_PAGO`, `VENTAS`, `DETALLE_VENTAS`, `ENVIOS`, `CARRITO`, `FAVORITOS`, `HISTORIAL`, `RESENAS`, `PAGOS_EVENTOS` | Métodos de pago, órdenes, renglones, logística, carrito, favoritos, recientemente vistos, reseñas y bitácora idempotente de eventos de Wompi |
| Retos y planes | `RETOS`, `RETOS_USUARIOS`, `RETO_EVIDENCIAS`, `PLANTILLAS_PLANES`, `PLANES_USUARIO` | Retos deportivos con recompensa (cupón) y planes de entrenamiento |
| Devoluciones | `DEVOLUCIONES`, `DEVOLUCIONES_EVIDENCIAS` | Devoluciones y reembolsos con evidencias |
| Vendedores y chat | `SOLICITUDES_VENDEDOR`, `VENDEDORES`, `CHAT`, `CHAT_MENSAJE` | Alta de vendedores (onboarding) y chat soporte/vendedor/devolución |

---

## 3. Diccionario por tabla

### 3.1 Usuarios y roles

#### ROLES — Catálogo de roles del sistema
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_ROL` | INT | No | auto | **PK** | Identificador del rol |
| 2 | `NOMBRE_ROL` | VARCHAR(50) | Sí | — | — | Nombre (Administrador, Vendedor…) |
| 3 | `DESCRIPCION` | VARCHAR(100) | Sí | — | — | Descripción corta del rol |

**Semilla (INSERT IGNORE en cada arranque):** 1 Administrador · 2 Empleado · 3 Proveedor · 4 Usuario · 5 Invitado · 6 Vendedor.

#### USUARIOS — Cuentas de personas (clientes, admins y vendedores)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_USUARIO` | INT | No | auto | **PK** | Identificador de la cuenta |
| 2 | `NOMBRE_USUARIO` | VARCHAR(100) | No | — | — | Nombre(s) |
| 3 | `APELLIDO_USUARIO` | VARCHAR(100) | No | — | — | Apellido(s) |
| 4 | `EMAIL` | VARCHAR(100) | No | — | **UQ** | Correo de acceso (único) |
| 5 | `USUARIO` | VARCHAR(100) | No | — | **UQ** | Nombre de usuario (@) único; se genera automáticamente `base.XXXX` (máx 20 caracteres) |
| 6 | `telefono` | VARCHAR(255) | Sí | — | — | Teléfono. ⚠️ columna histórica en minúscula |
| 7 | `CONTRASENA` | VARCHAR(255) | No | — | — | Hash bcrypt (nunca texto plano) |
| 8 | `FECHA_REGISTRO` | DATE | Sí | — | — | Fecha de creación de la cuenta |
| 9 | `TIPO_DOCUMENTO` | VARCHAR(5) | Sí | — | — | Tipo de documento de identidad (CC, etc.) |
| 10 | `NUMERO_DOCUMENTO` | VARCHAR(20) | Sí | — | — | Número de documento |
| 11 | `ID_ROL` | INT | Sí | — | **FK → ROLES.ID_ROL** | Rol de la cuenta |
| 12 | `CONFIRMADO` | TINYINT | Sí | 0 | — | 0 = correo sin verificar · 1 = verificado |
| 13 | `TOKEN` | VARCHAR(255) | Sí | NULL | — | **Hash bcrypt del código OTP** de 6 dígitos (verificación, cambio de correo, recuperación). Migrado de VARCHAR(6)→255 en 2026-10; nunca guarda el código plano |
| 14 | `TOKEN_EXPIRA` | DATETIME | Sí | NULL | — | Caducidad del OTP (15 min en el flujo) |
| 15 | `foto_url` | VARCHAR(255) | Sí | NULL | — | Ruta local (`/images/usuarios/…`) o URL. ⚠️ columna histórica en minúscula |
| 16 | `AUTH_PROVIDER` | VARCHAR(50) | Sí | 'local' | — | `local` (correo+contraseña) · `google` · `facebook` (login social) |
| 17 | `PROVIDER_ID` | VARCHAR(255) | Sí | NULL | — | ID del usuario en el proveedor social |
| 18 | `EMAIL_PENDIENTE` | VARCHAR(100) | Sí | NULL | — | Correo nuevo temporal: vive aquí hasta verificar el código para cambiar email |
| 19 | `ULTIMA_CONEXION` | DATETIME | Sí | NULL | — | Último login (se actualiza en cada acceso) |
| 20 | `ULTIMA_IP` | VARCHAR(45) | Sí | NULL | — | IP del último acceso (IPv6-safe) |
| 21 | `ULTIMA_UBICACION` | VARCHAR(100) | Sí | NULL | — | "Ciudad, país" geolocalizado vía ip-api (best-effort, nunca bloquea el login) |
| 22 | `DEBE_CAMBIAR_PASSWORD` | TINYINT | Sí | 0 | — | 1 = debe cambiar su contraseña temporal (vendedores creados por admin) antes de usar la cuenta |

#### DIRECCIONES — Direcciones de envío de un usuario
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_DIRECCION` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Dueño de la dirección |
| 3 | `DIRECCION` | VARCHAR(255) | No | — | — | Calle/avenida/sucursal |
| 4 | `BARRIO` | VARCHAR(100) | Sí | — | — | Barrio |
| 5 | `CIUDAD` | VARCHAR(100) | No | — | — | Ciudad |
| 6 | `DEPARTAMENTO` | VARCHAR(100) | No | — | — | Departamento (base de las tarifas de envío) |
| 7 | `CODIGO_POSTAL` | VARCHAR(20) | Sí | — | — | Código postal |
| 8 | `TELEFONO_CONTACTO` | VARCHAR(20) | Sí | — | — | Teléfono para la entrega |
| 9 | `ETIQUETA` | VARCHAR(50) | Sí | — | — | Etiqueta propia ("Casa", "Trabajo") |
| 10 | `ES_PRINCIPAL` | TINYINT(1) | Sí | 0 | — | 1 = dirección principal (la precargan el checkout y el perfil) |

#### USUARIOS_METODOS_PAGO — Métodos de pago guardados por el usuario
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Dueño |
| 3 | `ID_METODO` | INT | No | — | **FK → METODOS_PAGO.ID_METODO** | Tipo de método (Nequi, tarjeta…) |
| 4 | `TITULAR` | VARCHAR(100) | Sí | — | — | Titular del método (si aplica) |
| 5 | `TELEFONO` | VARCHAR(20) | Sí | — | — | Teléfono (billeteras digitales) |
| 6 | `BANCO` | VARCHAR(100) | Sí | — | — | Banco (tarjetas) |
| 7 | `TIPO` | VARCHAR(20) | Sí | — | — | Tipo de método (crédito/débito…) |
| 8 | `ES_PRINCIPAL` | TINYINT | Sí | 0 | — | 1 = método principal (el primero se auto-marca) |
| 9 | `FECHA_CREADO` | DATETIME | Sí | NOW() | — | Fecha de creación |

#### NOTIFICACIONES — Campanita in-app
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_NOTIFICACION` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | Sí | NULL | **FK → USUARIOS.ID_USUARIO** | Destinatario; **NULL = notificación global** (todos los admins la ven) |
| 3 | `TIPO` | VARCHAR(30) | No | — | — | Categoría (string libre del backend: `pedido`, `devolucion`, `vendedor`, `producto`, `stock`, `resena`, `contacto`, `pqr`, `chat`) |
| 4 | `TITULO` | VARCHAR(200) | No | — | — | Título corto |
| 5 | `MENSAJE` | VARCHAR(500) | Sí | — | — | Cuerpo del mensaje |
| 6 | `RUTA` | VARCHAR(255) | Sí | — | — | Ruta SPA de destino al hacer clic (p. ej. `/perfil/devolucion/15`, `/admin/chats?chat=2`) |
| 7 | `LEIDA` | TINYINT | Sí | 0 | — | 0 = no leída · 1 = leída individualmente |
| 8 | `FECHA` | DATETIME | Sí | NOW() | — | Fecha de creación |

#### PQR — Peticiones, quejas y reclamos
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_PQR` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Cliente que reporta |
| 3 | `TIPO` | VARCHAR(50) | No | — | — | Naturaleza (petición/queja/reclamo, valor del formulario) |
| 4 | `ASUNTO` | VARCHAR(255) | No | — | — | Asunto |
| 5 | `DESCRIPCION` | TEXT | No | — | — | Detalle del reporte |
| 6 | `NUMERO_PEDIDO` | VARCHAR(50) | Sí | NULL | (lógica) | Referencia anotada al pedido asociado (texto libre) |
| 7 | `FECHA` | DATETIME | No | — | — | Fecha de radicación |
| 8 | `ESTADO` | VARCHAR(50) | Sí | 'PENDIENTE' | — | Estado de atención (string libre del flujo) |

#### sessions — Sesiones del backend (express-session, MySQLStore)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `session_id` | VARCHAR(128) | No | — | **PK** | ID de sesión (SID de la cookie httpOnly del backend) |
| 2 | `expires` | INT UNSIGNED | No | — | — | Expiración (epoch; el sessionStore la purga cuando vence) |
| 3 | `data` | MEDIUMTEXT | Sí | — | — | Payload serializado de la sesión (usuario autenticado vía passport) |

**Nota:** tabla técnica gestionada por el almacén de sesiones; no se modifica por la aplicación.

### 3.2 Catálogo

#### PROVEEDORES — Marcas / proveedores
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_PROVEEDOR` | INT | No | auto | **PK** | Identificador |
| 2 | `NOMBRE_PROVEEDOR` | VARCHAR(200) | Sí | — | — | Nombre comercial (Nike Colombia SAS…) |
| 3 | `TELEFONO_PROVEEDOR` | VARCHAR(15) | Sí | — | — | Teléfono |
| 4 | `EMAIL_PROVEEDOR` | VARCHAR(100) | Sí | — | — | Correo |
| 5 | `DIRECCION_PROVEEDOR` | VARCHAR(255) | Sí | — | — | Ubicación |
| 6 | `CONTACTO_PROVEEDOR` | VARCHAR(100) | Sí | — | — | Persona de contacto |
| 7 | `NIT` | VARCHAR(15) | Sí | — | — | NIT |

> ⚠️ `PRODUCTOS.ID_PROVEEDOR` (ver abajo) **no tiene FK en el DDL** — relación por columna anotada en el código.

#### CATEGORIAS — Categorías del catálogo
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_CATEGORIA` | INT | No | auto | **PK** | Identificador |
| 2 | `NOMBRE_CATEGORIA` | VARCHAR(100) | No | — | **UQ** (`uq_categoria_nombre`, migración idempotente) | Nombre de la categoría |
| 3 | `DESCRIPCION` | VARCHAR(100) | Sí | — | — | Copy comercial |

#### DESCUENTOS — Cupones y promociones
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_DESCUENTO` | INT | No | auto | **PK** | Identificador |
| 2 | `DESCRIPCION` | VARCHAR(255) | Sí | — | — | **Código del cupón en la práctica** (JADDA10, RETO-XXXX, promos de tienda): así se consulta exactamente con `WHERE TRIM(DESCRIPCION)=?`; no existe columna `CODIGO_CUPON` |
| 3 | `PORCENTAJE` | DECIMAL(5,2) | Sí | — | — | Descuento (%) |
| 4 | `FECHA_INICIO` | DATE | Sí | — | — | Vigencia desde |
| 5 | `FECHA_FIN` | DATE | Sí | — | — | Vigencia hasta |
| 6 | `USADO` | TINYINT | No | 0 | — | 1 = cupón RETO- ya consumido (un solo uso); los cupones de tienda nunca se destruyen |
| 7 | `MONTO_MINIMO` | DECIMAL(12,0) | Sí | NULL | — | Compra mínima (regla escalada por porcentaje; NULL = sin mínimo) |

#### PRODUCTOS — Artículos del catálogo (JADDA o de vendedores)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID` | INT | No | auto | **PK** | Identificador (nombre de columna heredado del diseño) |
| 2 | `NOMBRE` | VARCHAR(255) | Sí | — | — | Nombre comercial |
| 3 | `MARCA` | VARCHAR(100) | Sí | — | — | Marca |
| 4 | `PRECIO` | DECIMAL(10,2) | Sí | — | — | Precio de venta (COP) |
| 5 | `DESCRIPCION` | TEXT | Sí | — | — | Descripción larga |
| 6 | `ID_PROVEEDOR` | INT | Sí | — | **(lógica) → PROVEEDORES** | Marca/proveedor |
| 7 | `ID_CATEGORIA` | INT | Sí | — | **(lógica) → CATEGORIAS** | Categoría |
| 8 | `ID_DESCUENTO` | INT | Sí | — | **(lógica) → DESCUENTOS** | Descuento aplicado (promo/cupón) |
| 9 | `ID_VENDEDOR` | INT | Sí | NULL | **(lógica) → VENDEDORES**; índice `idx_productos_vendedor` | NULL = producto propio de JADDA · ID = marketplace |
| 10 | `ESTADO_PUBLICACION` | VARCHAR(10) | Sí | NULL | — | NULL = legacy Jadda visible · `PENDIENTE`/`RECHAZADO` = oculto · `APROBADO` = visible. Controla la aprobación de marketplace en todos los queries públicos del catálogo |

> ⚠️ **Este DDL no declara ninguna FK en esta tabla** — las 4 referencias son columnas lógicas (sin FK); la integridad la maneja el código. Es un hallazgo propio documentado en el diagrama ER.

#### PRODUCTO_VARIANTES — Combinaciones color/talla con stock
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_VARIANTE` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS.ID (CASCADE)** | Producto padre |
| 3 | `COLOR` | VARCHAR(50) | Sí | — | — | Color |
| 4 | `NOMBRE_ATRIBUTO` | VARCHAR(50) | Sí | — | — | Nombre del atributo ("Talla") |
| 5 | `ATRIBUTO` | VARCHAR(50) | Sí | — | — | Valor del atributo ("40", "L") |
| 6 | `STOCK` | INT | Sí | — | — | Unidades disponibles de la variante |

**Llaves adicionales:** `UNIQUE (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO)` — evita duplicar combinaciones.

#### PRODUCTO_IMAGENES — Galería ordenada (Cloudinary o rutas locales)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_IMAGEN` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS.ID (CASCADE)** | Producto |
| 3 | `URL_IMAGEN` | VARCHAR(255) | No | — | — | URL **Cloudinary** (`res.cloudinary.com/…`, primario tras la migración 2026-10) o ruta local `/images/productos/…` (respaldo para BD diferentes) |
| 4 | `ORDEN` | INT | Sí | 1 | — | Posición en la galería (1 = portada) |

#### PRODUCTO_CARACTERISTICAS — Ficha técnica (pares atributo/valor)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_CARACTERISTICA` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS.ID (CASCADE)** | Producto |
| 3 | `NOMBRE_ATRIBUTO` | VARCHAR(100) | No | — | — | Atributo de la ficha técnica ("Peso") |
| 4 | `VALOR_ATRIBUTO` | VARCHAR(255) | No | — | — | Valor ("410 g") |

#### MOVIMIENTOS_STOCK — Historial de entradas/salidas de inventario
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_MOVIMIENTO` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_PRODUCTO` | INT | Sí | — | **FK → PRODUCTOS.ID** | Producto (a nivel producto, no variante) |
| 3 | `TIPO_MOVIMIENTO` | VARCHAR(50) | Sí | — | — | `ENTRADA` · `SALIDA` (checkout, devoluciones, ajustes admin) |
| 4 | `CANTIDAD` | INT | Sí | — | — | Unidades movidas (siempre en positivo; el TIPO indica la dirección) |
| 5 | `FECHA` | DATE | Sí | — | — | Fecha del movimiento |

**Uso:** auditoría (no repudio; apoyo a reportes/admin). Se registra dentro de las transacciones: el checkout descuenta el stock de la variante y anota el movimiento del producto.

#### AVISOS_STOCK — "Avísame cuando vuelva a estar disponible"
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_AVISO` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_VARIANTE` | INT | No | — | **FK → PRODUCTO_VARIANTES.ID_VARIANTE (CASCADE)** | Variante agotada de interés |
| 3 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO (CASCADE)** | Interesado |
| 4 | `FECHA_CREACION` | DATETIME | Sí | NOW() | — | Cuándo se suscribió |
| 5 | `ENVIADO` | TINYINT | Sí | 0 | — | 1 = reposición notificada (email + in-app). Al subir el stock de 0 a >0 el aviso se dispara y queda marcado; no se repite |

**Llaves adicionales:** `UNIQUE (ID_VARIANTE, ID_USUARIO)` — un aviso activo por usuario y variante.

### 3.3 Ventas y envíos

#### METODOS_PAGO — Catálogo de medios de pago
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_METODO` | INT | No | auto | **PK** | Identificador |
| 2 | `NOMBRE_METODO` | VARCHAR(50) | No | — | — | Ej. Nequi, Tarjeta, PSE |
| 3 | `DESCRIPCION` | VARCHAR(100) | Sí | — | — | Detalle |

#### VENTAS — Órdenes de compra
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_VENTA` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_CLIENTE` | INT | Sí | — | **(lógica) → USUARIOS.ID_USUARIO**; índice `idx_ventas_cliente` | Cliente comprador |
| 3 | `FECHA_VENTA` | DATETIME | Sí | — | — | Fecha/hora con **índice `idx_ventas_fecha`** (los dashboards y los reportes filtran por rango de fecha) |
| 4 | `DATOS_PAGO` | JSON | Sí | NULL | — | JSON con los datos del pago (método/referencia/teléfono según método) que se muestran en el detalle de la compra |
| 5 | `TOTAL` | DECIMAL(10,2) | Sí | — | — | Total pagado (recalculado 100 % en el servidor, nunca confiado al cliente) |
| 6 | `ESTADO` | VARCHAR(50) | Sí | 'COMPLETADA' | — | `COMPLETADA` (valor por defecto sin pasarela) · `PENDIENTE_PAGO` (con `PAYMENT_GATEWAY`) · `PENDIENTE` · `CONFIRMADA` · `ENVIADA` · `CANCELADA` |
| 7 | `ID_METODO` | INT | Sí | — | **FK → METODOS_PAGO.ID_METODO** | Método usado |
| 8 | `REFERENCIA_PAGO` | VARCHAR(100) | Sí | NULL | — | Referencia del pago. Con pasarela clásica `SIM_…`; con Wompi `JADDA-<idVenta>-<rand8>` (se escribe con guard `AND ESTADO='PENDIENTE_PAGO'`) — resuelve el webhook → venta |

> Con la pasarela (Wompi sandbox desde 2026-10-24), la venta nace `PENDIENTE_PAGO`, `POST /api/pagos/pagar` firma la URL del widget y la confirmación llega por pull (`GET /api/pagos/estado/:id`) o webhook firmado; los correos y notificaciones post-pago se envían solo tras la confirmación. Los 5 estados del flujo Wompi: `PENDIENTE_PAGO` → `CONFIRMADA` (APPROVED) / `CANCELADA` (DECLINED/VOIDED o 48 h sin pago, con reingreso de stock).

> El "número de pedido" visible (8 dígitos, p. ej. en correos y el panel) **no es una columna**: es un hash Knuth estable calculado sobre `ID_VENTA` (`utils/numeroPedido.js` en backend y espejos en web/móvil).

#### DETALLE_VENTAS — Renglones de la venta
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_DETALLE` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_VENTA` | INT | Sí | — | **FK → VENTAS.ID_VENTA** | Cabecera |
| 3 | `ID_PRODUCTO` | INT | Sí | — | **FK → PRODUCTOS.ID** | Producto |
| 4 | `ID_VARIANTE` | INT | Sí | NULL | **FK → PRODUCTO_VARIANTES (SET NULL)** | Variante específica (color/talla); NULL en ventas históricas |
| 5 | `CANTIDAD` | INT | Sí | — | — | Unidades |
| 6 | `PRECIO_UNITARIO` | DECIMAL(10,2) | Sí | — | — | Precio vigente al comprar |
| 7 | `SUBTOTAL` | DECIMAL(10,2) | Sí | — | — | Cantidad × precio unitario |

#### ENVIOS — Logística de la venta
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_ENVIO` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_VENTA` | INT | Sí | — | **FK → VENTAS.ID_VENTA** | Venta enviada |
| 3 | `DIRECCION_ENVIO` | VARCHAR(255) | Sí | — | — | Dirección de entrega (editable hasta que el pedido sale del almacén) |
| 4 | `CIUDAD` | VARCHAR(100) | Sí | — | — | Ciudad de entrega |
| 5 | `BARRIO` | VARCHAR(100) | Sí | NULL | — | Barrio |
| 6 | `DEPARTAMENTO` | VARCHAR(100) | Sí | NULL | — | Departamento |
| 7 | `CODIGO_POSTAL` | VARCHAR(20) | Sí | NULL | — | CP |
| 8 | `OBSERVACIONES` | TEXT | Sí | NULL | — | Notas para el transportador |
| 9 | `TELEFONO_CONTACTO` | VARCHAR(20) | Sí | NULL | — | Teléfono en la entrega |
| 10 | `COSTO_ENVIO` | DECIMAL(10,2) | Sí | 0 | — | Costo calculado server-side (`utils/envio.js` por departamento); 0 cuando envío gratis ≥ $800.000 |
| 11 | `ESTADO_ENVIO` | VARCHAR(50) | Sí | — | — | `PENDIENTE` · `POR_EMPAQUETAR` · `EMPACADO` · `EN_CAMINO` · `ENTREGADO` · `CANCELADO` |
| 12 | `FECHA_ENVIO` | DATE | Sí | — | — | Cuando salió del almacén |
| 13 | `FECHA_ENTREGA` | DATETIME | Sí | NULL | — | Cuando se entregó; **fuente de la regla de 3 días para pedir devolución** |

#### PAGOS_EVENTOS — Bitácora idempotente de eventos del webhook (Wompi)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_EVENTO` | INT | No | auto | **PK** | Identificador |
| 2 | `PROVEEDOR` | VARCHAR(20) | No | — | — | `wompi` (único gateway soportado) |
| 3 | `EXTERNO_ID` | VARCHAR(100) | No | — | **UQ (con CHECKSUM)** | ID de la transacción en Wompi (`data.transaction.id`) |
| 4 | `EVENTO` | VARCHAR(60) | No | — | — | Nombre del evento reportado (p. ej. `transaction.updated`) |
| 5 | `CHECKSUM` | VARCHAR(64) | No | — | **UQ (con EXTERNO_ID)** | SHA256 hex del webhook (`uq_pagos_evento` = idempotencia: el mismo evento no se procesa dos veces) |
| 6 | `ID_VENTA` | INT | Sí | NULL | **(lógica) → VENTAS.ID_VENTA** | Venta resuelta por `REFERENCIA_PAGO` |
| 7 | `ESTADO_PROCESADO` | VARCHAR(40) | Sí | 'RECIBIDO' | — | `RECIBIDO` · `CONFIRMADA` · `CANCELADA` · `IGNORADO` · `FIRMA_INVALIDA` (403) · `VENTA_NO_ENCONTRADA` |
| 8 | `FECHA_RECEPCION` | DATETIME | Sí | NOW() | — | Cuándo llegó el webhook |

#### CARRITO — Ítems pendientes (carrito persistido en BD)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_CARRITO` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS (CASCADE)** | Dueño del carrito |
| 3 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS (CASCADE)** | Producto |
| 4 | `ID_VARIANTE` | INT | Sí | NULL | **FK → PRODUCTO_VARIANTES (SET NULL)** | Variante |
| 5 | `CANTIDAD` | INT | No | 1 | — | Unidades (la existencia se valida en el checkout con `SELECT … FOR UPDATE` + guard del stock; los vendedores no pueden comprar) |
| 6 | `FECHA_AGREGADO` | TIMESTAMP | Sí | NOW() | — | Cuándo se agregó |

#### FAVORITOS — Lista de deseo
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_FAVORITO` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | Sí | — | **FK → USUARIOS.ID_USUARIO** | Dueño |
| 3 | `ID_PRODUCTO` | INT | Sí | — | **FK → PRODUCTOS.ID** | Producto favorito |
| 4 | `FECHA_AGREGADO` | DATE | Sí | — | — | Cuándo se agregó (sustenta el "deshacer" que restaura la fila) |

#### HISTORIAL — Productos vistos (recientemente vistos)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_HISTORIAL` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | Sí | — | **FK → USUARIOS.ID_USUARIO** | Visitante autenticado (anónimo usa localStorage) |
| 3 | `ID_PRODUCTO` | INT | Sí | — | **FK → PRODUCTOS.ID** | Producto visto |
| 4 | `FECHA_VISTO` | DATETIME | Sí | NOW() | — | Visita (define el orden "recientemente"); alimenta el orden por popularidad de la tienda (`COUNT visitas`) |

#### RESENAS — Valoraciones y comentarios
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_RESENA` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS.ID (CASCADE)** | Producto comentado |
| 3 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS (CASCADE)** | Autor (solo usuarios autenticados) |
| 4 | `CALIFICACION` | INT | Sí | — | CHECK 1..5 | Estrellas (1-5); alimenta RATING en las tarjetas |
| 5 | `COMENTARIO` | TEXT | Sí | — | — | Opinión |
| 6 | `FECHA` | TIMESTAMP | Sí | NOW() | — | Publicación |

### 3.4 Retos y planes

#### RETOS — Retos deportivos publicados
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_RETO` | INT | No | auto | **PK** | Identificador |
| 2 | `TITULO` | VARCHAR(200) | No | — | — | Título (p. ej. "Semana Activa") |
| 3 | `DESCRIPCION` | TEXT | Sí | — | — | Reglas del reto |
| 4 | `META_TIPO` | VARCHAR(50) | No | — | — | Unidad/objetivo del reto |
| 5 | `META_VALOR` | INT | No | — | — | Cantidad objetivo |
| 6 | `RECOMPENSA_PORCENTAJE` | DECIMAL(5,2) | No | — | — | % de cupón al completar; define su compra mínima (≥10 % → $200.000, etc.) |
| 7 | `FECHA_INICIO` | DATE | No | — | — | Vigencia desde |
| 8 | `FECHA_FIN` | DATE | No | — | — | Vigencia hasta |
| 9 | `ACTIVO` | TINYINT | Sí | 1 | — | Visible/no visible |

#### RETOS_USUARIOS — Participación de un usuario en un reto
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_RETO_USUARIO` | INT | No | auto | **PK** | Inscripción |
| 2 | `ID_RETO` | INT | No | — | **FK → RETOS.ID_RETO** | Reto |
| 3 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Participante |
| 4 | `PROGRESO` | INT | Sí | 0 | — | Avance acumulado (se incrementa con las evidencias aprobadas) |
| 5 | `COMPLETADO` | TINYINT | Sí | 0 | — | 1 = meta alcanzada |
| 6 | `CUPON_GENERADO` | VARCHAR(50) | Sí | NULL | — | Código generado al completar; el cupón real se crea en `DESCUENTOS` (código en `DESCRIPCION`, `USADO = 0`) |

#### RETO_EVIDENCIAS — Material que prueba el avance
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_EVIDENCIA` | INT | No | auto | **PK** | Envío de material |
| 2 | `ID_RETO_USUARIO` | INT | No | — | **FK → RETOS_USUARIOS.ID_RETO_USUARIO** | Inscripción |
| 3 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Autor (para carpetas `usuarios/{USUARIO}/retos/r{ID_RETO_USUARIO}/`) |
| 4 | `TIPO` | VARCHAR(10) | No | — | — | `imagen` · `video` |
| 5 | `RUTA` | VARCHAR(255) | Sí | NULL | — | URL **Cloudinary** o ruta local del primer archivo. Desde 2026 el material ya **no se borra** al revisar: queda disponible como historial |
| 6 | `RUTAS_EXTRA` | TEXT | Sí | NULL | — | Rutas de los archivos adicionales (2..N) |
| 7 | `CANTIDAD` | INT | No | 1 | — | Unidades que el envío aporta al progreso |
| 8 | `ESTADO` | VARCHAR(20) | Sí | 'pendiente' | — | `pendiente` · `aprobado` · `rechazado` |
| 9 | `OBSERVACION` | VARCHAR(500) | Sí | NULL | — | Motivo del rechazo o comentario del equipo (visible al usuario) |
| 10 | `FECHA_SUBIDA` | DATETIME | Sí | NOW() | — | Fecha del envío |

#### PLANTILLAS_PLANES — Plantillas de planes de entrenamiento
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_PLANTILLA` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_CATEGORIA` | INT | Sí | — | **FK → CATEGORIAS.ID_CATEGORIA** | Categoría deportiva a la que pertenece |
| 3 | `TITULO` | VARCHAR(200) | No | — | — | Plan |
| 4 | `DESCRIPCION` | TEXT | Sí | — | — | Objetivo y enfoque |
| 5 | `DURACION_DIAS` | INT | Sí | 14 | — | Días del plan |
| 6 | `NIVEL` | VARCHAR(50) | Sí | 'Principiante' | — | Nivel |
| 7 | `CONTENIDO` | JSON | Sí | — | — | Estructura del plan por día (JSON con los días que arma el backend) |

#### PLANES_USUARIO — Plan activado por cada usuario
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_PLAN` | INT | No | auto | **PK** | Instancia del plan |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Dueño |
| 3 | `ID_VENTA` | INT | Sí | — | **FK → VENTAS.ID_VENTA** | Compra que activó el plan (si vino de una orden) |
| 4 | `ID_PLANTILLA` | INT | No | — | **FK → PLANTILLAS_PLANES.ID_PLANTILLA** | Plantilla usada |
| 5 | `FECHA_INICIO` | DATE | Sí | — | — | Comienzo |
| 6 | `COMPLETADO` | TINYINT | Sí | 0 | — | 1 = terminado |

> El progreso por día **no está en MySQL**: vive en `backend/data/planes-progreso.json` (`{id_plan: [días completados]}`) por decisión de diseño del reboot.

### 3.5 Devoluciones

#### DEVOLUCIONES — Solicitudes de devolución / reembolso (multi-producto)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_DEVOLUCION` | INT | No | auto | **PK** | Solicitud |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** | Cliente que solicita |
| 3 | `ID_VENTA` | INT | No | — | **FK → VENTAS.ID_VENTA** | Pedido |
| 4 | `ID_PRODUCTO` | INT | No | — | **FK → PRODUCTOS.ID** | Producto devuelto (una fila por producto) |
| 5 | `CANTIDAD` | INT | No | 1 | — | Unidades (≤ lo comprado y no ya solicitado) |
| 6 | `MOTIVO` | VARCHAR(500) | Sí | NULL | — | Motivo ("Reembolso por cancelación del pedido" cuando es rama cancelación) |
| 7 | `DESCRIPCION` | TEXT | Sí | NULL | — | Detalle del cliente |
| 8 | `TIPO` | VARCHAR(20) | No | 'DEVOLUCION' | — | `DEVOLUCION` · `REEMBOLSO` (en CANCELADAS el flujo auto-genera REEMBOLSO) |
| 9 | `OBSERVACION` | VARCHAR(500) | Sí | NULL | — | Observación del equipo (vendedor o JADDA) al decidir |
| 10 | `ESTADO` | VARCHAR(20) | Sí | 'SOLICITADA' | — | `SOLICITADA` · `APROBADA` · `RECHAZADA` · `MAS_PRUEBAS` · `ESCALADA` (hilo con JADDA cuando el producto de vendedor no fue resoluido) |
| 11 | `FECHA_CREACION` | DATETIME | Sí | NOW() | — | Radicación |
| 12 | `FECHA_PROCESADA` | DATETIME | Sí | NULL | — | Decisión final |

#### DEVOLUCIONES_EVIDENCIAS — Evidencias (fotos/videos) de la devolución
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_EVIDENCIA` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_DEVOLUCION` | INT | No | — | **FK → DEVOLUCIONES (CASCADE)** | Solicitud de referencia |
| 3 | `TIPO` | VARCHAR(10) | No | — | — | imagen · video |
| 4 | `RUTA` | VARCHAR(500) | No | — | — | URL Cloudinary o ruta local |
| 5 | `FECHA` | DATETIME | Sí | NOW() | — | Fecha de adjunción (permite añadir más pruebas en estado `MAS_PRUEBAS`) |

### 3.6 Vendedores y chat

#### SOLICITUDES_VENDEDOR — Solicitud para ser vendedor (pública/informal)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_SOLICITUD` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | Sí | NULL | **FK → USUARIOS.ID_USUARIO** · **UQ** (`uq_solicitud_usuario`) | Cuenta solicitante; **NULL = formulario público sin cuenta** (vendedor informal) |
| 3 | `NOMBRE_EMPRESA` | VARCHAR(150) | Sí | NULL | — | Empresa (opcional para el vendedor informal; desde 2026) |
| 4 | `NIT` | VARCHAR(20) | Sí | NULL | **UQ** (`uq_solicitud_nit`) | NIT (opcional si informal; NULLs no chocan) |
| 5 | `NOMBRE_REPRESENTANTE` | VARCHAR(150) | No | — | — | Persona responsable |
| 6 | `EMAIL_EMPRESA` | VARCHAR(100) | No | — | **UQ** (`uq_solicitud_email`) | Correo de contacto (se reutiliza al crear la cuenta vendedor) |
| 7 | `TELEFONO` | VARCHAR(30) | No | — | — | Teléfono |
| 8 | `DEPARTAMENTO` | VARCHAR(60) | No | — | — | Ubicación |
| 9 | `CIUDAD` | VARCHAR(60) | No | — | — | Ubicación |
| 10 | `DIRECCION` | VARCHAR(200) | Sí | NULL | — | Dirección de contacto |
| 11 | `CATEGORIAS` | VARCHAR(255) | Sí | NULL | — | Categorías a vender (texto) |
| 12 | `DESCRIPCION` | TEXT | Sí | NULL | — | Pitch del solicitante |
| 13 | `ESTADO` | VARCHAR(20) | Sí | 'PENDIENTE' | — | `PENDIENTE` · `APROBADA` · `RECHAZADA` (con reenvío permitido tras rechazo) |
| 14 | `OBSERVACION_ADMIN` | VARCHAR(500) | Sí | NULL | — | Motivo del rechazo (va por correo al solicitante) |
| 15 | `FECHA_CREACION` | DATETIME | Sí | NOW() | — | Radicación |
| 16 | `FECHA_PROCESADA` | DATETIME | Sí | NULL | — | Aprobación/rechazo |

#### VENDEDORES — Cuenta de vendedor activa (marketplace)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_VENDEDOR` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_USUARIO` | INT | No | — | **FK → USUARIOS.ID_USUARIO** · **UQ** (`uq_vendedor_usuario`) | Cuenta que ejerce el rol (rol `Vendedor`, rol 6) |
| 3 | `ID_SOLICITUD` | INT | No | — | **FK → SOLICITUDES_VENDEDOR.ID_SOLICITUD** · **UQ** (`uq_vendedor_solicitud`) | Solicitud aprobada |
| 4 | `NOMBRE_EMPRESA` | VARCHAR(150) | Sí | NULL | — | Empresa (puede ser NULL con vendedor informal) |
| 5 | `NIT` | VARCHAR(20) | Sí | NULL | **UQ** (`uq_vendedor_nit`) | NIT |
| 6 | `EMAIL_VENDEDOR` | VARCHAR(100) | No | — | **UQ** (`uq_vendedor_email`) | Correo de contacto |
| 7 | `TELEFONO` | VARCHAR(30) | Sí | NULL | — | Teléfono editable |
| 8 | `DEPARTAMENTO` | VARCHAR(60) | Sí | NULL | — | Ubicación editable |
| 9 | `CIUDAD` | VARCHAR(60) | Sí | NULL | — | Ubicación editable |
| 10 | `DIRECCION` | VARCHAR(200) | Sí | NULL | — | Dirección editable |
| 11 | `CATEGORIAS` | VARCHAR(255) | Sí | NULL | — | Categorías vendidas (NO editable por el vendedor) |
| 12 | `ESTADO` | VARCHAR(20) | Sí | 'ACTIVO' | — | Estado de la cuenta de vendedor |
| 13 | `FECHA_REGISTRO` | DATETIME | Sí | NOW() | — | Desde cuándo vende |

#### CHAT — Conversaciones (soporte, vendedor, devolución)
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_CHAT` | INT | No | auto | **PK** | Identificador |
| 2 | `TIPO` | **ENUM('SOPORTE','VENDEDOR','DEVOLUCION')** | No | — | — | Soporte con JADDA · asesor del producto del vendedor · hilo por una devolución |
| 3 | `ID_CLIENTE` | INT | Sí | NULL | **FK → USUARIOS.ID_USUARIO** | Comprador (en SOPORTE, la parte cliente) |
| 4 | `ID_VENDEDOR` | INT | Sí | NULL | **FK → VENDEDORES.ID_VENDEDOR** | Vendedor (asesor de los productos de su catálogo) |
| 5 | `ID_PRODUCTO` | INT | Sí | NULL | **FK → PRODUCTOS.ID (SET NULL)** | Producto sobre el que abre el chat (queda NULL si el producto se elimina) |
| 6 | `ID_DEVOLUCION` | INT | Sí | NULL | **(lógica) → DEVOLUCIONES** | Devolución de origen — sin FK en el DDL (la integridad la maneja el código) |
| 7 | `PARTE` | VARCHAR(10) | Sí | NULL | — | NULL = hilo de acuerdo cliente↔vendedor · `CLIENTE` / `VENDEDOR` = hilo privado separado con JADDA tras la escalación (misma devolución, dos conversaciones) |
| 8 | `ESTADO` | VARCHAR(20) | Sí | 'ACTIVA' | — | `ACTIVA` · `ESCALADA` · `CERRADA` (bloquea el input) |
| 9 | `FECHA_CREACION` | DATETIME | Sí | NOW() | — | Apertura |
| 10 | `ULTIMA_ACTIVIDAD` | DATETIME | Sí | NOW() | — | Ordena la bandeja (lista `/chats` por rol) |

#### CHAT_MENSAJE — Mensajes del chat
| # | Columna | Tipo | Nulo | Defecto | Llaves | Descripción |
|---|---|---|---|---|---|---|
| 1 | `ID_MENSAJE` | INT | No | auto | **PK** | Identificador |
| 2 | `ID_CHAT` | INT | No | — | **FK → CHAT.ID_CHAT (CASCADE)** | Conversación |
| 3 | `ID_AUTOR` | INT | Sí | NULL | — | Usuario autor (NULL en mensajes `SISTEMA`) |
| 4 | `ROL_AUTOR` | **ENUM('CLIENTE','VENDEDOR','ADMIN','SISTEMA')** | No | — | — | Estilo de la burbuja y titularidad de los no-leídos (`ROL_AUTOR <> el mío`) |
| 5 | `MENSAJE` | TEXT | No | — | — | Texto (≤ 2000 caracteres; pasado por filtro de groserías `utils/groserias.js`) |
| 6 | `LEIDO` | TINYINT | Sí | 0 | — | Leído por la contraparte (alimenta badges de no-leídos) |
| 7 | `FECHA` | DATETIME | Sí | NOW() | — | Hora |

---

## 4. Enumeraciones de dominio (estados y flags usados por el backend)

> La única columna con `ENUM` nativo es del chat (`CHAT.TIPO`, `CHAT_MENSAJE.ROL_AUTOR`); el resto son `VARCHAR`/`TINYINT` cuyo dominio controla el código (esta tabla lo enumera; la cobertura del dominio está respaldada por las pruebas del backend).

| Tabla.Columna | Tipo de dato | Valores | Significado |
|---|---|---|---|
| `ROLES.ID_ROL` (semilla) | INT | 1 Administrador · 2 Empleado · 3 Proveedor · 4 Usuario · 5 Invitado · 6 Vendedor | Rol de la cuenta (RBAC en `esAdmin`/`esVendedor`) |
| `USUARIOS.CONFIRMADO` | TINYINT | 0 · 1 | Correo verificado o no |
| `USUARIOS.DEBE_CAMBIAR_PASSWORD` | TINYINT | 0 · 1 | 1 ⇒ Swal de cambio obligatorio en login |
| `USUARIOS.AUTH_PROVIDER` | VARCHAR | 'local' · 'google' · 'facebook' | Procedencia de la cuenta |
| `PRODUCTOS.ESTADO_PUBLICACION` | VARCHAR(10) | NULL · 'PENDIENTE' · 'APROBADO' · 'RECHAZADO' | Marketplace: visibilidad pública del artículo |
| `VENTAS.ESTADO` | VARCHAR(50) | 'COMPLETADA' · 'PENDIENTE_PAGO' · 'PENDIENTE' · 'CONFIRMADA' · 'ENVIADA' · 'CANCELADA' | Ciclo de la orden; con `PAYMENT_GATEWAY` la venta nace `PENDIENTE_PAGO` |
| `PAGOS_EVENTOS.ESTADO_PROCESADO` | VARCHAR(40) | 'RECIBIDO' · 'CONFIRMADA' · 'CANCELADA' · 'IGNORADO' · 'FIRMA_INVALIDA' · 'VENTA_NO_ENCONTRADA' | Resultado del procesamiento de cada webhook de Wompi |
| `ENVIOS.ESTADO_ENVIO` | VARCHAR(50) | 'PENDIENTE' · 'POR_EMPAQUETAR' · 'EMPACADO' · 'EN_CAMINO' · 'ENTREGADO' · 'CANCELADO' | Progreso logístico; al `ENTREGADO` se fija `FECHA_ENTREGA` |
| `DEVOLUCIONES.TIPO` | VARCHAR(20) | 'DEVOLUCION' · 'REEMBOLSO' | Devolución del producto o reembolso del dinero (en pedidos CANCELADAS) |
| `DEVOLUCIONES.ESTADO` | VARCHAR(20) | 'SOLICITADA' · 'MAS_PRUEBAS' · 'APROBADA' · 'RECHAZADA' · 'ESCALADA' | `ESCALADA` = el equipo JADDA decide (los vendedores solo gestionan las dos primeras) |
| `RETO_EVIDENCIAS.TIPO` | VARCHAR(10) | 'imagen' · 'video' | Medio del envío |
| `RETO_EVIDENCIAS.ESTADO` | VARCHAR(20) | 'pendiente' · 'aprobado' · 'rechazado' | Revisión del equipo |
| `MOVIMIENTOS_STOCK.TIPO_MOVIMIENTO` | VARCHAR(50) | 'ENTRADA' · 'SALIDA' | Movimiento de inventario: entrada o salida |
| `SOLICITUDES_VENDEDOR.ESTADO` | VARCHAR(20) | 'PENDIENTE' · 'APROBADA' · 'RECHAZADA' | Aprobación del onboarding de vendedor |
| `VENDEDORES.ESTADO` | VARCHAR(20) | 'ACTIVO' | Cuenta activa |
| `CHAT.TIPO` | ENUM | 'SOPORTE' · 'VENDEDOR' · 'DEVOLUCION' | Motivo del chat |
| `CHAT.PARTE` | VARCHAR(10) | NULL · 'CLIENTE' · 'VENDEDOR' | Hilos separados después de la escalación |
| `CHAT.ESTADO` | VARCHAR(20) | 'ACTIVA' · 'ESCALADA' · 'CERRADA' | Ciclo de la conversación |
| `CHAT_MENSAJE.ROL_AUTOR` | ENUM | 'CLIENTE' · 'VENDEDOR' · 'ADMIN' · 'SISTEMA' | Rol del autor; SISTEMA = eventos automáticos (sin autor humano) |
| `NOTIFICACIONES.TIPO` | VARCHAR(30) | string libre; usados: 'pedido', 'devolucion', 'vendedor', 'producto', 'stock', 'resena', 'contacto', 'pqr', 'chat', 'usuario' | Categoría del timbre |
| `DESCUENTOS.USADO` | TINYINT | 0 · 1 | 1 solo para cupones RETO- de un uso |
| Flags 0/1 genéricos | TINYINT | `ES_PRINCIPAL`, `LEIDA`, `LEIDO`, `COMPLETADO`, `ACTIVO`, `ENVIADO`, `RESENAS…` | Activadores booleanos |

---

## 5. Relaciones (45 FK reales + 7 lógicas)

### 5.1 Llaves foráneas reales del DDL

| De (columna FK) | A | Acción al borrar padre |
|---|---|---|
| USUARIOS.ID_ROL | ROLES.ID_ROL | — |
| DIRECCIONES.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| USUARIOS_METODOS_PAGO.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| USUARIOS_METODOS_PAGO.ID_METODO | METODOS_PAGO.ID_METODO | — |
| NOTIFICACIONES.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| PQR.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| PRODUCTO_VARIANTES.ID_PRODUCTO | PRODUCTOS.ID | **CASCADE** |
| PRODUCTO_IMAGENES.ID_PRODUCTO | PRODUCTOS.ID | **CASCADE** |
| PRODUCTO_CARACTERISTICAS.ID_PRODUCTO | PRODUCTOS.ID | **CASCADE** |
| MOVIMIENTOS_STOCK.ID_PRODUCTO | PRODUCTOS.ID | — |
| AVISOS_STOCK.ID_VARIANTE | PRODUCTO_VARIANTES.ID_VARIANTE | **CASCADE** |
| AVISOS_STOCK.ID_USUARIO | USUARIOS.ID_USUARIO | **CASCADE** |
| VENTAS.ID_METODO | METODOS_PAGO.ID_METODO | — |
| DETALLE_VENTAS.ID_VENTA | VENTAS.ID_VENTA | — |
| DETALLE_VENTAS.ID_PRODUCTO | PRODUCTOS.ID | — |
| DETALLE_VENTAS.ID_VARIANTE | PRODUCTO_VARIANTES.ID_VARIANTE | **SET NULL** |
| ENVIOS.ID_VENTA | VENTAS.ID_VENTA | — |
| CARRITO.ID_USUARIO | USUARIOS.ID_USUARIO | **CASCADE** |
| CARRITO.ID_PRODUCTO | PRODUCTOS.ID | **CASCADE** |
| CARRITO.ID_VARIANTE | PRODUCTO_VARIANTES.ID_VARIANTE | **SET NULL** |
| FAVORITOS.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| FAVORITOS.ID_PRODUCTO | PRODUCTOS.ID | — |
| HISTORIAL.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| HISTORIAL.ID_PRODUCTO | PRODUCTOS.ID | — |
| RESENAS.ID_PRODUCTO | PRODUCTOS.ID | **CASCADE** |
| RESENAS.ID_USUARIO | USUARIOS.ID_USUARIO | **CASCADE** |
| RETOS_USUARIOS.ID_RETO | RETOS.ID_RETO | — |
| RETOS_USUARIOS.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| RETO_EVIDENCIAS.ID_RETO_USUARIO | RETOS_USUARIOS.ID_RETO_USUARIO | — |
| RETO_EVIDENCIAS.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| PLANTILLAS_PLANES.ID_CATEGORIA | CATEGORIAS.ID_CATEGORIA | — |
| PLANES_USUARIO.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| PLANES_USUARIO.ID_VENTA | VENTAS.ID_VENTA | — |
| PLANES_USUARIO.ID_PLANTILLA | PLANTILLAS_PLANES.ID_PLANTILLA | — |
| DEVOLUCIONES.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| DEVOLUCIONES.ID_VENTA | VENTAS.ID_VENTA | — |
| DEVOLUCIONES.ID_PRODUCTO | PRODUCTOS.ID | — |
| DEVOLUCIONES_EVIDENCIAS.ID_DEVOLUCION | DEVOLUCIONES.ID_DEVOLUCION | **CASCADE** |
| SOLICITUDES_VENDEDOR.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| VENDEDORES.ID_USUARIO | USUARIOS.ID_USUARIO | — |
| VENDEDORES.ID_SOLICITUD | SOLICITUDES_VENDEDOR.ID_SOLICITUD | — |
| CHAT.ID_CLIENTE | USUARIOS.ID_USUARIO | — |
| CHAT.ID_VENDEDOR | VENDEDORES.ID_VENDEDOR | — |
| CHAT.ID_PRODUCTO | PRODUCTOS.ID | **SET NULL** |
| CHAT_MENSAJE.ID_CHAT | CHAT.ID_CHAT | **CASCADE** |

### 5.2 Referencias lógicas (columna existe, SIN FK en el DDL)

| De (columna) | A | Manejada por |
|---|---|---|
| PRODUCTOS.ID_PROVEEDOR | PROVEEDORES.ID_PROVEEDOR | `productoController` (CRUD formulario) |
| PRODUCTOS.ID_CATEGORIA | CATEGORIAS.ID_CATEGORIA | `productoController`; borrar categoría bloqueado si tiene productos |
| PRODUCTOS.ID_DESCUENTO | DESCUENTOS.ID_DESCUENTO | Checkout/precios (`descuentoPorcentaje`) |
| PRODUCTOS.ID_VENDEDOR | VENDEDORES.ID_VENDEDOR | Marketplace (aprobar/rechazar publicaciones) |
| VENTAS.ID_CLIENTE | USUARIOS.ID_USUARIO | Checkout y agregados de compras por cliente (mis compras, dashboards) |
| CHAT.ID_DEVOLUCION | DEVOLUCIONES.ID_DEVOLUCION | `chatController` (hilos de devolución) |
| PAGOS_EVENTOS.ID_VENTA | VENTAS.ID_VENTA | `pagosController` (el webhook resuelve la venta por `REFERENCIA_PAGO`); sin FK para aceptar eventos huérfanos sin romper la inserción |

---

## 6. Índices y unicidades destacados (más allá de las PK)

| Nombre | Tabla | Definición | Por qué |
|---|---|---|---|
| `idx_ventas_fecha` | VENTAS | `FECHA_VENTA` | Dashboards/reportes filtran por rango de fecha (EXPLAIN: sin índice era `type ALL`) |
| `idx_ventas_cliente` | VENTAS | `ID_CLIENTE` | "Mis compras" y perfil filtran por cliente |
| `uq_categoria_nombre` | CATEGORIAS | `NOMBRE_CATEGORIA` | Evita nombres repetidos; el catch de `ER_DUP_ENTRY` devuelve 400 |
| `uq_variante_producto` | PRODUCTO_VARIANTES | `(ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO)` | Una combinación por producto |
| `uq_aviso_variante_usuario` | AVISOS_STOCK | `(ID_VARIANTE, ID_USUARIO)` | Un solo aviso activo |
| `uq_solicitud_usuario` / `uq_solicitud_nit` / `uq_solicitud_email` | SOLICITUDES_VENDEDOR | columnas respectivas | Una solicitud por cuenta; NIT/correo no repetidos |
| `uq_vendedor_usuario` / `uq_vendedor_solicitud` / `uq_vendedor_nit` / `uq_vendedor_email` | VENDEDORES | columnas respectivas | 1 vendedor ↔ 1 cuenta ↔ 1 solicitud |
| `USUARIOS.EMAIL`, `USUARIOS.USUARIO` | USUARIOS | `UNIQUE` en columnas | Anti duplicidad en registro |
| `idx_productos_vendedor` | PRODUCTOS | `ID_VENDEDOR` | Consultas por marketplace |
| `uq_pagos_evento` | PAGOS_EVENTOS | `(EXTERNO_ID, CHECKSUM)` | Idempotencia del webhook: el mismo evento firmado no se procesa dos veces |

---

## 7. Cómo verificar o regenerar este documento

- **Verificar contra la BD viva:**
  ```sql
  USE jadda_sports_db;
  SHOW TABLES;                       -- 36 tablas
  DESCRIBE USUARIOS;                 -- columnas/nulos/defecto de una tabla
  SHOW CREATE TABLE ENVIOS\G        -- columnas + FKs + acciones
  SELECT COUNT(*) FROM USUARIOS;    -- volumen por tabla (base para entrega)
  ```
- **Después de cualquier cambio de esquema:** editar `backend/database/setup.js` (`CREATE_TABLES_RAW`/`MIGRACIONES` idempotentes) → correr `node backend/database/exportarSchema.js` para regenerar `schema.sql` → actualizar este diccionario (el setup.js es la única fuente; schema.sql y este documento son artefactos **generados**).
- **Respaldo/reinstalación:** el dump de `scripts/backup.ps1` contendrá siempre las 36 tablas con `CREATE TABLE` (verificación de 36 CREATE TABLE); una BD nueva se siembra con `schema.sql` o con `docker restart jadda_backend` (setup.js).

## 8. Lecturas cruzadas

- ERD visual: [base-de-datos.md](base-de-datos.md) · (alternativa dbdiagram: DBML con la misma información, gráfica crow's foot exportable)
- Respaldo/migración: [../entregables/entregable-s02-planes.md](../entregables/entregable-s02-planes.md) (RPO/RTO y procedimiento medido)
- Modelo y API: [../manuales/manual-tecnico.md](../manuales/manual-tecnico.md) · [../manuales/backend-usuario.md](../manuales/backend-usuario.md)
- Pasarela de pagos (estado `PENDIENTE_PAGO`): [../auditoria/pasarela-pagos-plan.md](../auditoria/pasarela-pagos-plan.md)

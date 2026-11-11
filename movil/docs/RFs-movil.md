# 📱 JADDA SPORTS — Requisitos Funcionales (App Móvil)

> Selección de los requisitos funcionales implementados y verificados en la **app móvil** (React Native 0.81 + Expo 54 + Expo Router), conectada a la **misma API REST y base de datos (TiDB Cloud)** que la web. Documento de referencia del cliente móvil; el conjunto completo (RF-001..RF-061) vive en `docs/RFs/`.
>
> **Corte de verificación: 2026-11-11** (incluye el rediseño T13: buscador unificado, carrito y perfil weblike, carrusel arrastrable y «TE PUEDE INTERESAR»).

---

## Cobertura de RFs en móvil

| RF | Función | Pantalla / flujo móvil | Estado |
| :--- | :--- | :--- | :--- |
| RF-001 | Registro + verificación por código | `registro.tsx` → `verificar-codigo.tsx` | ✅ Implementado |
| RF-002 | Inicio de sesión | `login.tsx` | ✅ Implementado |
| RF-003 | Recuperación de contraseña | `recuperar.tsx` → `restablecer.tsx` | ✅ Implementado |
| RF-005 | Cierre de sesión | Perfil → Cerrar sesión | ✅ Implementado |
| RF-006 | Catálogo de productos | `(tabs)/catalogo.tsx` | ✅ Implementado |
| RF-007 | Filtros por categoría | `(tabs)/catalogo.tsx` (chips de categoría) | ✅ Implementado |
| RF-008 | Ordenar por precio + rango | `(tabs)/catalogo.tsx` (menor/mayor, precioMin/precioMax) | ✅ Implementado |
| RF-009 | Búsqueda de productos | `Header.tsx` (dropdown) + catálogo — **client-side unificada** | ✅ Implementado |
| RF-010 | Detalle de producto | `producto/[id].tsx` (carrusel arrastrable + galería zoom + variantes) | ✅ Implementado |
| RF-011 | Disponibilidad / stock | Producto y catálogo (badge AGOTADO / «¡Solo quedan N!») | ✅ Implementado |
| RF-012 | Relacionados / recomendados | `producto/[id].tsx` «TE PUEDE INTERESAR» | ✅ Implementado |
| RF-013 | Opiniones y valoraciones | `producto/[id].tsx` | ⚠️ Parcial (solo lectura; escribir = web) |
| RF-014 | Carrito de compras | `(tabs)/carrito.tsx` (+ «TE PUEDE GUSTAR» en grid 2 col) | ✅ Implementado |
| RF-015 | Total de la compra | `checkout.tsx` (recalculado en servidor al procesar) | ✅ Implementado |
| RF-016 | Cupones de descuento | `checkout.tsx` (input de cupón + mínimos del servidor) | ✅ Implementado |
| RF-017 | Dirección de envío | `checkout.tsx` + `perfil/direcciones.tsx` (CRUD) | ✅ Implementado |
| RF-018 | Método de pago | `checkout.tsx` (tarjeta / PSE / Nequi / Daviplata + métodos guardados) | ✅ Implementado |
| RF-022 | Estado del pedido | `perfil/compras.tsx` | ✅ Implementado |
| RF-023 | Cancelar pedido | `perfil/compras.tsx` | ✅ Implementado |
| RF-024 | Historial de compras | `perfil/compras.tsx` | ✅ Implementado |
| RF-026 | Calificar compra | — | ❌ Pendiente en móvil (web) |
| RF-033 | Devoluciones / reembolsos | Crear desde `perfil/compras.tsx`; estado en `perfil/devolucion/[idVenta].tsx` y `perfil/reembolso/[id].tsx` | ✅ Implementado |
| RF-036 | Lista de deseos (favoritos) | `(tabs)/favoritos.tsx` | ✅ Implementado |
| RF-038 | Recomendaciones por señales | «TE PUEDE INTERESAR» (visto ×1 / favorito ×2 / comprado ×3) | ✅ Implementado |
| RF-039 | Contactar soporte | `ayuda-soporte.tsx` | ✅ Implementado |
| RF-040 | Retos deportivos | `retos.tsx` | ⚠️ Parcial (ver + unirse; reportar avance = web) |
| RF-041 | Plan de entrenamiento | `mis-planes.tsx` (marca días con `POST /api/planes/marcar-dia`) | ✅ Implementado |
| RF-042 | Métodos de pago guardados | `perfil/metodos-pago.tsx` (CRUD) + guardar en checkout | ✅ Implementado |
| RF-043 | Notificaciones in-app | `components/BellNotificaciones.tsx` (timbre con no leídos) | ✅ Implementado |
| RF-044 | Login social (Google) | `login.tsx` («Continuar con Google») | ✅ Implementado |
| RF-045 | Foto de perfil | Muestra `FOTO_URL`; subida = web | ❌ Pendiente en móvil |
| RF-048 | Formulario de contacto | `contacto.tsx` | ✅ Implementado |
| RF-049 | Historial de navegación | Recientemente vistos en `(tabs)/index.tsx` | ✅ Implementado |
| RF-050 | Chat del marketplace | `chat/[id].tsx` (hilo devoluciones) + `vendedor/chats.tsx` | ⚠️ Parcial (soporte general = web) |
| RF-052 | Envíos del vendedor | `vendedor/ordenes.tsx` | ✅ Implementado |
| RF-053 | Reportes del vendedor | `vendedor/reportes.tsx` | ✅ Implementado |
| RF-056 | Ser vendedor | `ser-vendedor.tsx` | ✅ Implementado |
| RF-059 | Productos del vendedor | `vendedor/productos.tsx` + `nuevo.tsx` + `editar/[id].tsx` | ✅ Implementado |
| RF-061 | PQR | `pqr.tsx` | ✅ Implementado |
| — | Pasarela Wompi en checkout móvil | — | ❌ Pendiente (el checkout móvil usa los 4 métodos propios sin pasarela) |
| — | Push notifications | — | ❌ Pendiente |

---

## Detalle de RFs (formato completo)

### RF-001 — Registro de usuario
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-001 |
| **Nombre** | Registro de usuario |
| **Módulo** | Autenticación |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Febrero 2026 |

* **Descripción:** El sistema debe permitir que un usuario nuevo cree una cuenta proporcionando su nombre completo, correo electrónico y contraseña. Tras el registro, el sistema envía un correo de verificación a la dirección proporcionada con un código de 6 dígitos. El usuario debe ingresar el código en la pantalla de verificación para activar su cuenta antes de poder iniciar sesión.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `full_name` (nombre) | Texto | Sí | Mínimo 2 caracteres, máximo 100 |
| `apellido` | Texto | Sí | Mínimo 2 caracteres, máximo 100 |
| `email` | Texto (email) | Sí | Formato de email válido, máximo 255 caracteres, debe ser único en el sistema |
| `password` | Texto | Sí | Mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número |
| `telefono` | Texto | Sí | Exactamente 10 dígitos |

* **Proceso:**
    1. El usuario ingresa nombre completo, correo electrónico y contraseña en el formulario de registro.
    2. El frontend valida los campos antes de enviar la solicitud al backend.
    3. El backend valida los datos (formato, longitudes, fortaleza de contraseña).
    4. El backend verifica que el correo no esté registrado previamente.
    5. La contraseña se hashea con bcrypt antes de almacenarse.
    6. Se crea el registro del usuario en la tabla `USUARIOS` con `CONFIRMADO = 0`.
    7. Se genera un código de 6 dígitos para verificación de email con expiración de 15 minutos y se almacena en `TOKEN` y `TOKEN_EXPIRA`.
    8. Se envía un correo electrónico al usuario con el código de verificación.
    9. La respuesta retorna un mensaje de éxito: `"Revisa tu correo 📩"`.
    10. El usuario ingresa el código de verificación en la pantalla `/verificar-codigo` → envía `{ email, codigo }` a `POST /api/auth/confirmar`.
    11. El backend valida el código (existencia, expiración), marca `CONFIRMADO = 1` y limpia los campos de token.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Registro exitoso | 201 | Datos del usuario creado (`ID_USUARIO`, `EMAIL`, `NOMBRE_USUARIO`, `CONFIRMADO: false`) |
| Email ya registrado | 400 | Mensaje de error: `"El email ya está registrado"` |
| Datos inválidos | 400 | Detalle de los errores de validación |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/registro` | No | Crea la cuenta y envía email con código de verificación |
| POST | `/api/auth/confirmar` | No | Activa la cuenta con el código de 6 dígitos |
| POST | `/api/auth/reenviar-codigo` | No | Reenvía el código de verificación al email |

* **Reglas de negocio:**
    * **RN-001:** El correo electrónico debe ser único en todo el sistema.
    * **RN-002:** La contraseña nunca se almacena en texto plano; siempre se hashea con bcrypt.

---

### RF-002 — Inicio de sesión
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-002 |
| **Nombre** | Inicio de sesión |
| **Módulo** | Autenticación |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** El sistema debe permitir al usuario autenticarse introduciendo sus credenciales (email y contraseña). Si son válidas y la cuenta está verificada, el sistema inicia una sesión mediante Passport.js + express-session.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `email` | Texto (email) | Sí | Formato de email válido |
| `password` | Texto | Sí | No nulo, cadena de caracteres obligatoria |

* **Proceso:**
    1. El usuario introduce sus credenciales en la interfaz de inicio de sesión (`/login`).
    2. El frontend comprueba la estructura básica de los campos.
    3. El backend busca el registro del usuario en la tabla `USUARIOS` mediante el campo `email`.
    4. El sistema comprueba que el hash de la contraseña proporcionada coincida con el almacenado (`CONTRASENA`) mediante bcrypt.
    5. El sistema evalúa el estado del campo `CONFIRMADO`.
    6. Tras pasar los controles, el backend serializa la sesión del usuario mediante `req.login()` y Passport.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Login exitoso | 200 | `{"message": "¡Login exitoso!", "nombre": "...", "usuario": {...}}` |
| Credenciales inválidas | 401 | Mensaje de error: `"Correo o contraseña incorrectos"` |
| Email no verificado | 403 | Mensaje de error: `"Debes verificar tu correo"` |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | No | Valida las credenciales e inicia sesión con Passport + express-session |
| POST | `/api/auth/logout` | Sí | Cierra la sesión activa |

* **Reglas de negocio:**
    * **RN-003:** Las cuentas con `CONFIRMADO = 0` tienen restringido el inicio de sesión.

---

### RF-003 — Recuperación de contraseña
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-003 |
| **Nombre** | Recuperación de contraseña |
| **Módulo** | Autenticación |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Permite a los usuarios que olvidaron su clave de acceso solicitar un restablecimiento seguro mediante un código de 6 dígitos enviado a su correo electrónico.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `email` | Texto (email) | Sí (Fase 1) | Formato válido de email |
| `codigo` | Texto | Sí (Fase 2) | Código de 6 dígitos |
| `password` | Texto | Sí (Fase 3) | Mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número |

* **Proceso:**
    1. El usuario introduce su correo electrónico en la pantalla de recuperación.
    2. El backend genera un código de 6 dígitos, lo guarda en `USUARIOS.TOKEN` con expiración, y lo envía por correo.
    3. El usuario ingresa el código recibido en la aplicación.
    4. El backend valida que el código coincida y no haya expirado.
    5. El usuario ingresa su nueva contraseña y el backend la actualiza con hash bcrypt.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Código enviado | 200 | Mensaje: `"Código enviado correctamente."` |
| Cambio completado | 200 | Mensaje: `"Contraseña actualizada con éxito. El código ha sido invalidado."` |
| Código incorrecto | 400 | Mensaje: `"Código incorrecto o ya utilizado."` |
| Código expirado | 400 | Mensaje: `"El código ha expirado."` |
| Correo no encontrado | 404 | Mensaje: `"Correo no encontrado."` |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/recuperar-password` | No | Envía código de 6 dígitos al correo del usuario |
| POST | `/api/auth/verificar-codigo` | No | Valida el código de recuperación |
| POST | `/api/auth/update-password` | No | Actualiza la contraseña usando código + email |
| POST | `/api/auth/reenviar-codigo` | No | Reenvía el código de verificación |

* **Reglas de negocio:**
    * **RN-004:** Los códigos de recuperación de contraseñas caducan automáticamente tras unos minutos de emisión o inmediatamente al consumirse.

---

### RF-005 — Cierre de sesión seguro
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-005 |
| **Nombre** | Cierre de sesión seguro |
| **Módulo** | Autenticación |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Garantiza la desconexión del usuario, destruyendo la sesión activa en el servidor y limpiando la cookie del navegador.
* **Entradas:** Ninguna. La sesión se identifica mediante cookie de sesión.
* **Proceso:**
    1. El usuario pulsa sobre la opción "Cerrar sesión".
    2. El backend ejecuta `req.logout()` (Passport) para limpiar el usuario de la sesión.
    3. Ejecuta `req.session.destroy()` para destruir la sesión en el servidor.
    4. Limpia la cookie `connect.sid` del navegador.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Cierre exitoso | 200 | `{"ok": true, "message": "Sesión cerrada correctamente"}` |
| Error del servidor | 500 | Mensaje de error |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/logout` | Sí | Destruye la sesión activa del usuario |

---

### RF-006 — Mostrar el catálogo de productos disponibles
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-006 |
| **Nombre** | Mostrar el catálogo de productos disponibles |
| **Módulo** | Catálogo de productos |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Presenta de manera visual al cliente el listado general con todos los productos deportivos disponibles para la venta. En móvil el catálogo se carga completo una vez y se filtra **en el cliente** (categoría, precio y orden), con chips de categoría y badges de descuento/stock.
* **Proceso:**
    1. El cliente entra en el catálogo en `(tabs)/catalogo`.
    2. El backend devuelve el listado completo (`GET /api/productos`), ordenado por popularidad.
    3. La app aplica filtros/orden en cliente (RF-007/RF-008) y la búsqueda unificada (RF-009).
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Obtención exitosa | 200 | Lista de productos con nombre, precio, imagen y marca |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/productos` | No | Lista los productos activos del catálogo |

---

### RF-009 — Buscar productos por nombre o palabra clave
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-009 |
| **Nombre** | Buscar productos por nombre o palabra clave |
| **Módulo** | Catálogo de productos |
| **Prioridad** | Alta |
| **Estado** | Implementado (2026-11-11) |
| **Fecha** | Mayo 2026 / T13 nov 2026 |

* **Descripción:** Barra de búsqueda en el header con **sugerencias en vivo** (dropdown de 5) y filtrado en el catálogo. En móvil la búsqueda es **100 % client-side** con el util unificado `movil/utils/buscador.ts` (port verbatim del util web `frontend/src/utils/buscador.ts`): normaliza tildes (NFD), tokeniza, aplica padrón de plurales en ambos lados (consulta y palabras del producto) y evita intrusiones por substring ('balon' ⊄ 'baloncesto'). No consume `?search=` del backend.
* **Proceso:**
    1. El usuario escribe en el buscador del header.
    2. `Header.tsx` filtra en vivo la lista de productos ya cargada con `filtrarProductos(productos, searchTerm).slice(0, 5)` (sin fetch por tecla) y muestra un dropdown con sugerencias o el empty state «No se encontraron productos».
    3. Al confirmar la búsqueda, el catálogo aplica el mismo `filtrarProductos`; si no hay resultados muestra el empty state con botón «LIMPIAR FILTROS».
* **Salidas:**

| Escenario | Respuesta |
| :--- | :--- |
| Coincidencias | Dropdown/catálogo con los productos que matchean (tildes y plurales incluidos) |
| Sin resultados | «No se encontraron productos» / empty state del catálogo |

* **Reglas de negocio:**
    * **RN-009.1:** La misma fuente de lógica (`movil/utils/buscador.ts`) alimenta el dropdown del header y el catálogo — nunca pipelines distintos.

---

### RF-010 — Mostrar la descripción detallada de cada producto
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-010 |
| **Nombre** | Mostrar la descripción detallada de cada producto |
| **Módulo** | Catálogo de productos |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 / T13 nov 2026 |

* **Descripción:** Despliega de forma pormenorizada e íntegra todos los metadatos de un artículo. Desde T13 incluye **carrusel de imágenes arrastrable** (`ScrollView horizontal pagingEnabled` sincronizado con las miniaturas, que ahora mueven la imagen grande con `scrollTo`), tap en imagen para galería con zoom, chips de categoría/marca, rating resumido y barra fija inferior de compra.
* **Proceso:**
    1. El cliente selecciona un producto del listado.
    2. La app consulta el producto, sus variantes y sus reseñas en paralelo (`Promise.all`) y las sugerencias «TE PUEDE INTERESAR».
    3. El usuario elige variante (color + atributo) con stock por combinación y cantidad.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Producto localizado | 200 | Objeto JSON con datos del producto |
| ID inexistente | 404 | Mensaje de error: `"Producto no encontrado"` |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/productos/:id` | No | Devuelve la información completa del producto |
| GET | `/api/productos/:id/variantes` | No | Devuelve las variantes (color, talla, stock) del producto |
| GET | `/api/productos/:id/resenas` | No | Devuelve las reseñas del producto (solo lectura en móvil) |

---

### RF-014 — Gestionar el carrito de compras
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-014 |
| **Nombre** | Gestionar el carrito de compras |
| **Módulo** | Carrito de compras |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 / T13 nov 2026 |

* **Descripción:** Permite gestionar el carrito (agregar productos con variante, modificar cantidades y eliminar ítems) persistido en la tabla `CARRITO` del servidor. Desde T13 incluye la sección «TE PUEDE GUSTAR» en **grid vertical de 2 columnas** con las mismas cards `ProductoItem` del catálogo (mezcla favoritos → similares → al azar, deduplicados), con botón que abre el modal de variante.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `ID_PRODUCTO` | Entero | Sí | Debe ser un ID de producto válido |
| `ID_VARIANTE` | Entero | Sí | Debe ser un ID de variante válido |
| `CANTIDAD` | Entero | Sí | Valor numérico entero mayor a cero |

* **Proceso:**
    1. El usuario agrega al carrito desde el detalle de producto (con variante) o desde la card (modal de variante).
    2. El backend registra, actualiza o elimina el registro en la tabla `CARRITO`.
    3. Los vendedores (rol 6) NO pueden comprar: la app muestra aviso y el backend rechaza con 403 (RF-055).
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Carrito modificado | 200 | Estado actualizado del carrito |
| Error de autenticación | 401 | Toast «Iniciar sesión» (AvisoLoginContext) |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/carrito` | Sí | Obtiene los ítems del carrito del usuario |
| POST | `/api/carrito/agregar` | Sí | Agrega una variante al carrito |
| PUT | `/api/carrito/actualizar/:id_carrito` | Sí | Actualiza la cantidad de un ítem |
| DELETE | `/api/carrito/eliminar/:id_carrito` | Sí | Elimina un ítem del carrito |

---

### RF-022 — Consultar el estado de su pedido
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-022 |
| **Nombre** | Consultar el estado de su pedido |
| **Módulo** | Pedidos |
| **Prioridad** | Alta |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Permite a los compradores ver el estado de su orden de compra (`COMPLETADA`, `PENDIENTE`, `PENDIENTE_PAGO`, `CANCELADA`) y el estado del envío (`PENDIENTE`, `EMPACADO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO`), con badges y acciones por estado.
* **Proceso:**
    1. El cliente consulta sus compras en `perfil/compras`.
    2. El backend busca en `VENTAS` filtrado por el ID del usuario y devuelve los pedidos con sus estados.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Consulta exitosa | 200 | Lista de compras con estados `ESTADO` y `ESTADO_ENVIO` |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/compras` | Sí | Devuelve todas las compras del usuario autenticado con detalles |

---

### RF-024 — Consultar su historial de compras
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-024 |
| **Nombre** | Consultar su historial de compras |
| **Módulo** | Pedidos |
| **Prioridad** | Media |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Ofrece un listado retrospectivo de todas las transacciones completadas por el usuario, ordenadas de la fecha más reciente hacia atrás.
* **Proceso:**
    1. El usuario abre la sección "Mis Compras" en `perfil/compras`.
    2. El backend identifica al usuario por su sesión y filtra los registros en la tabla `VENTAS` relacionados con su ID.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Historial obtenido | 200 | Lista de compras con fechas, totales, estados y productos |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/compras` | Sí | Obtiene el historial de compras del usuario autenticado |

---

### RF-036 — Crear y gestionar una lista de deseos
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-036 |
| **Nombre** | Crear y gestionar una lista de deseos |
| **Módulo** | Interacción de usuarios |
| **Prioridad** | Baja |
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Permite a los clientes autenticados guardar productos de su interés en una lista personal de favoritos. En móvil el estado vive en `FavoritosContext` y sincroniza con el servidor; sin sesión muestra el toast «Iniciar sesión».
* **Proceso:**
    1. El usuario pulsa el ícono de corazón en la tarjeta del producto.
    2. El backend agrega o elimina el registro en la tabla `FAVORITOS`.
    3. El usuario puede ver todos sus favoritos en `(tabs)/favoritos`.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Favorito agregado | 201 | Confirmación |
| Favorito eliminado | 200 | Confirmación |
| Lista obtenida | 200 | Lista de productos favoritos del usuario |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/favoritos` | Sí | Obtiene los favoritos del usuario |
| POST | `/api/favoritos` | Sí | Añade un producto a favoritos |
| DELETE | `/api/favoritos/:id` | Sí | Elimina un producto de favoritos |

---

### RF-044 — Iniciar sesión con Google (login social)
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-044 |
| **Nombre** | Login social |
| **Módulo** | Autenticación |
| **Prioridad** | Media |
| **Estado** | Implementado |
| **Fecha** | Agosto 2026 |

* **Descripción:** Permite autenticarse mediante OAuth 2.0 con Google (Passport.js). Si el usuario no existía, se crea automáticamente con rol cliente (4) y cuenta confirmada; si ya existe, se vincula la sesión. En la app móvil el flujo usa el token del proveedor: `GoogleSignin.signIn()` (botón "Continuar con Google") y envía el token a `POST /api/auth/social-login`. Facebook fue retirado (solo Google) en 2026-11-07.
* **Proceso:**
    1. El usuario pulsa "Continuar con Google" en la pantalla de login de la app.
    2. La app obtiene el `idToken` de Google con `GoogleSignin.signIn()`.
    3. La app envía `{ provider, accessToken }` a `POST /api/auth/social-login`.
    4. El backend valida el id_token y crea o actualiza `USUARIOS` (la contraseña se guarda como `'google'` como marcador del método).
    5. El backend inicia la sesión y la app navega a los tabs principales.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Autenticación correcta | 200 | Datos del usuario con sesión iniciada |
| Token inválido | 401 | Mensaje de error del proveedor |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/social-login` | No | Inicio de sesión directo con id_token (móvil) |

* **Nota de implementación:** Requiere `GOOGLE_CLIENT_ID/SECRET` en `.env` del backend y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en `movil/.env` para el botón de Google de la app.

---

## RFs adicionales en móvil (formato compacto)

### RF-007/RF-008 — Filtrar por categoría, ordenar y rango de precio
* **Estado:** ✅ Implementado · **Pantalla:** `(tabs)/catalogo.tsx`.
* El catálogo móvil trae el listado completo y aplica **en cliente**: chips de categoría, orden por precio (menor/mayor) y rango `precioMin`/`precioMax`; combinable con la búsqueda unificada (RF-009). Empty state con botón «LIMPIAR FILTROS».

### RF-011 — Mostrar la disponibilidad en inventario
* **Estado:** ✅ Implementado · **Pantalla:** producto y catálogo.
* Stock total y por variante; badges **AGOTADO** / **¡Solo quedan N!** (umbral 10); el selector de variante bloquea combinaciones sin stock y la barra de compra se deshabilita.

### RF-012/RF-038 — Relacionados y recomendados («TE PUEDE INTERESAR»)
* **Estado:** ✅ Implementado (T13 2026-11-11) · **Pantalla:** `producto/[id].tsx` (al pie, después de reseñas, grid 2 columnas).
* Fetch en `Promise.all` con el producto: **con sesión** `GET /api/productos/recomendados` (señales visto ×1 / favorito ×2 / comprado ×3) · **sin sesión** `GET /api/productos/:id/relacionados` (misma categoría). Excluye el producto actual, `slice(0, 6)`.

### RF-013 — Opiniones y valoraciones
* **Estado:** ⚠️ Parcial · **Pantalla:** `producto/[id].tsx`.
* Móvil **lee** las reseñas (`GET /api/productos/:id/resenas`, con autor, estrellas y fecha). **Escribir** reseña y **calificar compra** (RF-026) siguen siendo flujos web — pendiente en móvil.

### RF-015/RF-016/RF-017 — Checkout: total, cupón y dirección
* **Estado:** ✅ Implementado · **Pantalla:** `checkout.tsx`.
* Dirección editable con CRUD en `perfil/direcciones.tsx`; campo de cupón (validación de mínimos en servidor); el total se **recalcula en el servidor** al procesar (`POST /api/checkout/procesar`), que también descuenta stock y calcula el envío real por departamento.

### RF-018/RF-042 — Método de pago y métodos guardados
* **Estado:** ✅ Implementado · **Pantalla:** `checkout.tsx` + `perfil/metodos-pago.tsx`.
* Métodos del checkout móvil: **tarjeta (débito/crédito), PSE, Nequi, Daviplata** (`ID_METODO` 2/7/4/5) con datos por método (banco, teléfono, titular) y checkbox para **guardar el método** (`POST /api/usuarios/metodos-pago`); CRUD completo en perfil. **Sin pasarela Wompi** (la venta nace `COMPLETADA`; el flujo Wompi es exclusivo de la web).

### RF-023 — Cancelar un pedido antes de su envío
* **Estado:** ✅ Implementado · **Pantalla:** `perfil/compras.tsx`.
* Botón **Cancelar** por pedido (solo estados permitidos y sin despacho); el backend libera stock, reembolsa automáticamente si hubo cobro y notifica. La app muestra el mensaje devuelto por el servidor.

### RF-033 — Devoluciones y reembolsos
* **Estado:** ✅ Implementado · **Pantallas:** `perfil/compras.tsx` (crear) · `perfil/devolucion/[idVenta].tsx` (estado/timeline/evidencias) · `perfil/reembolso/[id].tsx` (comprobante).
* Crear solicitud desde el pedido (tipo reembolso/devolución, motivo, evidencias); consulta con timeline, chat embebido de la devolución y detalle de reembolso con desglose productos/envío.

### RF-039/RF-048/RF-061 — Soporte, contacto y PQR
* **Estado:** ✅ Implementado · **Pantallas:** `ayuda-soporte.tsx` · `contacto.tsx` · `pqr.tsx` · `sobre-nosotros.tsx` · `preguntas-frecuentes.tsx`.
* Formularios que llegan a los endpoints de contacto/PQR del backend con rate limit por IP.

### RF-040 — Retos deportivos
* **Estado:** ⚠️ Parcial · **Pantalla:** `retos.tsx`.
* Móvil: listar retos con cupos/reglas, ver mis retos con progreso y **unirse** (`POST /api/retos/unirse/:id`). **Reportar avance** (evidencias foto/video, modales, cupones RETO-) sigue siendo flujo web — pendiente en móvil.

### RF-041 — Plan de entrenamiento
* **Estado:** ✅ Implementado · **Pantalla:** `mis-planes.tsx`.
* Mis planes con progreso por días y **marcar día** (`POST /api/planes/marcar-dia/:idPlan`); el plan se genera automáticamente con la primera compra.

### RF-043 — Notificaciones in-app
* **Estado:** ✅ Implementado · **Pantalla:** timbre global `components/BellNotificaciones.tsx` (header) + badge de chats sin leer en `Header.tsx`.
* Polling de `GET /api/notificaciones` / `no-leidas`; marca leídas; navegación a la ruta de cada notificación.

### RF-045 — Foto de perfil
* **Estado:** ❌ Pendiente en móvil · La app **muestra** la foto (`FOTO_URL` del perfil, con fallback ui-avatars). La subida desde el teléfono (cámara/galería) no está implementada — hoy se sube desde la web.

### RF-049 — Historial de navegación
* **Estado:** ✅ Implementado · **Pantalla:** `(tabs)/index.tsx` (sección «Recientemente vistos»).
* Con sesión consulta `GET /api/historial`; sin sesión usa el respaldo local de productos vistos.

### RF-050 — Chat del marketplace
* **Estado:** ⚠️ Parcial · **Pantallas:** `chat/[id].tsx` (hilo genérico, hoy para chats de devoluciones) + `vendedor/chats.tsx` (panel del vendedor) + badge de no leídos en header.
* Hilo con polling, mensajes SISTEMA centrados y chat embebido desde el estado de devolución. El canal de **soporte general** y la lista general de chats siguen siendo web — pendiente ampliar en móvil.

### RF-052/RF-053/RF-059 — Panel del vendedor
* **Estado:** ✅ Implementado · **Pantallas:** `vendedor/` (index con KPIs, productos, nuevo/editar con variantes e imágenes, ventas, ordenes, devoluciones, reportes, tienda, chats).
* CRUD de sus productos (nacen `PENDIENTE` hasta aprobación admin), gestión de envíos de sus ventas y reportes. Sincronizado con el mismo panel web (los cambios se ven en ambos).

### RF-056 — Solicitud para ser vendedor
* **Estado:** ✅ Implementado · **Pantalla:** `ser-vendedor.tsx`.
* Formulario completo (empresa/NIT opcionales para vendedor informal), políticas y estados de la solicitud (pendiente/aprobada/rechazada con motivo de reenvío).

---

## Pendientes específicos del móvil

| # | Función | Nota |
| :--- | :--- | :--- |
| 1 | Escribir reseñas y calificar compra (RF-013/026) | Hoy solo lectura de reseñas |
| 2 | Reportar avance de retos (RF-040) | Hoy solo ver + unirse |
| 3 | Subida de foto de perfil (RF-045) | Hoy solo muestra la foto |
| 4 | Chat de soporte general (RF-050) | Hoy solo chats de devoluciones + vendedor |
| 5 | Pasarela Wompi en checkout | El checkout móvil usa los 4 métodos propios (la venta nace COMPLETADA) |
| 6 | Push notifications | Sin notificaciones push (solo in-app con polling) |
| 7 | Banners nuevos de inicio | 4 imágenes pendientes del usuario (upload Cloudinary + OTA de seguimiento) |

---

*Fuente: `docs/RFs/` (conjunto completo RF-001..RF-061). Selección de RFs aplicables al cliente móvil, verificada contra el código el 2026-11-11.*

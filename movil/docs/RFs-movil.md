# 📱 JADDA SPORTS — Requisitos Funcionales (App Móvil)

> Selección de los requisitos funcionales implementados y verificados en la **app móvil** (React Native + Expo). Documento de referencia para el cliente móvil; el conjunto completo (RF-001..RF-049) vive en `docs/RFs/`.

---

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

* **Descripción:** Presenta de manera visual al cliente el listado general con todos los productos deportivos disponibles para la venta.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| Ninguna | — | — | La consulta se realiza sin filtros obligatorios |

* **Proceso:**
    1. El cliente entra en el catálogo en `/catalogo`.
    2. El backend realiza una consulta a la tabla `PRODUCTOS` y devuelve el listado completo.
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
| **Estado** | Implementado |
| **Fecha** | Mayo 2026 |

* **Descripción:** Habilita una barra de texto para buscar productos evaluando el término introducido contra el nombre del producto.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `q` | Texto (Query) | Sí | Palabra clave, búsqueda por prefijo (`LIKE 'word%'`) |

* **Proceso:**
    1. El usuario escribe un término en el cuadro de búsqueda.
    2. El backend procesa el string y ejecuta una búsqueda con `LIKE 'palabra%'` sobre el nombre del producto.
    3. Si hay múltiples palabras, todas deben coincidir (cada palabra se busca como prefijo).
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Coincidencias halladas | 200 | Lista de productos que coinciden con el patrón de búsqueda |
| Sin resultados | 200 | Lista vacía |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/productos` | No | Realiza búsquedas mediante el argumento query `q` |

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
| **Fecha** | Mayo 2026 |

* **Descripción:** Despliega de forma pormenorizada e íntegra todos los metadatos correspondientes a un artículo, incluyendo imágenes secundarias, descripción larga, ficha técnica y variaciones comerciales disponibles.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `id` | Entero (Path) | Sí | Debe ser un número entero correspondiente a un ID existente |

* **Proceso:**
    1. El cliente selecciona un producto del listado en `/producto/:id`.
    2. El backend consulta la tabla `PRODUCTOS` con la información del producto.
    3. Adicionalmente se obtienen sus variantes (`/api/productos/:id/variantes`), imágenes y reseñas.
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
| GET | `/api/productos/:id/resenas` | No | Devuelve las reseñas del producto |

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
| **Fecha** | Mayo 2026 |

* **Descripción:** Permite gestionar el carrito de compras (agregar productos con variante, modificar cantidades y eliminar ítems). El carrito se mantiene en la tabla `CARRITO` para usuarios autenticados.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `ID_PRODUCTO` | Entero | Sí | Debe ser un ID de producto válido |
| `ID_VARIANTE` | Entero | Sí | Debe ser un ID de variante válido |
| `CANTIDAD` | Entero | Sí | Valor numérico entero mayor a cero |

* **Proceso:**
    1. El usuario hace clic en "Agregar al carrito" desde la página del producto.
    2. El frontend muestra el carrito con los ítems actualizados.
    3. El backend registra, actualiza o elimina el registro en la tabla `CARRITO`.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Carrito modificado | 200 | Estado actualizado del carrito |
| Error de autenticación | 401 | Mensaje de error |

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

* **Descripción:** Permite a los compradores ver el estado de su orden de compra (`COMPLETADA`, `PENDIENTE`, `CANCELADA`) y el estado del envío (`PENDIENTE`, `ENVIADO`, `ENTREGADO`, `CANCELADO`).
* **Entradas:** Ninguna. El usuario autenticado consulta sus propias compras.
* **Proceso:**
    1. El cliente consulta sus compras en `/perfil/compras`.
    2. El backend busca en la tabla `VENTAS` filtrado por el ID del usuario y devuelve los pedidos con sus estados.
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
* **Entradas:** Ninguna. Usuario autenticado.
* **Proceso:**
    1. El usuario abre la sección "Mis Compras" en `/perfil/compras`.
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

* **Descripción:** Permite a los clientes autenticados guardar productos de su interés en una lista personal de favoritos.
* **Entradas:**

| Campo | Tipo | Obligatorio | Validaciones |
| :--- | :--- | :--- | :--- |
| `ID_PRODUCTO` | Entero (Body/Path) | Sí | Debe ser un ID de producto existente |

* **Proceso:**
    1. El usuario hace clic en el ícono de corazón en la tarjeta del producto.
    2. El backend agrega o elimina el registro en la tabla `FAVORITOS`.
    3. El usuario puede ver todos sus favoritos en la página `/favoritos`.
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

### RF-044 — Iniciar sesión con redes sociales (Google y Facebook)
* **Identificación:**

| Campo | Valor |
| :--- | :--- |
| **ID** | RF-044 |
| **Nombre** | Login social |
| **Módulo** | Autenticación |
| **Prioridad** | Media |
| **Estado** | Implementado |
| **Fecha** | Agosto 2026 |

* **Descripción:** Permite autenticarse mediante OAuth 2.0 con Facebook o Google (Passport.js). Si el usuario no existía, se crea automáticamente con rol cliente (4) y cuenta confirmada; si ya existe, se vincula la sesión. En la app móvil el flujo usa el token del proveedor: `GoogleSignin.signIn()` (botón "Continuar con Google") o `LoginManager.logInWithPermissions()` (botón "Continuar con Facebook") y envía el token a `POST /api/auth/social-login`.
* **Entradas:** Ninguna directa. Delegado al proveedor OAuth (token de acceso).
* **Proceso:**
    1. El usuario pulsa "Google" o "Facebook" en la pantalla de login.
    2. La app obtiene el `idToken` (Google) o `accessToken` (Facebook) del proveedor nativo.
    3. La app envía `{ provider, accessToken }` a `POST /api/auth/social-login`.
    4. El backend valida el token contra el proveedor y crea o actualiza `USUARIOS` (la contraseña se guarda como `'google'`/`'facebook'` como marcador del método).
    5. El backend inicia la sesión y la app navega a los tabs principales.
* **Salidas:**

| Escenario | Código HTTP | Respuesta |
| :--- | :--- | :--- |
| Autenticación correcta | 200 | Datos del usuario con sesión iniciada |
| Token inválido | 401 | Mensaje de error del proveedor |
| Facebook sin email | — | Error "Facebook no proporcionó email" (no se crea cuenta) |

* **Endpoints asociados:**

| Método | Ruta | Auth requerida | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/api/auth/google`, `/api/auth/google/callback` | No | OAuth Google 2.0 (web) |
| GET | `/api/auth/facebook`, `/api/auth/facebook/callback` | No | OAuth Facebook (web) |
| POST | `/api/auth/social-login` | No | Inicio de sesión directo con token del proveedor (móvil) |

* **Nota de implementación:** Requiere `GOOGLE_CLIENT_ID/SECRET` y `FACEBOOK_CLIENT_ID/SECRET` en `.env` del backend, y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en `movil/.env` para el botón de Google de la app.

---

*Fuente: `docs/RFs/` (conjunto completo RF-001..RF-049). Selección de RFs aplicables al cliente móvil.*
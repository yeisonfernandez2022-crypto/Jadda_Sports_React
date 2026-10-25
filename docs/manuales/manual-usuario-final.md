# Manual de Usuario Final — JADDA SPORTS

**Versión del documento:** 1.1 · 2026-10-22
**Audiencia:** clientes, vendedores y administradores de la tienda
**Acceso:** navegador web en `http://<dirección-del-servidor>:5173` (o la app móvil de JADDA SPORTS)

---

## 1. Visitante (sin cuenta)

| Quiero… | Haz esto |
|---------|----------|
| Ver el catálogo | Menú **CATÁLOGO** (pasa el mouse para ver categorías) o botón OFERTAS |
| Buscar un producto | Caja de búsqueda del menú superior; escribe las primeras letras del nombre |
| Ver detalles | Clic sobre cualquier tarjeta: fotos (zoom), colores/tallas, descripción, reseñas |
| Filtrar por precio o categoría | Barra lateral del catálogo; usa LIMPIAR FILTROS para reiniciar |

> Para comprar, agregar favoritos o participar en retos necesitas una cuenta.

## 2. Cliente

### 2.1 Crear cuenta e iniciar sesión
1. Botón **INICIAR SESIÓN / REGISTRO** (arriba a la derecha).
2. En *Registro* llena tus datos → recibirás un **código de 6 dígitos al correo** (válido 15 minutos).
3. Ingrésalo y ya puedes comprar. También puedes entrar con Google/Facebook.
4. ¿Olvidaste tu contraseña? → "¿Olvidaste tu contraseña?" en el login.

### 2.2 Comprar
1. En el producto elige **color y talla** (si aplica) y cantidad → **AGREGAR AL CARRITO** (ícono flotante abajo a la derecha = tu carrito).
2. Abre el carrito → **COMPRAR**. En el resumen, despliega **"Ver cupones disponibles y los tuyos"** para ver las promociones de la tienda y los cupones que ganaste en retos, y aplicarlos con un clic.
3. Paso 1: dirección (puedes guardarla para futuras compras). El costo de envío se calcula solo - es gratis desde $800.000.
4. Paso 2: en pago verás los métodos aceptados por la pasarela **Wompi** (Tarjeta, PSE, Nequi, Daviplata y Bancolombia): **no se piden datos de pago en el sitio**, se eligen dentro del checkout seguro de Wompi. Desde *Perfil → Métodos de pago* puedes guardarlos para reutilizar tus datos de dirección/teléfono.
5. Al confirmar vas a la pasarela Wompi y luego a la **página de éxito**: el pedido queda *PENDIENTE DE PAGO* con el botón **"PAGAR CON WOMPI"** hasta que el pago se apruebe (la página consulta el estado sola cada pocos segundos o lo hace la respuesta del webhook de Wompi). Cuando es aprobado verás la **compra exitosa** con tu número de pedido y llega un **correo con la factura PDF**. Si el pago se declina o pasan **48 horas sin pagar**, el pedido se cancela y el stock vuelve a estar disponible. (Sin pasarela de pagos activada, el pedido nace completado como siempre.)

### 2.3 Seguir mis pedidos — *Perfil → Mis compras*
- Cada tarjeta muestra el estado real: *Pendiente de pago* (cuando aplica), *Por empaquetar → Empacado → En camino → Entregada*.
- **Ver mi compra**: detalle completo con línea de tiempo, dirección (editable hasta que salga del almacén), productos y totales.
- Acciones según el caso: **Cancelar pedido** (antes de que salga), **Factura** (PDF), **Volver a comprar**, y si algo salió mal:
  - Dentro de los **3 días** tras entrega: **Devolver o pedir reembolso** → eliges productos, motivo y adjuntas fotos/videos.
  - Puedes seguir el proceso en **"Ver estado de devolución"**; si el equipo pide más pruebas, ahí mismo adjuntas nuevas evidencias y escribes en el **chat embebido** de esa solicitud.

### 2.4 Retos deportivos — *Menú → Retos*
1. Únete a un reto (ej. "Semana Activa").
2. Reporta tu avance: cantidad + fotos/videos opcionales (hasta 5 archivos de 25 MB). Si envías material, queda **en revisión hasta 24 horas**.
3. Al completar la meta recibes un **cupón de descuento** (de un solo uso) que aplicas en el checkout (también aparece en el panel "cupones disponibles").
4. Si el equipo rechaza un avance, lo verás con su **motivo** (botón "Ver motivo de la revisión") y un comentario si lo aprobó con observaciones; mientras un avance sigue *en revisión* puedes **eliminarlo**.

### 2.5 Chats — *Menú de usuario → Mis chats*
- **Soporte JADDA**: botón **"Nuevo soporte"** dentro de *Mis chats*.
- **Chatear con el vendedor**: botón en la página de cada producto vendido por una tienda externa.
- Hilos con burbujas y mensajes del sistema centrados; hay **badge de no leídos** en el menú.
- Si una devolución no se resuelve, usa el botón **"Escalar a JADDA"** (desde la página de estado de la devolución): el hilo se cierra y JADDA abre uno contigo con su decisión final.
- El filtro de lenguaje censura palabras ofensivas con asteriscos.

### 2.6 Perfil — *Menú → Ver perfil*
- **Editar datos**: nombres, teléfono, usuario; foto de perfil (clic en tu avatar); cambiar contraseña y correo (pide tu contraseña por seguridad).
- **Direcciones** y **Métodos de pago**: alta/baja y marcar principal.
- **Favoritos**: corazón en cada producto; puedes deshacer una eliminación por unos segundos.
- 🔔 **Timbre**: notificaciones de tus pedidos, retos y avisos.

## 3. Vendedor

1. Solicita tu cuenta: *menú de usuario → Ser vendedor* (o VENDER sin sesión). Si vendes de forma informal puedes dejar empresa y NIT vacíos.
2. El administrador revisa tu solicitud (máximo 48 h) y te llegará un **correo con usuario y clave temporal**; al ingresar deberás crear tu propia contraseña.
3. **Importante**: las cuentas de vendedor **no pueden comprar** en la tienda (el carrito y el checkout lo bloquean).
4. Tu panel (*Mi tienda*) tiene 8 secciones:
   - **Mi tienda**: KPIs (productos publicados/pendientes, unidades vendidas, ingresos) y stock bajo.
   - **Publicar producto**: ficha completa con fotos desde tu PC, variantes (color/talla) y ficha técnica; pasa a *En revisión* hasta que el administrador lo apruebe.
   - **Mis productos**: lista con estados *En revisión / Aprobado / Rechazado* (con motivo) y edición.
   - **Mis ventas**: pedidos con tus artículos; avanzas el estado de envío (Pendiente → Entregado) de TUynes pedidos como lo haría el admin.
   - **Devoluciones**: resuelves las solicitudes de tus productos (devolver con reingreso al stock, reembolsar, pedir más pruebas o rechazar con motivo) y chateas con el cliente en cada caso.
   - **Chats**: conversaciones con clientes (badge de no leídos).
   - **Reportes**: ingresos, detalle de tus ventas y descarga en **Excel/PDF**.
   - **Configuración**: teléfono, ubicación y dirección de contacto (empresa, NIT y correo quedan bloqueados).

## 4. Administrador

Entra con tu cuenta admin; el menú lateral izquierdo da acceso a todo:

| Sección | Qué hacer |
|---------|-----------|
| **Dashboard** | Resumen del día/30 días, ventas, pendientes y accesos rápidos |
| **Órdenes** | Pedidos separados en *Sin procesar / Procesadas*. Botón **Gestionar** → avanzar estado de envío con la línea de tiempo (Pendiente→Entregado), ver artículos, dirección y descargar factura. Las canceladas permiten eliminar el registro |
| **Productos** | Buscar/filtrar, editar con galería ordenable y vista previa; aprobar ✅ o rechazar ❌ productos de vendedores; Publicar crea productos propios de JADDA |
| **Categorías / Descuentos / Proveedores** | Creación y edición sencilla desde formularios |
| **Usuarios** | Buscar y **Ver usuario**: compras, retos, direcciones, métodos de pago y datos de vendedores |
| **Devoluciones y reembolsos** | Filtro Reembolsos/Devoluciones; **Gestionar** abre toda la solicitud con evidencias; decidir: devolver (reingresa el stock), reembolsar, pedir más pruebas o rechazar (con observación que el cliente verá) |
| **Chats** | Hilos de soporte, vendedores y devoluciones — los de devolución se ven separados ("comprador" / "vendedor") con filtro de solo escaladas; la decisión final cierra los hilos con un mensaje del sistema |
| **Retos** | Evidencias separadas en *No revisados / Ya revisados*: ver material, aprobar o rechazar con motivo (el material se conserva tras la revisión) |
| **Vendedores** | Aprobar solicitudes (se envían credenciales por correo) o rechazar con razón |
| **Reportes** | Ventas por rango de fechas y productos más vendidos; descarga de reporte en **Excel o PDF** |
| **Newsletter** | Los correos de ofertas salen **automáticamente** cada 72 horas y cada pie de página admite desuscripción; los endpoints de admin (lista de suscritos / envío manual) existen pero aún sin panel visual. La suscripción se toma en el pie de la tienda |

## 5. Consejos generales

- Los correos de verificación/códigos pueden llegar a *spam*.
- El sistema bloquea acciones riesgosas con mensajes claros (ej. cancelar un pedido que ya salió): si no ves un botón, es porque la regla no lo permite.
- Ante dudas: *Ayuda y soporte / Contacto* en el pie de página, o el formulario PQR de tu perfil.

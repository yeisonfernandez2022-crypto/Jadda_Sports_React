# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-11-04

Primera versión desplegada a producción (servidor Linux/WSL y nube).

### Tienda (visitante / cliente)
- Catálogo con búsqueda por prefijo, filtros, categorías con mega-menú y
  productos multivariante (color/talla/presentación) con selector propio.
- Carrito flotante, barra de progreso a envío gratis (≥ $800.000) y checkout
  en 4 pasos (envío → pago → confirmación → compra exitosa) con resumen
  calculado íntegramente en el servidor.
- Pagos con pasarela **Wompi** (sandbox: tarjeta, Nequi, PSE, Bancolombia…),
  expiración de pedidos sin pagar (10 min) con reingreso de stock y pantalla
  de pago fallido con reintento.
- Cupones de tienda (con compra mínima) y cupones personales de reto
  (`RETO-`, un solo uso, intransferibles).
- Favoritos, recomendados por señales (visto/favorito/comprado), reseñas con
  calificación, historial de navegación y newsletter con correo de bienvenida
  y desuscripción.

### Cuentas y perfil
- Registro con verificación OTP por correo (código de 6 dígitos, 15 min),
  login social Google/Facebook (web), recuperación de contraseña.
- Perfil con foto (subida al navegador), direcciones y métodos de pago
  reutilizables en el checkout, cambio de correo con confirmación y última
  conexión geolocalizada.

### Compras y posventa
- Mis Compras con estados reales (pendiente de pago, envío, cancelación),
  rastreo, factura PDF descargable y «volver a comprar».
- Cancelación de pedidos pagados antes del despacho con **reembolso
  automático** (productos + costo de envío) sin pasar por el admin.
- Devoluciones y reembolsos post-entrega (plazo 3 días) con evidencias
  (fotos/videos), 4 decisiones del equipo y **chat de negociación** con el
  vendedor, con escalación a soporte JADDA en hilos separados.

### Retos deportivos y planes
- Retos con inscripción (máx. 3 activos), reporte de avance con evidencias
  (hasta 5 archivos × 25 MB, 1 avance/día en metas por días/sesiones),
  revisión del admin con motivo, y cupón de recompensa personal.
- Planes de entrenamiento generados con progreso persistente.

### Paneles admin y vendedor
- Admin: dashboard con métricas y gráficas, gestión de productos (con
  variantes e imágenes), órdenes con timeline de envío, usuarios con detalle
  completo, categorías, devoluciones/reembolsos, vendedores (solicitudes con
  aprobación/rechazo por correo), retos, reportes descargables (Excel con
  fórmulas y PDF ejecutivo) y configuración.
- Vendedor: tienda propia (productos con flujo de aprobación), ventas con
  gestión de estado, reportes Excel/PDF y datos de empresa; los vendedores no
  pueden comprar en la tienda.
- Chat soporte/vendedor/devolución con badges de no leídos y filtro de
  groserías.

### Seguridad
- Sesiones firmadas (`connect.sid` httpOnly SameSite=Lax), defensa CSRF por
  verificación de Origin, rate limiting por IP en rutas sensibles, validación
  de subidas (magic bytes, límites por tipo), archivos privados servidos con
  autorización por recurso, RBAC (cliente/vendedor/admin), cabeceras de
  seguridad en el proxy y secretos solo por variables de entorno.

### Infraestructura y despliegue
- Docker (dev y producción) con 4 servicios: MySQL, backend, frontend (nginx
  SPA) y nginx de borde TLS; BD con auto-setup + migraciones idempotentes y
  datos demo opcionales (`DEMO_DATA`).
- Medios en Cloudinary con fallback local; correos transaccionales con
  factura adjunta; healthchecks en todos los servicios; CI en GitHub Actions
  (unit + integración con MySQL real + E2E) y scripts de respaldo/restauración.
- Despliegue verificado: **WSL Ubuntu (smoke 6/6)** y **nube con MySQL
  gestionado externo (smoke 6/6)**; nginx SPA con upstream resuelto en
  runtime y Host del upstream para evitar loops detrás de edges.
- Pendiente externo: dominio propio para OAuth social en la nube y webhook
  Wompi de producción.

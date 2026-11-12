# Plan de Trabajo — JADDA SPORTS (Semana 1 · Sprint 0)

> Bootcamp: Asesoría Desarrollo — Codificación (SENA ADSO). Semana 1: Alistamiento acelerado y arranque.
> RAP: Planear actividades de construcción del software de acuerdo con el diseño establecido.

## 1. Resumen del Informe de Diseño

**Problema que resuelve el proyecto**: JADDA SPORTS es una tienda deportiva online para Colombia que concentra en un solo lugar el catálogo de artículos deportivos (fútbol, running, gimnasio, natación, ciclismo, etc.), la compra con carrito y pasarela de pagos, y una capa de fidelización (retos deportivos con cupones, planes de entrenamiento, notificaciones). Resuelve tres dolores concretos: (1) el cliente no tiene una fuente confiable con stock real por talla/variante y precios en COP; (2) la compra completa — carrito → dirección → método de pago → confirmación → factura PDF — está dispersa entre canales (WhatsApp, correos sueltos) y genera errores de entrega; (3) la atención postventa (devoluciones/reembolsos, con productos de la tienda y de vendedores externos) carece de trazabilidad centralizada.

**Documentos de diseño disponibles**:

| Documento | Estado | Ubicación |
|---|---|---|
| Arquitectura del sistema | ✅ Disponible | `docs/diagrams/arquitectura.md` (capas web+móvil → API → BD; diagramas de secuencia de autenticación y checkout) |
| Historias de usuario | ✅ Disponible — 61 HUs (HU-001..HU-061) | `docs/HUs/` (formato con Identificación, Historia, CA numerados, RF asociados) |
| Requisitos funcionales | ✅ Disponible — 61 RFs (RF-001..RF-061) | `docs/RFs/` |
| Requisitos no funcionales | ✅ Disponible — 17 RNFs | `docs/RNFs/` |
| Casos de uso (formales UML) | ⚠️ Parcial — el diseño usa flujos diagramados en vez de casos de uso UML | `docs/diagrams/flujos.md` (registro, compra, admin, navegación) |
| Anteproyecto (formato académico) | — Pendiente de aclarar con instructor | — |

## 2. Stack de Desarrollo

| Capa | Tecnología | Justificación breve |
|---|---|---|
| Backend | **Node 22 + Express 5** (CommonJS), sesiones con `express-session` + Passport.js | El diseño exige API REST con sesión de servidor (cookie `connect.sid`) y OAuth (Google) con Passport — no JWT de cliente. El equipo ya domina JavaScript/TypeScript (mismo lenguaje en backend y frontend), lo que reduce el costo de integración. Se descartó FastAPI (stack de referencia del bootcamp) porque el proyecto real ya está construido sobre Node y la migración no aporta valor. |
| Frontend web | **React 19 + Vite 8 + TypeScript + Bootstrap 5** (SweetAlert2) | SPA con tienda pública, checkout multi-paso y paneles admin/vendedor; Vite por recarga instantánea y build nativo ESM. |
| Base de datos | **MySQL 8** (Docker en dev) / **TiDB Cloud** (producción, compatible MySQL, puerto 4000 TLS) | El diseño exige integridad referencial fuerte (38 tablas con FKs, transacciones `FOR UPDATE` en checkout). TiDB permite desplegar sin servidor propio conservando el mismo esquema. |
| App móvil | **React Native (Expo SDK 54)** | Segunda cara del cliente (Expo Go); comparte el mismo backend y endpoints REST. |
| Pruebas | Vitest (backend + frontend) + sondas E2E | Suites actuales: 208 pruebas backend, 65 frontend. |

## 3. Backlog Priorizado

Cadena core seleccionada (12 de las 61 HUs): cubre el ciclo completo del cliente (registrar → entrar → explorar → comprar → confirmar → consultar → postventa) más fidelización y avisos. Las 49 HUs restantes se consideran **Secundarias** y se construyen sobre esta base.

| # | Historia de Usuario | Core / Secundaria | Depende de |
|---|---|:---:|---|
| 1 | HU-001 — Registro de cuenta: *Como usuario nuevo, quiero crear una cuenta proporcionando mi nombre, correo electrónico y contraseña, para poder acceder a las funcionalidades del sistema.* | Core | — |
| 2 | HU-002 — Inicio de sesión: *Como usuario registrado, quiero iniciar sesión con mi correo y contraseña, para acceder a las funcionalidades exclusivas de mi cuenta en Jadda Sports.* | Core | HU-001 |
| 3 | HU-006 — Mostrar el catálogo de productos disponibles: *Como cliente de la tienda, quiero visualizar un catálogo paginado con todos los productos disponibles, para explorar los artículos deportivos de forma fluida.* | Core | — |
| 4 | HU-014 — Gestionar el carrito de compras: *Como cliente, quiero añadir, actualizar y quitar variantes de productos de mi carrito de compras, para consolidar la lista de ítems que deseo adquirir en una sola transacción.* | Core | HU-002 |
| 5 | HU-015 — Calcular y mostrar el total de la compra: *Como comprador meticuloso, quiero ver el desglose económico de mi carrito en tiempo real, para comprender claramente el subtotal, el valor de los impuestos (IVA 19%) y el costo de envío.* | Core | HU-014 |
| 6 | HU-017 — Ingresar la dirección de envío: *Como comprador, quiero especificar mi dirección exacta de entrega durante el checkout, para asegurar que el paquete de mi pedido llegue de forma correcta a mi domicilio.* | Core | HU-014 |
| 7 | HU-018 — Seleccionar el método de pago: *Como cliente con distintas tarjetas o cuentas bancarias, quiero elegir mi medio de pago preferido y cerrar la compra por la pasarela de pagos, para pagar el pedido de la forma que más me convenga y con facilidades de bancos colombianos.* | Core | HU-017 |
| 8 | HU-020 — Enviar la confirmación del pedido al correo electrónico del cliente: *Como comprador en línea, quiero recibir un correo electrónico informativo inmediatamente después de pagar, para tener un comprobante digital de que mi orden de compra fue procesada con éxito por la tienda.* | Core | HU-015, HU-018 |
| 9 | HU-024 — Consultar su historial de compras: *Como cliente frecuente, quiero tener acceso a una lista cronológica con todas mis compras pasadas, para recordar los modelos deportivos que adquirí anteriormente y verificar sus costos.* | Core | HU-020 |
| 10 | HU-033 — Gestionar devoluciones de productos: *Como encargado de atención postventa, quiero evaluar y cambiar el estado de las solicitudes de devolución de los clientes, para autorizar de forma centralizada la devolución del dinero y el reingreso automático de los artículos al stock disponible.* | Core | HU-024 |
| 11 | HU-040 — Participar en retos deportivos: *Como usuario autenticado, quiero unirme a retos deportivos y reportar mi progreso (con o sin evidencia), para alcanzar la meta del reto y recibir un cupón de descuento `RETO-`.* | Core | HU-002 |
| 12 | HU-043 — Notificaciones in-app (campana de avisos): *Como usuario autenticado, quiero recibir y gestionar avisos dentro de la aplicación a través de una campana, para estar al tanto de los eventos importantes de mis pedidos y de la plataforma sin depender del correo.* | Core | HU-020 |

Fuente literal: `docs/HUs/HU-001.md`..`HU-061.md`.

## 4. Progresión de Sprints Propuesta

Progresión alineada al plan curricular del bootcamp (`docs/plan-curricular.md`, sprints 1–8). **Nota honesta**: la mayoría de las HUs core ya está implementada en el código real del proyecto; los sprints no reconstruyen desde cero — profundizan, pulen y validan cada capa según el enfoque del sprint (persistencia → autenticación → CRUD → reglas → integración → flujos → pruebas → cierre), y el avance se acredita con commits y pruebas por semana.

| Sprint | Semana | Historias asignadas | Alcance del sprint sobre el proyecto real |
|---|:---:|---|---|
| 1 — Dominio y persistencia | 2 | HU-001, HU-006 | Validar el esquema de `USUARIOS` (confirmación OTP, rol) y `PRODUCTOS`/`PRODUCTO_VARIANTES`/`PRODUCTO_IMAGENES` (38 tablas, seeds idempotentes, `schema.sql` regenerable). |
| 2 — Autenticación y autorización | 3 | HU-002 | Validar sesiones `express-session` + Passport (local y OAuth Google), verificación OTP por correo, RBAC (`esAdmin`/`esVendedor`) y bloqueo de vendedores compradores. |
| 3 — API CRUD entidades core | 4 | HU-014, HU-006 (refinada) | Carrito server-side (CRUD de ítems con variante), filtros/orden/búsqueda del catálogo client-side con util unificada, stock por variante. |
| 4 — Reglas de negocio y servicios | 5 | HU-015, HU-017, HU-018 | Total calculado 100 % en servidor (subtotal, descuentos, cupón, envío por departamento, gratis ≥ $800.000), direcciones, métodos de pago con pasarela Wompi (sandbox). |
| 5 — Integración frontend-backend | 6 | HU-020 (+ checkout HU-019) | Transacción de checkout concurrente (`FOR UPDATE`, 409 por stock), correos con factura PDF adjunta, notificaciones post-venta, expiración de pagos. |
| 6 — Flujos y funcionalidades secundarias | 7 | HU-024, HU-033, HU-040 | Historial de compras con detalle y factura, devoluciones/reembolsos con 3 reglas de decisión (tienda, vendedor, escalación a JADDA), retos con evidencias y cupones `RETO-` personales. |
| 7 — Pruebas y manejo de errores | 8 | HU-043 (validación) | Notificaciones in-app (campana, rutas por destinatario), pruebas E2E de la cadena core completa, manejo de errores con mensajes claros en español. |
| 8 — Cierre y avance 90 % | 9 | (transversal) | Gate de despliegue con Docker, smoke test de punta a punta, verificación de las 12 HUs core con evidencia de commits/pruebas por sprint. |

## 5. Sprint 0 — Qué se codificó esta semana

- **Rama feature usada**: `feature/sprint0-coding-standards` (basada en `origin/Develop`).
- **Qué se construyó**:
  1. `CODING_STANDARDS.md` (raíz): estándar de codificación completo siguiendo la plantilla del bootcamp — reglas de nombrado (variables/métodos/atributos/clases/tablas/campos), indentación, documentación de código, manejo de errores, commits Conventional Commits (rama `feature/*`, PRs a `Develop`), linter. **Evidencia RED→GREEN del linter registrada en la sección 8 del documento**: baseline verde (0 errores, 227 warnings), violación intencional detectada (`@typescript-eslint/no-unused-vars` como error con escape `^_`), y verde de nuevo tras eliminarla.
  2. Fix de integración continua: `.github/workflows/ci.yml` — los triggers de `push`/`pull_request` solo escuchaban `develop` en minúscula y no disparaban contra la rama real del equipo (`Develop`); corregido a `branches: [main, develop, Develop]` en ambos eventos.
  3. Este entregable (`docs/entregables-asesoria/entregable-s01-plan-de-trabajo.md`).
  4. Dominio real — no "hello world": endpoint de solo lectura `GET /api/envio/tarifas` (`backend/routes/envioRoutes.js` + `backend/controllers/envioController.js`) que expone el dominio de envío ya existente (`backend/utils/envio.js`): tabla de tarifas por departamento, tabla por ciudad, tarifa por defecto ($15.000) y umbral de envío gratis ($800.000). Desarrollado con TDD: el test `tests/backend/routes/envioRoutes.test.js` (4 casos) se escribió primero y falló con 404 (RED), después se implementó el endpoint y quedó verde (GREEN); suite backend completa 214/214 sin regresiones. Sin cambios de esquema ni de base de datos.
- **PR mergeado a develop**: (por crear — el enlace se agrega al abrir el PR `feature/sprint0-coding-standards` → `Develop`)
- **Commit(s) representativo(s)**: `docs(standards): ...` (estándar), `fix(ci): ...` (triggers de Develop), `feat(envio): endpoint read-only GET /api/envio/tarifas (dominio Sprint 0)` (dominio con TDD: test RED→GREEN, 4/4), `docs(s01): Sprint 0 cubre dominio minimo` (entregable con evidencia del dominio)

## 6. Roles del Equipo (Sprint 0)

| Integrante | Rol |
|---|---|
| Yeison | Scrum Master |
| Duglas | Product Owner |
| Angel | Dev |
| Johan | QA |

# Plan de Trabajo — Jadda Sports

## Objetivo General
Desarrollar una plataforma de comercio electrónico deportivo con frontend web (React + Vite), backend API (Node.js + Express + MySQL) y aplicación móvil (React Native + Expo).

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend Web | React + TypeScript + Vite | React 19, Vite 8 |
| Backend API | Node.js + Express | Express 5 |
| Base de Datos | MySQL | 8.0 |
| App móvil | React Native + Expo Router | Expo 54 |
| Autenticación | Passport.js + express-session + bcrypt | — |
| Contenedores | Docker + Docker Compose | — |

## Módulos y Estados

| Módulo | Estado | Prioridad |
|--------|--------|-----------|
| Autenticación (registro, login, OAuth, recuperación) | Implementado | Alta |
| Catálogo de productos | Implementado | Alta |
| Carrito de compras | Implementado | Alta |
| Checkout y pagos | Implementado | Alta |
| Reseñas y valoraciones | Implementado | Media |
| Favoritos / Lista de deseos | Implementado | Baja |
| PQR / Soporte | Implementado | Media |
| Perfil de usuario | Implementado | Alta |
| Historial de compras | Implementado | Media |
| Panel administrador (productos, variantes) | Implementado | Alta |
| Reportes de ventas por rango de fechas | Implementado | Media |
| Estadísticas de productos más vendidos | Implementado | Baja |
| Gestión de categorías (admin) | Implementado | Media |
| Confirmación de pedido por email | Implementado | Media |
| Factura digital PDF (descargable + adjunta al email) | Implementado | Alta |
| Cancelar pedido | Implementado | Media |
| Notificaciones de estado pedido/envío (email + in-app) | Implementado | Media |
| Admin: Ver todos los pedidos | Implementado | Media |
| Aviso de reposición de stock | Implementado | Baja |
| Compartir productos en redes sociales | Implementado | Baja |
| Devoluciones (solicitud cliente + aprobar/rechazar admin + reingreso stock) | Implementado | Media |
| Recomendaciones personalizadas por compras previas | Implementado | Baja |
| Retos deportivos (unirse, evidencias, cupón RETO-) | Implementado | Baja |
| Planes de entrenamiento con progreso | Implementado | Baja |
| Métodos de pago guardados en el perfil | Implementado | Media |
| Notificaciones in-app (campana) | Implementado | Media |
| Login social (Google / Facebook) | Implementado | Media |
| Foto de perfil (subida desde navegador) | Implementado | Baja |
| Subida de imágenes de productos (admin) | Implementado | Media |
| Newsletter | Implementado | Baja |
| Formulario de contacto | Implementado | Media |
| Historial de navegación (recientemente vistos) | Implementado | Baja |
| Marketplace de vendedores: solicitudes públicas, panel `/vendedor` y aprobación admin (`ESTADO_PUBLICACION`) | Implementado | Alta |
| Chat cliente ↔ vendedor ↔ JADDA con escalación de devoluciones | Implementado | Media |
| Cupones con compra mínima escalada + panel "cupones disponibles" en checkout | Implementado | Media |
| Devoluciones con 4 decisiones (devolver/reembolsar/más pruebas/rechazar) y plazo de 3 días post-entrega | Implementado | Media |
| Plan paralelo pre-producción F1–F6 (secretos fail-fast, gate de demo, hardening, checkout con `FOR UPDATE` + `PENDIENTE_PAGO`, media solo-Cloudinary) | Implementado | Alta |
| Pasarela de pagos Wompi (sandbox): checkout externo firmado, webhook idempotente, expiración 48 h, métodos (Tarjeta/PSE/Nequi/Daviplata/Bancolombia) en el checkout | Implementado (sandbox) | Alta |
| App móvil (React Native) | En desarrollo (checkout/reseñas implementados; faltan chat de soporte y push) | Alta |

## Fases del Proyecto

### Fase 1 — Base (Completada)
- Setup Docker + MySQL
- Creación de tablas y seed de datos automático
- Frontend: routing, layout, navbar, footer
- Autenticación local + Google + Facebook
- Catálogo con búsqueda, filtros, ordenamiento

### Fase 2 — Núcleo Comercial (Completada)
- Carrito de compras (flotante, mini menú)
- Variantes de producto (color, talla)
- Checkout con dirección, método de pago, resumen
- Integración de cupones de descuento
- Reseñas y valoraciones post-compra
- Favoritos
- Historial de compras
- Panel administrador (CRUD productos, variantes)

### Fase 3 — Móvil (En desarrollo)
- App React Native con Expo Router
- Pantallas: inicio, catálogo, detalle, carrito, checkout, favoritos, perfil, retos, panel de vendedor y chat.
- Implementado: catálogo, carrito, perfil, checkout, reseñas, favoritos, retos, panel de vendedor y chat de devolución.
- Pendiente: bandeja de soporte del cliente, notificaciones push y validación E2E en dispositivo.

### Fase 4 — Mejoras (En curso)
- Confirmación de pedido por email ✅
- Factura digital PDF descargable (cliente + admin) y adjunta al email de confirmación ✅
- Cancelación de pedidos ✅
- Aviso de reposición de stock ✅
- Compartir productos en redes sociales ✅
- Notificaciones de estado de pedido/envío por email + campana in-app ✅
- Admin: gestión de pedidos ✅
- Reportes de ventas por rango de fechas (ingresos, órdenes, ticket, unidades, gráfico diario) ✅
- Ranking de productos más vendidos ✅
- Devoluciones: solicitud del cliente en Mis Compras + panel admin con aprobar/rechazar y reingreso automático de stock ✅
- Recomendaciones personalizadas por compras previas (sección "Recomendados para ti" en la portada, con fallback de más vendidos) ✅
- Retos deportivos: unirse, reportar avance con evidencia (imagen/video), revisión admin y cupón `RETO-` de un solo uso ✅
- Planes de entrenamiento con progreso persistido ✅
- Métodos de pago guardados en el perfil (sincronizados con el checkout) ✅
- Notificaciones in-app (campana con contador, marcar leídas) ✅
- Foto de perfil (subida desde navegador) ✅
- Subida de imágenes de productos desde el panel admin ✅
- Newsletter con envío automático y desuscripción ✅
- Formulario de contacto ✅
- Historial de navegación ("Recientemente vistos") ✅
- Gestión de categorías (CRUD admin) ✅
- Optimización de rendimiento (lazy loading, paginación backend)

## Cronograma Estimado

| Actividad | Duración estimada |
|-----------|-------------------|
| Fase 1 (Base) | 4 semanas |
| Fase 2 (Núcleo) | 6 semanas |
| Fase 3 (Móvil) | 4 semanas |
| Fase 4 (Mejoras) | 4 semanas |

## Equipo

- Yeison Fernandez
- Duglas Montenegro
- Miguel Castro
- Juan Arias

### Actualización 2026-08-25 — Chat, disputas, vendedor avanzado y cupones con condiciones
- **RF-050/HU-050:** Sistema de chat (soporte, vendedor, devolución) con censura de groserías y badge de no leídos.
- **RF-051/HU-051:** Devoluciones de productos de vendedores negociadas en chat; escalación a JADDA con hilos separados por parte; decisión final del admin cierra todo.
- **RF-052/HU-052:** El vendedor gestiona el estado de envío de SUS ventas (stepper); admin en solo lectura para ventas de terceros.
- **RF-053/HU-053:** Reportes del vendedor (KPIs, serie diaria, más vendidos) con descarga Excel/PDF.
- **RF-054/HU-054:** Cupones RETO con compra mínima escalada según %; panel "cupones disponibles" en checkout; búsqueda exacta de códigos.
- **RF-055/HU-055:** Cuentas de vendedor bloqueadas para comprar (UI + backend + móvil).
- **Calidad:** Suite E2E versionada `tests/smoke.mjs` (`npm run test:e2e`) con 23 checks críticos; detectó y corrigió el bug latente de eliminarCompra (tabla PLANES → PLANES_USUARIO).

### Actualización 2026-10-20 - Limpieza integral y CI reproducible
- **Código:** eliminados archivos muertos (`index.js`, `AdminRoute` duplicado, `resenaController`, `checkImagenes`, CSS sin referencias) y dependencias sin uso en backend/frontend/móvil; lockfiles regenerados. Se retiró el JWT legacy (`verificarToken`).
- **Pruebas:** 57 backend unitarias + 16 de integración (MySQL real, puerto 3307, con supertest) + 51 frontend; E2E Playwright activo (20 specs × 2 proyectos = 40 ejecuciones) y 23 checks de humo (`tests/smoke.mjs`) como complemento. Lint frontend en 0 errores y `tsc -b` sin errores; build de producción verificado.
- **CI:** workflow reescrito (pnpm setup, sin `tsc` de backend, tests con cobertura real, build y humo E2E con MySQL efímero).
- **Producto:** restauradas las rutas `/chats`, `/admin/chats` y `/vendedor/chats`; proxy de Vite configurable con `VITE_PROXY_TARGET`; corregido mojibake en mensajes de usuario.
- **Documentación:** nuevo `docs/estado-del-proyecto.md`; umbral real de envío gratis ($800.000), conteos 61 RF / 61 HU / 17 RNF y comandos de prueba actualizados.

### Actualización 2026-10-22 — Cierre de brechas pre-producción (plan paralelo F1–F6, rama `chore/produccion`)
- **F1 Secretos:** fail-fast en producción de `SESSION_SECRET`/`DB_PASSWORD`; `seedAdminUser` sin contraseñas por defecto; SQL de usuarios de producción con placeholder; `.env.example` alineado.
- **F2 Datos demo:** gate `debeSembrarDemo()` (prod no siembra demo salvo `LOAD_DEMO_DATA=true`); carpetas de subidas de usuarios fuera del git con `.gitkeep`.
- **F3 Hardening:** log de peticiones JSON de una línea + `X-Request-Id`; magic bytes y límite 6 MB en subidas; helmet/CORP, HSTS/CSP solo prod; `/api/health` exenta del rate limiter; cierre ordenado SIGTERM; sin PII en logs.
- **F4 Checkout concurrente:** `SELECT ... FOR UPDATE` por variante dentro de la transacción + guard `AND STOCK >= ?` (competencia simulada: 200 + 409); estado `PENDIENTE_PAGO` activable por `PAYMENT_GATEWAY`; 16/16 tests de integración con MySQL real (`docker-compose.test.yml`, puerto 3307) usando supertest.
- **F5 Media solo-Cloudinary:** todo el media vive en Cloudinary (344 assets, carpeta `jadda/`); el repo solo versiona `.gitkeep` en las carpetas de subidas + seeds puro-Cloudinary; la purga del historial con `git filter-repo` queda documentada y pendiente.
- **F6 Pasarela (patrón):** patrón genérico documentado (`/api/checkout/pagar` + webhook HMAC + idempotencia); proveedor concreto por decidir.
- Inventario completo con commits reales en `docs/auditoria/estado-brechas.md`.

### Actualización 2026-10-24 — Fusionada a `main`: pasarela Wompi (sandbox), purga del repo y CI ajustado
- **Pasarela (F6 EJECUTADA):** integración real de Wompi en modo **sandbox** (dinero de prueba) — checkout Redirect con firma `signature:integrity`, venta nace `PENDIENTE_PAGO`, los avisos/correos se disparan cuando el pago se confirma. Rutas `/api/pagos` (23 rutas en total): `POST /pagar` idempotente (referencia `JADDA-<id>-<rand8>` → URL del widget), `GET /estado/:idVenta` (pull), `POST /webhook` (HMAC SHA256 + re-verificación de la transacción vía API + idempotencia por `PAGOS_EVENTOS`, tabla **36**), `GET /config`; job cada 15 min expira ventas >48 h → `CANCELADA` + reingreso de stock + correo. UI: ResumenCompra no pide tarjeta y muestra los métodos (Tarjeta/PSE/Nequi/Daviplata/Bancolombia) con redirect al widget; CompraExitosa con polling 3,5 s + botón "PAGAR CON WOMPI"; DetalleCompra y MisCompras con botón pagar. **Pendiente para producción:** crear cuenta real y reemplazar llaves `sandbox` por `live` en `backend/.env` (código sin cambios). Ver `docs/auditoria/pasarela-pagos-plan.md` §5.
- **Purga del historial git (EJECUTADA 2026-10-22):** `git filter-repo` (media + `.pnpm-store` + blobs >1 MB) tras bundle de respaldo; pack 94,56 MiB → **3,77 MiB**; merge FF a `main` y force push. Ver `docs/auditoria/purga-media-filter-repo.md`.
- **CI ahorro de minutos:** `concurrency` cancel-in-progress; `e2e-smoke` legacy pasado a solo manual (`workflow_dispatch`). La cuenta agotó los minutos incluidos de GitHub Actions: las corridas fallan con "No jobs were run" hasta el reinicio mensual o activar pago — el código y las pruebas locales no se afectan. Suite vigente: **68** backend unitarias (11 nuevas en `pagos.test.js`) + 16 integración + 51 frontend + 40 E2E + 23 humo.

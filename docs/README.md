# 📚 Documentación — JADDA SPORTS

> Documentación técnica completa del proyecto: requisitos, historias de usuario, restricciones, diagramas y planificación.

![RF](https://img.shields.io/badge/RFs-61%20documentados-e73737)
![HU](https://img.shields.io/badge/HUs-61%20documentadas-2563eb)
![RNF](https://img.shields.io/badge/RNFs-17%20documentados-16a34a)
![Verificación](https://img.shields.io/badge/Verificación-Octubre%202026-f59e0b)

## Índice

### Requerimientos Funcionales
- [RF-001 a RF-061](RFs/) — 61 requerimientos funcionales documentados (verificación 2026-08: todos los RFs verificados contra la implementación real; 2026-08-28: +6 RF-056..061 para marketplace, usuarios, envío y PQR)

### Historias de Usuario
- [HU-001 a HU-061](HUs/) — 61 historias de usuario con criterios de aceptación

### Requerimientos No Funcionales
- [RNF-001 a RNF-017](RNFs/) — 17 requerimientos no funcionales (RNF-016 auditoría, RNF-017 idempotencia)

### Diagramas
- [Arquitectura del Sistema](diagrams/arquitectura.md) — Diagrama de componentes, secuencia de autenticación y flujo de compra
- [Base de Datos](diagrams/base-de-datos.md) — Diagrama entidad-relación y estructura de tablas
- [Diccionario de Datos](diagrams/diccionario-de-datos.md) — Definición de las 36 tablas: columnas, tipos, llaves, estados y relaciones (2026-10-24)
- [Flujos de Usuario](diagrams/flujos.md) — Diagramas de flujo: registro, compra, admin y mapa de navegación
- [Casos de Uso](diagrams/casos-uso.md) — Actores (visitante/cliente/vendedor/admin), 32 casos de uso con relaciones «include»/«extend» y trazabilidad CU → RF (61/61)

### Planificación
- [Estado del Proyecto](estado-del-proyecto.md) — **qué está implementado, parcial y pendiente** (corte 2026-10-24, incluye pasarela Wompi en sandbox)
- [Licencias de Terceros](licencias-terceros.md) — Inventario completo de licencias: 895 dependencias npm de las 3 capas, herramientas de desarrollo y servicios externos (Cloudinary, Wompi, TiDB, ip-api, Google OAuth...) con su régimen (generado 2026-11-12 con `pnpm licenses list`)
- **Entregables del bootcamp de asesoría** (`entregables-asesoria/`): [S01 · Plan de trabajo](entregables-asesoria/entregable-s01-plan-de-trabajo.md) · [S02 · Sprint 1 dominio/persistencia](entregables-asesoria/entregable-s02-sprint-1-review.md) · [S03 · Sprint 2 autenticación](entregables-asesoria/entregable-s03-sprint-2-review.md) · [S04 · Sprint 3 API CRUD](entregables-asesoria/entregable-s04-sprint-3-review.md) · [S05 · Sprint 4 reglas de negocio](entregables-asesoria/entregable-s05-sprint-4-review.md) · [S06 · Sprint 5 integración FE-BE](entregables-asesoria/entregable-s06-sprint-5-review.md) · [S07 · Sprint 6 flujos secundarios](entregables-asesoria/entregable-s07-sprint-6-review.md) · [S08 · Sprint 7 pruebas/errores](entregables-asesoria/entregable-s08-sprint-7-review.md) · [S09 · Cierre ≥90% con gate Docker](entregables-asesoria/entregable-s09-cierre-final.md)
- [Plan de Trabajo](planeacion/plan%20de%20trabajo.md) — Módulos, fases, cronograma y equipo
- [Restricciones del Proyecto](planeacion/Restricciones%20del%20Proyecto.md) — Stack, seguridad y flujo de trabajo
- [Estrategia de Pruebas](calidad/estrategia-pruebas.md) — Pirámide (354 unitarias BE · 132 integración MySQL real · 168 FE · 20 specs Playwright), mocks y CI (cifras reales 2026-11-13)
- [Matriz de Rotación de Pruebas](calidad/matriz-rotacion.md) — Plan de cobertura completo de la pirámide

### Testing — Bootcamp ADSO (S1–S9)
- [Hallazgos del Trimestre](testing/hallazgos.md) — 23 hallazgos reales por capa (20 corregidos · 2 proceso · 1 pendiente) con detección y evidencia
- [Preparación de Sustentación](testing/preparacion-sustentacion.md) — Guion explicar/romper/escribir por capa con tests reales del proyecto + preguntas típicas
- [Cobertura ≥80% — handoff](testing/pendiente-cobertura-80.md) — Gap real medido (fusionado 70.39/61.74/79.20 vs 80), puntos fuertes/débiles y prompt de reanudación

### Implantación (Despliegue e Infraestructura)
- [**Plan de Implantación (maestro por semanas)**](implantacion/plan-implantacion.md) — Plan completo del proyecto a partir de la plantilla: mapa semana↔entregable, §1–§5 completados con S01/S02 y secciones pendientes S03–S09 enlazadas
- [Entregable S01 — Ficha Técnica](entregables/entregable-s01-ficha-tecnica.md) — Semana 1 (CE-1, CE-2): inventario, requisitos y verificación con script
- [Entregable S02 - Planes](entregables/entregable-s02-planes.md) - Semana 2 (CE-3, CE-4): migración, respaldo (RPO 24h/RTO 1h) e instalación con evidencia real
- [Entregable S03 - Hosting y Dominio](entregables/entregable-s03-hosting-dominio.md) - Semana 3 (CE-1): hosting propio justificado, dominio `jaddasports.com` + DNS, reverse proxy Caddy (`deploy/Caddyfile`) y HTTPS con evidencia real (`tls internal` + `curl --resolve`)
- [01 · Preparación de la Plataforma](implantacion/01-preparacion-plataforma.md) — Requisitos HW/SW verificados contra el servidor real
- [02 · Plan de Migración y Respaldos](implantacion/02-plan-migracion-respaldos.md) — Estrategia de migración + backups diarios con restauración probada
- [03 · Guía de Despliegue](implantacion/03-guia-despliegue.md) — Publicación en producción local (Docker), usuario BD con menor privilegio, smoke tests y troubleshooting
- [04 · Despliegue de Producción](implantacion/04-despliegue-produccion.md) — Perfil `deploy/compose.prod.yaml` (ex docker-compose.prod.yml, renombrado en S04): nginx TLS 443, secretos obligatorios y smoke puerta a puerta
- [05 · Guía de Seguridad](implantacion/05-guia-seguridad.md) — Sesión/cookies, CSRF, CORS, trust proxy, cabeceras, rate limiting, subidas, secretos (2026-10-21)
- [06 · Despliegue en Oracle Cloud](implantacion/06-despliegue-oracle.md) — **Guía maestra del despliegue en la VM** (Always Free ARM A1, mismo compose de producción, MySQL en la VM): TLS/dominio, respaldos y restauración (§12), servicios (§13), frontend estático (§14), checklist dominio/HTTPS (§15) y mapa de las 8 guías (§16)
- [Inventario de brechas (auditoría continua)](auditoria/estado-brechas.md) — Estado por área: seguridad ✅ (fase 1), disponibilidad/observabilidad/rendimiento/arquitectura/CI/UX/privacidad en fases 2-7 · plan paralelo pre-producción F1–F6 completado (pasarela Wompi sandbox incluida)
- [Purga de media del historial git](auditoria/purga-media-filter-repo.md) — **EJECUTADA (2026-10-22)** con `git filter-repo`: pack 94,56 → 3,77 MiB
- [Pasarela de pagos Wompi (sandbox)](auditoria/pasarela-pagos-plan.md) — **EJECUTADA (2026-10-24)**: `PENDIENTE_PAGO + /api/pagos (config · pagar · estado · webhook HTTPS)` + llaves sandbox + §5 con convenciones y evidencia
- [Estado de la documentación por archivo](auditoria/estado-documentacion.md) — Qué está vigente, qué se actualizó y cuándo, históricos congelados y pendientes externos (~117 archivos)
- Scripts operativos Windows: `scripts/backup.ps1` · `scripts/restaurar-backup.ps1` · `scripts/mediciones-rnf.ps1` · `scripts/sql/usuarios-produccion.sql`
- Scripts operativos Linux (VM Oracle, guía 06 §12-§17): `scripts/desplegar-prod.sh` (despliegue idempotente) · `scripts/respaldar.sh` (`RETENER_DIAS`) · `scripts/restaurar.sh` · `scripts/verificar-restauracion.sh` · `scripts/verificar-requisitos.sh` (sección 8 = producción)

### Manuales
- [Manual de Instalación](manuales/manual-instalacion.md) — Paso a paso para el instalador técnico
- [Manual Técnico](manuales/manual-tecnico.md) — Arquitectura, modelo de datos, mapa completo del API y seguridad
- [Manual de Usuario Final](manuales/manual-usuario-final.md) — Guías por rol: visitante, cliente, vendedor y administrador
- [Backend — Módulo Usuario](manuales/backend-usuario.md) — Controllers y rutas orientados al usuario final (excluye panel admin)

### Calidad de Software
- [**Evaluación ISO/IEC 25010 (maestro)**](calidad/evaluacion-iso-25010.md) — 9 características · 40 subcaracterísticas con evidencia, verificación y valoración (22 Alta · 10 Media · 4 Parcial · 4 Pendiente) + matriz de trazabilidad TP/smoke
- [Revisión técnica del proyecto (2026-10-20)](calidad/revision-tecnica-2026-10-20.md) — Auditoría estática del repositorio: hallazgos y estado del trabajo
- [Marco de Calidad ISO 25010 / PSP / CMMI](calidad/marco-calidad.md)
- [Evaluación de RNFs con mediciones reales](calidad/informe-evaluacion-rnf.md) (+ `calidad/resultados-mediciones.md` generada por script)
- [Informe Técnico de Evaluación de Calidad](calidad/informe-evaluacion-calidad.md)
- [Bitácora de Lecciones Aprendidas](calidad/bitacora-lecciones-aprendidas.md) — 16 lecciones con causa raíz
- [Plan de Mejora Continua](calidad/plan-mejora-continua.md) — Matriz MC-01..MC-16

### Aceptación y Entrega
- [Plan de Pruebas de Aceptación (UAT)](aceptacion/pruebas-aceptacion.md) — 38 casos TP-001..TP-038 (incluye pasarela de pagos I)
- [Acta de Entrega y Aceptación](aceptacion/acta-entrega.md) — Plantilla formal con firmas y niveles de servicio
- [Guía de Capacitación](aceptacion/guia-capacitacion.md) — 3 sesiones por rol + evaluación práctica

### App Móvil
- [Índice móvil](../movil/docs/README.md) — Stack, estructura de rutas, cómo correr (dev client + OTA/EAS) y variables de entorno
- [RFs del móvil](../movil/docs/RFs-movil.md) — Cobertura de RFs en la app móvil: tabla de estado, detalle de los principales y pendientes específicos (corte 2026-11-11)

## Estado General

| Módulo | Estado | Prioridad |
|--------|--------|-----------|
| Autenticación (registro, login, OAuth, recuperación) | Implementado | Alta |
| Catálogo de productos | Implementado | Alta |
| Carrito de compras | Implementado | Alta |
| Checkout y pagos (pasarela Wompi en sandbox: `PENDIENTE_PAGO → CONFIRMADA/CANCELADA`, webhook firmado + idempotencia, expiración 48 h) | Implementado | Alta |
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
| Login social (Google) | Implementado | Media |
| Foto de perfil (subida desde navegador) | Implementado | Baja |
| Subida de imágenes de productos (admin) | Implementado | Media |
| Newsletter | Implementado | Baja |
| Formulario de contacto | Implementado | Media |
| Historial de navegación (recientemente vistos) | Implementado | Baja |
| Solicitud para ser vendedor (pública, informal) | Implementado | Alta |
| Gestión de solicitudes de vendedores (admin) | Implementado | Alta |
| Administración de usuarios (perfil + ventas) | Implementado | Media |
| Gestión de productos por vendedor (PENDIENTE/APROBADO) | Implementado | Alta |
| Cálculo de costo de envío por ubicación | Implementado | Media |
| Gestión de PQR | Implementado | Media |
| Chat cliente ↔ vendedor ↔ JADDA (soporte y devoluciones) | Implementado | Alta |
| Escalación de devoluciones a JADDA con hilos separados | Implementado | Media |
| Marketplace: productos, ventas y reportes del vendedor | Implementado | Alta |
| Reportes del vendedor descargables (Excel/PDF) | Implementado | Media |
| Cupones de reto con compra mínima escalada | Implementado | Baja |
| Envío gratis desde $800.000 con barra de progreso | Implementado | Media |
| App móvil (React Native) | En desarrollo (chat de soporte del cliente y push pendientes; checkout/reseñas implementados) | Alta |

## Nota de verificación (Agosto 2026 · actualizada 2026-10-20)

Los 61 RFs fueron revisados contra el código real (rutas, controladores y pantallas). Resultado:
- **61/61 documentados como Implementado**, con 2 matices de alcance: RF-007/RF-008 (filtros y orden son client-side) y RF-018 (detalle de endpoints internos).
- RF-023 (cancelación con liberación de stock + RN-010 real) y RF-029 (inventario con `MOVIMIENTOS_STOCK`) quedaron completos el 2026-08-13.
- Los 6 nuevos RF-056..061 (solicitud/gestión de vendedores, admin de usuarios, productos de vendedor, envío y PQR) están implementados.

Estado de los RNF:
- **13 implementados.**
- **3 parciales:** RNF-002 (falta HTTPS/CSRF), RNF-003 (sin pruebas de carga), RNF-004 (sin monitoreo/uptime).
- **1 en desarrollo:** RNF-009 (app móvil).

**Actualización 2026-08-24:** el faltante de respaldos quedó resuelto — `scripts/backup.ps1`/`restaurar-backup.ps1` con ciclo backup→restauración verificado E2E; la evaluación completa de los **17 RNFs** con mediciones reales vive en [calidad/informe-evaluacion-rnf.md](calidad/informe-evaluacion-rnf.md).

**Actualización 2026-08-28:** auditoría de funcionalidades vs implementación detectó 6 huecos (solicitud vendedores, gestión admin vendedores, admin usuarios, productos vendedor, envío, PQR) y 2 RNFs de integridad; se documentaron como RF-056..061 / HU-056..061 / RNF-016..017 y se deduplicaron variantes con índice único `uq_variante_producto`.

**Actualización 2026-10-20:** limpieza integral — dependencias sin uso eliminadas, lockfiles regenerados, CI reescrito, rutas de chat restauradas y documentación alineada. (La suite Playwright, que en ese corte se reportó eliminada, está **activa de nuevo y es oficial**: `tests/e2e/smoke.spec.ts` con 20 specs × 2 proyectos + job `e2e-playwright` en CI.) Ver [estado-del-proyecto.md](estado-del-proyecto.md).

**Actualización 2026-10-22:** plan paralelo pre-producción F1–F6 completado en la rama `chore/produccion` — secretos fail-fast, gate de datos demo, hardening (log JSON + headers + subidas validadas), checkout concurrente con `FOR UPDATE` y estado `PENDIENTE_PAGO`, **media solo-Cloudinary** (repo sin binarios, solo `.gitkeep`) y patrón genérico de pasarela pendiente de proveedor. Pruebas verificadas: 57 unitarias + 16 de integración (MySQL real) en backend. Ver [auditoria/estado-brechas.md](auditoria/estado-brechas.md).

**Actualización 2026-10-24:** pasarela de pagos **Wompi EJECUTADA en modo sandbox** (dinero de prueba): con `PAYMENT_GATEWAY=wompi` la venta nace `PENDIENTE_PAGO`, `POST /api/pagos/pagar` devuelve la URL firmada del widget (`signature:integrity` SHA256), la confirmación llega por sondeo (`GET /api/pagos/estado/:idVenta`, 3,5 s) o por webhook autenticado (`POST /api/pagos/webhook`, checksum SHA256 + idempotencia en la tabla nueva `PAGOS_EVENTOS`, 36 tablas en total), y los pagos mayores a 48 h se cancelan automático con reingreso de stock (job cada 15 min). Granulación admin y banners actualizados; los e2e sandbox demostraron el ciclo completo (25/25 sondas + 10/10 UI msedge, temporales borrados). Suites: **68 unitarias backend** (+11 en `utils/pagos.test.js`) · integración 16 · frontend 51 · E2E Playwright 40 · humo 23. CI ajustado (concurrency + humo solo manual). Fusionado a `main` (últimos commits `736ae2e`, `553ce4a`). Ver [auditoria/pasarela-pagos-plan.md](auditoria/pasarela-pagos-plan.md).

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend Web | React + TypeScript + Vite | React 19, Vite 8 |
| Backend API | Node.js + Express | Express 5 |
| Base de Datos | MySQL | 8.0 |
| App móvil | React Native + Expo Router | Expo 54 |
| Autenticación | Passport.js + express-session + bcrypt | — |
| Contenedores | Docker + Docker Compose | — |

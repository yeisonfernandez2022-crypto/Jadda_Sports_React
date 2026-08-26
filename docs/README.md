# 📚 Documentación — JADDA SPORTS

> Documentación técnica completa del proyecto: requisitos, historias de usuario, restricciones, diagramas y planificación.

![RF](https://img.shields.io/badge/RFs-55%20documentados-e73737)
![HU](https://img.shields.io/badge/HUs-55%20documentadas-2563eb)
![RNF](https://img.shields.io/badge/RNFs-15%20documentados-16a34a)
![Verificación](https://img.shields.io/badge/Verificación-Agosto%202026-f59e0b)

## Índice

### Requerimientos Funcionales
- [RF-001 a RF-049](RFs/) — 49 requerimientos funcionales documentados (verificación 2026-08: todos los RFs verificados contra la implementación real)

### Historias de Usuario
- [HU-001 a HU-049](HUs/) — 49 historias de usuario con criterios de aceptación

### Requerimientos No Funcionales
- [RNF-001 a RNF-015](RNFs/) — 15 requerimientos no funcionales

### Diagramas
- [Arquitectura del Sistema](diagrams/arquitectura.md) — Diagrama de componentes, secuencia de autenticación y flujo de compra
- [Base de Datos](diagrams/base-de-datos.md) — Diagrama entidad-relación y estructura de tablas
- [Flujos de Usuario](diagrams/flujos.md) — Diagramas de flujo: registro, compra, admin y mapa de navegación

### Planificación
- [Plan de Trabajo](plan%20de%20trabajo.md) — Módulos, fases, cronograma y equipo
- [Restricciones del Proyecto](Restricciones%20del%20Proyecto.md) — Stack, seguridad y flujo de trabajo

### Implantación (Despliegue e Infraestructura)
- [01 · Preparación de la Plataforma](implantacion/01-preparacion-plataforma.md) — Requisitos HW/SW verificados contra el servidor real
- [02 · Plan de Migración y Respaldos](implantacion/02-plan-migracion-respaldos.md) — Estrategia de migración + backups diarios con restauración probada
- [03 · Guía de Despliegue](implantacion/03-guia-despliegue.md) — Publicación en producción local (Docker), usuario BD con menor privilegio, smoke tests y troubleshooting
- Scripts operativos: `scripts/backup.ps1` · `scripts/restaurar-backup.ps1` · `scripts/mediciones-rnf.ps1` · `scripts/sql/usuarios-produccion.sql`

### Manuales
- [Manual de Instalación](manuales/manual-instalacion.md) — Paso a paso para el instalador técnico
- [Manual Técnico](manuales/manual-tecnico.md) — Arquitectura, modelo de datos, mapa completo del API y seguridad
- [Manual de Usuario Final](manuales/manual-usuario-final.md) — Guías por rol: visitante, cliente, vendedor y administrador

### Calidad de Software
- [Marco de Calidad ISO 25010 / PSP / CMMI](calidad/marco-calidad.md)
- [Evaluación de RNFs con mediciones reales](calidad/informe-evaluacion-rnf.md) (+ `calidad/resultados-mediciones.md` generada por script)
- [Informe Técnico de Evaluación de Calidad](calidad/informe-evaluacion-calidad.md)
- [Bitácora de Lecciones Aprendidas](calidad/bitacora-lecciones-aprendidas.md) — 16 lecciones con causa raíz
- [Plan de Mejora Continua](calidad/plan-mejora-continua.md) — Matriz MC-01..MC-10

### Aceptación y Entrega
- [Plan de Pruebas de Aceptación (UAT)](aceptacion/pruebas-aceptacion.md) — 35 casos TP-001..TP-035
- [Acta de Entrega y Aceptación](aceptacion/acta-entrega.md) — Plantilla formal con firmas y niveles de servicio
- [Guía de Capacitación](aceptacion/guia-capacitacion.md) — 3 sesiones por rol + evaluación práctica

## Estado General

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
| App móvil (React Native) | En desarrollo | Alta |

## Nota de verificación (Agosto 2026)

Los 55 RFs fueron revisados contra el código real (rutas, controladores y pantallas). Resultado:
- **47 Implementado 100%** — incluidos RF-023 (cancelación con liberación de stock + RN-010 real) y RF-029 (inventario con `MOVIMIENTOS_STOCK`), completados el 2026-08-13.
- **2 Verificados con matices:** RF-007/RF-008 (filtros/orden client-side, detalle de endpoints internos RF-018).

Los RNF-002/003/004 marcados "Por implementar" se reclasificaron a **Implementado parcialmente** con notas explícitas de lo que falta (HTTPS, CSRF, backups, pruebas de carga). Los RNF-012 a RNF-015 son nuevos (no-bloqueo de correo, subidas, BD portátil, RBAC).

**Actualización 2026-08-24:** el faltante de respaldos quedó resuelto — `scripts/backup.ps1`/`restaurar-backup.ps1` con ciclo backup→restauración verificado E2E; la evaluación completa de los 15 RNFs con mediciones reales vive en [calidad/informe-evaluacion-rnf.md](calidad/informe-evaluacion-rnf.md).

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend Web | React + TypeScript + Vite | React 19, Vite 8 |
| Backend API | Node.js + Express | Express 5 |
| Base de Datos | MySQL | 8.0 |
| App Móvil | React Native + Expo | Expo 54 |
| Autenticación | Passport.js + express-session + bcrypt | — |
| Contenedores | Docker + Docker Compose | — |

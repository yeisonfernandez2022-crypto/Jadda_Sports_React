# Documentación — Jadda Sports

## Índice

### Requerimientos Funcionales
- [RF-001 a RF-039](RFs/) — 39 requerimientos funcionales documentados

### Historias de Usuario
- [HU-001 a HU-039](HUs/) — 39 historias de usuario con criterios de aceptación

### Requerimientos No Funcionales
- [RNF-001 a RNF-011](RNFs/) — 11 requerimientos no funcionales

### Diagramas
- [Arquitectura del Sistema](diagrams/arquitectura.md) — Diagrama de componentes, secuencia de autenticación y flujo de compra
- [Base de Datos](diagrams/base-de-datos.md) — Diagrama entidad-relación y estructura de tablas
- [Flujos de Usuario](diagrams/flujos.md) — Diagramas de flujo: registro, compra, admin y mapa de navegación

### Planificación
- [Plan de Trabajo](plan%20de%20trabajo.md) — Módulos, fases, cronograma y equipo
- [Restricciones del Proyecto](Restricciones%20del%20Proyecto.md) — Stack, seguridad y flujo de trabajo

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
| Gestión de categorías (admin) | Parcial | Media |
| Confirmación de pedido por email | No implementado | Media |
| Cancelar pedido | No implementado | Media |
| Notificaciones por email | No implementado | Baja |
| Admin: Ver todos los pedidos | No implementado | Media |
| Devoluciones | No implementado | Baja |
| App móvil (React Native) | En desarrollo | Alta |

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend Web | React + TypeScript + Vite | React 19, Vite 8 |
| Backend API | Node.js + Express | Express 5 |
| Base de Datos | MySQL | 8.0 |
| App Móvil | React Native + Expo | Expo 54 |
| Autenticación | Passport.js + express-session + bcrypt | — |
| Contenedores | Docker + Docker Compose | — |

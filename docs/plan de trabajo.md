# Plan de Trabajo — Jadda Sports

## Objetivo General
Desarrollar una plataforma de comercio electrónico deportivo con frontend web (React + Vite), backend API (Node.js + Express + MySQL) y aplicación móvil (React Native + Expo).

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend Web | React + TypeScript + Vite | React 19, Vite 8 |
| Backend API | Node.js + Express | Express 5 |
| Base de Datos | MySQL | 8.0 |
| App Móvil | React Native + Expo | Expo 54 |
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
| Gestión de categorías (admin) | Parcial | Media |
| Confirmación de pedido por email | No implementado | Media |
| Cancelar pedido | No implementado | Media |
| Notificaciones por email | No implementado | Baja |
| Admin: Ver todos los pedidos | No implementado | Media |
| Devoluciones | No implementado | Baja |
| App móvil (React Native) | En desarrollo | Alta |

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
- Pantallas: inicio, catálogo, detalle producto, login, registro
- Pendiente: carrito, perfil, checkout, reseñas

### Fase 4 — Mejoras (Pendiente)
- Confirmación de pedido por email
- Cancelación de pedidos
- Notificaciones de estado
- Admin: gestión de pedidos
- Devoluciones
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

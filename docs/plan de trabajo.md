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

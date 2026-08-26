# ACTA DE ENTREGA Y ACEPTACIÓN DE SOFTWARE

**Proyecto:** Plataforma e-commerce JADDA SPORTS
**Lugar y fecha:** ____________________, ____ de ______________ de 2026

---

Entre quienes suscriben, **______________________** en calidad de DESARROLLADOR/EQUIPO DE DESARROLLO, y **______________________** en calidad de CLIENTE/USUARIO FINAL, se hace constar la entrega formal del software descrito a continuación, previa ejecución del proceso de pruebas de aceptación.

## 1. Objeto de la entrega

| Componente | Descripción |
|------------|-------------|
| Tienda web JADDA SPORTS | Catálogo, carrito, checkout con envío por departamento, pagos registrados, favoritos, reseñas, retos deportivos con recompensas, planes de entrenamiento, devoluciones/reembolsos con evidencias, facturación PDF, notificaciones |
| Panel de administración | Órdenes y estados de envío, productos/categorías/descuentos, usuarios, devoluciones, retos, vendedores, reportes, newsletter |
| Marketplace de vendedores | Solicitud/aprobación de vendedores, publicación de productos externos con flujo de aprobación, panel de vendedor |
| App móvil (Expo) | Navegación, catálogo, carrito, favoritos y perfil (checkout móvil pendiente — ver alcance §3) |
| Infraestructura | Despliegue local Docker Compose (MySQL 8 + API Node/Express + Frontend Vite), migración automática de BD, esquema de respaldos verificado |

## 2. Documentación entregada

- Manual de instalación (`docs/manuales/manual-instalacion.md`)
- Manual técnico (`docs/manuales/manual-tecnico.md`)
- Manual de usuario final por rol (`docs/manuales/manual-usuario-final.md`)
- Documentación de implantación: preparación de plataforma, plan de migración y respaldos, guía de despliegue (`docs/implantacion/`)
- Evaluación de calidad: marco ISO 25010/PSP/CMMI, informe RNF con mediciones, informe de calidad, bitácora de lecciones, plan de mejora continua (`docs/calidad/`)
- Plan de pruebas de aceptación ejecutado (`docs/aceptacion/pruebas-aceptacion.md`)
- Requisitos funcionales/no funcionales e historias de usuario (49 RF · 49 HU · 15 RNF)

## 3. Alcance y exclusiones explícitas

Queda INCLUIDO todo lo listado en §1. Queda EXCLUIDO de esta versión: proceso de pago dentro de la app móvil y módulo de reseñas móviles (disponibles en la versión web); publicación en Internet con dominio propio/HTTPS (el despliegue acordado es local/LAN). Estas exclusiones están contempladas en el Plan de Mejora Continua.

## 4. Resultado de las pruebas de aceptación

Se ejecutaron los casos definidos en `pruebas-aceptacion.md` con el siguiente resultado:

| Métrica | Valor |
|---------|-------|
| Casos totales | 35 |
| Aprobados | ________ |
| Fallados | ________ |

Los hallazgos pendientes (si existen) quedan documentados y priorizados en el Plan de Mejora Continua sin impedir la aceptación según el criterio acordado (100% críticos, ≥90% global).

## 5. Capacitación

El equipo desarrollador entregó capacitación al personal del cliente conforme al guion de `guia-capacitacion.md`, cubriendo los roles de cliente, vendedor y administrador, quedando habilitado el cliente para operar autónomamente la plataforma.

## 6. Niveles de servicio y soporte acordados

| Compromiso | Término |
|------------|---------|
| Corrección de defectos críticos (sistema inoperante o pérdida de datos) | ≤ 48 horas desde el reporte, durante ______ días posteriores a la entrega |
| Corrección de defectos menores | Próxima actualización programada |
| Soporte de operación | Guías de troubleshooting incluidas en la guía de despliegue; respaldo diario automatizado |
| Actualizaciones | Procedimiento documentado (backup → actualizar → verificar) |

## 7. Declaración de aceptación

El CLIENTE declara haber recibido el software y la documentación relacionadas, haber presenciado/ejecutado las pruebas de aceptación, recibido la capacitación correspondiente, y **ACEPTA** la entrega en los términos de este acta. El DESARROLLADOR declara entregado el producto en su totalidad conforme al alcance §2-§3.

## 8. Firmas

| | DESARROLLO | CLIENTE / USUARIO FINAL |
|---|------------|--------------------------|
| Nombre | ____________________ | ____________________ |
| C.C. | ____________________ | ____________________ |
| Firma | ____________________ | ____________________ |
| Fecha | ____________________ | ____________________ |

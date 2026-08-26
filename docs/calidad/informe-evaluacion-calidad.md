# Informe Técnico de Evaluación de Calidad

**Proyecto:** JADDA SPORTS
**Fecha del informe:** 2026-08-24
**Elaborado por:** Equipo de desarrollo JADDA
**Documentos de entrada:** marco-calidad.md · informe-evaluacion-rnf.md · bitacora-lecciones-aprendidas.md · resultados-mediciones.md

---

## 1. Resumen ejecutivo

La versión puesta en producción local cumple **49/49 requisitos funcionales** documentados, con evaluación no funcional **11/15 módulos implementados**, 3 parciales con plan de cierre y 1 en desarrollo (app móvil). Las mediciones reales de rendimiento son óptimas para el escenario LAN (P95 < 55 ms en lecturas) y los mecanismos de seguridad demostraron funcionamiento efectivo en pruebas vivas. La calidad general se califica como **apta para entrega** con las salvedades listadas en §5.

## 2. Alcance evaluado

| Dimensión | Cobertura |
|-----------|-----------|
| Funcional web | 100% de RFs: catálogo→checkout→postventa, retos, planes, marketplace, admin completo |
| Móvil | Navegación, catálogo, carrito, favoritos, perfil; sin checkout/reseñas |
| No funcional | 15 módulos RNF evaluados + mediciones de rendimiento ejecutadas |
| Seguridad | RBAC, rate limiting (verificado activo), bcrypt, sesiones, validaciones servidor |

## 3. Hallazgos principales

### 3.1 Hallazgos positivos
1. **Robustez transaccional**: checkout, cancelaciones y devoluciones operan con BEGIN/COMMIT/ROLLBACK y movimientos de stock consistentes; probados E2E por API.
2. **Seguridad activa, no declarativa**: durante las mediciones el limitador bloqueó automáticamente intentos repetidos de login (HTTP 429) — control funcionando en producción real.
3. **Recuperabilidad probada**: ciclo completo backup → restauración ejecutado con éxito (35 tablas reconstruidas en BD temporal), eliminando el mayor riesgo operativo previo.
4. **Portabilidad verificada**: la plataforma se levanta completa desde cero con un solo comando; migraciones idempotentes aplican solas al arrancar.

### 3.2 Defectos encontrados y corregidos durante el ciclo (muestra)
| Defecto | Severidad | Estado |
|---------|-----------|--------|
| Foto de perfil se perdía al re-loguear social (claves SQL en minúsculas) | Alta | ✅ Corregido y normalizado |
| Doble navbar interceptaba clicks del menú móvil | Alta | ✅ Eliminado (navbar único global) |
| Filtro de precio ocultaba productos legítimos ("No encontramos productos") | Media | ✅ Tope dinámico |
| Devoluciones: evidencias se perdían al revisar; usuario no veía motivo de rechazo | Media | ✅ Material conservado + observación visible |
| Checkout móvil ausente | Alta (alcance) | 🔶 En desarrollo — ver §5 |

Bitácora completa: `bitacora-lecciones-aprendidas.md` (16 lecciones con causa raíz).

## 4. Verificación aplicada

- **Pruebas E2E automatizadas** (Playwright/Chrome): suites de flujos críticos por entrega — checkout real, multi-evidencias de devolución, modales admin, responsive 375/1440 px, panel vendedor, timbre de notificaciones; patrón "0 errores JS" exigido antes de cerrar cada tarea.
- **Pruebas de API** (curl/PowerShell): casos positivos y negativos (403/400/404/429), incluidas reglas de negocio (plazo 3 días, cancelación tras despacho).
- **Pruebas de recuperación**: restauración integral del respaldo en BD temporal.

## 5. Salvedades (deuda conocida y aceptada)

| # | Salvedad | Riesgo | Mitigación acordada |
|---|----------|--------|---------------------|
| 1 | App móvil sin checkout/reseñas | Medio — canal alternativo completo existe vía web | MC-05 en plan de mejora |
| 2 | Sin HTTPS en LAN | Bajo en red local confiable | MC-01 si se publica externamente |
| 3 | Rate limiter en memoria | Bajo (monousuario/local) | MC-03 |
| 4 | Dependencias legacy sin uso | Nulo funcional | MC-04 limpieza |

## 6. Conclusión

El producto satisface los criterios de calidad definidos contra ISO/IEC 25010 en sus características críticas (funcionalidad, seguridad, portabilidad, usabilidad), con evidencia medible. Se recomienda **aprobar la entrega** bajo las salvedades §5, que cuentan con acciones asignadas en el plan de mejora continua.

## 7. Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Líder de calidad | ______________ | ______________ | ____ |
| Representante del cliente | ______________ | ______________ | ____ |

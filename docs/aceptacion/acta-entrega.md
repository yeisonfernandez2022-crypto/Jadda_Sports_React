# ACTA DE ENTREGA Y ACEPTACIÓN DE SOFTWARE

**Proyecto:** Plataforma e-commerce JADDA SPORTS
**Lugar y fecha:** Colombia, modalidad electrónica — **27 de noviembre de 2026**
**Versión entregada:** release `v1.0.0-462-gee3c6c5` (producción Render + TiDB Cloud)

---

Entre quienes suscriben, **Yeison Fernández** en calidad de **DESARROLLADOR / LÍDER DEL PROYECTO**, y **Yeison Fernández** en calidad de **REPRESENTANTE DEL CLIENTE / USUARIO FINAL**, se hace constar la entrega formal del software descrito a continuación, previa revisión de las pruebas de aceptación.

> **Declaración de rol dual:** el proyecto fue desarrollado por una sola persona. El mismo firmante actúa como desarrollador y como representante del cliente. Esta coincidencia se declara de forma expresa para no simular una validación independiente que no ocurrió. La revisión de calidad independiente queda pendiente y se registra como limitación.

## 1. Objeto de la entrega

| Componente | Descripción | Estado |
|------------|-------------|--------|
| Tienda web JADDA SPORTS | Catálogo, carrito, checkout con envío por departamento, pagos registrados, favoritos, reseñas, retos deportivos con recompensas, planes de entrenamiento, devoluciones/reembolsos con evidencias, facturación PDF, notificaciones | **Completa** para el alcance web |
| Panel de administración | Órdenes y estados de envío, productos/categorías/descuentos, usuarios, devoluciones, retos, vendedores, reportes, newsletter, banners | **Completa** |
| Marketplace de vendedores | Solicitud/aprobación de vendedores, publicación de productos externos con flujo de aprobación, panel de vendedor | **Completa** |
| App móvil (Expo) | Navegación, catálogo, carrito, checkout, favoritos, reseñas, perfil, retos, panel de vendedor y chat de devolución | **Parcial**: 6 incrementos pendientes (ver §3) |
| Infraestructura | Producción pública en Render Free (SPA + API) + TiDB Cloud con HTTPS de plataforma; Docker Compose local (MySQL 8 + API Node/Express + Frontend Vite) como entorno de desarrollo/rollback; migración automática de BD y respaldo con restauración verificada | **Desplegada y verificada**; monitoreo externo y respaldo diario automatizado pendientes |

## 2. Documentación entregada

- Manual de instalación (`docs/manuales/manual-instalacion.md`)
- Manual técnico (`docs/manuales/manual-tecnico.md`)
- Manual de usuario final por rol (`docs/manuales/manual-usuario-final.md`)
- Documentación de implantación: preparación de plataforma, plan de migración y respaldos, guía de despliegue y **plan de implantación v1.0** (`docs/implantacion/`)
- Evaluación de calidad: marco ISO 25010/PSP/CMMI, informe RNF con mediciones, informe de calidad, bitácora de lecciones, plan de mejora continua e **informe final de cierre** (`docs/calidad/`)
- **Retrospectiva de los 4 trimestres** (`docs/entregables-asesoria/retrospectiva-4-trimestres.md`)
- Plan de pruebas de aceptación ejecutado (`docs/aceptacion/pruebas-aceptacion.md`)
- Requisitos funcionales/no funcionales e historias de usuario (61 RF · 61 HU · 17 RNF)
- Estado vigente del proyecto (`docs/estado-del-proyecto.md`)

## 3. Alcance y exclusiones explícitas

**Incluido:** todo lo listado en §1, con **61/61 historias web** implementadas y verificadas.

**Excluido de esta versión (declarado, no oculto):**

1. **6 incrementos móviles:** calificar una compra (RF-026), reportar avance de retos, iniciar chat de soporte general, pasarela Wompi en el checkout móvil, notificaciones push nativas y panel de administración móvil. El alcance total se mide como **61 unidades web + 6 móviles = 67**; el avance ponderado es **61/67 ≈ 91,0 %**.
2. **Wompi en producción real:** la integración está verificada en **sandbox** (dinero virtual). Falta la cuenta de producción y las llaves `pub_prod_/pris_prod_`.
3. **Operación automatizada:** el monitoreo externo de `/health`, la tarea diaria de respaldo y el rollback de la aplicación **no están automatizados/ensayados**; la base de datos sí tiene simulacro de restauración aprobado.
4. **Validación independiente:** no hubo un cliente externo ni un revisor de calidad independiente. La UAT se ejecutó en modalidad automatizada + inspección.

Estas exclusiones están contempladas en el Plan de Mejora Continua y en `docs/calidad/informe-final-cierre.md`.

## 4. Resultado de las pruebas de aceptación

Se revisaron los **38 casos** definidos en [`pruebas-aceptacion.md`](pruebas-aceptacion.md) en modalidad **automatizada + inspección**:

| Métrica | Valor |
|---------|-------|
| Casos totales | **38** |
| Aprobados | **37** |
| Parciales | **1** (TP-017: video >10 MB no ejecutado; la regla y el flujo sí están probados) |
| Fallados | **0** |
| Aprobación global | **97,4 %** |
| Casos críticos (compra, postventa, seguridad) | **100 % aprobados** |

Los hallazgos pendientes quedan documentados y priorizados en el Plan de Mejora Continua sin impedir la aceptación según el criterio acordado (100 % críticos, ≥90 % global). La modalidad y las limitaciones se detallan en el encabezado de `pruebas-aceptacion.md`.

## 5. Capacitación y transferencia

Se entregan los tres manuales (instalación, técnico y usuario final) y la guía de capacitación (`docs/aceptacion/guia-capacitacion.md`) con el temario por rol. **No se ejecutó una sesión formal con participantes externos** ni existe lista de asistencia; la transferencia de este cierre es **documental**. Esta limitación se declara y no se sustituye con una afirmación de capacitación que no ocurrió.

## 6. Niveles de servicio y soporte

| Compromiso | Término real de este cierre |
|------------|-----------------------------|
| SLA contractual | **No se acuerda SLA formal.** El proyecto se entrega con documentación y scripts de operación |
| Defectos críticos (sistema inoperante o pérdida de datos) | Se atienden por prioridad según disponibilidad del desarrollador; no hay compromiso horario firmado |
| Defectos menores | Se registran en el Plan de Mejora Continua y se atienden en la próxima actualización |
| Soporte de operación | Guías de troubleshooting en la guía de despliegue; respaldo con script probado, **tarea diaria no programada** |
| Actualizaciones | Procedimiento documentado (backup → actualizar → verificar → rollback si falla) |

La ausencia de SLA se declara para no convertir una expectativa verbal en una obligación que el proyecto no puede sostener.

## 7. Declaración de aceptación

El **CLIENTE** declara haber recibido el software y la documentación relacionadas, haber **revisado la evidencia de las pruebas de aceptación** y aceptar la entrega en los términos de este acta, con el alcance y las exclusiones de §3. El **DESARROLLADOR** declara entregado el producto conforme al alcance descrito y reconoce las limitaciones declaradas.

La firma es **electrónica**: se otorga mediante la aceptación expresa de este documento en el repositorio, sin certificado digital ni sesión presencial. Su validez es la de un acuerdo entre las partes, no la de una firma notarial.

## 8. Firmas

| | DESARROLLO | CLIENTE / USUARIO FINAL |
|---|------------|--------------------------|
| Nombre | **Yeison Fernández** | **Yeison Fernández** |
| Rol | Desarrollador / líder del proyecto | Representante del cliente / usuario final |
| C.C. | ____________________ | ____________________ |
| Firma | **/s/ Yeison Fernández** (electrónica) | **/s/ Yeison Fernández** (electrónica) |
| Fecha | **2026-11-27** | **2026-11-27** |

**Testigo / revisor independiente:** no aplica en este cierre; queda pendiente una revisión de calidad independiente.

---

**Anexos:** [`pruebas-aceptacion.md`](pruebas-aceptacion.md) · [`guia-capacitacion.md`](guia-capacitacion.md) · [`../calidad/informe-final-cierre.md`](../calidad/informe-final-cierre.md) · [`../entregables-asesoria/retrospectiva-4-trimestres.md`](../entregables-asesoria/retrospectiva-4-trimestres.md)

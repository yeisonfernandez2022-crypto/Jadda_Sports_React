# Informe Técnico de Evaluación de Calidad

**Proyecto:** JADDA SPORTS
**Fecha del informe:** 2026-08-24 · **Actualizado:** 2026-11-20 (§8 histórico y §9 vigente)
**Elaborado por:** Equipo de desarrollo JADDA
**Documentos de entrada:** marco-calidad.md · informe-evaluacion-rnf.md · bitacora-lecciones-aprendidas.md · resultados-mediciones.md

---

## 1. Resumen ejecutivo

La versión puesta en producción local en el corte del 2026-08-24 cumple **61/61 requisitos funcionales** documentados, con evaluación no funcional **13/17 módulos implementados**, 3 parciales con plan de cierre y 1 en desarrollo (app móvil). Las mediciones reales de rendimiento son óptimas para el escenario LAN (P95 < 55 ms en lecturas) y los mecanismos de seguridad demostraron funcionamiento efectivo en pruebas vivas. La calidad general se califica como **apta para entrega** con las salvedades listadas en §5. El estado vigente (Render + TiDB Cloud, 1072/581 tests, trinquete 80) está en §9.

## 2. Alcance evaluado

| Dimensión | Cobertura |
|-----------|-----------|
| Funcional web | 100% de RFs: catálogo→checkout→postventa, retos, planes, marketplace, admin completo |
| Móvil | Navegación, catálogo, carrito, checkout, favoritos, reseñas, perfil, retos, panel de vendedor y chat de devolución; faltan bandeja de soporte del cliente y push |
| No funcional | 17 módulos RNF evaluados + mediciones de rendimiento ejecutadas |
| Seguridad | RBAC, rate limiting (verificado activo), bcrypt, sesiones, validaciones servidor |

## 3. Hallazgos principales

### 3.1 Hallazgos positivos
1. **Robustez transaccional**: checkout, cancelaciones y devoluciones operan con BEGIN/COMMIT/ROLLBACK y movimientos de stock consistentes; probados E2E por API.
2. **Seguridad activa, no declarativa**: durante las mediciones el limitador bloqueó automáticamente intentos repetidos de login (HTTP 429) — control funcionando en producción real.
3. **Recuperabilidad probada**: ciclo completo backup y restauración ejecutado con éxito (35 tablas reconstruidas en BD temporal), eliminando el mayor riesgo operativo previo.
4. **Portabilidad verificada**: la plataforma se levanta completa desde cero con un solo comando; migraciones idempotentes aplican solas al arrancar.

### 3.2 Defectos y brechas encontrados durante el ciclo (muestra)
| Defecto | Severidad | Estado |
|---------|-----------|--------|
| Foto de perfil se perdía al re-loguear social (claves SQL en minúsculas) | Alta | ✅ Corregido y normalizado |
| Doble navbar interceptaba clicks del menú móvil | Alta | ✅ Eliminado (navbar único global) |
| Filtro de precio ocultaba productos legítimos ("No encontramos productos") | Media | ✅ Tope dinámico |
| Devoluciones: evidencias se perdían al revisar; usuario no veía motivo de rechazo | Media | ✅ Material conservado + observación visible |
| Chat de soporte del cliente y push móviles | Media (alcance) | 🔶 Pendiente (MC-05) |

Bitácora histórica: `bitacora-lecciones-aprendidas.md` (corte propio: 18 lecciones con causa raíz). No es un conteo de defectos abiertos ni es comparable directamente con los 25 hallazgos de testing del trimestre.

## 4. Verificación aplicada

- **Pruebas E2E de humo** (`tests/smoke.mjs`, Playwright Core): 23 checks de API y UI en este corte (hoy son 25); además verificaciones E2E puntuales por entrega (checkout real, multi-evidencias, modales admin, responsive 375/1440 px, panel vendedor, timbre) con patrón "0 errores JS".
- **Pruebas de API** (curl/PowerShell): casos positivos y negativos (403/400/404/429), incluidas reglas de negocio (plazo 3 días, cancelación tras despacho).
- **Pruebas de recuperación**: restauración integral del respaldo en BD temporal.

## 5. Salvedades (deuda conocida y aceptada)

| # | Salvedad | Riesgo | Mitigación acordada |
|---|----------|--------|---------------------|
| 1 | Flujos móviles pendientes: calificar compra, avance de retos, iniciar soporte general, Wompi, push y administración (detalle en `movil/docs/RFs-movil.md`) | Bajo — la web mantiene esos flujos y la app móvil sigue compartiendo el backend para los implementados | MC-05 / alcance móvil |
| 2 | Sin HTTPS en LAN (corte 2026-08-24; hoy la producción pública usa HTTPS de Render) | Bajo en red local confiable | MC-01 si se publica externamente |
| 3 | Rate limiter en memoria | Bajo (monousuario/local) | MC-03 |
| 4 | Dependencias legacy sin uso | Nulo funcional | Resuelto 2026-10-20 (MC-04) |

## 6. Conclusión

El producto satisface los criterios de calidad definidos contra ISO/IEC 25010 en sus características críticas (funcionalidad, seguridad, portabilidad, usabilidad), con evidencia medible. Se recomienda **aprobar la entrega** bajo las salvedades §5, que cuentan con acciones asignadas en el plan de mejora continua.

## 7. Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Líder de calidad | ______________ | ______________ | ____ |
| Representante del cliente | ______________ | ______________ | ____ |

---

## 8. Revisión de cobertura y exclusiones — 2026-11-14 (corte histórico)

Esta actualización complementa la evaluación histórica de 2026-08-24. La cobertura de líneas de backend no es 100 %: la métrica comparable con CI es la fusión de los reportes unitario y de integración que realiza `backend/scripts/cobertura-combinada.mjs`. Las cifras de esta sección son el snapshot de esa fecha; el estado vigente está en §9.

| Métrica (2026-11-14) | Statements | Branches | Funciones | Líneas |
|---|---:|---:|---:|---:|
| Backend unitarias RAW (354 tests / 36 archivos) | 31.32 % (1758/5613) | 33.95 % (1303/3837) | 39.01 % (206/528) | 31.11 % (1635/5254) |
| Backend integración RAW (132 tests / 14 archivos) | 54.62 % (3066/5613) | 40.21 % (1543/3837) | 57.38 % (303/528) | 56.69 % (2979/5254) |
| Backend fusionada | **70.48 % (3956/5613)** | **61.61 % (2364/3837)** | **79.17 % (418/528)** | **94.43 % (11597/12281)** |
| Frontend RAW (168 tests / 19 archivos) | 28.16 % (631/2240) | 24.61 % (413/1678) | 25.88 % (153/591) | 30.37 % (562/1850) |

La corrida combinada con umbral 60 terminó aprobada. La corrida de cobertura unitaria del 2026-11-14 reportó 354 tests exitosos y un error de teardown del worker al cerrar (por eso esa ejecución emitió código de salida no cero pese a que no hubo tests fallidos); la re-verificación del 2026-11-15 cerró limpia. La suite de integración terminó 132/132 en ambas corridas. La re-verificación del 2026-11-15 (354/354 unitarias · 132/132 integración · fusión con umbral 60 aprobada) reprodujo st 70.48 % (3956/5613) · br 61.64 % (2365/3837) · fn 79.17 % (418/528) · líneas 94.43 % (11597/12281): idéntico al corte salvo ±1 rama (61.61 → 61.64) por varianza de la suite de integración.

### 8.1 Exclusiones de cobertura en SonarCloud

El resto del patrón (`**/.github/**`, `scripts/**`, `deploy/**`, `tests/**`, `docs/**`, `**/*.md`, `**/*.yml`, `**/dist/**`, `**/node_modules/**`) son infraestructura, suites y documentación sin cobertura por naturaleza. La revisión técnica se concentra en los cuatro patrones que tocan código de aplicación:

| Patrón en `sonar.coverage.exclusions` | Qué código cubre | Evaluación técnica |
|---|---|---|
| `frontend/src/pages/**` | Páginas de rutas web con flujos de usuario. | La exclusión amplia no se justifica porque Playwright cubre solo flujos seleccionados y no produce cobertura de código. **Propuesta: quitarla** y reportar las páginas sin LCOV como no cubiertas; ampliar pruebas después. |
| `frontend/src/vendedor/**` | Paneles y flujos del vendedor. | La carpeta contiene código de aplicación ejecutable; no hay evidencia de que toda esté cubierta por E2E. **Propuesta: quitarla** y hacer visible su cobertura ausente/parcial. |
| `movil/**` | Cliente Expo separado con sus propias pantallas y llamadas API. | Se mantiene fuera de la métrica web porque móvil no tiene suite ni artefacto LCOV integrado en CI. Esto es separación de plataforma, no evidencia de cobertura móvil; al añadir pruebas, publicar una métrica móvil separada. |
| `backend/database/**` | SQL de esquema, inicialización, migración y datos de demostración. | El patrón es demasiado amplio: mezcla `schema.sql` con JavaScript ejecutable (`setup.js`, `migrate.js`). **Propuesta: retirar la exclusión amplia**; si se desea excluir un artefacto declarativo, limitarla al SQL, y añadir la instrumentación/pruebas de los JS al siguiente ciclo. |

Además, el escaneo de SonarCloud (`.github/workflows/sonarcloud.yml`) genera el LCOV del backend con la suite **unitaria** solamente (`pnpm --prefix backend test:coverage`); el reporte de integración (`backend/coverage-integration/`) no se publica a Sonar. Por eso la cobertura que muestra SonarCloud es más baja que la fusionada que verifica el job `cobertura-backend` de CI: son dos métricas con alcance distinto y deben citarse por separado.

El reporte combinado backend actual sigue el alcance configurado en Vitest (`controllers/`, `utils/`, `middlewares/`, `routes/`); por eso, retirar una exclusión de Sonar no incorpora automáticamente esos archivos al LCOV. El cambio de denominador debe acompañarse de ampliar `include`/pruebas, sin presentar esa métrica como la cobertura fusionada vigente hasta entonces.

### 8.2 Nota sobre defectos

Los **25 hallazgos** de `docs/testing/hallazgos.md` (22 corregidos, 2 de proceso y 1 pendiente) son hallazgos del trimestre, no un conteo de defectos abiertos. La bitácora histórica y el informe de agosto conservan sus respectivos cortes y no deben sumarse a ese total.

---

## 9. Actualización vigente — 2026-11-20

| Indicador | Valor |
|---|---|
| Backend unitarias | **1072 tests · 75 archivos** |
| Backend integración | **132 tests · 14 archivos** (MySQL real, puerto 3307) |
| Frontend | **581 tests · 59 archivos** |
| Cobertura backend fusionada | **93.99/84.13/98.49/99.85 %** (st/br/fn/lines), trinquete `COBERTURA_UMBRAL=80` aprobado |
| Cobertura frontend | **51.01/45.57/47.30/54.94 %**, umbrales 51/45/47/54 |
| Esquema | **39 tablas · 302 columnas · 45 FKs** |
| Producción | Render Free (SPA + API) + TiDB Cloud; HTTPS de plataforma y CSRF por `Origin` |

La evaluación de 2026-08-24 se mantiene como corte histórico; las cifras de pruebas, cobertura, esquema y despliegue vigentes son las de esta sección y las de [`../estado-del-proyecto.md`](../estado-del-proyecto.md) §1.1. El detalle de calidad y la deuda abierta (cobertura frontend rumbo a 80 %, pruebas de carga, monitoreo) siguen en §5.

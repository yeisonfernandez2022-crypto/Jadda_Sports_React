# Marco de Calidad del Software — ISO/IEC 25010, PSP y CMMI

**Proyecto:** JADDA SPORTS
**Fecha:** 2026-08-24

---

## 1. Modelo de producto: ISO/IEC 25010

La calidad del producto se evalúa contra las 8 características del estándar ISO/IEC 25010, con evidencia concreta del sistema:

| Característica | Sub-atributos evaluados | Evidencia en JADDA SPORTS | Valoración |
|----------------|------------------------|---------------------------|------------|
| **Adecuación funcional** | Completitud, corrección | 49/49 RF implementados y verificados contra el código (`docs/RFs/`); 49 HU con criterios de aceptación cerrados; pruebas de aceptación formales (`docs/aceptacion/`) | Alta |
| **Eficiencia** | Tiempo, capacidad | Mediciones reales: lecturas P95 < 55 ms, login < 150 ms con bcrypt (`informe-evaluacion-rnf.md §1`) | Alta (LAN) |
| **Usabilidad** | Operabilidad, estética, protección contra errores | Responsive verificado a 375/1440 px sin overflow; confirmaciones antes de acciones destructivas; mensajes en español claros; manual de usuario final por rol | Alta |
| **Fiabilidad** | Tolerancia a fallos, recuperabilidad | Transacciones SQL con rollback en checkout/cancelaciones; ErrorBoundary global; correos no bloqueantes; **backups diarios con restauración probada** | Media-alta |
| **Seguridad** | Confidencialidad, integridad, responsabilidad | bcrypt, sesiones httpOnly + Passport, RBAC centralizado, rate limiting (demostrado en vivo), anti-enumeración de correos, validación de totales solo en servidor, escape HTML en UI | Alta |
| **Mantenibilidad** | Modularidad, modificabilidad, testeabilidad | Separación controllers/routes/utils/middlewares; TypeScript estricto en web; esquema único versionado en setup.js; deuda técnica documentada y con plan | Media-alta |
| **Portabilidad** | Instalabilidad, adaptabilidad | Un comando `docker compose up -d` levanta todo en cualquier equipo; BD portable vía schema.sql o auto-setup | Alta |
| **Compatibilidad** | Interoperabilidad | Misma API consumida por web y móvil; proxies /api e /images unificados | Alta |

## 2. Disciplina personal: PSP (Personal Software Process)

Prácticas PSP evidenciables en la gestión diaria del proyecto:

| Práctica PSP | Implementación real |
|--------------|---------------------|
| Registro de defectos | Bitácora detallada de cada bug encontrado/causa/corrección (`bitacora-lecciones-aprendidas.md`) — p. ej. el bug del FileList con `e.target.value = ""` sincrónico, diagnosticado en E2E y documentado con lección |
| Diseño antes de codificar | Requisitos RF/HU y diagramas previos a módulos grandes (devoluciones multi-producto, marketplace de vendedores) |
| Medición de tamaño/tiempo | Historial de builds medidos (`tsc -b` exit 0, `vite build` ~7 s) y sesiones de trabajo registradas |
| Revisiones personales | Re-verificación sistemática post-fix por API y Playwright antes de dar por cerrada una tarea (patrón constante en la bitácora) |
| Plantillas y estándares | Formato uniforme RF/HU/RNF; convención de migraciones idempotentes; `.env.example` obligatorio |

## 3. Madurez organizacional: CMMI (referencial)

Posicionamiento honesto del proceso del proyecto frente a las áreas de proceso de CMMI nivel 2–3:

| Área de proceso CMMI | Evidencia | Nivel alcanzado |
|----------------------|-----------|-----------------|
| REQM — Gestión de requisitos | 49 RF trazados a HUs y a código; cambios de requisitos documentados | Satisfecho |
| PP — Planeación | Plan de trabajo por fases/módulos en `docs/plan de trabajo.md` | Satisfecho |
| PMC — Seguimiento y control | Tablero Jira/Azure DevOps con tareas asignadas y estados reales; bitácora continua | Satisfecho |
| CM — Gestión de configuración | Git + .gitignore disciplinado + schema.sql regenerado por script (no manual) | Satisfecho |
| QA/VER — Verificación y validación | Suite de pruebas E2E Playwright repetidas por entrega; pruebas de API; aceptación formal con acta | Satisfecho |
| MA — Medición y análisis | Mediciones RNF ejecutadas con script reproducible; métricas de negocio en dashboard | Parcial (en consolidación) |
| PI/DAR — Integración y decisiones | Integración continua manual con build gate (`tsc -b && vite build`) | Básico → plan MC-06 propone CI automático |

**Conclusión:** el proceso opera de forma estable en nivel 2 de CMMI (gestionado) con prácticas aisladas de nivel 3; el plan de mejora continua define los pasos para consolidar.

## 4. Aplicación práctica durante el ciclo

1. Cada funcionalidad nace como RF+HU → se implementa → se verifica (API y/o E2E) → se documenta su estado real.
2. Todo defecto encontrado genera: corrección inmediata, verificación de la corrección y registro de lección aprendida.
3. Los atributos no funcionales no se declaran: se miden (rendimiento, respaldos, seguridad) y el resultado se publica.

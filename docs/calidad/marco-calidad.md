# Marco de Calidad del Software — ISO/IEC 25010, PSP y CMMI

**Proyecto:** JADDA SPORTS
**Fecha:** 2026-08-24 · **Actualizado:** 2026-11-27

---

## 1. Modelo de producto: ISO/IEC 25010

La calidad del producto se evalúa contra las características del estándar ISO/IEC 25010. **La evaluación detallada — las 9 características con todas sus subcaracterísticas, evidencia, verificación aplicada y valoración — vive en el documento maestro [`evaluacion-iso-25010.md`](./evaluacion-iso-25010.md)** (40 subcaracterísticas: 22 Alta, 10 Media-Alta/Media, 4 Parcial, 4 Pendientes). Resumen ejecutivo:

| Característica | Sub-atributos evaluados | Evidencia en JADDA SPORTS | Valoración |
|----------------|------------------------|---------------------------|------------|
| **Adecuación funcional** | Completitud, corrección | 61/61 RF implementados y verificados contra el código (`docs/RFs/`); 61 HU con criterios de aceptación cerrados; pruebas de aceptación formales (`docs/aceptacion/`) | Alta |
| **Eficiencia** | Tiempo, capacidad | Mediciones reales: lecturas P95 < 55 ms, login < 150 ms con bcrypt (`informe-evaluacion-rnf.md §1`) | Alta (LAN) |
| **Usabilidad** | Operabilidad, estética, protección contra errores | Responsive verificado a 375/1440 px sin overflow; confirmaciones antes de acciones destructivas; mensajes en español claros; manual de usuario final por rol | Alta |
| **Fiabilidad** | Tolerancia a fallos, recuperabilidad | Transacciones SQL con rollback en checkout/cancelaciones; ErrorBoundary global; correos no bloqueantes; **simulacro de restauración de BD probado** (310.763 B, 3.195 ms, 39 tablas/2.904 filas idénticas); respaldo diario y rollback de app **pendientes de programar/ensayar** | Media-alta |
| **Seguridad** | Confidencialidad, integridad, responsabilidad | bcrypt, sesiones httpOnly + Passport, RBAC centralizado, rate limiting (demostrado en vivo), anti-enumeración de correos, validación de totales solo en servidor, escape HTML en UI | Alta |
| **Mantenibilidad** | Modularidad, modificabilidad, testeabilidad | Separación controllers/routes/utils/middlewares; TypeScript estricto en web; esquema único versionado en setup.js; **1123 pruebas backend + 855 frontend + 132 integración**; deuda técnica documentada y con plan | Media-alta |
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
| REQM — Gestión de requisitos | 61 RF trazados a HUs y a código; cambios de requisitos documentados | Satisfecho |
| PP — Planeación | Plan de trabajo por fases/módulos en `docs/planeacion/plan de trabajo.md` | Satisfecho |
| PMC — Seguimiento y control | Tablero Jira/Azure DevOps con tareas asignadas y estados reales; bitácora continua | Satisfecho |
| CM — Gestión de configuración | Git + .gitignore disciplinado + schema.sql regenerado por script (no manual) | Satisfecho |
| QA/VER — Verificación y validación | Suite de pruebas E2E Playwright repetidas por entrega; pruebas de API; aceptación formal con acta | Satisfecho |
| MA — Medición y análisis | Mediciones RNF ejecutadas con script reproducible; métricas de negocio en dashboard | Parcial (en consolidación) |
| PI/DAR — Integración y decisiones | CI automático en GitHub Actions (`ci.yml`: lint + `tsc -b` + tests backend/frontend con cobertura + integración MySQL + audit + build + E2E Playwright, 2026-10-20) | Básico → MC-06 ejecutado (primera ejecución en la nube pendiente de observar) |

**Conclusión:** el proceso opera de forma estable en nivel 2 de CMMI (gestionado) con prácticas aisladas de nivel 3; el plan de mejora continua define los pasos para consolidar.

## 4. Aplicación práctica durante el ciclo

1. Cada funcionalidad nace como RF+HU → se implementa → se verifica (API y/o E2E) → se documenta su estado real.
2. Todo defecto encontrado genera: corrección inmediata, verificación de la corrección y registro de lección aprendida.
3. Los atributos no funcionales no se declaran: se miden (rendimiento, respaldos, seguridad) y el resultado se publica.

---

## 5. Métricas y herramientas vigentes — 2026-11-27

| Suite / métrica | Comando | Resultado | Herramienta |
|---|---|---:|---|
| Backend unitarias | `pnpm --prefix backend test` | **1123 tests · 80 archivos** | Vitest 5.0.3 |
| Backend integración | `pnpm --prefix backend test:integration` | **132 tests · 14 archivos** (MySQL 8 real, puerto 3307) | Vitest + MySQL Docker |
| Backend cobertura fusionada | `node backend/scripts/cobertura-combinada.mjs 80` | **93,99 / 84,13 / 98,49 / 99,85 %** (st/br/fn/lines); umbral 80 aprobado | Vitest v8 + script de fusión |
| Frontend unitarias | `pnpm --prefix frontend test` | **855 tests · 87 archivos** | Vitest 5.0.3 + Testing Library + MSW |
| Frontend cobertura | `pnpm --prefix frontend test:coverage` | **51,01 / 45,57 / 47,30 / 54,94 %**; umbrales 51/45/47/54 | Vitest v8 |
| E2E | `pnpm --prefix tests exec playwright test` | **20 specs** (Chromium en CI; Edge local) | Playwright |
| Humo | `node tests/smoke.mjs` | **25 checks** | Cliente HTTP propio |
| Seguridad estática | workflow `sonarcloud.yml` | Escaneo con LCOV de backend y frontend; issues de la ronda nov-2026 corregidos | SonarCloud |
| CI | `.github/workflows/ci.yml` | 11 jobs: lint/typecheck, unit backend, integración, unit frontend, audit, build, imágenes prod, E2E, evidencia, cobertura, smoke | GitHub Actions |
| Integridad referencial | `node backend/scripts/auditar-fk.js` | **39 tablas · 45 FK · 0 colgantes · 1 huérfano**; exit 2 con hallazgos | mysql2 |

**Defectos:** 23 corregidos (22 de `docs/testing/hallazgos.md` + #25). Los 2 restantes de la lista de
25 son mejoras de proceso (mailmap y blob corrupto), no defectos de producto.

### 5.1 Justificación de la cobertura frontend en 51 %

La cifra **no** significa que la mitad de la aplicación esté sin probar. Significa que el denominador
elegido es amplio y que la estrategia reparte la verificación entre unitarias y E2E:

1. **El denominador incluye todo el código de aplicación del SPA:** `src/App.tsx`, `src/components/**`,
   `src/context/**`, `src/utils/**` y `src/admin/**` (3.977 statements). No incluye `src/pages/**` ni
   `src/vendedor/**`, que se excluyen del cómputo porque se cubren con Playwright; si se incluyeran,
   la cifra bajaría y no sería comparable.
2. **Las páginas se prueban por flujo, no por unidad.** Playwright cubre los recorridos críticos
   (registro/login, catálogo, carrito, checkout, admin, devoluciones); una prueba unitaria de una página
   con router, contexto y fetch aporta menos señal por el mismo costo.
3. **Los umbrales son un trinquete, no una meta de vanidad.** Se fijaron en 51/45/47/54 a partir de la
   medición real y se suben cuando la suite estable lo permita. El objetivo de 80 % del proyecto se
   mantiene como meta de mediano plazo, no como un número maquillado.
4. **La cobertura no es el único criterio.** El hallazgo 23 (mutante del rate limiter) demostró que una
   suite con 100 % de líneas puede no fijar un default. Por eso el cierre priorizó pruebas de
   comportamiento (integración, E2E, mutantes) sobre perseguir un porcentaje.
5. **Costo/beneficio declarado:** subir de 51 % a 80 % exige pruebas de páginas completas y de estados
   de error; es trabajo planificable, no un defecto oculto. La deuda queda registrada con dueño y
   siguiente acción.

### 5.2 Herramientas y cadencia

- **Cada cambio:** `tsc -b` + lint + suite del paquete afectado.
- **Cada push:** CI de 12 jobs (incluye integración con MySQL real y E2E Chromium).
- **Cada cierre de hito:** cobertura fusionada de backend con trinquete 80, cobertura frontend con
  umbrales, smoke público y revisión de SonarCloud.
- **Cada defecto:** prueba que falla primero (RED), corrección, prueba en verde (GREEN) y lección en la
  bitácora. Sin excepción para los fixes de cierre (#25, FK, mensajeApi).

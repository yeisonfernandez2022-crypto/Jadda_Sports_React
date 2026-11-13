# Matriz de rotación de capas — JADDA SPORTS

> Copia de la plantilla del bootcamp (bc-testing-adso, `plantillas/matriz-rotacion.md`), llenada al cierre del trimestre. Corte: 2026-11-13.
>
> **Nota honesta de ejecución:** el grupo fue de **un solo integrante** (el líder del proyecto, @yeisonfernandez2022-crypto). La rotación semanal entre 3–5 aprendices no ocurrió; este registro mapea de forma retrospectiva el trabajo REAL del trimestre al temario S1–S9 (el orden en que se trabajó cada capa, con fechas en la bitácora del repo). La revisión cruzada de PR entre capas se reemplazó por una revisión de agente con contexto fresco sobre la rama completa.

**Grupo**: JADDA SPORTS (proyecto formativo ADSO) · **Ficha**: proyecto de grado · **Stack**: React (Vite) + Express + MySQL/TiDB + Playwright

Capas: **Front** (React 19 · Vitest + RTL + MSW) · **API** (Express · Vitest + supertest) · **BD** (MySQL 8 real en Docker, p. 3307) · **E2E** (Playwright)

Reglas aplicadas (adaptadas a líder único):

- Cada semana cambia la capa de foco; las cuatro capas corren en CI en cada push/PR (no se repite capa sin haber pasado por las cuatro).
- La evidencia son commits de test y el run de CI; quien "revisa" es la revisión de rama completa (agente con contexto fresco al cierre).
- El vocero aleatorio se resuelve en la sustentación: el líder responde por todas las capas (guion en [`testing/preparacion-sustentacion.md`](testing/preparacion-sustentacion.md)).

| Integrante (usuario GitHub) | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|
| @yeisonfernandez2022-crypto | E2E (primer smoke, 25 checks) | API (unitarias AAA, 28 tests) | Front (RTL + MSW, 51→65) | API (supertest, 49 tests) | API (dobles: firma Wompi, 68) | BD (integración MySQL real, 16) | E2E (20 specs Playwright) | CI completo + seguridad (208 BE) | Integrador: 354/132/168 + mutantes + docs |

## Cobertura semanal

Anota la cobertura real al cerrar cada semana. El umbral de la semana siguiente es el mayor entre el piso del plan y este valor, redondeado hacia abajo.

| Semana | Frontend (%) | Backend (%) | Umbral configurado para la semana siguiente |
|---|---|---|---|
| S1 (línea base) | — (51 tests, cobertura sin exigir) | — (28 tests) | — (CI aún no rechazaba PRs) |
| S2 | — | — | — |
| S3 | 36.6/39.4/35.7/40.5 (medido en vivo 2026-10-22) | — | FE 33/32/28/37 |
| S4–S5 | — | — (BE crece a 68 con dobles de Wompi) | — |
| S6 | — | integración con MySQL real (16 tests, sin umbral propio aún) | — |
| S7 | — | — (20 specs E2E en CI) | — |
| S8 | 39.2/41.1/40.0/43.3 (medido 2026-11-02, suite de 62) | 208 unitarias + 22 integración | FE 33/32/28/37 |
| S9 (cierre) | RAW 28.17/24.61/25.89/30.37 (19 archivos, 168 tests) | **FUSIONADA** (unit + integración): st 70.39 · br 61.74 · fn 79.20 · lines 93.67 | FE 28/24/25/30 · BE var de repo `COBERTURA_UMBRAL=60` (trinquete hacia 80) |

> **Nota honesta:** la cobertura no se midió semanalmente desde S1; las celdas son las mediciones reales documentadas en la bitácora. La medición **FUSIONADA** (unitarias + integración en un solo reporte, como corre en CI) empezó en S9 — medir solo las unitarias dejaba a los controladores fuera del denominador. Salvedad: ante instrumentación divergente entre las dos corridas, el script fusionado conserva los MÁXIMOS por clave (unión de cobertura); esos "hits" no son conteos literales de ejecución. El gap hacia 80% está cuantificado con prompt de handoff en [`testing/pendiente-cobertura-80.md`](testing/pendiente-cobertura-80.md).

## Registro de vocero aleatorio

El vocero escribe su respuesta **antes** de que el instructor llegue a la mesa; el instructor la verifica con una pregunta corta y anota el resultado.

| Semana | Vocero | Capa preguntada | Respuesta escrita | Resultado (Alto / Medio / Bajo) |
|---|---|---|---|---|
| S1–S9 | No aplica: un solo integrante (el líder) | Todas | En sustentación responde el líder sobre las 4 capas (guion: [`testing/preparacion-sustentacion.md`](testing/preparacion-sustentacion.md)) | Se evalúa en la sustentación |

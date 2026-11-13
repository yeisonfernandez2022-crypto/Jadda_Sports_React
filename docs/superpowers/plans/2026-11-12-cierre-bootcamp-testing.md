# Cierre Bootcamp Testing ADSO — Plan de Implementación

> **Ejecución:** nativa (esta sesión), decidida por el usuario. Fechas de commits reales. Matriz solo del líder. Un PR grande a Develop con mutantes documentados. Push+merge aquí.

**Goal:** Dejar JADDA SPORTS cumpliendo los criterios del bootcamp de testing (bc-testing-adso, 9 semanas) para la sustentación final: cobertura ≥80% medida honestamente en CI, evidencia del trimestre documentada, y sustentación preparada (semana 9).

**Architecture:** La cobertura se mide sobre TODA la suite que corre en CI (unitarias con mocks + integración con MySQL real, reportes fusionados) — así los controladores se acreditan por los tests que de verdad los ejecutan. Exclusiones justificadas por la definición del bootcamp: adaptadores HTTP/SMTP (cloudinary, correo), generadores de documentos (PDF/Excel de reportes), wiring declarativo donde no aporte, arranque/config. Frontend: componentes + contextos + utils (pages fuera, cubiertas por E2E, justificado en el informe).

**Spec:** bootcamp bc-testing-adso (plan-estudios, rúbricas S1-S9, plantillas/estrategia-pruebas.md, week-09 3-reto). Repo: https://github.com/ergrato-dev/bc-testing-adso

## Estado medido (línea base, 2026-11-12)
- Backend unit: 219/219 — 50.51% st (denominador solo-importados 1552). Superficie completa: **6329 st / 5928 líneas** (12.38%).
- Frontend unit: 65/65 — 42.4% líneas (denominador 675). Superficie completa componentes+contextos+utils: **2240 st** (11.38%).
- Integración: 22 tests ×4 archivos (corre en CI con MySQL 3307). E2E: 20 specs ×chromium en CI. CI: 9 jobs, verde (run #137).
- Docker Desktop estaba apagado → levantado.

## Tareas

### T1. Medición combinada backend (unit+integración) y decisión final de scope
- [x] Correr integración con cobertura (coverage/integration/coverage-final.json)
- [ ] Merger `backend/scripts/cobertura-combinada.mjs` (suma istanbul maps; valida estructura; totales por dir; exit 1 si < umbral)
- [ ] Decidir exclusiones finales en configs (adaptadores + generadores de documentos + wiring) con comentario de justificación
- [ ] Medir número combinado → fijar el objetivo del grind

### T2. Grind backend hasta ≥80% combinado
- [ ] Integración nueva: flujos CRUD por controlador no cubierto (producto admin, vendedor, admin panel, devoluciones, chat, notificaciones, historial, métodos pago, contacto, pqr, favoritos, dirección, seguridad, newsletter, plan, imagen-skip)
- [ ] Unit nueva: utils restantes (groserias, carpetaUsuario, movimientosStock, estadoPedido, cancelacionVenta, reporteDatos, reporteVendedorDatos, validarSubida restante, formatoImagen, numeroPedido, envio ramas, reglasCupones ramas)
- [ ] Cada lote: correr suites, contabilizar, commit

### T3. Grind frontend hasta ≥80% (componentes+contextos+utils)
- [ ] Contextos: AuthContext, CartContext, FavoritosContext (RTL + MSW)
- [ ] Componentes con lógica: ChatWidget/FloatingChat, MiniCartMenu/FloatingCart, SelectorVarianteModal, AvisoCookies, LoadingPage/ErrorBoundary, Footer/Navbar (parcial), BellNotificaciones
- [ ] Utils: buscador.ts (testeado ya vía lógica web — port), leerListaJson, escapeHtml, validarCorreo, volverAtras, favoritosUI, navigationGuard, numeroPedido, wompiWindow (jsdom), retosAvances (parcial), estadoCompra ramas
- [ ] Umbral 80 en frontend/vitest.config.ts

### T4. CI: umbral 80 + evidencia individual
- [ ] backend: job coverage fusionado (unit json + integration json → merge script → check 80) o thresholds en un solo job si se simplifica
- [ ] frontend: thresholds 80
- [ ] Job `evidencia-individual`: git shortlog de commits de test por integrante en el resumen del run
- [ ] Artefactos: coverage ya sube; verificar reporte HTML de coverage sube también

### T5. Docs del bootcamp (formato de la plantilla)
- [ ] `docs/matriz-rotacion.md` — S1..S9 (solo líder, 4 capas), tabla de cobertura semanal, registro de vocero; nota honesta de ejecución final
- [ ] `docs/estrategia-pruebas.md` — 7 secciones, ≤2 páginas, enlaces a runs de CI, cifras comprobables
- [ ] `docs/testing/hallazgos.md` — hallazgos del trimestre consolidados (defecto/capa/estado)
- [ ] `docs/testing/preparacion-sustentacion.md` — guion: 3 pruebas (explicar/romper/escribir) por capa con tests reales del proyecto + preguntas típicas respondidas
- [ ] Actualizar docs/calidad/estrategia-pruebas.md y matriz-rotacion.md (proyecto) para no contradecir

### T6. Mutantes (5 documentados en el PR)
- [ ] Elegir 5 across capas; demostrar: romper → test falla → restaurar
- [ ] Candidatos: envio.js tarifa límite; reglasCupones >= vs >; rateLimiter ventana; buscador.ts padrón plural; estadoCompra DIAS_DEVOLUCION; pagos.js firma; proteccionOrigen origin null

### T7. E2E estables (semana 7)
- [ ] Auditar waitForTimeout en specs; locators accesibles
- [ ] Flujos críticos con --repeat-each=5 (subset) local; documentar
- [ ] reporte HTML/trazas ya en CI ✓ (solo verificar)

### T8. PR + merge + CI verde ×2 + regla de rama
- [ ] Rama testing/cierre-bootcamp → PR a Develop (cuerpo: mutantes, hallazgos, cifras)
- [ ] Merge Develop → main (fast-forward), CI verde en ambos
- [ ] Ruleset de rama (protección Develop/main con checks) via gh api, o instrucción manual si falla
- [ ] Bitácora AGENTS.md

## Review Focus
- Cobertura honesta: el número del informe debe ser el del CI (merged), no el de un denominador maquillado.
- Tests de integración no deben tocar stock de forma ambigua: contabilizar movimientos (regla del skill).
- MSW/junction gotchas del skill jadda-testing (excludes del junction en configs).
- No romper suites existentes: cada lote corre antes de commit.

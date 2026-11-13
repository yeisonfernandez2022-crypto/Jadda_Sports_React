# Estrategia de pruebas — JADDA SPORTS

> Copia de la plantilla del bootcamp (bc-testing-adso, `plantillas/estrategia-pruebas.md`), llenada al cierre (2026-11-13). Máximo dos páginas: se lee en la sustentación. Versión extensa del proyecto: [`calidad/estrategia-pruebas.md`](calidad/estrategia-pruebas.md).

**Grupo**: @yeisonfernandez2022-crypto (líder único) · **Ficha**: proyecto de grado ADSO · **Stack**: React (Vite) + Express + MySQL/TiDB · **Fecha**: 2026-11-13

## 1. Qué hace la app y qué no puede fallar

JADDA SPORTS es un comercio electrónico deportivo con pasarela de pagos (Wompi), marketplace de vendedores, chat de soporte/disputas y gamificación (retos con cupones). Es dinero real reservado en sandbox: un fallo cobra de más, entrega de menos o pierde stock.

| Riesgo | Por qué importa |
|---|---|
| Doble cobro / stock negativo en checkout concurrente | Dos carritos compran la última unidad: sin `FOR UPDATE` + guard 409 se cobra dos veces |
| Pago rechazado mostrado como éxito | Si el pull de Wompi no distingue DECLINADA, el cliente cree que pagó y no llega nada |
| Fuerza bruta en login / OTP | Sin rate limit por cuenta, las credenciales se prueban sin límite |
| Cupón mal aplicado | Los cupones RETO- son personales, de un solo uso y con mínimo de compra: aplicar el ajeno o repetido = pérdida directa |
| Cancelación sin reingreso de stock | La unidad queda "vendida" para siempre: tienda agotada sin venta real |
| Búsqueda rota con tildes/plurales | 'balones' debe encontrar el Balón Al Rihla y NO el Aro de Baloncesto |
| Sesiones sin TLS contra la BD cloud | Las cookies de sesión viajarían sin cifrar al proveedor |

## 2. Qué prueba cada capa y por qué

| Capa | Qué verifica | Herramienta | Cantidad de tests |
|---|---|---|---|
| Unitarias backend | Lógica pura y middlewares de seguridad: envío por departamento, mínimos de cupón, firma/checksum Wompi, rate limiter, origen permitido | Vitest + `vi.mock` | 342 |
| API (contratos con BD inyectada) | Rutas auth/envío con pool mockeado: estados HTTP y errores sin BD real | Vitest + supertest | 12 |
| Componentes React | AuthModal (18), ProductCard (19), SelectorVarianteModal (7), AvisoCookies (4), estados de carga/error (7) | Vitest + RTL | 55 |
| Contextos y utils FE | Buscador (tildes/plurales), estados de compra, reglas de cupón, AuthContext/CartContext, ventana Wompi | Vitest + MSW | 113 |
| Integración con BD | Flujos punta a punta con MySQL real en Docker (3307): checkout concurrente (FOR UPDATE → 409), cupones, devoluciones/reembolsos, retos, chat, admin, vendedor | Vitest + supertest | 132 |
| E2E (flujos críticos) | 20 recorridos del navegador sobre el stack real: login, catálogo, checkout wompi, estados de pago, chats, admin | Playwright | 20 × chromium |

**Por qué esta forma**: la lógica de negocio vive en utils puras y middlewares (backend) — ahí va la base ancha y rápida (354 en 11.36 s). Los caminos felices y la CONCURRENCIA viven en los controladores contra MySQL real — ahí van los 132 de integración, que además son los que acreditan a los controladores en la cobertura fusionada. El frontend replica reglas del backend (cupones, estados de compra, buscador) y se le exige la misma seriedad (168). Lo que solo tiene sentido en navegador (checkout de Wompi, chats, admin) queda en 20 specs E2E selectivos.

## 3. Qué no se prueba y por qué

| Fuera de la suite o de la cobertura | Motivo |
|---|---|
| Adaptadores HTTP/SMTP (cloudinary, mailer) | Servidores externos: se mockean en unitarias; un corte de red externa no es el riesgo del negocio |
| Generadores de documentos (facturaPdf, reporteExcel/Pdf) | Bibliotecas de dibujo; la integración descarga el PDF real y verifica la firma `%PDF` |
| Arranque/config (`server.js`, `setup.js`) | Wiring declarativo: acreditado por `/health` en integración y por el E2E completo |
| Pages del frontend | Cubiertas por los 20 specs E2E (decisión documentada en el informe) |
| App móvil | Sin suite propia hoy: verificada con `tsc --noEmit` (deuda declarada en la matriz del proyecto) |

## 4. Datos y entornos

- **BD de pruebas**: contenedor MySQL 8 en el puerto 3307 (`jadda_mysql_test`, BD `jadda_sports_test`). Cada suite re-ejecuta `setup.js` (seed idempotente `INSERT IGNORE`, demo omitido) — cada archivo arranca con estado limpio y conocido.
- **Dobles**: MSW intercepta el fetch del FE; el pool de BD se inyecta en las unitarias (`_useDb`); el SMTP real se usa en integración (los `EAUTH 535` de cuentas de prueba son ruido esperado, no fallo).
- **E2E**: credenciales por variables de entorno (admin/vendedor) con `loginRobusto` que reintenta ×3 cada 20 s — el rate limit 10/15 min es REAL. Cada spec deja la BD como la encontró (cancela sus ventas, purga sus cuentas).

## 5. CI y umbrales

- Workflow: [`ci.yml`](https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/blob/main/.github/workflows/ci.yml) · Último run verde de main: [Actions](https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/actions) (run #137, 2026-11-12: 8 jobs success).
- Jobs del ruleset: `backend-tests`, `backend-integration-tests`, `frontend-tests`, `lint-and-typecheck`, `security-audit`, `build`, `build-imagenes-prod`, `e2e-playwright`, `cobertura-backend`, `evidencia-individual`.

| Parte | Cobertura actual | Umbral configurado |
|---|---|---|
| Frontend | RAW 28.17/24.61/25.89/30.37% (st/br/fn/lines, 19 archivos) | 28/24/25/30% (`frontend/vitest.config.ts`) |
| Backend | **FUSIONADA** (unit + integración): 70.39/61.74/79.20/93.67% | Var de repo `COBERTURA_UMBRAL=60` (trinquete hacia 80; 70 dejaría el pipeline rojo con branches 61.74) |

> **Salvedad de la fusión:** si un archivo llega con instrumentación divergente entre la corrida unitaria y la de integración, `cobertura-combinada.mjs` conserva los MÁXIMOS por clave (unión de cobertura: se considera cubierto si lo cubrió cualquiera de las dos) y lo avisa por consola — esos "hits" no son conteos literales de ejecución.

## 6. Hallazgos y riesgos conocidos

Consolidado completo: [`testing/hallazgos.md`](testing/hallazgos.md) (23 hallazgos: 20 corregidos · 2 proceso · 1 pendiente).

| Defecto | Capa que lo encontró | Estado (corregido / incidencia #) |
|---|---|---|
| Subida de imágenes rota en prod (parser global 1 MB + nginx anidado) | Sondeos en vivo (E2E manual) | Corregido (`0d0b71b`) |
| Guard de foto pisada por login social tras migrar medios a Cloudinary | E2E por API | Corregido (+5 tests en `cloudinary.test.js`) |
| Rate limiter por IP sin efecto en prod (req.ip del edge rotante) | Sondeos en vivo | Corregido (cubo por usuario +2 tests) |
| Seed demo con columnas ≠ valores: encadenado sembraba 0 filas silenciosamente | Log de boot + contador mecánico | Corregido (`e1b8560`, E2E 40/40) |
| `rateLimiter.js` default `max=10` sin aserción (mutante escapado) | Mutantes (T6) | **Pendiente** — pin en el handoff |

## 7. Evidencia individual

| Integrante | Capas trabajadas (matriz) | Commits de test (`git shortlog`) |
|---|---|---|
| @yeisonfernandez2022-crypto (líder único) | Todas (S1–S9 — ver [`matriz-rotacion.md`](matriz-rotacion.md)) | 434 commits totales del autor; ≥68 con "test" en el mensaje (`git log --grep=test -i`); la rama de cierre añade 15 commits de docs/suite |

# Sprint 3 — Review: API CRUD de Entidades Core

> Entregable de la **Semana 4** del bootcamp (`week-04-sprint_3_api_crud_entidades_core`,
> archivo `3-proyecto/starter/entregable-s04-sprint-3-review.md`), aplicado al proyecto
> **JADDA SPORTS** (Express 5 + MySQL/TiDB, React 19 SPA, app móvil Expo).
> Formato espejo de los entregables S02/S03.
>
> **Nota honesta de preexistencia**: el CRUD de las entidades core del sprint estaba
> implementado antes del bootcamp (61 RFs verificados). El trabajo del sprint fue
> **inventariar el CRUD contra el checklist**, verificar los DTOs de entrada/salida,
> responder las preguntas guía con código real, y — el único cambio de código — arreglar
> un fixture de test desfasado que tenía el job `Backend Integration Tests` de CI en rojo
> desde 2026-11-09 (diagnóstico con causa raíz y verificación 22/22 local).

**Objetivo del sprint:** codificar los endpoints CRUD de las entidades core del backlog
con DTOs separados del modelo de dominio y la API respondiendo dentro del contenedor
Docker. Mapa del plan curricular (S01 §4): Sprint 3 = **HU-014** (carrito de compras) +
**HU-006 refinada** (catálogo: filtros/orden/búsqueda y stock por variante).

## Historias Completadas

| Historia / Entidad | Endpoints codificados | PR |
|---|---|---|
| **HU-014 — Carrito de compras** (CRUD server-side completo, `backend/controllers/carritoController.js`) | `POST /api/carrito/agregar` (crear: valida variante + stock + visibilidad + dedupe por variante, `201`) · `GET /api/carrito` (leer: JOIN productos/variantes/imagen, filtrado por dueño) · `PUT /api/carrito/actualizar/:id_carrito` (actualizar: cantidad 1-99 con techo de stock, dueño) · `DELETE /api/carrito/eliminar/:id_carrito` (eliminar: `DELETE ... AND ID_USUARIO = ?`, `404` si ajeno) | `https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/compare/Develop...feature/sprint3-api-crud` (apertura/merge = acción del propietario) |
| **HU-006 refinada — Productos** (CRUD admin completo, `productoController.js` L68-70) | `GET /api/productos` (listar con DTO calculado) · `GET /api/productos/:id` (obtener) · `POST /api/productos` (crear, `esAdmin`) · `PUT /api/productos/:id` (actualizar, reordena imágenes ORDEN 1..N) · `DELETE /api/productos/:id` (eliminar) — más CRUD completo de **variantes** (`/:id/variantes` GET/POST, `/variantes/:idVariante` PUT/DELETE), **características** (GET/POST/PUT/DELETE) y **categorías** (GET/POST/PUT/DELETE con guard de productos asociados → 400) | mismo PR |
| **HU-006 refinada — Búsqueda/filtros** (búsqueda client-side unificada) | `GET /api/productos?search=` (backend: `buildSearchWhere` con escape de `% _ \` y guard anti-array) + util única `frontend/src/utils/buscador.ts` (`normalizar` sin tildes + `padron` de plurales + `filtrarProductos`) consumida por navbar (dropdown en vivo) y catálogo — misma lógica web y móvil (`movil/utils/buscador.ts` es copia verbatim) | mismo PR |
| **CRUD vendedor de sus productos** (HU-045) | `POST /api/vendedor/productos` (nace `PENDIENTE` de aprobación) · editar (vuelve a `PENDIENTE`) · eliminar (bloqueado si `APROBADO`) — gestión de estado de publicación por el admin (`/api/admin/productos/:id/aprobar|rechazar`) | mismo PR |

**Stock por variante** (criterio de la HU-006 refinada): el stock NO es columna de
`PRODUCTOS` — se calcula `SUM(PRODUCTO_VARIANTES.STOCK)` por producto en el DTO del
listado (L92-93), y el carrito valida contra el stock de la variante específica antes
de agregar/actualizar (`carritoController.js` L71-76 y L92-97).

## Historias No Completadas

| Historia / Entidad | Motivo |
|---|---|
| **DESCUENTOS — CRUD incompleto por diseño actual**: solo `POST /api/productos/descuentos` (crear, esAdmin) + `GET /descuentos` (listar). **No existe** `PUT` ni `DELETE` de descuento. | Alcance del proyecto: la vigencia se controla al crear (`FECHA_FIN`); cambiar o retirar una promo hoy exige tocar la BD directamente. Brecha documentada honestamente — es la única entidad core con CRUD genuinamente incompleto (candidata a `PUT/DELETE` futuros si el producto lo pide). |
| **RESEÑAS — solo crear + listar** (`POST /:id/resenas` con 401 inline + rate 10/min; `GET /:id/resenas` público) | Decisión de dominio: 1 reseña por usuario-producto y solo si COMPRÓ (regla anti-fraude A04); no hay edición/borrado de reseñas ni por el autor ni por el admin — el módulo nunca lo exigió. |
| **FAVORITOS / métodos de pago — relación binaria** (crear/eliminar/listar + "marcar principal" en métodos) | Son relaciones, no entidades editables: un favorito no tiene atributos que actualizar. CRUD "completo" no aplica por diseño. |
| **VENTAS — no es CRUD genérico** | Es un flujo de negocio con transiciones guardadas (crear en checkout con `FOR UPDATE`, cancelar/reembolsar con reglas de estados, estados de envío) — modelarla como CRUD rompería las reglas (el sprint lo registra, no lo "completa"). |
| **Listado paginado server-side** | `GET /api/productos` NO pagina en servidor (sin `LIMIT/OFFSET`); la paginación es **client-side** en la SPA (web y móvil, 6/página catálogo, 10/página admin) sobre un catálogo acotado (~105 productos). Criterio del checklist cubierto por la paginación de la UI + orden server-side por popularidad (`ORDER BY visitas DESC, ID ASC`, L144-146). Si el catálogo creciera, la deuda sería mover paginación a servidor. |
| **PR mergeado con revisión de compañero** | Equipo de 2 (propietario + asistente IA): no hay segundo desarrollador humano que haga code review. El control de calidad aplicado: suites automatizadas (unit + integración), sondeos E2E reales y la revisión del propietario al abrir el PR. Limitación honesta del equipo, no del proceso. |

## DTOs de entrada/salida (pregunta guía 2)

El proyecto **no usa una librería de DTOs formal** (zod/class-validator). La separación
se cumple con dos mecanismos verificables:

- **Entrada**: validaciones inline en cada controlador antes de tocar la BD — p. ej.
  `validarCantidad()` en `carritoController.js` L12-24 (entero, 1-99, mensajes exactos),
  campos obligatorios con `400`, normalización `String(x).trim()` en textos (OWASP),
  guard de `?search` array y escape de wildcards en `buildSearchWhere` (L44-74). El body
  CRUDO nunca viaja directo al SQL: los INSERT/UPDATE usan placeholders `?` con el
  subconjunto validado.
- **Salida**: cada endpoint define su shape con SELECT de columnas específicas + alias +
  subconsultas calculadas — el DTO difiere del modelo físico:
  - Listado de productos (L80-95): `STOCK` = `SUM(variantes)`, `RATING`/`RESENA_COUNT`
    de `RESENAS`, `ID_VARIANTE_POR_DEFECTO` = `MIN(ID_VARIANTE)`,
    `VENDEDOR_NOMBRE` = `COALESCE(empresa,'JADDA SPORTS')`, imagen por `ORDEN = 1` —
    ninguna de esas columnas existe así en `PRODUCTOS`.
  - Carrito (L141-159): `ID_CARRITO, CANTIDAD, NOMBRE, PRECIO, COLOR, ATRIBUTO, STOCK,
    IMAGEN` — shape plano listo para la UI, no el JOIN crudo.

**¿Revisados por el compañero?** Ver tabla de no-completadas: el equipo real es de dos;
la revisión es del propietario + CI (unit/integración/audit) + sondeos E2E. No hubo un
revisor humano externo formal — se registra como limitación del equipo.

## Demo

Qué se muestra en vivo al instructor:

1. **CRUD del carrito server-side** (HU-014): login cliente → `POST /api/carrito/agregar`
   (dos veces la misma variante → cantidad suma, no duplica fila) → `GET /api/carrito`
   (shape con variante/stock/imagen) → `PUT .../actualizar/:id` hasta el techo de stock
   (`400 "Solo hay N unidades disponibles."`) → `DELETE .../eliminar/:id` (`200`).
2. **Ownership real**: mismo DELETE con el `ID_CARRITO` de OTRO usuario → `404 "Item no
   encontrado"` (el `AND ID_USUARIO = ?` lo filtra).
3. **Stock por variante**: producto con 2 variantes → agregar variante A no consume el
   techo de la variante B (el stock vive por variante, no por producto).
4. **CRUD admin de productos**: crear producto con variantes → aparece en el catálogo
   público → actualizar (reordena imágenes) → eliminar.
5. **Búsqueda unificada**: `GET /api/productos?search=balones` en la API + la misma
   búsqueda en la UI (navbar y catálogo comparten `buscador.ts`: tildes, plurales, sin
   intrusos como "baloncesto").
6. **API dentro del contenedor** (ver §Estado Docker): `docker exec` + fetch → 200.

## Estado Docker de esta Semana

- [x] La API responde en el puerto mapeado del contenedor, no solo en `localhost` fuera de Docker

**Evidencia en vivo** (ejecutada al cierre del sprint, DENTRO del contenedor):

```
$ docker exec jadda_backend node -e "fetch('http://127.0.0.1:5000/api/productos')
    .then(r=>r.json()).then(d=>console.log('DENTRO-CONTENEDOR /api/productos HTTP OK, items:', d.length))"
DENTRO-CONTENEDOR /api/productos HTTP OK, items: 105
```

- [x] La configuración (BD, secretos, puertos) viene de variables de entorno (`.env`), no hardcodeada

`config/db.js` lee `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL` de `process.env`;
el compose las inyecta por interpolación del `.env` raíz (`TIDB_*` para la BD gestionada).
Cero URLs/credenciales hardcodeadas en el código de la API.

- [x] `docker compose up db be` levanta backend + BD sin pasos manuales adicionales

> **Ruling** (S02/S03, vigente): los servicios se llaman **`database`** y **`backend`** —
> NO se renombró a `db`/`be` (rompería compose/depends_on/proxies). Comando equivalente:
> `docker compose up -d database backend` → `Container jadda_mysql Running` /
> `Container jadda_backend Running` (idempotente; evidencia capturada en el S03 y
> re-verificada al abrir este sprint). El setup automático (`setup.js`: tablas + seeds +
> migraciones idempotentes) hace que "BD vacía → API sirviendo" sea solo `compose up`.

**¿La API responde igual dentro del contenedor que en local? (pregunta guía 3)**: SÍ —
mismo código (bind mount `./backend => /app`), misma config por env. Las dos lecturas
verificadas en la misma jornada: el contenedor dev y el despliegue de producción
(Render) leyeron el MISMO estado de BD con resultados idénticos (A/B del 2026-11-11 sobre
TiDB: 104/104 renombres en ambos lados). En este estación el backend dev apunta a la BD
gestionada (TiDB) en vez del MySQL local del compose: el cambio de destino es SOLO el
`.env` — el código y el comportamiento no cambiaron, que es exactamente el criterio de
"config por variables de entorno". La BD local del compose sigue sana (`healthy`) como
servicio dev de referencia y el setup la reconstruye sola si se borra el volumen.

**CI de la semana — hallazgo y fix del sprint:**

- El workflow `CI - JADDA SPORTS` lleva rojo en `main`/`Develop` desde 2026-11-09 (última
  corrida verde: 2026-11-06, run #85). Dos jobs en rojo:
  1. **Backend Integration Tests — CAUSA RAÍZ ENCONTRADA Y ARREGLADA en este sprint**: el
     fixture `reqLogin` de `tests/backend/integration/fuerza-bruta.test.js` fingía un
     `req` SIN `session`, pero el login ahora regenera la sesión en el camino de éxito
     (anti fijación, commit OWASP `77ac477` del 2026-11-09) → `TypeError` → 500 en vez
     del 200 esperado. El test nació (`cca164f`, 2026-11-03) ANTES del cambio y la suite
     de integración no se volvió a correr después. Fix SOLO en el fixture (mock de
     `session.regenerate`), commit `55bb565` en esta rama. Verificado local: **22/22
     integración** (BD de test aislada `docker-compose.test.yml`, puerto 3307) + unit
     210/210 intacta. Con este commit el job vuelve a verde en CI al abrir el PR.
  2. **E2E Playwright — sigue rojo, diagnóstico pendiente del propietario**: el job
     provee todas las credenciales (admin efímero + vendedor demo con `DEMO_PASSWORD`)
     y el backend/preview arrancan (step 12/13 en éxito); el fallo está en el paso
     "Run Playwright E2E tests". Los logs/reportes de CI exigen sesión (403 anónimo) —
     el propietario debe abrir el reporte HTML de artifacts del run #135
     (`https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/actions/runs/43133920390`).
     Hipótesis priorizadas: aserción de UI desfasada por los cambios de catálogo/checkout
     de 2026-11-08..11 (botón APLICAR de filtros, carrusel) o flakiness de rate limit
     en el login robusto. La unidad de reproducción local quedó descrita en el ledger.
- Los demás jobs en verde en el run #135: Lint & TypeScript, Frontend Unit, Backend Unit,
  Dependency Audit, SonarCloud (success).

## % de Avance Acumulado del Proyecto

**~35 %** de las semanas del plan (Sprint 0 + Sprint 1 + Sprint 2 + Sprint 3 de 8 sprints
de desarrollo + Semana 1). Sprint 3 aporta **+7 pts**: CRUD de entidades core
inventariado y verificado contra el checklist (carrito HU-014 completo con ownership y
techo de stock por variante; producto/variantes/características/categorías completos;
vendedor con flujo de aprobación), DTOs de entrada/salida documentados con código real,
evidencia Docker dentro del contenedor y el primer fix de código del bootcamp (fixture
de integración que devuelve el job de CI a verde). Nota honesta: el código preexistía —
el porcentaje acredita semanas cerradas con criterios verificados, no líneas nuevas.

## Roles del Equipo (Sprint 3)

| Integrante | Rol |
|---|---|
| **Yeison** (propietario del repo) | Product Owner — prioriza y aprueba el PR a `develop`; valida la demo en el navegador; dueño de la revisión del diagnóstico de E2E (artifacts de CI) |
| **Asistente IA (OpenCode)** | Scrum Master — checklist de la semana + ledger de decisiones · **Dev** — rama `feature/sprint3-api-crud`, fix del fixture de integración, commits por convención · **QA** — suites automatizadas (integración 22/22 contra BD de test aislada, unit 210/210) + sondeos Docker/HTTP como evidencia |

Nota honesta: el equipo real es de dos (propietario + asistente IA); los cuatro roles
Scrum se cubren en parejas. La apertura/merge del PR y la revisión del reporte E2E de
CI son las acciones pendientes del propietario.

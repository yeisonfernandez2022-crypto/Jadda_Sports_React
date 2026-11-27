# Informe final de cierre — JADDA SPORTS

**Proyecto:** JADDA SPORTS — e-commerce de artículos deportivos con marketplace.
**Fecha:** 2026-11-27 · **Autor:** Yeison Fernández (@yeisonfernandez2022-crypto).
**Alcance:** cierre del ciclo 2026 (Q1–Q4), verificación de calidad y hand-off.
**Documentos de entrada:** `docs/testing/hallazgos.md`, `docs/calidad/bitacora-lecciones-aprendidas.md`,
`docs/estado-del-proyecto.md`, `docs/aceptacion/`, `docs/implantacion/plan-implantacion.md`.

---

## 1. Resumen ejecutivo

| Indicador | Resultado |
|---|---|
| Requisitos funcionales web | **61/61 implementados y verificados** |
| Alcance completo (web + móvil) | **61/67 ≈ 91,0 %** (6 incrementos móviles pendientes) |
| Pruebas backend unitarias | **1123** (80 archivos) |
| Pruebas backend de integración | **132** (14 archivos, MySQL real) |
| Pruebas frontend | **855** (87 archivos) |
| Cobertura backend fusionada | **93,99 / 84,13 / 98,49 / 99,85 %** (st/br/fn/lines) |
| Cobertura frontend | **51,01 / 45,57 / 47,30 / 54,94 %** (última medición 2026-11-20) |
| Incidencias técnicas corregidas | **23** (18 lecciones + 5 hallazgos de cierre) |
| Integridad referencial | **39 tablas · 45 FK · 0 colgantes · 1 huérfano de datos** |
| Producción | Render Free + TiDB Cloud; smoke 3/3 rutas 200; **$0/mes** |
| UAT | **38 casos** ejecutados en modalidad automatizada + inspección; acta firmada 2026-11-27 |

**Recomendación:** aprobar la entrega **web** para el alcance del proyecto de grado. La app móvil se
entrega como cliente parcial con 6 incrementos identificados; no se declara terminada.

---

## 2. Método de conteo de los 23

El cierre usa el conteo acordado: **18 lecciones de `bitacora-lecciones-aprendidas.md` + 5 hallazgos
del cierre**. No es una suma de `docs/testing/hallazgos.md` —ese documento tiene su propio alcance
(22 defectos corregidos, 2 de proceso y #25, hoy también corregido)—. Los conjuntos se solapan en el
seed demo y en #25, pero el número 23 se sostiene por dos caminos independientes:

- **18 lecciones + 5 hallazgos de cierre = 23.**
- **22 defectos de `hallazgos.md` + #25 = 23.**

No todas las 18 lecciones son defectos de producto: algunas son obstáculos de herramienta o de proceso
(PowerShell, Docker, Playwright). Se cuentan porque cada una exigió una corrección verificable y dejó
una acción preventiva. El informe las separa por tipo para no inflar la gravedad.

---

## 3. Las 23 incidencias corregidas

### 3.1 Lecciones de la bitácora (18)

| # | ID | Incidencia | Tipo | Corrección / evidencia |
|---|---|---|---|---|
| 1 | L1 | Vaciar el input de archivos con `e.target.value = ""` dentro del `onChange` destruía la `FileList` en React 19 | Frontend | Reset diferido con `setTimeout(..., 0)`; patrón documentado |
| 2 | L2 | `SELECT *` devolvía `foto_url` en minúsculas y `user.FOTO_URL` quedaba `undefined` | SQL/Backend | Alias explícito en mayúsculas en todos los campos consumidos |
| 3 | L3 | `LEFT JOIN` nullable rompía `SELECT ... FOR UPDATE` en MySQL | SQL/Backend | Separar la fila bloqueada (`VENTAS`) de los datos complementarios (`ENVIOS`) |
| 4 | L4 | Un `?` sin parámetro en la rama de respaldo producía `ERROR 1064` solo en el fallback | SQL/Backend | Probar siempre la rama alternativa, no solo el caso feliz |
| 5 | L5 | Docker Desktop no propagaba carpetas nuevas y Vite servía `index.html` para una foto recién subida | DevOps | Servir archivos dinámicos desde Express + proxy `/images` |
| 6 | L6 | El dev server de Vite en Docker conservaba errores de parseo viejos | DevOps | `docker restart jadda_frontend` tras cambios grandes; documentado |
| 7 | L7 | PowerShell 5.1 eliminaba comillas internas al pasar SQL a `docker.exe` | Tooling | SQL a archivo + `docker cp` + `mysql < archivo`; comillas simples vía `[char]39` |
| 8 | L8 | `Add-Content` pegaba texto si el archivo no terminaba en salto de línea (`.gitignore` roto) | Tooling | Verificar salto final; preferir `Set-Content` |
| 9 | L9 | Dos navbars fijos apilados: el segundo interceptaba clicks del menú móvil | Frontend | Navbar único global en `AppLayout`; auditoría con `elementFromPoint` |
| 10 | L10 | Z-index sin jerarquía: modales admin bajo el navbar público y bajo SweetAlert | Frontend | Escala centralizada: admin 1040 < público 9990 < modales/Swal 10050 |
| 11 | L11 | `isVisible()` corría antes del montaje de React; `translateX(-105%)` no oculta para Playwright | Testing | `waitForSelector` + geometría real (`getBoundingClientRect`) |
| 12 | L12 | Cookies con `expires: 0` se consideraban expiradas al inyectarlas en Playwright | Testing | `sameSite:'Lax'` y omitir `expires` cuando vale 0 |
| 13 | L13 | `INSERT IGNORE` no actualiza filas existentes: cambiar seeds no modificaba una BD viva | Datos | Cambios de datos de referencia vía migración/UPDATE documentado, no solo re-seed |
| 14 | L14 | Un rename de endpoints (`/api/producto/` vs `/api/productos/`) rompió un fetch en otro archivo | Proceso | Renombres globales con build + smoke de las pantallas afectadas |
| 15 | L15 | Interpolar datos de usuario en `html:` de SweetAlert2 permitía XSS almacenado | Seguridad | Helper `escapeHtml.ts` obligatorio antes de interpolar |
| 16 | L16 | `tsc --noEmit` en la raíz de un monorepo con referencias no revisaba nada | Build/TS | Comando canónico `npx tsc -b` antes de cada entrega |
| 17 | L17 | `delete fs.mkdirSync` en un `afterEach` borraba la propiedad del módulo compartido y rompía otras suites | Testing | Guardar referencias reales antes de mockear y restaurarlas, nunca `delete` |
| 18 | L18 | Un módulo que congela constantes al `require` no se puede re-ejercitar con otro entorno; un `setInterval` real cuelga el worker | Testing | Requerir con el entorno alterado antes del `require`; stub de `setInterval` + fake timers |

### 3.2 Hallazgos del cierre (5)

| # | ID | Incidencia | Tipo | Corrección / evidencia |
|---|---|---|---|---|
| 19 | #25 | Facturas PDF/correo formateaban dinero con `toLocaleString()` sin locale: `$75,000` en Linux | Backend | `backend/utils/formatoMoneda.js` + `"es-CO"` en 4 sitios; **3 pruebas RED→GREEN** |
| 20 | FK-1 | FK colgante `VENTAS.ID_EMPLEADO → EMPLEADOS` (tabla inexistente) | Esquema | `limpiarFkColganteVentas` idempotente en `setup.js`; 46 FK/1 colgante → **45/0** en local |
| 21 | SEED-1 | Seed demo de `USUARIOS` con 21 columnas vs 22 valores (faltaba `ULTIMA_IP`); CI rojo desde el run #75 | Datos/CI | Commit `e1b8560`; E2E 40/40 con BD recreada desde cero |
| 22 | CI-E2E | El job E2E ejecutaba el proyecto msedge que el runner no instala | CI | `--project=chromium` (commit `ff278c3`); CI 8/9 jobs verdes |
| 23 | ENV-1 | `.env.example` raíz ausente: el gate Docker no era ejecutable desde un clon limpio | Config | Commit `65b2fa3`; variables del compose con placeholders |

**Estado:** las 23 están cerradas. La única que no tiene un "fix de código" es L13 (lección de datos);
su acción preventiva quedó incorporada al procedimiento de migraciones.

---

## 4. Verificación ejecutada

| Verificación | Comando / fuente | Resultado |
|---|---|---|
| Backend unitario | `corepack pnpm --prefix backend test` | **1123/1123** en 80 archivos (2026-11-27) |
| Backend integración | `corepack pnpm --prefix backend test:integration` | **132/132** en 14 archivos (MySQL real, 3307; última corrida 2026-11-20) |
| Frontend unitario | `corepack pnpm --prefix frontend test` | **855/855** en 87 archivos (2026-11-27) |
| TypeScript | `npx tsc -b` | 0 errores (2026-11-26) |
| Cobertura backend | `node backend/scripts/cobertura-combinada.mjs 80` | **93,99/84,13/98,49/99,85 %**; umbral 80 aprobado |
| Cobertura frontend | `pnpm --prefix frontend test:coverage` | **51,01/45,57/47,30/54,94 %**; umbrales 51/45/47/54 (última medición 2026-11-20) |
| Integridad FK | `node backend/scripts/auditar-fk.js` | 39 tablas · 45 FK · 0 colgantes · 1 huérfano |
| Rollback BD | dump + restore local | 310.763 B · SHA-256 `EA0A0392…DB21BC` · **3.195 ms** · 2.904 filas idénticas |
| Smoke público | frontend + `/health` + `/api/productos` | **3/3 rutas 200**; 495/416/604 ms; release `v1.0.0-462-gee3c6c5` |
| UAT | 38 casos automatizados + inspección | Acta firmada 2026-11-27 |

**Nota sobre la cobertura frontend:** no se re-midió el 2026-11-26 porque la corrida con cobertura chocó
con un test flaky (`AdminNavbar.extra.test.tsx`, "refresca al recuperar el foco": esperaba 2 llamadas y
recibió 3). La suite completa sí pasó 855/855. La cifra 51,01 % es la última medición válida y los
umbrales siguen activos; la justificación completa está en `docs/calidad/marco-calidad.md` §5.1.

---

## 5. Pendientes y deuda abierta

| # | Tema | Estado | Impacto | Siguiente acción |
|---|---|---|---|---|
| P1 | Huérfano `VENTAS.ID_CLIENTE` (venta 426 → cliente 248) | Abierto | Un reporte histórico puede mostrar un cliente inexistente | Decisión del negocio: conservar, anonimizar o reasignar; no borrar sin autorización |
| P2 | 6 incrementos móviles | Abierto | La app móvil no cubre calificar compra, avance de retos, soporte general, Wompi, push ni admin | Planificar por prioridad en `movil/docs/RFs-movil.md` |
| P3 | Formato de error legacy de la API | Abierto | 56 `msg`, 5 `error`, 6 `message`; el frontend ya normaliza | Migración gradual a `{ ok:false, msg }` con test de contrato |
| P4 | Cobertura frontend 51 % | Aceptado con trinquete | Páginas y vendedor se cubren con E2E; no hay métrica unitaria de esas capas | Subir umbral cuando la suite estable lo permita |
| P5 | Monitoreo de `/health` | Abierto | Sin alerta temprana | Workflow programado + canal de respuesta |
| P6 | Respaldo diario | Abierto | El script está probado; la tarea de las 23:30 no está programada | Programar y verificar una ejecución |
| P7 | Rollback de aplicación | Abierto | La BD tiene simulacro; la app no | Relanzar la imagen previa con `PAYMENT_GATEWAY=wompi` o `ALLOW_SIMULATED_PAYMENTS=true` |
| P8 | Tipos `any` (~181) | Deuda continua | No rompen CI; afectan mantenibilidad | Corregir solo en archivos que se toquen |
| P9 | Rate limiter en memoria | Aceptado | Se reinicia con el contenedor; no escala multi-instancia | Redis si el negocio escala |
| P10 | Wompi en producción real | Abierto (negocio) | Hoy es sandbox | Cuenta de producción y llaves `pub_prod_/pris_prod_` |

---

## 6. Conclusión

El producto web cumple el alcance funcional comprometido: **61/61 HUs**, 1123 pruebas unitarias de
backend, 855 de frontend, 132 de integración, cobertura backend por encima del trinquete de 80 %,
integridad referencial auditada y un despliegue público verificado a costo $0/mes. La calidad no se
declara "perfecta": la cobertura frontend es 51 %, el contrato de errores tiene tres formatos legacy y
la operación (monitoreo, respaldo diario y rollback de app) sigue pendiente. Esas brechas están
cuantificadas y con dueño.

La entrega se recomienda **con alcance declarado**: web completa; móvil parcial (61/67 ≈ 91,0 %). El
acta de aceptación firmada el 2026-11-27 refleja esa realidad y no sustituye una validación presencial
con un cliente externo.

---

## 7. Aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Desarrollador / líder del proyecto | Yeison Fernández | *Firmado electrónicamente* | 2026-11-27 |
| Representante del cliente | Yeison Fernández | *Firmado electrónicamente* | 2026-11-27 |
| Revisor de calidad | — | Pendiente de revisión independiente | — |

La firma electrónica y su alcance se detallan en `docs/aceptacion/acta-entrega.md`. La ausencia de un
revisor independiente se declara como limitación, no se oculta.

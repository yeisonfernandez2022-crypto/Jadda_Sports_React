# Retrospectiva de los 4 trimestres — JADDA SPORTS (2026)

> **Proyecto:** JADDA SPORTS — e-commerce de artículos deportivos con marketplace de vendedores.
> **Periodo:** 2026-03-23 (primer commit) a 2026-11-27 (cierre documental).
> **Autor:** Yeison Fernández (@yeisonfernandez2022-crypto), líder único del proyecto.
> **Propósito:** consolidar en una sola línea de tiempo lo construido, lo aprendido y lo que queda,
> sin inflar cifras ni presentar como terminado lo que sigue parcial.

## 1. Cómo leer este documento

El proyecto no tuvo cuatro años: tuvo **cuatro trimestres calendario de 2026**. El corte de cada
trimestre es el siguiente:

| Trimestre | Periodo | Commits en el historial vigente | Carácter |
|---|---|---:|---|
| **Q1** | 23–31 de marzo | 3 | Fundación del repositorio y primera versión del catálogo |
| **Q2** | abril–junio | 17 | Expansión funcional, Docker y primer cliente móvil |
| **Q3** | julio–septiembre | 28 | Consolidación del alcance web y sustentación |
| **Q4** | octubre–27 de noviembre | 563 | Profesionalización: pruebas, seguridad, producción y cierre |

**Advertencia de método:** en Q1–Q3 el historial tiene pocos commits porque el trabajo se agrupó en
entregas grandes; un commit de esos trimestres puede contener decenas de archivos. Por eso las cifras
de pruebas y cobertura solo existen desde Q4: **antes no había una suite medible**. No se inventan
métricas retroactivas; se citan hitos verificables (commits, documentos y fechas).

Los números de commits corresponden al historial vigente al 2026-11-27 (611 commits), después de la
purga de medios del 2026-10-22 y de la corrección de contribuyentes del 2026-11-25.

---

## 2. Resumen ejecutivo de los cuatro trimestres

| Indicador | Q1 | Q2 | Q3 | Q4 (cierre) |
|---|---:|---:|---:|---:|
| Commits | 3 | 17 | 28 | 563 |
| Requisitos funcionales documentados | En formación | En formación | **61** (RF-001…061) | **61** |
| Historias de usuario documentadas | — | — | **61** | **61** |
| Tablas en la base de datos | — | — | 36–38 | **39** |
| Pruebas backend unitarias | No había suite | No había suite | No había suite | **1123** (80 archivos) |
| Pruebas backend de integración | — | — | — | **132** (14 archivos) |
| Pruebas frontend | — | — | — | **855** (87 archivos) |
| Cobertura backend fusionada | — | — | — | **93,99 / 84,13 / 98,49 / 99,85 %** |
| Cobertura frontend | — | — | — | **51,01 / 45,57 / 47,30 / 54,94 %** |
| Despliegue | Local | Docker local | Docker local | **Render Free + TiDB Cloud** |
| Costo mensual de infraestructura | $0 | $0 | $0 | **$0** |

**Resultado de alcance:** 61/61 HUs web implementadas y verificadas; 6 incrementos móviles pendientes
sobre 67 unidades de alcance total (61 web + 6 móviles) = **61/67 ≈ 91,0 %**. La meta ≥90 % se cumple,
pero el producto **no** está 100 % terminado: la web sí; el cliente móvil es parcial por decisión de
alcance y depende de trabajo pendiente (ver §9).

---

## 3. Q1 2026 — Fundación (23–31 de marzo)

**Contexto.** El proyecto arranca como una aplicación de catálogo deportivo. El primer commit
(`10e8776`, 2026-03-23) abre el repositorio; los otros dos commits del trimestre corrigen variables
de entorno y mejoran la presentación del catálogo.

**Qué se construyó**

- Estructura inicial del repositorio y del catálogo de productos.
- Separación incipiente de configuración por variables de entorno (el primer defecto registrado en la
  bitácora es de esta época: interpolar datos de usuario en `html:` de SweetAlert2 permitía XSS
  almacenado; se corrigió con el helper `escapeHtml`).
- Primeras pantallas de tienda y navegación.

**Qué salió bien.** La idea de producto quedó clara desde el inicio: catálogo, carrito y compra.
**Qué salió mal.** El primer commit llegó tarde respecto al trabajo real y el proyecto nació sin una
estrategia de pruebas ni de despliegue. **Lección:** versionar desde el primer día y no confundir
"funciona en mi máquina" con "está listo".

---

## 4. Q2 2026 — Expansión (abril–junio)

**Contexto.** Es el trimestre de mayor crecimiento funcional antes de la profesionalización. Se
suman seguridad de tokens, más catálogo, documentación, Docker y el cliente móvil.

**Hitos verificables**

| Fecha | Commit | Hito |
|---|---|---|
| 2026-04-09 | `5f9bdc9` | Seguridad de registro/recuperación con token y vencimiento |
| 2026-05-02 | `afd83ed` | Nuevos productos y ajustes de estilos del catálogo |
| 2026-05-20 | `2337f4d` | README con la descripción del proyecto |
| 2026-05-28 | `0bb7426` / `137f683` | **Docker** entra al proyecto (primer `docker compose`) |
| 2026-06-03 | `addee9c` / `ac409a3` | **App móvil** con login funcional (Expo) |
| 2026-06-22 | `bf50619` | Controladores backend, autenticación móvil, documentación y pulido de UX |
| 2026-06-29 | `146d5ff` | Mejoras para la sustentación |

**Qué se construyó.** Autenticación con tokens de expiración, catálogo ampliado, Docker para los tres
servicios, app móvil con login y una primera pasada de documentación. Al cierre del trimestre el
sistema ya se parecía al producto actual: web + API + móvil + base de datos.

**Qué salió bien.** La velocidad de expansión y la decisión de compartir la misma API entre web y
móvil, que evitó duplicar reglas de negocio. **Qué salió mal.** Docker llegó después de la app y la
app móvil nació sin suite de pruebas; ambos defectos se pagarían en Q3 y Q4 (deriva de entornos,
`INSERT IGNORE` que no actualiza seeds, dependencias de sistema operativo). **Lección:** containerizar
temprano y no añadir un cliente nuevo sin un mínimo de pruebas de contrato.

---

## 5. Q3 2026 — Consolidación funcional (julio–septiembre)

**Contexto.** El proyecto entra en la fase de "cerrar el alcance": se completan módulos, se audita la
documentación contra el código y se prepara la sustentación.

**Hitos verificables**

| Fecha | Commit | Hito |
|---|---|---|
| 2026-08-13 | `02e89ab` | Cierre del alcance web ("100 web falta front") |
| 2026-08-24 | — | Evaluación de calidad ISO/IEC 25010 y de los 17 RNF con mediciones reales |
| 2026-08-27 | `e24cb74` / `800d7b2` | Deduplicación de variantes + índice único `uq_variante_producto`; traducción de productos |
| 2026-08-28 | `fdae9c4` | **RF-056…061, HU-056…061 y RNF-016…017**: se documentan los 6 huecos detectados (vendedores, admin de usuarios, productos de vendedor, envío, PQR, auditoría/idempotencia) |
| 2026-08-28 | `83e2b4f` | Dashboard de administración |
| 2026-08-31 | `5347385` | Sustentación del proyecto |
| 2026-09-01 | `2ca6152` | Aislamiento del chat admin/vendedor y limpieza de navbar |
| 2026-09-02 | `07f1d5e` | Corrección de Docker |
| 2026-09-09 | `5206a7c` | Rotación de la clave de la base de datos |

**Qué se construyó.** El alcance web completo: catálogo, carrito, checkout, pedidos, devoluciones,
retos, planes, marketplace, panel admin, chat, newsletter y PQR. La auditoría de agosto detectó seis
funcionalidades que existían en el código pero no estaban documentadas; se cerraron como RF/HU 056–061.
También se estabilizó el esquema (39 tablas al final del ciclo) y se corrigió la deduplicación de
variantes.

**Qué salió bien.** La disciplina de auditar código contra documentación y de admitir los huecos: el
proyecto no se declaró completo hasta que los 61 RF estuvieron verificados. **Qué salió mal.** El
crecimiento funcional superó la inversión en pruebas; el seed dependía de `INSERT IGNORE`, que no
actualiza filas existentes, y las variantes duplicadas llegaron a producción. **Lección:** un requisito
sin prueba de aceptación es una promesa, no una verificación; y los seeds deben ser idempotentes de
verdad, no solo "no fallar".

---

## 6. Q4 2026 — Profesionalización y cierre (octubre–27 de noviembre)

**Contexto.** Es el trimestre de la calidad: limpieza, seguridad, pasarela de pagos, despliegue público,
suite de pruebas, cobertura, CI y cierre documental. Concentra 563 de los 611 commits.

### 6.1 Octubre — limpieza, seguridad y pasarela

| Fecha | Hito | Evidencia |
|---|---|---|
| 2026-10-20 | Limpieza integral: archivos muertos, dependencias sin uso, JWT eliminado, CI reescrito | `docs/estado-del-proyecto.md` §6.b |
| 2026-10-22 | Purga de medios del historial con `git filter-repo`: pack 94,56 → 3,77 MiB | `docs/auditoria/purga-media-filter-repo.md` |
| 2026-10-24 | **Wompi sandbox EJECUTADA**: `PENDIENTE_PAGO`, firma `integrity`, webhook con checksum e idempotencia (`PAGOS_EVENTOS`) | `docs/auditoria/pasarela-pagos-plan.md` |
| 2026-10-25 | Reescritura del bloque DEMO: 29 ventas que respaldan 177 reseñas; 0 productos visibles sin reseña | `docs/testing/hallazgos.md` #3 |
| 2026-10-27 | Corrección de la pasarela: firma plana (sin prefijo `integrity:`), estado `pagoDeclinado` separado | `docs/testing/hallazgos.md` #11–12 |

**Qué salió bien.** La pasarela se integró con pruebas reales contra la API sandbox y se documentó el
ciclo completo. **Qué salió mal.** La firma con prefijo y el estado "DECLINADA" que no cancelaba la
venta demostraron que el camino feliz no basta: hicieron falta sondas A/B y logs reales. **Lección:**
probar el camino de error del proveedor antes de decir que la pasarela está integrada.

### 6.2 Noviembre — hardening, pruebas y producción

| Fecha | Hito | Evidencia |
|---|---|---|
| 2026-11-08/09 | Sesiones TLS contra TiDB, `trust proxy`, subidas de 10/25 MB, rate limit por usuario, auditoría OWASP r1/r2 (~24 fixes) | `docs/auditoria/estado-brechas.md`; `docs/testing/hallazgos.md` #7–10 |
| 2026-11-11 | Script seguro `crear-admin.js` con verificación bcrypt; T13 móvil (buscador unificado, carrusel, recomendados) | `movil/AGENTS.md`; `docs/testing/hallazgos.md` #6 |
| 2026-11-12 | **Gate Docker** en clon limpio: 3 contenedores, BD sembrada, `/health` y `/api/productos` 200 | `entregable-s09-cierre-final.md` §1 |
| 2026-11-12 | Fix del seed demo (21 columnas vs 22 valores) y del job E2E msedge; `.env.example` raíz | commits `e1b8560`, `ff278c3`, `65b2fa3` |
| 2026-11-14 | Revisión de los RF móviles contra el código: 6 brechas reales | `movil/docs/RFs-movil.md` |
| 2026-11-15 | Hallazgo 23 (mutante del rate limiter) cerrado con test del default; 25 hallazgos consolidados | `docs/testing/hallazgos.md` |
| 2026-11-17 | Fix #24: `toLocaleString("es-CO")` en 11 sitios del frontend + auditoría de casing de 419 imports | `docs/testing/hallazgos.md` #24 |
| 2026-11-20 | Corte de calidad: 1072 backend / 132 integración / 581 frontend; cobertura 93,99 % y 51,01 % | `docs/estado-del-proyecto.md` §1.1 |
| 2026-11-23/24 | Cobertura frontend ampliada y corrección masiva de issues de SonarCloud | commits `f401aef`…`a5cd968` |
| 2026-11-25/26 | Suite frontend hasta **852 pruebas**; estabilización de esperas; reorganización de manuales | commits `72b7b81`…`ee3c6c5` |
| 2026-11-26/27 | Cierre integral: #25, FK colgante, auditoría de integridad, simulacro de rollback, UAT y este informe | `.superpowers/sdd/cierre-integral-2026-11-26/`; `docs/aceptacion/` |

**Qué salió bien.** La recta final convirtió un proyecto funcional pero frágil en un producto medible:
suite de 1123 pruebas backend y 855 frontend, cobertura fusionada de backend con trinquete 80, CI con
E2E, producción en Render + TiDB Cloud a costo $0 y un simulacro de restauración de base de datos con
tiempo y hash verificables.

**Qué salió mal.** El esfuerzo se concentró al final: la deuda de pruebas y de tipos se pagó en dos
semanas; la cobertura frontend quedó en 51 % porque el denominador incluye todo `src/` y las páginas se
cubren con E2E, no con unitarias; el rollback de la aplicación no se pudo ejecutar porque el contenedor
previo exige `PAYMENT_GATEWAY=wompi` y llaves que no están en el entorno de prueba. **Lección:** la
calidad no se puede "añadir al final" sin pagar intereses; y un rollback que no se ensaya es un
documento, no una capacidad.

---

## 7. Evolución de las métricas

| Métrica | Q1 | Q2 | Q3 | Q4 |
|---|---:|---:|---:|---:|
| Commits | 3 | 17 | 28 | 563 |
| Tablas | — | — | 36–38 | **39** |
| Pruebas backend | — | — | — | **1123 unitarias + 132 integración** |
| Pruebas frontend | — | — | — | **855** |
| Cobertura backend fusionada | — | — | — | **93,99 % statements** |
| Cobertura frontend | — | — | — | **51,01 % statements** |
| Hallazgos de testing corregidos | — | — | — | **23 defectos** (22 de `hallazgos.md` + #25) |
| Despliegue | Local | Docker local | Docker local | **Render Free + TiDB Cloud** |
| Costo | $0 | $0 | $0 | **$0/mes** |

**Lectura honesta:** el 91,0 % no es un promedio de estas métricas; es el cociente entre 61 HUs web
terminadas y 67 unidades de alcance (61 web + 6 incrementos móviles). Las métricas de pruebas y
cobertura son de Q4 y no se extrapolan a los trimestres anteriores.

---

## 8. Qué funcionó, qué no y qué cambiamos

### 8.1 Qué funcionó

1. **Una sola API para web y móvil.** Evitó duplicar reglas de negocio y permitió que el móvil
   reutilizara autenticación, catálogo, carrito y checkout.
2. **Auditar código contra documentación.** En agosto se detectaron seis funcionalidades sin RF/HU;
   documentarlas cerró el alcance real en 61 RF.
3. **Pruebas de integración con MySQL real.** Encontraron problemas que los mocks no ven: locks,
   `FOR UPDATE`, sesiones TLS, seeds.
4. **Desplegar temprano en un PaaS gratuito.** Render + TiDB Cloud obligó a resolver TLS, `trust proxy`,
   cold start y variables de entorno antes del cierre.
5. **Documentar la deuda con evidencia.** Los 25 hallazgos y la bitácora de 18 lecciones evitron que
   los mismos errores se repitieran.

### 8.2 Qué no funcionó

1. **Docker y pruebas llegaron tarde.** Q2 y Q3 crecieron sin una red de seguridad; el precio se pagó
   en Q4 con una deuda de tipos, cobertura y flakiness.
2. **Seeds no idempotentes.** `INSERT IGNORE` ocultó filas desactualizadas y el seed demo con 21
   columnas vs 22 valores dejó el CI rojo desde el run #75.
3. **Formato de moneda sin locale.** `toLocaleString()` sin `"es-CO"` produjo `$75,000` en Linux y
   `$75.000` en Windows; el CI lo destapó en el frontend (#24) y en las facturas (#25).
4. **Rollback no ensayado hasta el final.** El simulacro de base de datos funcionó; el de la aplicación
   no, porque el contenedor previo exige la configuración de Wompi.
5. **Monitoreo y respaldo diario no automatizados.** Quedaron como pendientes operativos de baja
   prioridad, con instrucciones y scripts listos.

### 8.3 Qué cambiamos

- **Regla de locale explícito:** todo dinero se formatea con `toLocaleString("es-CO")`; hay helper
  `backend/utils/formatoMoneda.js` y pruebas.
- **Regla de errores de API:** el contrato canónico es `{ ok: false, msg }`; el frontend normaliza la
  lectura con `frontend/src/utils/mensajeApi.ts` y la deuda legacy se documenta, no se maquilla.
- **Regla de integridad referencial:** `backend/scripts/auditar-fk.js` sale con código 2 si hay FK
  colgantes u huérfanos; `setup.js` limpia la FK legada de forma idempotente.
- **Regla de pruebas:** cada fix relevante entra con una prueba que falla primero (RED→GREEN). El
  hallazgo 23 (mutante del rate limiter) es el ejemplo canónico.
- **Regla de cierre:** ninguna cifra del informe final se acepta sin comando ejecutado o documento
  fechado; lo no ejecutado se declara como pendiente.

---

## 9. Deuda y hand-off

| Tema | Estado al 2026-11-27 | Prioridad | Siguiente acción |
|---|---|---|---|
| 6 incrementos móviles (calificar compra, avance de retos, soporte general, Wompi, push, admin) | Pendiente | Alta | Ver `movil/docs/RFs-movil.md` §Pendientes |
| Cobertura frontend 51 % | Aceptada con umbrales 51/45/47/54 | Media | Subir el trinquete cuando la suite estable lo permita |
| Monitoreo de `/health` y alertas | No configurado | Media | Workflow programado + canal de respuesta |
| Respaldo diario automatizado | Script listo; tarea programada no activada | Media | Programar `scripts/backup.ps1` a las 23:30 y verificar |
| Rollback de aplicación | Simulacro de BD ejecutado; app no | Media | Relanzar el contenedor previo con `PAYMENT_GATEWAY=wompi` o `ALLOW_SIMULATED_PAYMENTS=true` |
| Formato de error legacy (`{error}`/`{message}`) | Deuda documentada | Media | Migración gradual a `{ ok:false, msg }` |
| Rate limiter en memoria | Aceptado para una instancia | Baja | Redis si se escala |
| Wompi en producción real | Sandbox | Alta (negocio) | Cuenta de producción y llaves `pub_prod_/pris_prod_` |

---

## 10. Conclusión

JADDA SPORTS pasó de un catálogo inicial en marzo a una plataforma desplegada, con 61/61 HUs web,
1123 pruebas backend, 855 pruebas frontend, 132 pruebas de integración, 23 defectos corregidos y un
costo de infraestructura de $0/mes. El avance ponderado es **91,0 %** (61/67), no 100 %: la web está
completa; el móvil es parcial y tiene seis incrementos identificados.

La lección más valiosa del ciclo no es un número: es que **un test que no puede fallar no es un test**.
El hallazgo 23 —un mutante `max:10 → max:11` que sobrevivió a toda la suite del rate limiter— obligó a
fijar el default y se convirtió en el estándar de calidad del cierre: cada corrección debe tener una
prueba que primero falle. Esa es la diferencia entre un proyecto que funciona y un proyecto que se puede
mantener.

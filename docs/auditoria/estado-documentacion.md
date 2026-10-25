# Estado de la documentación — JADDA SPORTS

> **Propósito:** informe vivo por documento para que cualquier persona (instalador, revisor o el propio dueño) sepa de un vistazo **qué está vigente, qué se actualizó y cuándo** — sin releer los ~100 archivos de nuevo.
> **Corte:** 2026-10-24 (pasarela Wompi sandbox ejecutada).  **Total:** ~117 archivos en bajo `docs/` (incluye los 2 binarios del usuario).

**Convenios:** ✅ vigente (coincide con el código en `main`) · 🟡 parcial (ajuste menor pendiente) · 🔶 histórico (describe un corte fijo — NO se reescribe a futuro; sirve de bitácora/medición) · ⛔ congelado a decisión del usuario.

---

## 1. Raíz (2)

| Documento | Estado | Nota |
|---|---|---|
| `README.md` | ✅ 2026-10-24 | Índice general: 36 tablas, 68 unitarias, pasarela/purga EJECUTADAS, `Actualización 2026-10-24` |
| `estado-del-proyecto.md` | ✅ 2026-10-24 | Corte 2026-10-24 / `main` `553ce4a`: §3.1 con pasarela Wompi, pendientes tachados, §6.a con los cambios de la pasarela |

## 2. Requisitos

| Doc | Estado | Nota |
|---|---|---|
| `RFs/RF-001..061` | ✅ 2026-10-24 | RF-018 ampliado con el flujo Wompi (chips sin datos de pago, pull 3,5 s + webhook, expiración 48 h); RF-020 correos solo tras confirmación |
| `HUs/HU-001..061` | ✅ 2026-10-24 | HU-018 reescrita (CA-018.1/018.2/018.3) |
| `RNFs/RNF-001..017` | ✅ 2026-10-24 | RNF-006.2 menciona la runa de integración de pasarela; RNF-014 ajustado a 36 tablas |

## 3. Diagramas

| Doc | Estado | Nota |
|---|---|---|
| `diagrams/arquitectura.md` | ✅ 2026-10-24 | Servicio `/api/pagos` en el gateway, subgraph "Pasarela de Pagos (externa)", secuencia de compra con `alt Wompi` + `opt 48 h` |
| `diagrams/base-de-datos.md` | ✅ 2026-10-24 | ERD con `PAGOS_EVENTOS` (36 tablas) |
| `diagrams/diccionario-de-datos.md` | ✅ 2026-10-24 | 36 tablas · 274 columnas · 45 FK reales + 7 lógicas; `VENTAS.REFERENCIA_PAGO` documentada con valores reales |
| `diagrams/flujos.md` | ✅ 2026-10-24 | Compra con rama de pasarela (pendiente → widget → confirmación sondeo/webhook → CONFIRMADA/CANCELADA) |
| `Modelo relacional/` | 🟡 | Imagen de referencia del ERD; aún no refleja la tabla 36 (`PAGOS_EVENTOS`) — regenerar cuando se pida |

## 4. Calidad

| Doc | Estado | Nota |
|---|---|---|
| `calidad/matriz-rotacion.md` | ✅ 2026-10-24 | 68 unitarias BE (con breakdown `pagos.test.js` 11 tests); sus filas para Wompi marcan honestamente la cobertura que falta (sin integración propia de la pasarela) |
| `calidad/estrategia-pruebas.md` | ✅ 2026-10-24 | Pirámide al día; humo legacy solo manual en CI |
| `calidad/evaluacion-iso-25010.md` | ✅ 2026-10-24 | "Integración segura" refleja la pasarela sandbox + idempotencia del webhook |
| `calidad/revision-tecnica-2026-10-20.md` | 🔶 histórico | Revisión puntual; sus hallazgos están en cierre en `estado-brechas` |
| `calidad/informe-evaluacion-rnf.md`, `informe-evaluacion-calidad.md`, `marco-calidad.md`, `plan-mejora-continua.md`, `bitacora-lecciones-aprendidas.md`, `resultados-mediciones.md` | ✅ | Sin cambios requeridos por la pasarela |

## 5. Implantación

| Doc | Estado | Nota |
|---|---|---|
| `implantacion/plan-implantacion.md` | ✅ 2026-10-24 | Respaldo y paso 4 con 36 tablas; la migración medida en S02 conserva sus 35 (congelado, con nota inline) |
| `implantacion/plan-implantacion-template.md` | ✅ | Plantilla genérica (intacta por diseño) |
| `implantacion/01-preparacion-plataforma.md` | ✅ | Sin cambios requeridos por la pasarela |
| `implantacion/02-plan-migracion-respaldos.md` | ✅ 2026-10-24 | Import/paso 1 con 36 tablas; la restauración medida queda en 35 (congelado) |
| `implantacion/03-guia-despliegue.md` | ✅ 2026-10-24 | Env vars `PAYMENT_GATEWAY`/`WOMPI_*` documentadas |
| `implantacion/04-despliegue-produccion.md` | ✅ 2026-10-24 | `.env` producción con llaves de PRODUCCIÓN de Wompi + URL de eventos |
| `implantacion/05-guia-seguridad.md` | ✅ 2026-10-24 | Bullet de webhook firmado (SHA256 timing-safe + idempotencia `PAGOS_EVENTOS`) y llaves UI |

## 6. Manuales

| Doc | Estado | Nota |
|---|---|---|
| `manuales/manual-tecnico.md` | ✅ 2026-10-24 | 36 tablas, sección `### Pagos — /api/pagos`, venta `PENDIENTE_PAGO` |
| `manuales/manual-instalacion.md` | ✅ 2026-10-24 | Configuración de la pasarela (`PAYMENT_GATEWAY` + llaves) |
| `manuales/manual-usuario-final.md` | ✅ 2026-10-24 | Pagar en la pasarela: sin datos devolucional de tarjeta, sondeo 3,5 s / webhook, expiración 48 h |
| `manuales/backend-usuario.md` | ✅ 2026-10-24 | Pasos 8 y 14 del checkout reencaminados; sección nueva `## 🔹 pagosController.js`; tabla `PAGOS_EVENTOS` |

## 7. Aceptación

| Doc | Estado | Nota |
|---|---|---|
| `aceptacion/pruebas-aceptacion.md` | ✅ 2026-10-24 | TP-034 con 36 tablas; **sección I nueva: TP-036/037/038 (sesión Wompi, pago + idempotencia, expiración)** |
| `aceptacion/acta-entrega.md`, `guia-capacitacion.md` | ✅ | Sin cambios (firma pendiente con el cliente — congelado C-7) |

## 8. Auditoría

| Doc | Estado | Nota |
|---|---|---|
| `auditoria/estado-brechas.md` | ✅ 2026-10-24 | F1–F6 (pasarela/purga EJECUTADAS con métricas reales por fase) |
| `auditoria/purga-media-filter-repo.md` | ✅ 2026-10-22 | **EJECUTADA** (pack 94,56 → 3,77 MiB) |
| `auditoria/pasarela-pagos-plan.md` | ✅ 2026-10-24 | **EJECUTADA** en sandbox; §5 con convenciones reales de la API Wompi (tokens planos, firma string, mínimo 150.000 centavos) |
| `auditoria/estado-documentacion.md` | ✅ | Este informe (actualizar tras cada gran cambio) |

## 9. Planeación

| Doc | Estado | Nota |
|---|---|---|
| `planeacion/plan de trabajo.md` | ✅ 2026-10-24 | Fila de pasarela marcada EJECUTADA (sandbox) |
| `planeacion/Restricciones del Proyecto.md` | ✅ | Sin cambios |
| `planeacion/*.xlsx` (2) | ⛔ | Editados por el usuario (2026-10-24); **el asistente NO los toca** |

## 10. Entregables (históricos)

| Doc | Estado | Nota |
|---|---|---|
| `entregables/entregable-s01-ficha-tecnica.md` | 🔶 histórico | Semana 1 (inventario/mediciones de plataformas, congeladas a esa fecha) |
| `entregables/entregable-s02-planes.md` | 🔶 histórico | Migración/respaldo plasmado con 35 tablas y 2.519 filas — la cifra vigente (36) vive en `plan-implantacion`/README |
| `entregables/entregable-s03-hosting-dominio.md` | 🔶 histórico | Caddy + dominio sintético; el despliegue vigente es nginx (`04-despliegue`) |
| `entregables/Informe de diseño JADDA SPORTS.pdf` | ⛔ | Binario del usuario (2026-10-24); NO editable |

---

## 11. Congelados / decisiones del usuario

Lo que depende del dueño (fuera del alcance del asistente):

| # | Tema | Qué falta | Dónde se nota |
|---|---|---|---|
| C-1 | Pasarela producción | Cuenta Wompi real + llaves `pub_prod_/pris_prod_` + URL de eventos en el panel de Wompi | `04-despliegue`, `pasarela-pagos-plan` |
| C-2 | Rotación de credenciales | Cambiar la contraseña del admin tras el primer acceso en prod | `03-guia` |
| C-3 | BD de menor privilegio | Activar `DB_USER=jadda_app` en el `.env` prod | `usuarios-produccion.sql`, `04-despliegue` |
| C-4 | HTTPS público | Certificado de producción (Let's Encrypt o CA en `deploy/certs`) | `04-despliegue`, MC-01 |
| C-5 | Prueba de carga | k6/Artillery (MC-12) + medición del rate limit global en prod | `estado-brechas` ESC-1 |
| C-6 | App móvil | Bandeja de soporte del cliente + notificaciones push (+ validación E2E en dispositivo) | `estado-del-proyecto` §3.2 |
| C-7 | UAT | Ejecutar las pruebas de aceptación con el cliente y firmar el acta | `aceptacion/` |

**Cortes históricos congelados:** entregables S01/S02/S03 y `revision-tecnica-2026-10-20` conservan los números de su época (35 tablas, 57 unitarias) tal como se midieron — el corte vigente SIEMPRE vive en `estado-del-proyecto.md` y `docs/README.md`.

## 12. Próximos pasos sugeridos

1. Ejecutar el UAT (`pruebas-aceptacion.md`) con el cliente y firmar el acta.
2. Regenerar la imagen de `Modelo relacional/` para incluir `PAGOS_EVENTOS`.
3. Al cerrar cualquier ventana futura: actualizar el documento fuente correspondiente + la fila de este informe (estatus + corte).

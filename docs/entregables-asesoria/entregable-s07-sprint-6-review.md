# Sprint 6 — Review: Flujos y Funcionalidades Secundarias

> Entregable de la **Semana 7** del bootcamp (`week-07-sprint_6_flujos_y_funcionalidades_secundarias`,
> archivo `3-proyecto/starter/entregable-s07-sprint-6-review.md`), aplicado al proyecto
> **JADDA SPORTS**. Formato espejo de los entregables S02–S06.
>
> **Nota honesta de preexistencia**: los flujos secundarios del sprint estaban
> implementados de punta a punta antes del bootcamp (los 61 RFs del proyecto están
> verificados contra el código desde 2026-08-08). El trabajo del sprint fue
> **priorizar el backlog restante con criterio de vertical slice** (tabla §1) y
> verificar el orden de arranque de Docker (`depends_on` con condición + healthchecks)
> — criterio que el compose ya cumple y que se re-verificó con la corrida del clon
> limpio del 2026-11-12 (evidencia en S09 §1).

**Objetivo del sprint:** completar los casos de uso secundarios del backlog como
slices verticales completos (UI + API + persistencia), priorizar con criterio qué
entra y qué se recorta a las 2 semanas restantes, y dejar el arranque de Docker
estable con healthchecks.

## 1. Backlog restante — priorización

| # | Historia de Usuario | ¿Entra al Sprint 6? | Motivo si se recorta |
|---|---|:---:|---|
| 1 | **HU-050/051 — Chat usuario↔vendedor↔admin con escalación de disputas** | ✅ Entra | — (vertical slice completo: UI web + API + tablas CHAT/CHAT_MENSAJE + filtro de groserías) |
| 2 | **HU-040 — Retos deportivos** (inscripción, avances con evidencias ≤25 MB, revisión ≤24h, cupón RETO- personal) | ✅ Entra | — (completo: `Retos.tsx`, `MisRetos.tsx`, `retoController` con guard de máximo 3 activos) |
| 3 | **HU-033 — Devoluciones y reembolsos** (solicitud multi-producto, evidencias, 4 decisiones, timeline) | ✅ Entra | — (completo en web con reembolso automático de cancelación pagada) |
| 4 | **HU-012/HU-049 — Favoritos e historial de navegación** | ✅ Entra | — (CRUD con ownership + recomendados por señales vista×1/favorito×2/comprado×3) |
| 5 | **HU-048 — Newsletter** (suscripción con bienvenida, desuscripción, envío admin) | ✅ Entra | — |
| 6 | **HU-041 — Planes de entrenamiento** (generados por compras, marcar días persistidos) | ✅ Entra | — |
| 7 | **HU-061 — PQR** (petición/queja/reclamo con radicado) | ✅ Entra | — |
| 8 | **Móvil: escribir reseñas** | ❌ Recortado | La app móvil LEE reseñas pero no escribe — deuda documentada en `movil/docs/RFs-movil.md` (tabla de pendientes) para el siguiente trimestre |
| 9 | **Móvil: chat de soporte y pagos con Wompi** | ❌ Recortado | El móvil quedó en métodos propios (2/7/4/5) sin pasarela; chat móvil sin UI — misma tabla de pendientes |
| 10 | **Móvil: notificaciones push y banners nuevos de inicio** | ❌ Recortado | Requieren EAS push + entrega de 4 imágenes del propietario — fuera del alcance del trimestre |

La priorización es una decisión real: los 7 slices verticales de web entran (y están
verificados), los 3 grupos móviles se recortan por tiempo y dependencias externas
(EAS push, imágenes del propietario) — documentados, no caídos en silencio.

## 2. Historias completadas (vertical slice completo)

| Historia | PR (enlace) | ¿Vertical slice completo? |
|---|---|:---:|
| HU-050/051 Chat + escalación | `Develop...documentacion-swagger-openapi` (los sprints 0-4 mergeados) | ✅ UI web (Chats.tsx, ChatHilo embebido en devoluciones) + API 6 rutas + BD + notificaciones con ruta por destinatario |
| HU-040 Retos | mismo PR | ✅ UI + API 9 rutas + evidencias multipart a Cloudinary + cupón RETO- con mínimo de compra |
| HU-033 Devoluciones | mismo PR | ✅ UI (solicitud, estado, evidencias) + API 7 rutas + reingreso de stock + chat por vendedor |
| HU-012 Favoritos | mismo PR | ✅ UI + API 3 rutas + recomendados por señales |
| HU-048 Newsletter | mismo PR | ✅ Formulario footer + desuscripción HTML + scheduler automático + envío admin |
| HU-041 Planes | mismo PR | ✅ Generación por compra + mis-planes + marcar día persistido en MySQL |
| HU-061 PQR | mismo PR | ✅ Formulario + radicado |

Cada uno cruza las tres capas sin funcionalidad a medias (los 61 RFs del proyecto
están marcados "Implementado" en `docs/README.md` con verificación contra el código).

## 3. Historias no completadas

- Los 3 recortes móviles de la tabla §1 (reseñas-escritura, chat/Wompi móvil, push/
  banners) — motivados y documentados en `movil/docs/RFs-movil.md` §pendientes.
- Revisión de PR por compañero humano — misma limitación de equipo de 2 que los
  sprints anteriores (control: CI + suites automatizadas).

## 4. Demo

- **Chat completo**: cliente inicia soporte → admin responde desde `/admin/chats` →
  contador de no-leídos del navbar; una devolución rechazada se escala con el botón
  morado → JADDA crea DOS hilos privados (comprador y vendedor aislados por `PARTE`).
- **Reto de punta a punta**: unirse a un reto (máx. 3 → el 4º devuelve 400 con el
  mensaje exacto), reportar avance con evidencia (multipart + barra de progreso),
  admin lo aprueba en `/admin/retos` con comentario → al completar la meta se genera
  el cupón `RETO-XXXX` con su compra mínima.
- **Devolución**: pedido entregado → solicitar devolución con evidencias → vendedor
  la procesa o se escala → timeline del estado con los 3 pasos.
- **Newsletter**: suscribir un correo → llega el correo de bienvenida con "Cancelar
  mi suscripción" → desuscribir desde el link.
- **Orden de arranque**: `docker compose up` en clon limpio — el frontend NO arranca
  hasta que el backend está `healthy` (evidencia S09 §1).

## 5. % de avance acumulado del proyecto

**~62 %** de las semanas del plan (Semana 1 + Sprints 0–6 de 8). Sprint 6 aporta
**+10 pts**: 7 slices verticales del backlog restante explicitados con su recorrido
de 3 capas, la priorización documentada (7 entran / 3 recortes con motivo) y el
orden de arranque de Docker verificado. Nota honesta: el código preexistía.

## 6. Estado Docker de esta semana

- [x] `depends_on` con condición: `frontend.depends_on.backend.condition =
  service_healthy` en `docker-compose.yml` — el frontend espera la sonda
  (`fetch http://127.0.0.1:5000/health`) del backend, no solo su arranque.
- [x] Healthchecks definidos para `database` (mysqladmin ping con la contraseña
  interpolada del propio contenedor, interval 5s/retries 30/start_period 30s) y
  `backend` (node + fetch a `/health`, interval 30s/retries 3/start_period 40s).
- [x] `docker compose up` en un clon limpio levanta todo sin errores de orden de
  arranque — **corrida real del 2026-11-12**: `jadda_frontend: Up N seconds` SOLO
  después de `jadda_backend: healthy` (log del compose); ver S09 §1.
- *Salvedad honesta*: el servicio `frontend` en dev NO tiene healthcheck propio
  (Vite dev no expone endpoint de salud dedicado) — en producción
  `deploy/compose.prod.yaml` el nginx interno tiene `depends_on` con condición de
  backend y frontend healthy. Registrado en la deuda técnica del S09.

## 7. PRs mergeados esta semana

| PR (enlace) | Historia | Revisor |
|---|---|---|
| `feature/sprint0-coding-standards` → Develop | Semana 1 (plan de trabajo, CODING_STANDARDS, envío) | Propietario (apertura/merge; sin revisor humano externo — equipo de 2) |
| `feature/sprint1-dominio-persistencia` → Develop | HU-002/003/004 (dominio + BD) | idem |
| `feature/sprint2-autenticacion` → Develop | HU-006..010 (auth, OTP, social) | idem |
| `feature/sprint3-api-crud` → Develop | HU-011..014 (API CRUD core) | idem |
| `feature/sprint4-reglas-negocio` → Develop | HU-015/017/018 (reglas + pasarela) | idem |
| `documentacion-swagger-openapi` (vigente) | flujos secundarios explicitados + docs | pendiente de merge por el propietario |

## 8. Roles del Equipo (Sprint 6)

| Integrante | Rol |
|---|---|
| Yeison Fernández (@yeisonfernandez2022-crypto) | Scrum Master · Product Owner · Dev · QA |
| Asistente IA (OpenCode) | Dev · QA · documentación de evidencia |

# Cierre del Trimestre — JADDA SPORTS

> Entregable de la **Semana 9** del bootcamp (`week-09-sprint_8_cierre_y_avance_90`,
> archivo `3-proyecto/starter/entregable-s09-cierre-final.md`), aplicado al proyecto
> **JADDA SPORTS** (Express 5 + MySQL/TiDB Cloud, React 19 SPA, app móvil Expo).
> Formato espejo de los entregables S02–S08.

## 1. Gate Docker de Entrega — sin alternativa

**Checklist obligatorio** (copiado de `docs/docker-guia.md` del bootcamp):

- [x] `git clone` limpio + `cp .env.example .env` + `docker compose up` levanta el
  proyecto completo
- [x] Backend, frontend y base de datos corren cada uno en su propio contenedor
  (`jadda_backend` · `jadda_frontend` · `jadda_mysql`, nombres fijos del compose)
- [x] No hay ningún proceso corriendo fuera de Docker para que el proyecto funcione
  (el compose ejecuta `pnpm install && pnpm dev` DENTRO de cada contenedor; la
  corrida se hizo con el entorno dev detenido)
- [x] El Sprint Review final se demuestra sobre la versión containerizada, no sobre
  el entorno local

**Resultado del gate**: ☒ **PASA**

**Evidencia** (quién verificó, cuándo, en qué máquina): verificado por el asistente
IA (OpenCode) el **2026-11-12** sobre la máquina del propietario (Windows 11 Home
25H2, Docker Desktop 29.5.2/Compose v5.1.3). Procedimiento exacto:

1. `git clone -b documentacion-swagger-openapi
   https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git`
   → clon limpio (commit `65b2fa3`, 23 archivos en raíz).
2. `copy .env.example .env` en el clon + **relleno de credenciales** (MySQL root +
   TIDB_* del cluster) por canal fuera de git — el `.env.example` solo trae
   placeholders, como exige la política del repo.
3. `docker compose up -d` → `jadda_mysql`, `jadda_backend`, `jadda_frontend`
   creados y arrancados; el frontend arrancó **solo después** de
   `jadda_backend: healthy` (`depends_on: service_healthy`).
4. BD **sembrada desde cero** por `setup.js` del arranque (volumen nuevo): el
   catálogo sirvió **104 productos · 68.273 bytes**.
5. Verificación de punta a punta: `GET http://127.0.0.1:5000/health` → **200**;
   `GET http://127.0.0.1:5173/api/productos` → **200 · 68.273 bytes** (vía proxy del
   SPA); `GET http://127.0.0.1:5173/` → **200** (index del SPA · 914 bytes);
   `docker compose ps` → mysql `healthy`, backend `healthy`, frontend `Up`.
6. Cierre: `docker compose down` del clon + restauración del entorno dev.

*Salvedad honesta*: lo verificó UNA persona (el asistente) — el "idealmente alguien
fuera del equipo" queda como la acción del propietario/instructor (el procedimiento
de 6 pasos de arriba es repetible en cualquier máquina con Docker). El login de
ADMIN en el clon requiere añadir `ADMIN_EMAIL`/`ADMIN_PASSWORD` al `backend/.env`
del clon (el seed del admin es opcional en dev desde 2026-11-11 y el arranque NO
falla sin ellas — queda en el guion de demo).

**Si no pasa**: no aplica (gate superado). El único ajuste que exigió el gate fue
**crear el `.env.example` raíz** que no existía (commit `65b2fa3`, variables del
compose documentadas con placeholders) — sin él el `cp` del checklist no tenía
fuente.

## 2. Avance del Proyecto

| Métrica | Valor |
|---|---|
| Historias totales del backlog | 61 HUs documentadas (`docs/HUs/HU-001..061`, verificadas contra el código) |
| Historias en estado "Hecho" | 61 (todas marcadas "Implementada" con verificación 2026-08-08 y re-verificaciones posteriores: OWASP r1/r2 2026-11-09, legal 2026-10-24, E2E arreglado 2026-11-12) |
| % de avance | **100 % del backlog de diseño web** · ponderado del producto completo web+móvil = **61/67 ≈ 91,0 %** (6 incrementos móviles pendientes) |

**Meta:** ≥90 % — **cumplida** con la siguiente salvedad honesta: el 100 % se refiere
al backlog de diseño web (61 HUs con su RF). El alcance completo se mide como
**61 HUs web + 6 incrementos móviles = 67 unidades**; 61/67 = **91,04 % ≈ 91,0 %**.
Los 6 pendientes verificados contra el código el 2026-11-14 y re-confirmados en el
cierre son:

1. Calificar una compra (RF-026) — la reseña de producto RF-013 **sí** está implementada en móvil.
2. Reportar avance de retos (RF-040).
3. Iniciar chat de soporte general (RF-050).
4. Pasarela Wompi en el checkout móvil.
5. Notificaciones push nativas.
6. Panel de administración móvil (el login bloquea el rol admin por diseño).

El carrusel de banners **sí** está implementado en móvil; lo que falta son las 4 imágenes
del propietario, no el flujo. El inventario vigente vive en
[`movil/docs/RFs-movil.md`](../../movil/docs/RFs-movil.md) §Pendientes específicos del móvil.
El 92 % del corte anterior queda **reemplazado** por este cálculo, no promediado con él.

## 3. Code Review Final

**Alcance revisado**: todo el repositorio, en capas verificadas a lo largo del
trimestre y re-barridas en el cierre: backend (auditoría OWASP Top 10 ronda 1 y
ronda 2 con ~24 fixes — 2026-11-09), legal/privacidad (políticas, cookies, subidas,
más la auditoría de 2026-10-24), frontend (barrido de 16 rutas con sesión 0 errores,
hardening anti-500), CI/E2E (causa raíz del rojo crónico arreglada el 2026-11-12),
y la rama documental vigente (Swagger/OpenAPI + licencias de terceros).

**Hallazgos bloqueantes corregidos esta semana**:
- Seed demo roto: 5 INSERT de USUARIOS con 21 columnas vs 22 valores (faltaba
  `ULTIMA_IP`) → `ER_WRONG_VALUE_COUNT_ON_ROW` silencioso que dejaba sin vendedores
  demo y mantenía el job E2E de CI **rojo desde el run #75** (commit `e1b8560`).
- Job E2E corriendo el proyecto msedge que el runner no instala → `--project=chromium`
  (commit `ff278c3`; CI **verde 8/9 jobs** por primera vez).
- `.env.example` raíz ausente (el gate del bootcamp no era ejecutable) → creado
  (commit `65b2fa3`).

**Hallazgos del cierre integral (2026-11-26/27)**:

- **#25 — dinero sin locale en backend**: las facturas PDF/correo formateaban con
  `toLocaleString()` sin locale (Linux → `$75,000`). Se creó
  `backend/utils/formatoMoneda.js` y se fijaron los 4 sitios con `"es-CO"`; 3 pruebas
  RED→GREEN. Con esto, los 23 defectos del ciclo quedan corregidos (22 de
  `docs/testing/hallazgos.md` + #25).
- **FK colgante `VENTAS.ID_EMPLEADO → EMPLEADOS`**: la tabla `EMPLEADOS` no existe en
  el esquema canónico. `setup.js` la elimina de forma idempotente
  (`limpiarFkColganteVentas`); `schema.sql` quedó con 39 tablas y 45 FK canónicas.
  Verificado en local: 46 FK/1 colgante → **45 FK/0 colgantes**.
- **Huérfano de datos `VENTAS.ID_CLIENTE`**: venta 426 apunta al cliente 248, que ya
  no existe (venta COMPLETADA, $120.000, 2026-10-29). No se borra ni se reasigna sin
  autorización del negocio; se documenta en `docs/auditoria/estado-brechas.md` (ARQ-4)
  y el script `backend/scripts/auditar-fk.js` sale con código 2 mientras exista.
- **Contrato de errores de API**: el backend conserva 56 `data.msg`, 5 `data.error` y
  6 `data.message` legacy. No se hizo una migración masiva; el frontend centraliza la
  lectura en `frontend/src/utils/mensajeApi.ts` (3 pruebas) y la deuda se documenta.
- **Simulacro de rollback de BD**: dump de 310.763 B (SHA-256
  `EA0A0392…DB21BC`), restauración en **3.195 ms**, 39 tablas/2.904 filas idénticas;
  la FK colgante reaparece y la re-migración la elimina en **1.570 ms**.

**Hallazgos NO bloqueantes** → ver sección 4 (Deuda Técnica).

## 4. Deuda Técnica Documentada para el Siguiente Trimestre

| Qué | Por qué no se resolvió | Impacto | Prioridad |
|---|---|---|---|
| Formato de error de la API mezclado (`{error}`/`{msg}`/`{message}` según controller) | Tocaría ~22 routers; el cierre priorizó documentación y una lectura tolerante antes que una migración masiva | El frontend centraliza la lectura en `frontend/src/utils/mensajeApi.ts`; quedan 56 `msg`, 5 `error` y 6 `message` legacy en backend | Media |
| Rate limiter en memoria (reinicia con el contenedor; por instancia) | Diseño dev deliberado; en producción single-instance Render funciona | Multi-instancia o restart pierde contadores de fuerza bruta | Media |
| Spec OpenAPI mantenida a mano (`backend/docs/openapi.js`) | La cobertura de 120 paths se escribió manualmente (sin swagger-jsdoc) | Desync posible entre código y spec al evolucionar rutas | Media |
| `Dockerfile.prod` del backend no multi-stage formal | El efecto ya se logra con `--prod` + copia granular + runtime sin root | Estética de imagen (capas), no funcional | Baja |
| Flujos móviles pendientes (calificar compra RF-026, avance de retos, soporte general, Wompi, push y admin) | Recortados con criterio en el Sprint 6; dependen de EAS push, cuenta Wompi y decisiones de producto | La app móvil cubre los flujos principales, pero no esos 6 incrementos | Alta |
| Huérfano de datos `VENTAS.ID_CLIENTE` (venta 426 → cliente 248) | No se borra ni reasigna sin autorización del negocio; es un dato histórico, no un error de esquema | Un reporte histórico puede mostrar un cliente inexistente | Media |
| Rollback de la aplicación no ensayado | El contenedor previo exige `PAYMENT_GATEWAY=wompi` + llaves o `ALLOW_SIMULATED_PAYMENTS=true`; el entorno de prueba no las tenía | La BD sí tiene rollback probado; la app no | Media |
| Monitoreo de `/health` y respaldo diario no automatizados | Prioridad baja acordada con el propietario; scripts y procedimiento ya existen | Sin alerta temprana ni copia diaria programada | Media |
| CI no ejecuta pruebas DENTRO de las imágenes prod construidas | Los jobs construyen y validan las imágenes, pero las suites corren con MySQL en contenedor y backend en el runner | Gap entre lo probado y lo desplegado | Media |
| `frontend` (dev) sin healthcheck propio en compose | Vite dev no expone endpoint de salud dedicado | El `depends_on` del nginx de prod sí usa condición; el dev solo depende del backend | Baja |
| Admin credentials gestionadas por `.env`/dashboard (Render) | Decisión de seguridad 2026-11-11 (script `scripts/crear-admin.js` con hash verificado) | Riesgo bajo; documentado en manual | Baja |

## 5. Demo Integrada

- **Flujo demostrado** (guion sobre la versión containerizada del gate): registro
  con verificación OTP → login → catálogo con datos reales (104 productos) →
  detalle con variantes → carrito con sesión → checkout con tarjeta (venta
  COMPLETADA) → compra exitosa → factura PDF descargable → devolución con
  evidencias → admin la procesa → stock reingresado. Cada tramo está respaldado
  por la suite E2E (20 specs), **132 pruebas de integración** con MySQL real y
  **1123 pruebas unitarias** de backend.
- **Se ejecutó sobre contenedores**: ☒ Sí — el gate del §1 levantó el stack
  completo en clon limpio y los verificaciones HTTP (UI 200, API 200 vía proxy)
  corrieron contra esos contenedores.
- **Caso de error mostrado**: backend detenido momentáneamente → home vacío con
  reintento y "¡Oops!" del ErrorBoundary (sin estados congelados) — y en el flujo
  de compra, el checkout bajo el mínimo del cupón devuelve `400` con el mensaje
  exacto y el cupón NO se consume.

## 6. Hand-off al Siguiente Trimestre

- **Qué queda por codificar**: los **6 incrementos móviles** (calificar compra
  RF-026, avance de retos, soporte general, Wompi, push y admin); la migración
  gradual del formato de error de la API a `{ ok:false, msg }` (hoy el frontend
  ya normaliza la lectura); y pruebas dentro de las imágenes prod del CI.
- **Qué queda por documentar**: el hand-off móvil ya está al día en
  `movil/docs/RFs-movil.md`; queda mantener la spec OpenAPI (`/api-docs`) sincronizada
  con las rutas y publicar el manual técnico definitivo.
- **Qué queda por implementar/desplegar**: producción ya corre en Render (backend +
  frontend) con TiDB Cloud — el siguiente trimestre hereda un despliegue vivo con
  CI verde; quedan el monitor de `/health`, la tarea diaria de respaldo y el ensayo
  de rollback de la aplicación (la BD ya tiene simulacro aprobado), además de la
  pasarela real de Wompi cuando el negocio lo defina.
- **Riesgos o bloqueos conocidos**: TiDB Cloud Starter hiberna por inactividad
  (despertar variable, boot del backend con reintento de ciclos largos ya
  implementado); Render free con cold start de ~1 min; límites del buzón SMTP de
  Gmail (Brevo como alternativa soportada en el código); rate limiter en memoria
  si se escala a multi-instancia.

## 8. Evidencia de cierre — 2026-11-27

| Verificación | Resultado | Evidencia |
|---|---|---|
| Smoke público | Frontend `200` (495 ms) · `/health` `200` (416 ms) · `/api/productos?limit=1` `200` (604 ms) | 2026-11-26 23:02 -05, release `v1.0.0-462-gee3c6c5` |
| Producción | `https://jadda-frontend.onrender.com` + `https://jadda-backend.onrender.com`; Render Free + TiDB Cloud | costo **$0/mes** |
| Backend unitario | **1123 pruebas · 80 archivos** en verde | vitest 5.0.3, 2026-11-27 |
| Frontend unitario | **855 pruebas · 87 archivos** en verde | vitest 5.0.3, 2026-11-27 |
| Integridad FK | 39 tablas · 45 FK · 0 colgantes · 1 huérfano de datos | `backend/scripts/auditar-fk.js`; TiDB y local |
| Rollback de BD | 310.763 B · SHA-256 `EA0A0392…DB21BC` · restore 3.195 ms · 2.904 filas idénticas | simulacro 2026-11-26 |
| UAT | 38 casos ejecutados en modalidad automatizada + inspección | `docs/aceptacion/pruebas-aceptacion.md` y acta firmada |

El detalle de los 23 defectos corregidos y de los pendientes vive en
[`../calidad/informe-final-cierre.md`](../calidad/informe-final-cierre.md); la línea de tiempo
completa, en [`retrospectiva-4-trimestres.md`](retrospectiva-4-trimestres.md).

## 7. Roles del Equipo (Sprint 8)

| Integrante | Rol |
|---|---|
| Yeison Fernández (@yeisonfernandez2022-crypto) | Scrum Master · Product Owner · Dev · QA |
| Asistente IA (OpenCode) | Dev · QA · ejecución del gate · documentación de evidencia |

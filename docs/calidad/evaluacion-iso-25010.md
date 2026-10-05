# Evaluación de Calidad del Software — ISO/IEC 25010 (Documento maestro)

**Proyecto:** JADDA SPORTS
**Fecha de evaluación:** 2026-10-05
**Elaborado por:** Equipo de desarrollo JADDA
**Método:** revisión documental de requisitos (49 RF, 49 HU, 15 RNF) + verificación por API/E2E (`tests/smoke.mjs`, ~22 checks) + mediciones reales de rendimiento (`scripts/mediciones-rnf.ps1`) + pruebas de aceptación formales (`docs/aceptacion/pruebas-aceptacion.md`, TP-001..035).
**Documentos de soporte:** `marco-calidad.md` · `informe-evaluacion-rnf.md` · `resultados-mediciones.md` · `bitacora-lecciones-aprendidas.md` · `informe-evaluacion-calidad.md`

Este documento es la **fuente única** de la evaluación contra el modelo de calidad del producto ISO/IEC 25010: declara las 9 características evaluadas, **todas** sus subcaracterísticas, la evidencia concreta del sistema, la verificación aplicada, la valoración y el **dictamen de cumplimiento**. Las brechas se rastrean en `plan-mejora-continua.md` (MC-xx); los **pasos concretos para cerrarlas** están en **§13**.

**Escala de valoración:** Alta (evidencia verificada) · Media-Alta (evidencia verificada con salvedades menores) · Parcial (mecanismo presente, sin verificación formal o incompleto) · Pendiente (sin evidencia; acción de cierre asignada).

**Mapeo a dictamen de cumplimiento:** Alta → **Cumple** · Media-Alta / Media / Parcial → **Parcialmente** · Pendiente → **No cumple** (verificación pendiente, con acción de cierre MC-xx asignada) · N/A → No aplica. El dictamen de cada característica se declara al inicio de su sección.

---

## 1. Adecuación Funcional

> Representa la capacidad del producto software para proporcionar funciones que satisfacen las necesidades declaradas e implícitas de los usuarios cuando el producto se usa en las condiciones especificadas.

**Dictamen: CUMPLE** — 3/3 subcaracterísticas con valoración Alta y evidencia verificada (TP-001..035 + suite E2E).

| Subcaracterística | Evidencia en JADDA SPORTS | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Completitud funcional** (grado en que el conjunto de funcionalidades cubre todas las tareas y objetivos de usuario especificados) | 49/49 RF implementados y verificados contra el código (`docs/RFs/`); 49 HU con criterios de aceptación cerrados; cobertura catálogo→carrito→checkout→postventa→retos→planes→marketplace→admin→chat de soporte | TP-001..035 por sección; suite E2E (auth, catálogo, cupones, checkout, chats, paneles) | **Alta** | — |
| **Corrección funcional** (capacidad para proveer resultados exactos cuando es usado por los usuarios especificados) | Totales recalculados 100% en servidor (el checkout ignora `totalFinal`/`descuentoAplicado` del cliente); cupón por búsqueda **exacta** (`WHERE TRIM(DESCRIPCION)=?`); regla de compra mínima por % de cupón; RN-010 (no se cancela pedido en camino); plazo de 3 días post-entrega para devoluciones; vendedores bloqueados para comprar (guard web + 403 API) | API: 400 bajo mínimo sin consumir cupón, 403 vendedor, 401/403 sin sesión; smoke: "Cupón JADDA10 válido" y "'JADDA' parcial NO matchea"; TP-010/TP-012 | **Alta** | — |
| **Pertinencia funcional** (capacidad para proporcionar funciones que facilitan la consecución de tareas y objetivos de usuario) | Flujos guiados por tarea: buscador por prefijo, filtros con "Limpiar", recomendaciones por categorías compradas, retos con progreso %, cupones, chat de soporte embebido, reportes con presets 7/30/90 días, steppers de estado de pedido | TP-005..008, TP-016..018; E2E UI de reportes y retos | **Alta** | — |

---

## 2. Eficiencia de Desempeño

> Representa el desempeño de un producto en la realización de sus funciones dentro de unos parámetros de tiempo y rendimiento especificados y con un uso eficiente de recursos (CPU, memoria, almacenamiento, energía...) utilizados bajo determinadas condiciones.

**Dictamen: NO CUMPLE** — utilización de recursos y capacidad sin medición ni prueba de carga (MC-11/MC-12); el comportamiento temporal sí cumple (Alta, lecturas P95 < 55 ms).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Comportamiento temporal** (grado en que el tiempo de respuesta y el ratio de rendimiento cumple los requisitos) | Lecturas P95 < 55 ms (`/api/productos` 51,2 ms; detalle 29,9 ms; categorías 29,2 ms); login 147 ms P95 justificado por bcrypt; frontend 28,8 ms | `scripts/mediciones-rnf.ps1` (10 iteraciones + warmup, Stopwatch) → `resultados-mediciones.md` | **Alta** (LAN) | Repetir mediciones en cada entrega |
| **Utilización de recursos** (grado en que la cantidad y tipos de recursos utilizados no exceden lo especificado) | Pool de conexiones BD; multer con streaming a disco (sin base64 en memoria para evidencias de retos); express.static para imágenes | **No medido**: sin perfilado de CPU/RAM del contenedor bajo carga | **Pendiente** | **MC-11** — medir CPU/RAM de `jadda_backend` bajo carga |
| **Capacidad** (grado en que el producto cumple requisitos de límites máximos: ítems almacenados, usuarios concurrentes, ancho de banda) | Índices BD (`idx_productos_vendedor`, únicos de categoría/NIT/cupones); rate limiter anti fuerza-bruta | **Sin prueba de carga ni usuarios concurrentes**; único dato en vivo: el limitador devolvió **429** en las iteraciones 9–10 de login durante las mediciones | **Pendiente** | **MC-12** — prueba de carga (k6/Artillery) con concurrencia (absorbe MC-02) |

---

## 3. Compatibilidad

> Capacidad de un producto de intercambiar información con otros productos y/o llevar a cabo sus funciones requeridas cuando comparten un mismo entorno y recursos.

**Dictamen: PARCIALMENTE** — interoperabilidad Alta verificada (una API consumida por web y móvil); coexistencia Media-Alta (despliegue LAN monousuario).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Coexistencia** (capacidad para coexistir con otro software independiente en un entorno común, compartiendo recursos sin detrimento) | Arquitectura en 3 contenedores aislados (backend, frontend, MySQL) con volúmenes nombrados; puertos configurables (3306/5000/5173); sin dependencias de servicios externos obligatorios | Despliegue verificado desde cero con `docker compose up -d` en equipo limpio (log de despliegue en `docs/implantacion/03-guia-despliegue.md`) | **Media-Alta** | Coexistencia multi-inquilino no aplica al despliegue LAN monousuario |
| **Interoperabilidad** (capacidad de dos o más sistemas o componentes para intercambiar información y utilizar la información intercambiada) | Una sola API REST/JSON consumida por web (axios) y móvil (Expo/fetch); proxies `/api` e `/images` unificados; formato de moneda COP `es-CO` consistente (precios, facturas PDF, correos); PDFs estándar (pdfkit) | E2E: misma sesión y endpoints desde web y móvil; TP-009/TP-015 | **Alta** | — |

---

## 4. Capacidad de Interacción

> Capacidad del producto software para que el usuario interactúe mediante su interfaz intercambiando información para completar determinadas tareas.

**Dictamen: PARCIALMENTE** — 6 subcaracterísticas Altas; involucración del usuario Media-Alta e inclusividad Parcial (sin auditoría formal de accesibilidad, MC-13).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Reconocibilidad de la adecuación** (capacidad que permite al usuario entender si el software es adecuado para sus necesidades) | Home con catálogo, ofertas con badge −%, recomendaciones personalizadas, "Vendido por: {empresa}"; guía de tallas; estados de stock visibles ("¡Solo quedan N!") | TP-006/TP-007; E2E UI home (4 badges −%, sin repetidos entre secciones) | **Alta** | — |
| **Aprendizabilidad** (capacidad que permite al usuario aprender su funcionamiento dentro de un tiempo especificado) | `manual-usuario-final.md` por rol (cliente/vendedor/admin con tablas "quiero→haz esto"); mensajes en español accionables; wizard de checkout; steppers visuales de envío | Revisión documental; guia-capacitacion.md (3 sesiones con temario minuto a minuto) | **Alta** | UAT con usuarios reales pendiente de ejecutar (acta-entrega) |
| **Operabilidad** (capacidad que permite al usuario operarlo y controlarlo con facilidad) | Confirmaciones SweetAlert antes de acciones destructivas; "deshacer" de favoritos (barra 5 s); filtros con restablecimiento; paginación y ordenamiento en tablas admin; responsive 375/1440 px sin overflow horizontal | E2E Playwright responsive (375/1440 px, 0 errores JS); TP-033 | **Alta** | — |
| **Protección contra errores de usuario** (capacidad del sistema para prevenir errores en su operación) | Validaciones cliente + servidor (longitudes, formatos, obligatoriedad); checkout recalcula en servidor; bloqueo de edición de dirección cuando el pedido salió; anti-doble-clic en cambios de estado (`sinCambios`); filtro de groserías en chat (≈70 términos ES/CO, palabras completas, insensible a tildes) | API: 400 de validación, 400 de dirección bloqueada, 400 de plazo vencido; TP-003/TP-023 | **Alta** | — |
| **Involucración del usuario** (capacidad de presentar funciones e información de forma atractiva y motivadora, fomentando la interacción continua) | Retos con barra de progreso y recompensa en %; cupones personales; newsletter con ofertas; identidad visual JADDA (azul marino #002244 / rojo #e63946) | TP-016..018; E2E de retos y cupones | **Media-Alta** | — |
| **Inclusividad** (capacidad de ser utilizado por personas con distintos contextos: edad, habilidades, cultura, raza, lenguaje, género...) | Idioma español; responsive móvil (375 px, menú hamburguesa); formatos locales (COP, fechas es-CO) | **Sin auditoría formal de accesibilidad** (contraste WCAG, roles ARIA, navegación por teclado, lectores de pantalla) | **Parcial** | **MC-13** — auditoría de accesibilidad |
| **Asistencia al usuario** (capacidad que permite ser utilizado por usuarios con determinadas características logrando objetivos específicos) | Chat de soporte usuario↔vendedor↔admin con escalación a JADDA; PQR; Preguntas Frecuentes; "Ayuda y Soporte"; notificaciones in-app con ruta directa al caso | E2E de chat completo (solicitud→respuesta→rechazo→escalación→decisión); TP-013/TP-014 | **Alta** | — |
| **Auto-descriptividad** (capacidad para presentar la información adecuada, haciendo su uso inmediatamente evidente sin interacciones excesivas con recursos externos) | Tooltips en textos truncados; badges de estado con color semántico; estados vacíos con CTA; mensajes de error que dicen qué hacer ("El cupón X requiere una compra mínima de $Y (tu carrito suma $Z)"); condiciones del cupón visibles en el resumen | TP-006; E2E UI de condiciones de cupón y aviso de mínimo | **Alta** | — |

---

## 5. Fiabilidad

> Capacidad de un sistema o componente para desempeñar las funciones especificadas, cuando se usa bajo unas condiciones y periodo de tiempo determinados sin interrupciones o fallos.

**Dictamen: PARCIALMENTE** — tolerancia a fallos y capacidad de recuperación Altas (transacciones con rollback y restore probado E2E); ausencia de fallos y disponibilidad Parciales (MC-14/MC-16).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Ausencia de fallos** (capacidad de llevar a cabo funciones sin fallos bajo condiciones normales de operación) | 16+ defectos registrados con causa raíz y corrección verificada (`bitacora-lecciones-aprendidas.md`); patrón "0 errores JS" exigido por entrega; build gate `tsc -b && vite build` | **Sin métrica formal** (densidad de defectos/MTBF por entrega) | **Parcial** | **MC-14** — métrica de defectos por entrega |
| **Disponibilidad** (capacidad de estar operativo y accesible para su uso cuando se requiere) | `restart: always` en compose; auto-setup de BD en cada arranque (tablas + datos de referencia); seed de admin automático | **Sin monitoreo de uptime externo** | **Parcial** | **MC-16** — chequeo de disponibilidad recurrente |
| **Tolerancia a fallos** (capacidad para operar según lo previsto en presencia de fallos hardware o software) | Transacciones SQL con BEGIN/COMMIT/ROLLBACK en checkout, cancelación (con liberación de stock) y devoluciones; correos y notificaciones no bloqueantes (try/catch nunca rompe la compra); ErrorBoundary global con reintentar | E2E API: compra→cancelación con stock reingresado y MOVIMIENTOS_STOCK; TP-011 | **Alta** | — |
| **Capacidad de recuperación** (capacidad para recuperar los datos directamente afectados y reestablecer el estado deseado ante interrupción o fallo) | Backups diarios (`scripts/backup.ps1`: dump SQL + imágenes, rotación 7 días, log) con **restauración probada E2E** en BD temporal (35 tablas reconstruidas); `scripts/restaurar-backup.ps1` | E2E de backup→restore; TP-034 | **Alta** | Verificación mensual (MC-07) |

---

## 6. Seguridad

> Capacidad de protección de la información y los datos de manera que las personas u otros productos tengan el grado de acceso a los datos adecuado a sus tipos y niveles de autorización, y para defenderse de los patrones de ataque de agentes maliciosos.

**Dictamen: PARCIALMENTE** — confidencialidad, integridad y autenticidad Altas; no repudio y responsabilidad Media-Alta, resistencia Media (MC-15 completa no repudio; MC-01/MC-03 para exposición pública).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Confidencialidad** (asegurar que los datos solo son accesibles a quienes tienen autorización) | bcrypt (costo intencional ~90–150 ms); sesiones httpOnly + Passport; RBAC centralizado (`esAdmin`, `esVendedor`, `verificarSesion`); validación de pertenencia por recurso (devoluciones/compras propias); aislamiento de hilos de chat por `PARTE` | API: 401 sin sesión, 403 no-admin, 403 de vendedor en venta ajena y viceversa, 403 admin en ventas de vendedor; smoke y TP-032 | **Alta** | — |
| **Integridad** (garantizar que el estado del sistema y sus datos están protegidos frente a modificaciones o eliminaciones no autorizadas) | Totales y stock solo en servidor; transacciones; validaciones de formato/tamaño (archivos: tipo y 100 MB); escape HTML en Swal (`escapeHtml`); migraciones idempotentes (no degradan el esquema) | E2E: intento de compra con totales alterados ignorado; TP-023 (cambio de correo con código) | **Alta** | — |
| **No repudio** (capacidad de demostrar las acciones o eventos que han tenido lugar, de manera que no puedan ser repudiados) | **RNF-016 implementado**: `MOVIMIENTOS_STOCK` (tipo/cantidad/fecha en checkout, edición, devolución); `DEVOLUCIONES` con `FECHA_CREACION`/`FECHA_PROCESADA`/`OBSERVACION`; `CHAT_MENSAJE` con `ROL_AUTOR SISTEMA` (rastro de escalaciones y cierres); ciclo `ESTADO_PUBLICACION`/`SOLICITUDES_VENDEDOR` reconstruible; números de pedido estables (hash de Knuth) | Verificado en E2E API (movimientos ENTRADA/SALIDA al comprar/cancelar/devolver); **sin tabla de auditoría unificada** para toda acción sensible | **Media-Alta** | **MC-15** — tabla AUDITORÍA unificada |
| **Responsabilidad** (capacidad de rastrear de forma inequívoca las acciones de una entidad) | Sesiones por usuario; `ID_USUARIO` en notificaciones/devoluciones/evidencias; `ULTIMA_CONEXION`/`ULTIMA_IP` registradas y visibles en /perfil/seguridad; geolocalización best-effort | Revisión de código; verificación por API de campos de última conexión | **Media-Alta** | Se completa con MC-15 |
| **Autenticidad** (capacidad para demostrar que la identidad de un sujeto o recurso es la que afirma) | Login con bcrypt + mensaje anti-enumeración ("Correo o contraseña incorrectos" unificado); cambio de correo con código de 6 dígitos al nuevo correo; cambio de contraseña forzado para vendedores nuevos (`DEBE_CAMBIAR_PASSWORD`) | E2E de flujo completo registro→verificación→login; TP-001..004 | **Alta** | — |
| **Resistencia** (capacidad de mantener la operación bajo condiciones de ataque de un actor malicioso) | Rate limiter en memoria por IP (login 10/15 min, registro 5, recuperación 5, etc.) — **demostrado en vivo**: devolvió 429 en las mediciones; validación de entradas; filtro de groserías; credenciales fuera de git (`.env.example` con placeholders) | TP-035 (11 intentos → 429); hallazgo de mediciones §1 | **Media** | Limite en memoria no sobrevive reinicios (MC-03); sin WAF/CSRF formal en LAN (MC-01) |

---

## 7. Mantenibilidad

> Capacidad del producto software para ser modificado efectiva y eficientemente, debido a necesidades evolutivas, correctivas o perfectivas.

**Dictamen: PARCIALMENTE** — modularidad, capacidad de ser modificado y de ser probado Altas; reusabilidad y analizabilidad Media-Alta.

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Modularidad** (evitar que los cambios en un componente afecten a otros) | Separación controllers/routes/utils/middlewares; helpers compartidos (`utils/envio.js`, `utils/correo.js`, `utils/reglasCupones.js`, `utils/movimientosStock.js`, `utils/numeroPedido.js`, `utils/groserias.js`); esquema único versionado en `setup.js` | Revisión de estructura; `node --check` en cada archivo tocado | **Alta** | — |
| **Reusabilidad** (activo que permite ser utilizado en más de un sistema o en la construcción de otros activos) | Utils compartidos web↔admin↔móvil (mismo `numeroPedido` en web y móvil); componentes reutilizables (`SubirImagenes`, `ChatHilo`, `estadoCompra.ts`); `setup.js` como única fuente de esquema (genera `schema.sql`) | Revisión de código; regeneración de schema por script | **Media-Alta** | — |
| **Analizabilidad** (facilidad para evaluar el impacto de un cambio, diagnosticar deficiencias o identificar partes a modificar) | Logs estructurados (`[LOGIN]`, `[Setup]`); mensajes de error específicos con contexto; bitácora de lecciones con causa raíz; build gate con errores precisos (`tsc -b`) | Revisión documental; depuración registrada en la bitácora | **Media-Alta** | — |
| **Capacidad para ser modificado** (modificado de forma efectiva y eficiente sin introducir defectos) | Migraciones idempotentes (patrón `IS_NULLABLE`→`MODIFY`, `ADD COLUMN`); TypeScript estricto en web; convenciones documentadas en manual-técnico | Cada entrega aplica migraciones al reiniciar sin degradar BD existente | **Alta** | — |
| **Capacidad para ser probado** (facilidad para establecer criterios de prueba y llevarlas a cabo) | Suite E2E repetible (`npm run test:e2e`, ~22 checks con limpieza de datos); casos de API documentados; UAT formal TP-001..035 con criterio de aceptación (100% críticos, ≥90% global) | Ejecución de la suite y de pruebas de aceptación | **Alta** | — |

---

## 8. Flexibilidad

> Capacidad del producto para adaptarse a cambios en sus requisitos, contextos de uso o entorno del sistema.

**Dictamen: NO CUMPLE** — escalabilidad pendiente sin prueba de carga ni dato de concurrencia (MC-12); adaptabilidad, instalabilidad y reemplazabilidad evidencian cumplimiento (Alta/Media-Alta).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Adaptabilidad** (adaptado de forma efectiva y eficiente a diferentes entornos de hardware, software, operacionales o de uso) | Configuración por variables de entorno (`.env.example` con placeholders); normalización de tildes (departamentos, búsquedas); Docker multi-entorno (dev/producción local) | Despliegue en equipo limpio; `docs/implantacion/01-preparacion-plataforma.md` con specs reales | **Alta** | — |
| **Escalabilidad** (gestionar cargas de trabajo crecientes o decrecientes y adaptar su capacidad a la variabilidad) | Pool de conexiones BD; contenedores escalables por compose; **sin prueba de carga ni dato de concurrencia** | **Pendiente, sin medición** (decisión de evaluación 2026-10-05) | **Pendiente** | **MC-12** — prueba de carga con usuarios concurrentes |
| **Instalabilidad** (instalado y/o desinstalado de forma exitosa en un determinado entorno) | Un comando `docker compose up -d` levanta todo; auto-setup de BD al arrancar; `manual-instalacion.md` (7 pasos + desinstalación con warning de `down -v`) | Instalación verificada desde cero; TP de despliegue | **Alta** | — |
| **Reemplazabilidad** (ser utilizado en lugar de otro producto software con el mismo propósito en el mismo entorno) | Stack estándar (Express + MySQL + Vite/React); API REST por prefijo `/api`; BD portable vía `schema.sql` importable en Workbench o auto-setup; sin formatos propietarios de datos | Importación de `schema.sql` en BD nueva funcional en minutos (RNF-014, probado en cada arranque) | **Media-Alta** | — |

---

## 9. Protección

> Capacidad del producto, en condiciones definidas, de evitar un estado en el que se ponga en peligro la vida humana, la salud, la propiedad o el medio ambiente.

**Declaración:** JADDA SPORTS es una tienda deportiva online (LAN) sin componentes que operen maquinaria, vehículos o instalaciones; el riesgo directo a vida/salud/medio ambiente es inexistente. La característica se evalúa **como PARCIAL** por decisión de la evaluación: las subcaracterísticas de restricción operativa y protección ante fallos sí tienen evidencia real (validaciones de negocio y rollback), mientras que identificación formal de riesgos y advertencia de peligro no aplican al dominio y se declaran como tal.

**Dictamen: PARCIALMENTE** — restricción operativa Media-Alta y protección ante fallos Alta; identificación de riesgos N/A al dominio; advertencia de peligro e integración segura Medias (declaración de analogía en §9 y en acta).

| Subcaracterística | Evidencia | Verificación aplicada | Valoración | Brecha / Acción |
|---|---|---|---|---|
| **Restricción operativa** (limitar su funcionamiento a unos parámetros o estados seguros ante un peligro operativo) | Máquina de estados de negocio: cancelación solo antes del despacho (RN-010); edición de dirección bloqueada cuando el pedido salió; devolución solo dentro de 3 días post-entrega; vendedores bloqueados para comprar; cupones de un solo uso; decisión de devolución de vendedor solo en SOLICITADA/MAS_PRUEBAS (las ESCALADAS son de JADDA) | API: 400 de plazo vencido, 400 de dirección bloqueada, 403 de vendedor comprando; TP-011/TP-012 | **Media-Alta** | — |
| **Identificación de riesgos** (identificar situaciones u operaciones que puedan exponer la vida, la propiedad o el medio ambiente a un riesgo inaceptable) | No aplica al dominio (no hay operación de riesgo físico); análogo: checklist de seguridad de credenciales y rotación semestral | Revisión documental (MC-08) | **N/A (dominio)** | Registrar en acta la justificación de no aplicación |
| **Protección ante fallos** (ponerse automáticamente en modo de funcionamiento seguro o volver a una condición segura en caso de fallo) | Rollback transaccional que restaura stock y estado consistente ante cualquier fallo en checkout/cancelación/devolución; respaldos diarios restaurables | E2E de transacciones con rollback; TP-034 | **Alta** | — |
| **Advertencia de peligro** (alertar de riesgos inaceptables para reaccionar con tiempo) | Análogo en el dominio: avisos de stock bajo y reposición ("Te avisaremos cuando vuelva"), plazos de devolución visibles, confirmaciones antes de acciones irreversibles, aviso de plazo vencido | TP-012/TP-013; E2E de avisos de stock | **Media** | No es advertencia de peligro físico; declaración de analogía en acta |
| **Integración segura** (mantener la seguridad durante y después de la integración con otros componentes) | Subidas validadas por tipo/tamaño; credenciales fuera de git; credenciales de BD en compose (no en `.env` raíz); correo SMTP por variables de entorno; sin pasarela de pago integrada (referencia de pago) | Revisión de configuración; MC-01 si se publica a Internet | **Media** | HTTPS y CSRF formal pendientes para exposición pública (MC-01) |

---

## 10. Matriz de trazabilidad: pruebas → características

### 10.1 Pruebas de aceptación (TP, `docs/aceptacion/pruebas-aceptacion.md`)

| Casos | Características / subcaracterísticas cubiertas |
|---|---|
| TP-001..004 (registro e ingreso) | Adecuación (Completitud, Corrección) · Seguridad (Autenticidad, Confidencialidad) |
| TP-005..010 (catálogo y compra) | Adecuación (Pertinencia, Corrección) · Capacidad de interacción (Operabilidad, Auto-descriptividad) |
| TP-011..015 (postventa) | Fiabilidad (Tolerancia a fallos) · Adecuación (Corrección) · Protección (Restricción operativa) |
| TP-016..018 (retos) | Adecuación (Completitud) · Capacidad de interacción (Involucración del usuario) |
| TP-019..023 (perfil) | Seguridad (Confidencialidad, Integridad, Autenticidad) · Capacidad de interacción (Protección contra errores) |
| TP-024..027 (vendedor) | Adecuación (Completitud, Pertinencia) · Seguridad (Responsabilidad) |
| TP-028..032 (administración) | Seguridad (Responsabilidad, Autenticidad) · Fiabilidad (Tolerancia) · Mantenibilidad (Capacidad para ser probado) |
| TP-033 (responsive) | Capacidad de interacción (Operabilidad, Inclusividad-parcial) |
| TP-034 (respaldo) | Fiabilidad (Capacidad de recuperación) |
| TP-035 (rate limiting) | Seguridad (Resistencia) |

### 10.2 Suite E2E automatizada (`tests/smoke.mjs`, `npm run test:e2e`)

| Check (grupo) | Características / subcaracterísticas |
|---|---|
| Login admin/vendedor OK; password incorrecta 401 | Seguridad (Autenticidad, Confidencialidad) |
| Vendedor bloqueado para comprar (403) | Protección (Restricción operativa) · Seguridad (RBAC) |
| Cupón JADDA10 válido; "JADDA" parcial NO matchea | Adecuación (Corrección funcional) |
| Panel cupones disponibles (tienda + personales) | Adecuación (Completitud) · Capacidad de interacción (Auto-descriptividad) |
| Checkout bajo mínimo 400 sin consumir cupón; sobre mínimo crea venta; cancela y elimina (libera stock) | Adecuación (Corrección) · Fiabilidad (Tolerancia, Recuperación) |
| Chats sin leer, conversaciones por rol, pendientes admin con escaladas | Adecuación (Completitud) · Capacidad de interacción (Asistencia al usuario) |
| Admin NO gestiona envíos de ventas de vendedores (403) | Adecuación (Corrección) · Seguridad (Confidencialidad) |
| UI: home / admin / vendedor sin errores JS | Fiabilidad (Ausencia de fallos-parcial) · Capacidad de interacción (Operabilidad) |

---

## 11. Resumen de valoración y dictamen

| Característica | Subcaracterísticas | Alta | Media-Alta / Media | Parcial | Pendiente / N/A |
|---|---|---|---|---|---|
| 1. Adecuación funcional | 3 | 3 | — | — | — |
| 2. Eficiencia de desempeño | 3 | 1 | — | — | 2 (utilización de recursos, capacidad) |
| 3. Compatibilidad | 2 | 1 | 1 | — | — |
| 4. Capacidad de interacción | 8 | 6 | 1 | 1 (inclusividad) | — |
| 5. Fiabilidad | 4 | 2 | — | 2 (ausencia de fallos, disponibilidad) | — |
| 6. Seguridad | 6 | 3 | 3 | — | — |
| 7. Mantenibilidad | 5 | 3 | 2 | — | — |
| 8. Flexibilidad | 4 | 2 | 1 | — | 1 (escalabilidad, pendiente sin medición) |
| 9. Protección | 5 | 1 | 2 | 1 (declarada parcial) | 1 (N/A dominio) |
| **Total** | **40** | **22** | **10** | **4** | **4** |

### 11.1 Dictamen de cumplimiento por característica

| Característica | Subcaracterísticas | Dictamen | Acción de cierre |
|---|---|---|---|
| 1. Adecuación funcional | 3 | **CUMPLE** | — |
| 2. Eficiencia de desempeño | 3 | **NO CUMPLE** | MC-11 · MC-12 |
| 3. Compatibilidad | 2 | **PARCIALMENTE** | — |
| 4. Capacidad de interacción | 8 | **PARCIALMENTE** | MC-13 |
| 5. Fiabilidad | 4 | **PARCIALMENTE** | MC-14 · MC-16 |
| 6. Seguridad | 6 | **PARCIALMENTE** | MC-15 |
| 7. Mantenibilidad | 5 | **PARCIALMENTE** | — |
| 8. Flexibilidad | 4 | **NO CUMPLE** | MC-12 |
| 9. Protección | 5 | **PARCIALMENTE** | registro de la no aplicación en acta |

**Conclusión:** **1 característica CUMPLE · 7 PARCIALMENTE · 2 NO CUMPLE** (con acciones de cierre asignadas: MC-11/MC-12). En subcaracterísticas: 22/40 Alta verificada, 10 Media-Alta/Media, 4 Parcial y 4 Pendiente. El producto es **apto para entrega** bajo las salvedades de `informe-evaluacion-calidad.md` §5: las dos características "No cumple" corresponden a **verificaciones pendientes** (medición de utilización de recursos y prueba de carga con concurrencia), no a funcionalidad ausente — su cierre son las pruebas MC-11 y MC-12.

---

## 12. Brechas y acciones de cierre (nuevas)

| ID | Subcaracterística afectada | Acción | Prioridad |
|---|---|---|---|
| MC-11 | Eficiencia → Utilización de recursos | Medir CPU/RAM del contenedor backend bajo carga (sin perfilado hoy) | Media |
| MC-12 | Eficiencia → Capacidad · Flexibilidad → Escalabilidad | Prueba de carga (k6/Artillery) con usuarios concurrentes; absorbe MC-02 | Media |
| MC-13 | Capacidad de interacción → Inclusividad | Auditoría de accesibilidad (contraste WCAG, ARIA, teclado, lectores) | Media |
| MC-14 | Fiabilidad → Ausencia de fallos | Métrica de defectos por entrega (densidad sobre la bitácora de lecciones) | Baja |
| MC-15 | Seguridad → No repudio | Trail de auditoría formal (tabla AUDITORÍA de acciones sensibles) | Media |
| MC-16 | Fiabilidad → Disponibilidad | Chequeo recurrente de uptime (monitoreo básico externo) | Media |

> **¿Cómo se cierra cada brecha?** Los pasos concretos de ejecución (herramienta, comandos y criterio de cierre verificable) están en **§13. ¿Cómo solucionarlo?**. El seguimiento (responsable, plazo, estado) vive en `plan-mejora-continua.md`.

---

## 13. ¿Cómo solucionarlo? — pasos concretos de cierre

Cada brecha dictaminada **No cumple** o **Parcialmente** se cierra ejecutando **y verificando** los pasos siguientes (criterio del plan de mejora continua: acción ejecutada **y verificada** — no basta implementarla).

### MC-11 — Eficiencia → Utilización de recursos

**Herramienta:** `docker stats` (sin dependencias nuevas) o `ctop`.

**Pasos:**
1. Levantar la prueba de carga de MC-12 contra el entorno Docker real.
2. Durante la carga, muestrear cada 5 s: `docker stats --no-stream jadda_backend jadda_db --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"` (10–15 minutos).
3. Registrar en `docs/calidad/resultados-mediciones.md`: CPU y RAM **promedio y pico**, con techo propuesto (CPU < 70% sostenido · RAM < 512 MB).
4. Repetir en 2 entregas consecutivas para tener tendencia.

**Criterio de cierre:** tabla de utilización registrada en 2 entregas consecutivas dentro del techo, o acción correctiva abierta si se excede.

### MC-12 — Eficiencia → Capacidad · Flexibilidad → Escalabilidad

**Herramienta:** k6 (`docker run --network host grafana/k6`) o Artillery.

**Pasos:**
1. Escribir el script con 4 escenarios reales: navegación de catálogo (`GET /api/productos`), detalle de producto, login (POST con bcrypt) y checkout completo de prueba (con limpieza de datos al final).
2. Rampas de carga: 10 → 50 → 100 usuarios virtuales, 5 minutos por etapa.
3. Medir P50/P95/P99, tasa de error y respuestas 429; umbrales: **P95 < 500 ms con 50 concurrentes** y **errores < 1%**.
4. Registrar el informe (gráficas + tabla) en `docs/calidad/resultados-mediciones.md`; ejecutar 2 veces (línea base y tras ajustes).

**Criterio de cierre:** informe de carga con datos de concurrencia en `resultados-mediciones.md` y evaluación actualizada de Capacidad/Escalabilidad en este documento.

### MC-13 — Capacidad de interacción → Inclusividad

**Herramienta:** Lighthouse (Chrome DevTools) + axe DevTools.

**Pasos:**
1. Auditoría Lighthouse **Accessibility** en las 5 rutas críticas (home, catálogo, detalle, carrito/checkout, panel admin); objetivo **≥ 90**.
2. Recorrido con axe para violaciones WCAG 2.1 AA (contraste, etiquetas, foco, roles).
3. Navegación manual por teclado (Tab/Enter/Esc) en carrito, checkout y admin; verificar `:focus-visible`.
4. Corregir hallazgos críticos (contraste, `alt`, roles ARIA en modales) y re-auditar.

**Criterio de cierre:** Lighthouse ≥ 90 y cero violaciones graves de axe en rutas críticas; evidencia capturada en `docs/calidad/`.

### MC-14 — Fiabilidad → Ausencia de fallos

**Herramienta:** hoja de seguimiento (tabla en la bitácora o Excel).

**Pasos:**
1. Definir la fórmula: **densidad de defectos = defectos registrados en la bitácora ÷ tamaño de la entrega** (puntos de historia o líneas cambiadas).
2. Registrar por entrega: fecha, versión, defectos nuevos, tamaño y densidad.
3. Revisar en el cierre de cada sprint; acordar un techo de densidad aceptable.

**Criterio de cierre:** 3 entregas consecutivas con densidad bajo el techo acordado.

### MC-15 — Seguridad → No repudio

**Herramienta:** MySQL + helper interno.

**Pasos:**
1. Crear tabla `AUDITORIA` (`ID`, `ID_USUARIO`, `ACCION`, `TABLA`, `ID_REGISTRO`, `DETALLES` JSON, `IP`, `FECHA`) en `setup.js` (idempotente, con migración para BD existentes).
2. Helper `backend/utils/auditoria.js` (`registrarAuditoria({ conn, idUsuario, accion, tabla, idRegistro, detalles })`), invocado en: aprobación/rechazo de devoluciones, cambios de estado de venta y envío, aprobación de evidencias de reto, aprobación/rechazo de vendedores, creación de cupones.
3. Exponer el trail por API admin (`GET /api/admin/auditoria`) y agregar caso **TP-036** en `docs/aceptacion/pruebas-aceptacion.md`.

**Criterio de cierre:** cada acción sensible deja fila verificable y TP-036 pasa en la suite.

### MC-16 — Fiabilidad → Disponibilidad

**Herramienta:** `scripts/uptime.ps1` (o UptimeRobot/Cronitor en plan gratuito).

**Pasos:**
1. Script que hace `GET /` cada 5 minutos y loguea hora, estado HTTP y latencia en `docs/calidad/uptime.log` (tarea programada en el servidor).
2. Calcular el **% de disponibilidad mensual** y registrarlo en `docs/calidad/resultados-mediciones.md`.
3. Si se publica a Internet, configurar UptimeRobot/Cronitor con alerta al correo del equipo.

**Criterio de cierre:** ≥ 99% de disponibilidad documentado durante 2 meses consecutivos.

---

## 14. Aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Líder de calidad | ______________ | ______________ | ____ |
| Representante del cliente | ______________ | ______________ | ____ |

*La UAT (TP-001..035) se ejecuta con el cliente y se firma en `docs/aceptacion/acta-entrega.md`. Al cerrar MC-15 se agrega TP-036 (trail de auditoría) a la suite.*

# Plan de Pruebas de Aceptación de Usuario (UAT)

**Proyecto:** JADDA SPORTS
**Versión evaluada:** producción pública Render + TiDB Cloud (release `v1.0.0-462-gee3c6c5`) y entorno local Docker
**Modalidad de ejecución:** **automatizada + inspección documentada** (2026-11-27). No hubo sesión presencial con un cliente externo; esa limitación se declara en el acta.
**Ejecutor:** Yeison Fernández (desarrollador y representante del cliente en este cierre).
**Instrucciones originales:** ejecutar cada caso, marcar el resultado y anotar observaciones. Un caso fallido se registra como hallazgo con su evidencia.

### Códigos de resultado

| Código | Significado |
|---|---|
| ✅ A | Comportamiento del sistema verificado por una prueba automatizada (unitaria o de integración) |
| ✅ I | Verificado por inspección documentada o evidencia del cierre (sin prueba ejecutable del caso completo) |
| 🟡 P | Parcial: el flujo está cubierto, pero una condición del caso no se ejecutó en esta sesión |
| ❌ | Fallo reproducible |
| — | No aplica |

---

## A. Registro e ingreso (HU-001/002/005)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-001 | Registro de cuenta | Registrarse con correo real | Código de 6 dígitos llega al correo; al confirmarlo la sesión queda activa | ✅ A | `authController.test.js` y `authController.extra.test.js` cubren alta, código y confirmación. La **entrega SMTP real** no se re-verificó en esta sesión; la composición del correo está probada con transporte simulado. |
| TP-002 | Login correcto | Iniciar sesión con credenciales válidas | Accede y ve su nombre en el menú | ✅ A | `authRoutes.test.js` e integración `basic.test.js`; sesión y perfil en `perfil-datos.test.js`. |
| TP-003 | Login inválido | Contraseña errónea | Mensaje genérico "Correo o contraseña incorrectos" sin revelar cuál falló | ✅ A | `fuerza-bruta.test.js`: correo inexistente → 401 con mensaje genérico; 10 fallos bloquean la cuenta. |
| TP-004 | Recuperación de contraseña | "¿Olvidaste tu contraseña?" → código → nueva clave | Permite definir clave nueva y entrar | ✅ A | `authController.test.js` cubre token, expiración y cambio de clave. |

## B. Catálogo y compra (HU-007..013)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-005 | Buscar producto | Buscar por primeras letras ("bal") | Coincidencias relevantes en resultados | ✅ A | `buscador.test.ts` y `buscador.extra.test.ts` (tildes, plurales, sin resultados). |
| TP-006 | Filtrar catálogo | Filtrar categoría + rango de precio | Solo productos que cumplen; LIMPIAR FILTROS restaura | ✅ A | Pruebas de catálogo del frontend + E2E de humo; el restablecimiento está cubierto por inspección de la vista y sus pruebas de componentes. |
| TP-007 | Detalle y variantes | Abrir producto; elegir color/talla; ver stock | Precio/stock correctos por variante; guía de tallas disponible | ✅ A | `catalogo-extra.test.js` (integración) + `SelectorVarianteModal.test.tsx`. |
| TP-008 | Carrito | Agregar 2 productos distintos cantidades | Mini-carrito refleja ítems, cantidades y total | ✅ A | `CartContext.test.tsx`, `CartContext.extra.test.tsx` y `MiniCartMenu.test.tsx`. |
| TP-009 | Checkout completo | Comprar con dirección y método guardado | Compra exitosa con nº pedido; correo con factura PDF recibido | ✅ A | `compras-flujo.test.js` + `checkoutRoutes.gates.test.js`; `facturaPdf.test.js` cubre la composición del PDF. La **entrega SMTP real** no se re-verificó; el flujo de compra y la factura sí. |
| TP-010 | Envío gratis | Compra ≥ $800.000 | Costo de envío $0 en el resumen | ✅ A | `envioRoutes.test.js` fija `envio_gratis_desde = 800000`; `BarraEnvioGratis.test.tsx` cubre la UI. |

## C. Postventa (HU-023/031)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-011 | Cancelar pedido | Cancelar compra aún no enviada | Estado CANCELADA; stock reingresado; notificación recibida | ✅ A | `compras-flujo.test.js`: cancelación pagada pre-despacho, reembolso y stock. |
| TP-012 | Bloqueo RN cancelación | Intentar cancelar pedido "En camino" | Botón ausente / mensaje claro; API rechaza | ✅ A | `compras-flujo.test.js`: cancelar en camino → 400; cancelar de nuevo → 400. |
| TP-013 | Solicitar devolución | Dentro de 3 días post-entrega: devolver 1 producto con motivo + foto | Solicitud creada; estado visible desde Mis compras | ✅ A | `devoluciones-flujo.test.js`. |
| TP-014 | Seguimiento devolución | Admin marca "Pide más pruebas"; usuario adjunta 2 evidencias nuevas | Usuario ve motivo; tras subir vuelve a "En revisión" | ✅ A | `devoluciones-flujo.test.js` y `disputas-chat.test.js`. |
| TP-015 | Factura PDF | Descargar factura del pedido | PDF descargable con datos y productos | ✅ A | `compras-flujo.test.js` (Content-Disposition) + `admin-panel.test.js` (application/pdf). |

## D. Retos y fidelización (HU-040)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-016 | Unirse a reto | Inscribirse en un reto | Aparece en Mis retos con progreso 0/meta | ✅ A | `retos-flujo.test.js`: inscripción, duplicado 400, máximo 3 activos. |
| TP-017 | Reportar avance con video | Enviar cantidad + video >10 MB | Barra de progreso de subida; queda "en revisión ≤24 h" | 🟡 P | `retos-flujo.test.js` prueba avance con **PNG real** y `retoController.test.js` el límite de 10 MB; no se subió un video >10 MB en esta sesión. |
| TP-018 | Cupón por reto | Admin aprueba avances hasta meta | Cupón RETO-XXXX visible; aplica un solo uso en checkout | ✅ A | `cupon-reto.test.js` y `reglasCupones.test.js`. |

## E. Perfil y preferencias (HU-006/030)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-019 | Foto de perfil | Subir foto desde el PC | Se ve en navbar y perfil incluso tras cerrar sesión | ✅ A | `perfil-datos.test.js`; la lección L2 (alias `FOTO_URL`) quedó cubierta por la suite. |
| TP-020 | Direcciones | Crear/editar/eliminar dirección principal | Reflejado en checkout siguiente | ✅ A | `perfil-datos.test.js` y `compras-flujo.test.js` (edición antes del despacho). |
| TP-021 | Métodos de pago | Guardar método y marcar principal | Precargado en el checkout | ✅ A | `metodoPagoController.test.js` + `perfil-datos.test.js`. |
| TP-022 | Favoritos | Agregar/quitar/restaurar favorito | Deshacer funciona durante los segundos posteriores | ✅ A | Pruebas de favoritos del frontend y del contexto de carrito; el patrón "deshacer" está cubierto por componentes. |
| TP-023 | Cambio de correo seguro | Cambiar correo validando contraseña + código al nuevo | Correo actualizado solo tras confirmar código | ✅ A | `perfil-datos.test.js`: exige contraseña y código antes de actualizar. |

## F. Vendedor marketplace (HU-041+)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-024 | Solicitud informal | Enviar solicitud SIN empresa/NIT | Aceptada a revisión (48 h) | ✅ A | `vendedor-tienda.test.js`. |
| TP-025 | Aprobación vendedor | Admin aprueba solicitud | Correo con usuario/clave temporal; obliga a cambiarla al primer ingreso | ✅ A | `vendedor-tienda.test.js`; la entrega SMTP real no se re-verificó (misma salvedad que TP-001/009). |
| TP-026 | Publicar producto vendedor | Vendedor crea producto con imágenes | Queda "En revisión", invisible al público hasta aprobarlo | ✅ A | `productos-crud.test.js` y `vendedor-tienda.test.js`. |
| TP-027 | Aprobar producto | Admin aprueba | Visible en tienda con "Vendido por: {empresa}" | ✅ A | `vendedor-tienda.test.js` y `productos-crud.test.js`. |

## G. Administración

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-028 | Gestión de orden | Gestionar pedido → avanzar a "En camino" | Cliente recibe notificación + correo; timeline actualizada | ✅ A | `admin-panel.test.js` (cambio de estado idempotente); notificaciones cubiertas por la suite. |
| TP-029 | Procesar devolución | Decidir reembolso con observación | Stock/dinero según decisión; usuario notificado con ruta al detalle | ✅ A | `devoluciones-flujo.test.js` + `admin-panel.test.js`. |
| TP-030 | Revisar reto | Ver material, aprobar con comentario | Material sigue visible para el usuario + comentario mostrado | ✅ A | `retos-flujo.test.js`: aprobar/rechazar con comentario y progreso. |
| TP-031 | Reportes | Reporte de ventas últimos 30 días | KPIs y top productos consistentes con órdenes | ✅ A | `admin-panel.test.js`: reportes de ventas, analytics y descargas Excel/PDF. |
| TP-032 | Seguridad admin | Abrir endpoint admin sin sesión admin | Rechazo 401/403 sin filtrar datos | ✅ A | `roles.test.js` (401/403) + `admin-panel.test.js` (dashboard sin sesión → 401). |

## H. No funcionales visibles al usuario

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-033 | Responsive móvil | Recorrer inicio/catálogo/detalle en teléfono (375 px) | Sin desbordes horizontales; menú hamburguesa operativo | ✅ I | Verificación documentada a **375/1440 px sin overflow** en `evaluacion-iso-25010.md` e `informe-evaluacion-calidad.md`; no hay un E2E dedicado a 375 px en la suite vigente. |
| TP-034 | Respaldo operativo | Ejecutar backup y probar restauración en BD temporal | Zip generado + restauración con 39 tablas | ✅ A | Simulacro 2026-11-26: dump 310.763 B, restore **3.195 ms**, **39 tablas / 2.904 filas idénticas**; re-migración 1.570 ms. |
| TP-035 | Rate limiting | 11 intentos de login seguidos | A partir del límite responde 429 con mensaje | ✅ A | `rateLimiter.test.js`, `rateLimiter.limits.test.js` y `fuerza-bruta.test.js`. |

## I. Pasarela de pagos (Wompi sandbox)

| ID | Caso | Pasos | Resultado esperado | Resultado | Evidencia / observación |
|----|------|-------|--------------------|-----------|--------------------------|
| TP-036 | Sesión de pago | Cerrar carrito con pasarela activa → PAGAR AHORA | Venta `PENDIENTE_PAGO` + redirect al widget Wompi con métodos; repetir botón devuelve la MISMA URL | ✅ A | Sandbox 2026-10-24 (**25/25 checks**) + `pagos.test.js` y `pagosController.test.js`; idempotencia de URL cubierta. |
| TP-037 | Pago aprobado sandbox | Pagar tarjeta de prueba 4242… exp 12/2030 en el sandbox | Venta `CONFIRMADA` automática, factura por correo, avisos in-app, carrito limpio | ✅ A | Transacción sandbox APPROVED `12235670-1792863147-93417` (2026-10-24) + 10/10 checks de UI; composición de correo/factura en `facturaPdf.test.js`. |
| TP-038 | Expiración / declinación | Dejar venta `PENDIENTE_PAGO` sin pagar 10 min o declinar en sandbox | Venta `CANCELADA` sin avisos de compra + stock reingresado + correo de cancelación | ✅ A | `expirarVentasPendientes()` probado en sandbox (venta -49 h → CANCELADA + stock) y en `pagosController.test.js`. |

---

## Resumen

| Métrica | Valor |
|---|---:|
| Casos totales | **38** |
| Aprobados (✅ A + ✅ I) | **37** |
| Parciales (🟡 P) | **1** (TP-017) |
| Fallados (❌) | **0** |
| Aprobación global | **37/38 = 97,4 %** |
| Casos críticos (compra, postventa, seguridad) | **100 % aprobados** |

**Criterio de aceptación:** aprobación del 100 % de casos críticos (compra, postventa, seguridad) y ≥90 % global. Se cumple: los tres bloques críticos están aprobados y el global es 97,4 %. El único parcial (TP-017) corresponde a una condición de tamaño de archivo de video que no se ejecutó con un video real >10 MB; la regla de 10 MB y el flujo de avance sí están probados.

**Limitaciones declaradas:**
- La modalidad fue automatizada + inspección, no una sesión presencial con un cliente externo.
- La entrega real de correo (SMTP) no se re-verificó; sí la composición, el PDF y la lógica de códigos.
- Wompi se validó en **sandbox** (dinero virtual), no con una cuenta de producción.
- El respaldo se probó en local; la tarea diaria automatizada y el respaldo de TiDB Cloud siguen pendientes operativos.

Firmas al cierre en [`acta-entrega.md`](acta-entrega.md).

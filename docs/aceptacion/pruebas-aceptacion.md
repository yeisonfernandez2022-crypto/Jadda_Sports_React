# Plan de Pruebas de Aceptación de Usuario (UAT)

**Proyecto:** JADDA SPORTS
**Versión evaluada:** producción local Docker (2026-08-24)
**Usuarios ejecutores:** representante del cliente (rol cliente), representante operador (rol admin/vendedor)
**Instrucciones:** ejecutar cada caso en orden, marcar ☐ Resultado (✅/❌) y anotar observaciones. Un caso fallido se registra como hallazgo con su evidencia.

---

## A. Registro e ingreso (HU-001/002/005)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-001 | Registro de cuenta | Registrarse con correo real | Código de 6 dígitos llega al correo; al confirmarlo la sesión queda activa | ☐ | |
| TP-002 | Login correcto | Iniciar sesión con credenciales válidas | Accede y ve su nombre en el menú | ☐ | |
| TP-003 | Login inválido | Contraseña errónea | Mensaje genérico "Correo o contraseña incorrectos" sin revelar cuál falló | ☐ | |
| TP-004 | Recuperación de contraseña | "¿Olvidaste tu contraseña?" → código → nueva clave | Permite definir clave nueva y entrar | ☐ | |

## B. Catálogo y compra (HU-007..013)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-005 | Buscar producto | Buscar por primeras letras ("bal") | Coincidencias relevantes en resultados | ☐ | |
| TP-006 | Filtrar catálogo | Filtrar categoría + rango de precio | Solo productos que cumplen; LIMPIAR FILTROS restaura | ☐ | |
| TP-007 | Detalle y variantes | Abrir producto; elegir color/talla; ver stock | Precio/stock correctos por variante; guía de tallas disponible | ☐ | |
| TP-008 | Carrito | Agregar 2 productos distintos cantidades | Mini-carrito refleja ítems, cantidades y total | ☐ | |
| TP-009 | Checkout completo | Comprar con dirección y método guardado | Compra exitosa con nº pedido; correo con factura PDF recibido | ☐ | |
| TP-010 | Envío gratis | Compra ≥ $200.000 | Costo de envío $0 en el resumen | ☐ | |

## C. Postventa (HU-023/031)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-011 | Cancelar pedido | Cancelar compra aún no enviada | Estado CANCELADA; stock reingresado; notificación recibida | ☐ | |
| TP-012 | Bloqueo RN cancelación | Intentar cancelar pedido "En camino" | Botón ausente / mensaje claro; API rechaza | ☐ | |
| TP-013 | Solicitar devolución | Dentro de 3 días post-entrega: devolver 1 producto con motivo + foto | Solicitud creada; estado visible desde Mis compras | ☐ | |
| TP-014 | Seguimiento devolución | Admin marca "Pide más pruebas"; usuario adjunta 2 evidencias nuevas | Usuario ve motivo; tras subir vuelve a "En revisión" | ☐ | |
| TP-015 | Factura PDF | Descargar factura del pedido | PDF descargable con datos y productos | ☐ | |

## D. Retos y fidelización (HU-040)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-016 | Unirse a reto | Inscribirse en un reto | Aparece en Mis retos con progreso 0/meta | ☐ | |
| TP-017 | Reportar avance con video | Enviar cantidad + video >10 MB | Barra de progreso de subida; queda "en revisión ≤24 h" | ☐ | |
| TP-018 | Cupón por reto | Admin aprueba avances hasta meta | Cupón RETO-XXXX visible; aplica un solo uso en checkout | ☐ | |

## E. Perfil y preferencias (HU-006/030)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-019 | Foto de perfil | Subir foto desde el PC | Se ve en navbar y perfil incluso tras cerrar sesión | ☐ | |
| TP-020 | Direcciones | Crear/editar/eliminar dirección principal | Reflejado en checkout siguiente | ☐ | |
| TP-021 | Métodos de pago | Guardar método y marcar principal | Precargado en el checkout | ☐ | |
| TP-022 | Favoritos | Agregar/quitar/restaurar favorito | Deshacer funciona durante los segundos posteriores | ☐ | |
| TP-023 | Cambio de correo seguro | Cambiar correo validando contraseña + código al nuevo | Correo actualizado solo tras confirmar código | ☐ | |

## F. Vendedor marketplace (HU-041+)

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-024 | Solicitud informal | Enviar solicitud SIN empresa/NIT | Aceptada a revisión (48 h) | ☐ | |
| TP-025 | Aprobación vendedor | Admin aprueba solicitud | Correo con usuario/clave temporal; obliga a cambiarla al primer ingreso | ☐ | |
| TP-026 | Publicar producto vendedor | Vendedor crea producto con imágenes | Queda "En revisión", invisible al público hasta aprobarlo | ☐ | |
| TP-027 | Aprobar producto | Admin aprueba | Visible en tienda con "Vendido por: {empresa}" | ☐ | |

## G. Administración

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-028 | Gestión de orden | Gestionar pedido → avanzar a "En camino" | Cliente recibe notificación + correo; timeline actualizada | ☐ | |
| TP-029 | Procesar devolución | Decidir reembolso con observación | Stock/dinero según decisión; usuario notificado con ruta al detalle | ☐ | |
| TP-030 | Revisar reto | Ver material, aprobar con comentario | Material sigue visible para el usuario + comentario mostrado | ☐ | |
| TP-031 | Reportes | Reporte de ventas últimos 30 días | KPIs y top productos consistentes con órdenes | ☐ | |
| TP-032 | Seguridad admin | Abrir endpoint admin sin sesión admin | Rechazo 401/403 sin filtrar datos | ☐ | |

## H. No funcionales visibles al usuario

| ID | Caso | Pasos | Resultado esperado | ✅ | Obs. |
|----|------|-------|--------------------|----|------|
| TP-033 | Responsive móvil | Recorrer inicio/catálogo/detalle en teléfono (375 px) | Sin desbordes horizontales; menú hamburguesa operativo | ☐ | |
| TP-034 | Respaldo operativo | Ejecutar backup y probar restauración en BD temporal | Zip generado + restauración con 33 tablas | ☐ | |
| TP-035 | Rate limiting | 11 intentos de login seguidos | A partir del límite responde 429 con mensaje | ☐ | |

---

**Total casos:** 35 · **Aprobados:** ____ · **Fallados:** ____

**Criterio de aceptación:** aprobación del 100% de casos críticos (compra, postventa, seguridad) y ≥90% global; los fallos restantes quedan registrados en el plan de mejora con plazo.

Firmas al cierre en `acta-entrega.md`.

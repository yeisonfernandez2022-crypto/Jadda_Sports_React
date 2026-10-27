# Datos de prueba para pagar en Wompi (sandbox)

Guía de los **datos simulados** que acepta el checkout de Wompi en modo de pruebas
(`pub_test_…`). Se usan DENTRO de la pestaña de Wompi que se abre al confirmar la
compra; la app no pide ni guarda datos de tarjeta.

> Ningún cobro es real. Estos datos solo funcionan con llaves de **sandbox**; en
> producción se reemplazan las llaves en `backend/.env` y esta guía deja de aplicar.

## Cómo pagar una compra de prueba

1. Agrega productos al carrito y entra a **Finalizar compra**.
2. En el paso **Pago** elige **Wompi (pago seguro externo)** y continúa a **Confirmación**.
3. Pulsa **CONFIRMAR E IR A PAGAR**: se abre el checkout de Wompi en una pestaña nueva.
4. Elige el método de pago y usa el dato de la tabla. El checkout primero pide
   **«Ingresa datos del comprador»** (nombre, correo y celular): normalmente llegan
   precargados desde la app; si están vacíos, escribe cualquier dato válido.
5. La pestaña principal queda en **«Esperando confirmación de pago»** y cambia sola a
   **«¡Gracias por tu compra!»** cuando Wompi confirma. Si el pago se rechaza o da error,
   la app muestra **«No se pudo completar el pago»** con el motivo que reporta Wompi y el
   botón **VOLVER A PAGAR CON WOMPI** para reintentar. Si no terminas el pago, el pedido
   se cancela automáticamente a los **10 minutos** y el stock vuelve a la tienda.

## Métodos y datos de prueba

| Método en el checkout | Dato de prueba | Resultado |
|---|---|---|
| **Tarjeta de crédito / débito** | `4242 4242 4242 4242` · vence `12/30` · CVV `123` | Pago aprobado |
| **Tarjeta de crédito / débito** | `4111 1111 1111 1111` · vence `12/30` · CVV `123` | Pago rechazado |
| **Tarjeta de crédito / débito** | Cualquier otro número | Error |
| **Nequi** (campo «Celular en Nequi») | `3991111111` | Pago aprobado |
| **Nequi** (campo «Celular en Nequi») | `3992222222` | Pago rechazado |
| **Nequi** (campo «Celular en Nequi») | Cualquier otro número | Error |
| **DaviPlata** (documento CC + OTP) | Documento: cualquier número · OTP `574829` | Pago aprobado |
| **DaviPlata** (documento CC + OTP) | OTP `932015` | Pago rechazado |
| **DaviPlata** (documento CC + OTP) | OTP `186743` | Rechazado sin saldo |
| **DaviPlata** (documento CC + OTP) | OTP `999999` | Error |
| **PSE** | Banco: **«Banco que aprueba»** + documento CC | Pago aprobado |
| **PSE** | Banco: **«Banco que declina»** + documento CC | Pago rechazado |
| **PSE** | Banco: **«Banco que simula un error»** + documento CC | Error |
| **QR Interoperable** | «Estado esperado de la transacción»: **APROBADA** | Pago aprobado |
| **QR Interoperable** | «Estado esperado de la transacción»: **DECLINADA** / **ERROR** | Rechazado / Error |
| **Corresponsales Bancolombia** | «Estado esperado de la transacción»: **APROBADA** | Pago aprobado |
| **Corresponsales Bancolombia** | «Estado esperado de la transacción»: **DECLINADA** / **ERROR** | Rechazado / Error |
| **Transferencia Bancolombia** | Continuar y elegir el **estado final** en la página de pruebas de Bancolombia | Según lo elegido |
| **Bancolombia — Compra ahora, paga después (BNPL)** | Continuar y elegir el **estado final** en la página de pruebas | Según lo elegido |
| **Su+Pay — Compra hoy, pagas luego** | Continuar y elegir el **estado final** en la página de pruebas | Según lo elegido |

### Notas por método

- **Tarjetas:** cualquier fecha de vencimiento **futura** y CVV de 3 dígitos sirven; lo
  que decide el resultado es el número de la tarjeta.
- **Nequi:** el `3991111111` se escribe en el campo **«Celular en Nequi»** (no en los
  datos del comprador). El campo lo muestra con espacios (`399 111 1111`), pero el número
  debe ser exactamente ese: cualquier otro (por ejemplo `3990000000`) da el error
  **«Número no válido en Sandbox»**. Acepta el reglamento y las autorizaciones de datos.
- **DaviPlata:** después del documento, Wompi envía un código al celular vinculado; en
  sandbox se digita uno de los OTP de la tabla.
- **PSE:** el banco se elige en la lista; los tres primeros registros son los bancos de
  prueba. El tipo de documento `CC` sirve para todos los casos.
- **QR, Corresponsales, Transferencia, BNPL y Su+Pay:** no se usa un número especial;
  el sandbox muestra un selector o una página de pruebas donde se elige el estado final.
- **Reintentos:** si un pago se rechaza, el pedido sigue en `PENDIENTE_PAGO` y se puede
  reintentar con **VOLVER A PAGAR CON WOMPI** en la pantalla de resultado o desde
  **Mis compras → Pagar ahora** (se genera una sesión nueva de Wompi).

## Referencias

- Documentación de Wompi (sandbox y medios de pago): <https://docs.wompi.co>
- Llaves y configuración de la pasarela: `backend/.env` (`WOMPI_PUBLIC_KEY`,
  `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`).
- Código del flujo de pago: `backend/controllers/pagosController.js`,
  `frontend/src/pages/ResumenCompra.tsx` y `frontend/src/pages/CompraExitosa.tsx`.

> Documento de apoyo para pruebas académicas/demostración. Los datos fueron verificados
> contra el checkout sandbox de la cuenta de Jadda Sports (octubre 2026).

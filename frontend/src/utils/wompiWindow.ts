/**
 * Ventana del checkout de Wompi.
 *
 * La pestaña se abre VACÍA de forma síncrona en el click del usuario (antes de
 * cualquier await): así el navegador conserva la activación y no la bloquea.
 * Cuando la API responde con la URL del checkout se navega esa misma pestaña.
 * Antes se abría después de los awaits, el bloqueador la negaba y la app
 * mostraba un modal (Swal) con un enlace; ese modal ya no existe.
 *
 * Si aun así el navegador bloquea la ventana (window.open devuelve null), la
 * pantalla de espera muestra un enlace normal en línea para abrir el checkout.
 * Al confirmarse o cancelarse la venta, la pestaña de Wompi se cierra para que
 * no se pueda reutilizar el checkout.
 */
let ventanaWompi: Window | null = null;

/** Abre la pestaña vacía de inmediato (llamar en el handler del click). */
export const prepararVentanaWompi = (): Window | null => {
  cerrarVentanaWompi();
  ventanaWompi = window.open("", "_blank");
  if (!ventanaWompi) return null;
  try {
    // OJO: NO poner `opener = null` aquí. Con opener nulo el navegador deja de
    // permitir `close()` a la pestaña cuando navega a otro origen (Wompi), y la
    // pestaña quedaría abierta tras confirmar. Wompi es un dominio de confianza.
    const doc = ventanaWompi.document;
    if (doc?.body) {
      doc.title = "Jadda Sports — pago seguro";
      doc.body.style.margin = "0";
      doc.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
        'background:#0f172a;color:#fff;font-family:system-ui,sans-serif;font-size:16px">' +
        "Abriendo el pago seguro de Wompi…</div>";
    }
  } catch {
    /* la ventana puede no estar accesible todavía; no es crítico */
  }
  return ventanaWompi;
};

/**
 * Navega la pestaña preparada a la URL del checkout.
 * Devuelve false si la ventana no existe/estaba cerrada (el llamador debe
 * ofrecer el enlace en línea en la pantalla de espera).
 */
export const navegarVentanaWompi = (url: string): boolean => {
  if (!ventanaWompi || ventanaWompi.closed) {
    ventanaWompi = null;
    return false;
  }
  try {
    ventanaWompi.location.href = url;
    return true;
  } catch {
    cerrarVentanaWompi();
    return false;
  }
};

/** Cierra la pestaña de Wompi (si sigue abierta) y olvida la referencia. */
export const cerrarVentanaWompi = () => {
  if (ventanaWompi && !ventanaWompi.closed) {
    try {
      ventanaWompi.close();
    } catch {
      /* si el navegador lo impide, no hay nada más que hacer */
    }
  }
  ventanaWompi = null;
};

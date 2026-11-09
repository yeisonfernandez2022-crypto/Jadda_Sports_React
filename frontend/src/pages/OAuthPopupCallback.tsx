import { useEffect, useState } from "react";
import { CLAVE_RESULTADO_OAUTH, type MensajeOauth } from "../utils/oauthResultado";
import "../css/OAuthPopupCallback.css";

/*
 * Callback del popup OAuth Google. Lee ?user=&photo= (éxito) o ?motivo=
 * (fallo, enviado por el callback custom de authRoutes) y:
 *  1. Avisa al AuthModal por postMessage.
 *  2. En éxito muestra check verde + nombre ~1.1s y SE CIERRA sola.
 *  3. En fallo muestra la tarjeta roja con el motivo y se queda abierta
 *     (la cierra el usuario con el botón).
 */
export default function OAuthPopupCallback() {
  const [estado, setEstado] = useState<"cargando" | "exito" | "error">("cargando");
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    // Canal doble: postMessage al opener y — por si el navegador cortó la
    // relación opener durante el salto por accounts.google.com (COOP) —
    // también localStorage; el AuthModal de la madre misma-origen escucha
    // el evento 'storage' y procesa el resultado igual.
    const publicarResultado = (mensaje: MensajeOauth) => {
      try { localStorage.setItem(CLAVE_RESULTADO_OAUTH, JSON.stringify(mensaje)); } catch { /* storage bloqueado: queda el postMessage */ }
      window.opener?.postMessage(mensaje, window.location.origin);
    };
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    const photo = params.get("photo");
    const motivoParam = params.get("motivo");

    if (motivoParam) {
      setEstado("error");
      setMotivo(motivoParam);
      publicarResultado({ type: "oauth-error", motivo: motivoParam });
      return;
    }

    if (user) {
      setEstado("exito");
      setNombre(user);
      publicarResultado({ type: "oauth-success", user, photo });
      const t = setTimeout(() => {
        try { window.close(); } catch { /* el popup cierra por timeout de seguridad */ }
      }, 1100);
      return () => clearTimeout(t);
    }

    // Ni user ni motivo: el backend debería haber redirigido con uno de los dos.
    setEstado("error");
    setMotivo("No se pudo completar el inicio de sesión con Google");
    publicarResultado({ type: "oauth-error", motivo: "No se pudo completar el inicio de sesión con Google" });
  }, []);

  return (
    <div className="oauth-callback-pagina">
      <div className={`oauth-callback-tarjeta ${estado === "error" ? "es-error" : estado === "exito" ? "es-exito" : ""}`}>
        {estado === "cargando" && (
          <>
            <i className="fas fa-circle-notch fa-spin oauth-callback-icono"></i>
            <h2>Autenticando…</h2>
            <p>Estamos conectando con Google, espera un momento.</p>
          </>
        )}
        {estado === "exito" && (
          <>
            <div className="oauth-callback-circulo"><i className="fas fa-check"></i></div>
            <h2>¡ÉXITO!</h2>
            <p>Bienvenido, {nombre}</p>
            <p className="oauth-callback-sub">Cerrando esta ventana…</p>
          </>
        )}
        {estado === "error" && (
          <>
            <div className="oauth-callback-circulo es-error"><i className="fas fa-triangle-exclamation"></i></div>
            <h2>NO SE PUDO INICIAR SESIÓN</h2>
            <p className="oauth-callback-error-motivo">{motivo}</p>
            <button type="button" className="oauth-callback-boton" onClick={() => { try { window.close(); } catch { window.location.href = "/"; } }}>
              Cerrar ventana
            </button>
          </>
        )}
      </div>
    </div>
  );
}

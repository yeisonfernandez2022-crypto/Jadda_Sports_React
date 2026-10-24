import { useState } from "react";
import { Link } from "react-router-dom";
import "../css/AvisoCookies.css";

const CLAVE = "jadda_aviso_cookies";

function AvisoCookies() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(CLAVE);
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  const aceptar = () => {
    try {
      localStorage.setItem(CLAVE, new Date().toISOString());
    } catch {
      /* modo privado: solo se oculta durante esta sesión */
    }
    setVisible(false);
  };

  return (
    <div id="aviso-cookies" className="aviso-cookies" role="dialog" aria-label="Aviso de cookies">
      <div className="aviso-cookies-texto">
        <strong>🍪 Cookies</strong>
        <p>
          Usamos una única cookie esencial de sesión (<code>connect.sid</code>) para mantener tu sesión
          segura. No usamos cookies publicitarias ni de analítica.{" "}
          <Link to="/politica-privacidad">Más detalles</Link>
        </p>
      </div>
      <button type="button" className="aviso-cookies-btn" onClick={aceptar}>Entendido</button>
    </div>
  );
}

export default AvisoCookies;

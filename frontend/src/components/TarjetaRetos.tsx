import { FaTrophy } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../css/TarjetasPromo.css";

export default function TarjetaRetos() {
  const navigate = useNavigate();

  return (
    <div className="tarjeta-promo-sola">
      <div className="tarjeta-beneficio tarjeta-retos">
        <span className="tarjeta-ico"><FaTrophy /></span>
        <div className="tarjeta-copia">
          <strong>Retos con los mejores descuentos</strong>
          <p>Completa retos deportivos y desbloquea descuentos exclusivos en toda la tienda.</p>
        </div>
        <button type="button" className="tarjeta-cta" onClick={() => navigate("/retos")}>
          Ver retos
        </button>
      </div>
    </div>
  );
}
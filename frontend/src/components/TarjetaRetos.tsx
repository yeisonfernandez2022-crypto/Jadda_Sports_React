import { FaTrophy } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import "../css/TarjetasPromo.css";

export default function TarjetaRetos() {
  const navigate = useNavigate();
  const { usuarioLogueado } = useAuth();
  const { openLogin } = useAuthModal();

  const verRetos = () => {
    if (!usuarioLogueado) {
      // sin sesión la ruta /retos solo rebotaría a Principal en silencio:
      // avisamos en el acto y ofrecemos abrir el inicio de sesión
      void Swal.fire({
        icon: "info",
        title: "Inicia sesión",
        text: "Debes iniciar sesión para ver los retos disponibles.",
        showCancelButton: true,
        confirmButtonText: "Iniciar sesión",
        cancelButtonText: "Después",
        confirmButtonColor: "#e63946",
        reverseButtons: true,
      }).then((r) => {
        if (r.isConfirmed) openLogin();
      });
      return;
    }
    navigate("/retos");
  };

  return (
    <div className="tarjeta-promo-sola">
      <div className="tarjeta-beneficio tarjeta-retos">
        <span className="tarjeta-ico"><FaTrophy /></span>
        <div className="tarjeta-copia">
          <strong>Retos con los mejores descuentos</strong>
          <p>Completa retos deportivos y desbloquea descuentos exclusivos en toda la tienda.</p>
        </div>
        <button type="button" className="tarjeta-cta" onClick={verRetos}>
          Ver retos
        </button>
      </div>
    </div>
  );
}

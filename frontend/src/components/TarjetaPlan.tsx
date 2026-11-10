import { useState } from "react";
import { FaDumbbell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import "../css/TarjetasPromo.css";

const PASOS = [
  { t: "Compra cualquier producto", d: "De nuestro catálogo, sin importar la categoría: camisetas, balones, guayos, suplementos, lo que necesites." },
  { t: "Recibes tu plan gratis", d: "Al confirmar tu compra generamos automáticamente un plan de entrenamiento personalizado sin costo adicional." },
  { t: "Ábrelo desde tu perfil", d: "En la sección “Mis planes” encontrarás tus rutinas con tu progreso guardado día a día." },
  { t: "Entrena y registra", d: "Marca tus días completados y avanza a la semana: el progreso se queda guardado en tu cuenta." },
];

export default function TarjetaPlan() {
  const navigate = useNavigate();
  const { usuarioLogueado } = useAuth();
  const { openLogin } = useAuthModal();
  const [abierto, setAbierto] = useState(false);

  const irAMisPlanes = () => {
    setAbierto(false); // cerramos el modal del plan antes de hablar de sesión (sin capas superpuestas)
    if (!usuarioLogueado) {
      // sin sesión /mis-planes solo rebotaría a Principal en silencio: avisamos y ofrecemos login
      void Swal.fire({
        icon: "info",
        title: "Inicia sesión",
        text: "Debes iniciar sesión para ver tu plan de entrenamiento.",
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
    navigate("/mis-planes");
  };

  return (
    <>
      <div className="tarjeta-promo-sola">
        <div className="tarjeta-beneficio tarjeta-plan">
          <span className="tarjeta-ico"><FaDumbbell /></span>
          <div className="tarjeta-copia">
            <strong>Plan de entrenamiento GRATIS</strong>
            <p>Compra cualquier producto y recibe un plan personalizado de entrenamiento sin costo adicional.</p>
          </div>
          <button type="button" className="tarjeta-cta" onClick={() => setAbierto(true)}>
            Más información
          </button>
        </div>
      </div>

      {abierto && (
        <div className="promo-modal-overlay" onClick={() => setAbierto(false)}>
          <div className="promo-modal promo-modal-plan" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="promo-modal-hero">
              <span className="promo-modal-hero-ico"><FaDumbbell /></span>
              <div className="promo-modal-hero-txt">
                <h3 className="promo-modal-titulo">¿Cómo funciona tu plan?</h3>
                <p className="promo-modal-sub">Beneficio gratis con cada compra de la tienda</p>
              </div>
              <button type="button" className="promo-modal-x" aria-label="Cerrar" onClick={() => setAbierto(false)}>
                &times;
              </button>
            </div>
            <div className="promo-modal-cuerpo">
              {PASOS.map((p, i) => (
                <div key={i} className="promo-modal-paso">
                  <span className="promo-modal-num">{i + 1}</span>
                  <div>
                    <strong>{p.t}</strong>
                    <p>{p.d}</p>
                  </div>
                </div>
              ))}
              <ul className="promo-modal-reglas">
                <li>Beneficio exclusivo de JADDA SPORTS: entrena, progresa y aprovecha cada compra al máximo.</li>
                <li>“Mis planes” funciona con sesión iniciada: allí vive tu progreso.</li>
              </ul>
            </div>
            <div className="promo-modal-pie">
              <button type="button" className="promo-modal-btn" onClick={irAMisPlanes}>
                Ir a mis planes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

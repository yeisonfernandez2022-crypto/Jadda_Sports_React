import { useState } from "react";
import { FaDumbbell, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../css/TarjetasPromo.css";

export default function TarjetaPlan() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);

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
        <div className="plan-modal-overlay" onClick={() => setAbierto(false)}>
          <div className="plan-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="plan-modal-cerrar" aria-label="Cerrar" onClick={() => setAbierto(false)}>
              <FaTimes />
            </button>
            <span className="plan-modal-ico"><FaDumbbell /></span>
            <h3>¿Cómo funciona tu plan de entrenamiento?</h3>
            <ol className="plan-modal-pasos">
              <li>Compra <strong>cualquier producto</strong> de nuestro catálogo, sin importar la categoría.</li>
              <li>Al confirmar tu compra, generamos <strong>tu plan personalizado</strong> automáticamente.</li>
              <li>Accede a él desde tu perfil en la sección <strong>"Mis planes"</strong>.</li>
              <li>Sigue las rutinas diarias y registra tu avance; tu progreso se guarda día a día.</li>
            </ol>
            <p className="plan-modal-nota">
              Es un beneficio exclusivo de JADDA SPORTS: entrena, progresa y aprovecha cada compra al máximo.
            </p>
            <button type="button" className="plan-modal-btn" onClick={() => navigate("/mis-planes")}>
              Ir a mis planes
            </button>
          </div>
        </div>
      )}
    </>
  );
}
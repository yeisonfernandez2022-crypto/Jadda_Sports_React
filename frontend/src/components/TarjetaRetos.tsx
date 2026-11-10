import { useState } from "react";
import { FaTrophy } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import "../css/TarjetasPromo.css";

const PASOS = [
  { t: "Únete a un reto", d: "Gratis, con tu sesión abierta. Puedes tener hasta 3 retos activos a la vez." },
  { t: "Reporta tu avance", d: "Sube las capturas de tu app de fitness o de tu reloj, fotos y vídeos cortos (hasta 25 MB). En retos por días o sesiones hay 1 avance diario." },
  { t: "Revisión del equipo", d: "Nuestros asesores revisan tu material y lo aprueban en un máximo de 24 horas." },
  { t: "Gana tu cupón", d: "Al completar la meta recibes un cupón RETo- con 3-10 % de descuento según la meta y un mínimo de compra." },
];

export default function TarjetaRetos() {
  const navigate = useNavigate();
  const { usuarioLogueado } = useAuth();
  const { openLogin } = useAuthModal();
  const [abierto, setAbierto] = useState(false);

  const verRetos = () => {
    setAbierto(false); // cerramos el modal informativo antes de pedir sesión (sin capas superpuestas)
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
    <>
      <div className="tarjeta-promo-sola">
        <div className="tarjeta-beneficio tarjeta-retos">
          <span className="tarjeta-ico"><FaTrophy /></span>
          <div className="tarjeta-copia">
            <strong>Retos con los mejores descuentos</strong>
            <p>Completa retos deportivos y desbloquea descuentos exclusivos en toda la tienda.</p>
          </div>
          <div className="tarjeta-ctas">
            <button type="button" className="tarjeta-cta" onClick={() => setAbierto(true)}>
              Más información
            </button>
            <button type="button" className="tarjeta-cta solido" onClick={verRetos}>
              Ver retos
            </button>
          </div>
        </div>
      </div>

      {abierto && (
        <div className="promo-modal-overlay" onClick={() => setAbierto(false)}>
          <div className="promo-modal promo-modal-retos" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="promo-modal-hero">
              <span className="promo-modal-hero-ico"><FaTrophy /></span>
              <div className="promo-modal-hero-txt">
                <h3 className="promo-modal-titulo">¿Cómo funcionan los retos?</h3>
                <p className="promo-modal-sub">Retos deportivos que te pagan con descuentos</p>
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
                <li>El cupón es personal e intransferible: solo la cuenta que completó el reto puede usarlo.</li>
                <li>Un solo uso, vigente 30 días, con mínimo de compra según su porcentaje.</li>
                <li>Si se rechaza un avance puedes reenviarlo el mismo día con material nuevo.</li>
              </ul>
            </div>
            <div className="promo-modal-pie">
              <button type="button" className="promo-modal-btn" onClick={verRetos}>
                Ver retos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

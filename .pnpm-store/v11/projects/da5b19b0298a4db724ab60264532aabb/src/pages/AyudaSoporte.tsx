import "../css/AyudaSoporte.css";
import { FaHeadset, FaEnvelope, FaPhone, FaWhatsapp, FaQuestionCircle, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useState } from "react";

const faqs = [
  { p: "¿Cómo puedo hacer un pedido?", r: "Navega por nuestro catálogo, agrega productos al carrito y sigue el proceso de compra. Necesitas tener una cuenta e iniciar sesión." },
  { p: "¿Cuánto tarda el envío?", r: "Los envíos se procesan en 24-48 horas hábiles y llegan en 3-5 días dependiendo de tu ubicación." },
  { p: "¿Puedo cancelar mi pedido?", r: "Sí, puedes cancelar mientras el pedido esté en estado 'Pendiente'. Contacta a soporte para asistencia." },
  { p: "¿Cómo aplico un cupón de descuento?", r: "En la página de Finalizar Compra, hay una sección 'Cupón de descuento' donde ingresas el código y presionas 'Aplicar'." },
  { p: "¿Qué métodos de pago aceptan?", r: "Aceptamos tarjeta débito/crédito, PSE, Nequi y Daviplata." },
];

export default function AyudaSoporte() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className="ayuda-page">
      <div className="ayuda-card">
        <div className="ayuda-header">
          <FaHeadset className="ayuda-icon" />
          <h1>Ayuda y Soporte</h1>
          <p>Estamos aquí para ayudarte</p>
        </div>

        <section className="ayuda-faqs">
          <h2><FaQuestionCircle /> Preguntas frecuentes</h2>
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-pregunta" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <span>{f.p}</span>
                {faqOpen === i ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              {faqOpen === i && <div className="faq-respuesta">{f.r}</div>}
            </div>
          ))}
        </section>

        <section className="ayuda-contacto">
          <h2>Contacto directo</h2>
          <div className="contacto-grid">
            <div className="contacto-item">
              <FaEnvelope />
              <span>soporte@jaddasports.com</span>
            </div>
            <div className="contacto-item">
              <FaPhone />
              <span>+57 300 123 4567</span>
            </div>
            <div className="contacto-item">
              <FaWhatsapp />
              <span>+57 300 123 4567</span>
            </div>
          </div>
        </section>

        <section className="ayuda-pqr">
          <h2>¿Tienes una queja o reclamo?</h2>
          <p>Déjanos tu PQR y te responderemos a la brevedad.</p>
          <button className="btn-pqr" onClick={() => window.location.href = "/pqr"}>
            Ir a PQR
          </button>
        </section>
      </div>
    </div>
  );
}

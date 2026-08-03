import { memo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp,
  FaMapMarkerAlt, FaEnvelope, FaPaperPlane, FaShieldAlt
} from "react-icons/fa";
import "../css/footer.css";

const Footer = memo(function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [enviandoNewsletter, setEnviandoNewsletter] = useState(false);

  const suscribirNewsletter = async (e: FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Swal.fire({
        icon: "warning",
        title: "CORREO INVÁLIDO",
        text: "Ingresa un correo válido para suscribirte.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
      return;
    }
    setEnviandoNewsletter(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      Swal.fire({
        icon: res.ok ? "success" : "error",
        title: res.ok ? "¡SUSCRITO!" : "ERROR",
        text: data.msg || "Gracias por suscribirte a nuestras novedades.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
        timer: 2500,
        showConfirmButton: false,
      });
      if (res.ok) setNewsletterEmail("");
    } catch {
      Swal.fire({
        icon: "error",
        title: "ERROR",
        text: "No se pudo suscribir. Intenta de nuevo.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setEnviandoNewsletter(false);
    }
  };

  const redes = [
    { icon: <FaFacebookF />, nombre: "Facebook", href: "#" },
    { icon: <FaInstagram />, nombre: "Instagram", href: "#" },
    { icon: <FaTiktok />, nombre: "TikTok", href: "#" },
    { icon: <FaWhatsapp />, nombre: "WhatsApp", href: "#" },
  ];

  return (
    <footer className="footer">
      <div className="footer-contenido">
        <div className="footer-col footer-col-marca">
          <h3>JADDA <span>SPORTS</span></h3>
          <p className="footer-descripcion">
            Pasión por el deporte y la excelencia. Encuentra ropa, calzado y
            accesorios para superar tus límites.
          </p>
          <p className="footer-contacto">
            <FaMapMarkerAlt /> Bogotá, Colombia
          </p>
          <p className="footer-contacto">
            <FaEnvelope /> <Link className="footer-link" to="/contacto">Contáctanos</Link>
          </p>
          <p className="footer-contacto">
            <FaShieldAlt /> Compra 100% segura
          </p>
        </div>

        <div className="footer-col">
          <h5>NAVEGACIÓN</h5>
          <ul>
            <li><Link className="footer-link" to="/">Inicio</Link></li>
            <li><Link className="footer-link" to="/catalogo">Catálogo</Link></li>
            <li><Link className="footer-link" to="/catalogo?descuento=true">Ofertas</Link></li>
            <li><Link className="footer-link" to="/sobre-nosotros">Sobre Nosotros</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>ATENCIÓN AL CLIENTE</h5>
          <ul>
            <li><Link className="footer-link" to="/preguntas-frecuentes">Preguntas frecuentes</Link></li>
            <li><Link className="footer-link" to="/politicas-devolucion">Políticas de devolución</Link></li>
            <li><Link className="footer-link" to="/terminos-condiciones">Términos y condiciones</Link></li>
            <li><Link className="footer-link" to="/politica-privacidad">Política de privacidad</Link></li>
            <li><Link className="footer-link" to="/pqr">PQR</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>SÍGUENOS</h5>
          <div className="footer-redes">
            {redes.map((r) => (
              <a
                key={r.nombre}
                className="footer-social"
                href={r.href}
                title={r.nombre}
                aria-label={r.nombre}
              >
                {r.icon}
              </a>
            ))}
          </div>
          <p className="footer-sello">
            ¡Únete a la comunidad <strong>JADDA</strong> y entrena con nosotros!
          </p>
        </div>
      </div>

      <div className="footer-newsletter">
        <p className="footer-newsletter-texto">Novedades y ofertas en tu correo</p>
        <form onSubmit={suscribirNewsletter} className="footer-newsletter-form">
          <input
            type="email"
            placeholder="Tu correo electrónico"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            aria-label="Correo para novedades"
          />
          <button type="submit" disabled={enviandoNewsletter}>
            <FaPaperPlane /> {enviandoNewsletter ? "..." : "SUSCRIBIRME"}
          </button>
        </form>
      </div>

      <div className="footer-bottom">
        <p>© 2026 JADDA SPORTS - Todos los derechos reservados</p>
      </div>
    </footer>
  );
});

export default Footer;

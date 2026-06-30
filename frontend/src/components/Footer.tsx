import { memo } from "react";
import { Link } from "react-router-dom";
import "../css/footer.css";
const Footer = memo(function Footer() {
  return (
    <footer className="footer">
      <div className="container pt-3 pb-0">

        <div className="row g-3">

          {/* Jadda Sports */}
          <div className="col-md-4">
            <h3 className="fw-bold text-uppercase mb-2">
              JADDA SPORTS
            </h3>

            <p className="mb-3">
              Pasión por el deporte y la excelencia.
              Encuentra ropa, calzado y accesorios para superar tus límites.
            </p>

            <p>
              <i className="fas fa-location-dot me-2"></i>
              Bogotá, Colombia
            </p>

            <p>
              <i className="fas fa-envelope me-2"></i>
              contacto@jaddasports.com
            </p>
          </div>


          {/* Navegación */}
          <div className="col-md-2">
            <h5 className="mb-2">NAVEGACIÓN</h5>

            <ul className="list-unstyled">
              <li className="mb-2">
                <Link className="footer-link" to="/">
                  Inicio
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/catalogo">
                  Catálogo
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/catalogo?descuento=true">
                  Ofertas
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/sobre-nosotros">
                  Sobre Nosotros
                </Link>
              </li>
            </ul>
          </div>


          {/* Ayuda */}
          <div className="col-md-3">
            <h5 className="mb-2">ATENCIÓN AL CLIENTE</h5>

            <ul className="list-unstyled">
              <li className="mb-2">
                <Link className="footer-link" to="/preguntas-frecuentes">
                  Preguntas frecuentes
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/politicas-devolucion">
                  Políticas de devolución
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/terminos-condiciones">
                  Términos y condiciones
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/politica-privacidad">
                  Política de privacidad
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/pqr">
                  PQR
                </Link>
              </li>
            </ul>
          </div>


          {/* Redes */}
          <div className="col-md-3">
            <h5 className="mb-2">SÍGUENOS</h5>

            <div className="d-flex gap-3 mt-4">

              <a className="footer-social" href="#">
                <i className="fab fa-facebook"></i>
              </a>

              <a className="footer-social" href="#">
                <i className="fab fa-instagram"></i>
              </a>

              <a className="footer-social" href="#">
                <i className="fab fa-tiktok"></i>
              </a>

              <a className="footer-social" href="#">
                <i className="fab fa-whatsapp"></i>
              </a>

            </div>
          </div>

        </div>


        <hr className="my-2 opacity-50" />

        <div className="text-center">
          <p className="mb-0">
            © 2026 JADDA SPORTS - Todos los derechos reservados
          </p>
        </div>

      </div>
    </footer>
  );
});

export default Footer;


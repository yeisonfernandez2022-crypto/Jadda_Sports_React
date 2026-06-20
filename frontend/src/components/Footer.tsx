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
                <Link className="footer-link" to="/carrito">
                  Carrito
                </Link>
              </li>

              <li className="mb-2">
                <Link className="footer-link" to="/perfil">
                  Perfil
                </Link>
              </li>
            </ul>
          </div>


          {/* Ayuda */}
          <div className="col-md-3">
            <h5 className="mb-2">ATENCIÓN AL CLIENTE</h5>

            <ul className="list-unstyled">
              <li className="mb-2">
                <a className="footer-link" href="#">
                  Preguntas frecuentes
                </a>
              </li>

              <li className="mb-2">
                <a className="footer-link" href="#">
                  Políticas de devolución
                </a>
              </li>

              <li className="mb-2">
                <a className="footer-link" href="#">
                  Términos y condiciones
                </a>
              </li>

              <li className="mb-2">
                <a className="footer-link" href="#">
                  Política de privacidad
                </a>
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


import { useNavigate } from "react-router-dom";
import "../css/inicio.css"; // Importamos tu CSS para mantener la facha

function Confirmado() {
  const navigate = useNavigate();

  return (
    <div className="login-page"> {/* Usamos la clase base de tus fondos */}
      
      {/* NAVBAR COHERENTE CON JADDA SPORTS */}
      <header className="header">
        <a href="/principal" className="logo-text">
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </a>
      </header>

      {/* CONTENIDO CENTRAL */}
      <main className="main-container">
        <div className="form-area text-center shadow-lg p-5">
          <div className="mb-4">
            {/* Agregué un icono de check para que se vea más pro */}
            <i className="fas fa-check-circle fa-5x text-success"></i>
          </div>

          <h2 className="fw-bold mb-3">✔ CORREO CONFIRMADO</h2>

          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "15px" }} className="text-muted">
            Tu cuenta ha sido verificada correctamente.<br />
            Ahora puedes iniciar sesión y disfrutar de todos los beneficios de <strong>JADDA SPORTS</strong>.
          </p>

          <div className="d-grid gap-2 mt-4">
            {/* Usamos navigate para que la transición sea instantánea sin recargar la página */}
            <button 
              onClick={() => navigate("/login")} 
              className="btn btn-danger btn-lg fw-bold"
            >
              INICIAR SESIÓN
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>©2026 JADDA SPORTS TODOS LOS DERECHOS RESERVADOS.</p>
      </footer>
    </div>
  );
}

export default Confirmado;
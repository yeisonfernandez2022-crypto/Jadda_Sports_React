import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../css/Login.css"; // Reutilizamos tus estilos base

function ResetPassword() {
  const { token } = useParams(); // Atrapa el token de /reset-password/:token
  const navigate = useNavigate();

  // Estados del formulario
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Estados de validación visual
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [fuerza, setFuerza] = useState(0); // 0 a 3
  const [checks, setChecks] = useState({
    mayus: false,
    simbolo: false,
    longitud: false,
  });

  // Lógica de la barra de seguridad (Efecto espejo de tu input)
  useEffect(() => {
    const hasMayus = /[A-Z]/.test(password);
    const hasSimbolo = /[\W_]/.test(password);
    const hasLongitud = password.length >= 7;

    setChecks({ mayus: hasMayus, simbolo: hasSimbolo, longitud: hasLongitud });

    let puntos = 0;
    if (hasMayus) puntos++;
    if (hasSimbolo) puntos++;
    if (hasLongitud) puntos++;
    setFuerza(puntos);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validaciones previas
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden. Inténtalo de nuevo.");
      return;
    }

    if (fuerza < 3) {
      setErrorMsg("La contraseña debe cumplir con todos los requisitos de seguridad.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setExito(true);
      } else {
        const data = await res.json();
        setErrorMsg(data.message || "El enlace ha expirado o es inválido.");
      }
    } catch (err) {
      setErrorMsg("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const niveles = ["0%", "33%", "66%", "100%"];
  const colores = ["", "bg-danger", "bg-warning", "bg-success"];

  return (
    <div className="login-page">
      <header className="header">
        <a href="/principal" className="logo-text">
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </a>
      </header>

      <main className="main-container">
        <div className="form-area">
          {!exito ? (
            <div id="contenedorReset">
              <h2 className="mb-4">NUEVA CONTRASEÑA</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">NUEVA CONTRASEÑA</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onFocus={() => setMostrarAyuda(true)}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  {mostrarAyuda && (
                    <div id="passwordHelp" className="mt-2">
                      <small className="text-muted">Debe tener:</small>
                      <ul className="list-unstyled mb-2" style={{ fontSize: "13px" }}>
                        <li style={{ color: checks.mayus ? "#28a745" : "#e73737" }}>
                           {checks.mayus ? "✔" : "✘"} Una mayúscula
                        </li>
                        <li style={{ color: checks.simbolo ? "#28a745" : "#e73737" }}>
                           {checks.simbolo ? "✔" : "✘"} Un símbolo
                        </li>
                        <li style={{ color: checks.longitud ? "#28a745" : "#e73737" }}>
                           {checks.longitud ? "✔" : "✘"} Mínimo 7 caracteres
                        </li>
                      </ul>
                      <div className="progress" style={{ height: "8px" }}>
                        <div
                          className={`progress-bar ${colores[fuerza]}`}
                          style={{ width: niveles[fuerza], transition: "0.3s" }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label">CONFIRMAR CONTRASEÑA</label>
                  <input
                    type="password"
                    className={`form-control ${errorMsg.includes("coinciden") ? "is-invalid" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="alert alert-danger py-2 small text-center fw-bold">
                    <i className="fas fa-exclamation-circle me-2"></i> {errorMsg}
                  </div>
                )}

                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-danger btn-lg fw-bold" disabled={loading}>
                    {loading ? "ACTUALIZANDO..." : "ACTUALIZAR CLAVE"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div id="exitoReset" className="text-center py-4">
              <h3 className="text-success fw-bold">
                <i className="fas fa-check-circle"></i> ¡CLAVE ACTUALIZADA! ✅
              </h3>
              <p className="text-muted mt-2">Tu contraseña ha sido cambiada. Ya puedes ingresar a tu cuenta.</p>
              <button onClick={() => navigate("/login")} className="btn btn-danger mt-3 w-100">
                INICIAR SESIÓN
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>©2026 JADDA SPORTS TODOS LOS DERECHOS RESERVADOS.</p>
      </footer>
    </div>
  );
}

export default ResetPassword;
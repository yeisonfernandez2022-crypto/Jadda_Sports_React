import { useState, type ChangeEvent, type FormEvent } from "react";
import "../css/Login.css";

interface LoginResponse {
  token?: string;
  nombre?: string;
  message?: string;
}

function Login() {
  const [correo, setCorreo] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [mostrar, setMostrar] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [shake, setShake] = useState<boolean>(false);

  const aplicarShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password: password })
      });

      const data: LoginResponse = await response.json();

      if (response.ok) {
        if (data.token) localStorage.setItem("token", data.token);
        localStorage.setItem("userName", data.nombre || "Usuario");
        window.location.href = "/principal";
      } else {
        aplicarShake();
        setError(data.message || "Correo o contraseña inválidos");
      }
    } catch (err) {
      console.error("Error técnico:", err);
      aplicarShake();
      setError("No hay conexión con el servidor.");
    }
  };

  return (
    <div className="login-page">
      <header className="header">
        <a href="/principal" className="logo-text">
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </a>
      </header>

      <main className="main-container">
        <div className={`form-area ${shake ? "shake-error" : ""}`}>
          <h2>INICIAR SESIÓN</h2>

          <form onSubmit={handleLogin} autoComplete="off">
            <div className="mb-3">
              <label className="form-label">CORREO</label>
              <input
                type="email"
                name="loginEmail"
                className="form-control"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCorreo(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">CONTRASEÑA</label>
              <input
                type={mostrar ? "text" : "password"}
                name="loginPassword"
                className="form-control"
                placeholder="Contraseña"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />

              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="form-check m-0">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="showPass"
                    checked={mostrar}
                    onChange={() => setMostrar(!mostrar)}
                    style={{ cursor: "pointer" }}
                  />
                  <label
                    className="form-check-label small text-muted"
                    htmlFor="showPass"
                    style={{ cursor: "pointer" }}
                  >
                    Mostrar contraseña
                  </label>
                </div>

                <a href="/recuperar" className="recover-link">
                  ¿OLVIDASTE TU CONTRASEÑA?
                </a>
              </div>
            </div>

            <div className="d-grid gap-2 mt-4">
              <button type="submit" className="btn btn-danger btn-lg fw-bold">
                ENTRAR
              </button>
            </div>

            {error && (
              <div className="alert alert-danger mt-3 py-2 text-center small">
                {error}
              </div>
            )}
          </form>

          <hr className="my-4" />

          <div className="text-center">
            <p className="text-muted small mb-3">O CONTINÚA CON</p>
            <div className="d-flex flex-column align-items-center gap-2">
              <a
                href="http://localhost:3000/api/auth/google"
                className="btn btn-outline-dark w-100 py-2 fw-bold"
              >
                <i className="fab fa-google me-2 text-danger"></i> GOOGLE
              </a>
              <a
                href="http://localhost:3000/api/auth/facebook"
                className="btn btn-outline-dark w-100 py-2 fw-bold"
              >
                <i className="fab fa-facebook-f me-2 text-primary"></i> FACEBOOK
              </a>
            </div>

            <div className="text-center mt-4">
              <p className="small">
                ¿NO TIENES CUENTA?{" "}
                <a
                  href="/registro"
                  className="text-danger fw-bold text-decoration-none"
                >
                  REGÍSTRATE
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>©2026 JADDA SPORTS TODOS LOS DERECHOS RESERVADOS.</p>
      </footer>
    </div>
  );
}

export default Login;

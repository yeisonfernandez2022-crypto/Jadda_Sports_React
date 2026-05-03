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
        setError(data.message || "Credenciales incorrectas");
      }
    } catch (err) {
      aplicarShake();
      setError("Error de conexión con el servidor.");
    }
  };

  return (
    <div className="login-container-wrapper">
      <main className="login-main">
        <div className={`login-card ${shake ? "shake-animation" : ""}`}>
          
          <div className="login-brand">
            <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
            <p className="brand-tagline">PREMIUM SPORT STORE</p>
          </div>

          <header className="login-header">
            <h2>Iniciar Sesión</h2>
            <p>Ingresa tus datos para acceder a tu cuenta</p>
          </header>

          <form onSubmit={handleLogin} className="login-form" autoComplete="off">
            <div className="form-group-custom">
              <label htmlFor="email">CORREO ELECTRÓNICO</label>
              <input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={correo}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCorreo(e.target.value)}
                required
              />
            </div>

            <div className="form-group-custom">
              <div className="label-row">
                <label htmlFor="password">CONTRASEÑA</label>
                <a href="/recuperar" className="forgot-password">¿Olvidaste tu contraseña?</a>
              </div>
              <div className="password-input-container">
                <input
                  id="password"
                  type={mostrar ? "text" : "password"}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="btn-toggle-view"
                  onClick={() => setMostrar(!mostrar)}
                >
                  <i className={`fas ${mostrar ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login-submit">
              ENTRAR
            </button>

            {error && <div className="error-badge">{error}</div>}
          </form>

          <div className="social-divider">
            <span>O continúa con</span>
          </div>

          <div className="social-actions">
  <a 
    href="http://localhost:3000/api/auth/google" 
    className="social-btn google"
  >
    <i className="fab fa-google"></i> Google
  </a>
  <a 
    href="http://localhost:3000/api/auth/facebook" 
    className="social-btn facebook"
  >
    <i className="fab fa-facebook-f"></i> Facebook
  </a>
</div>

          <footer className="login-footer-links">
            <p>¿No tienes una cuenta? <a href="/registro">Regístrate gratis</a></p>
          </footer >
        </div>
      </main>

      <footer className="legal-footer">
        <p>© 2026 JADDA SPORTS. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default Login;
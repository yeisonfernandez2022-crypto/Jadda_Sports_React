import { useState } from "react";
import axios from "axios";
import { 
  EyeFill, EyeSlashFill, CheckCircleFill, 
  ShieldLockFill, XCircleFill, EnvelopeFill, ArrowLeft
} from "react-bootstrap-icons"; 
import "../css/Login.css"; 

function Recuperar() {
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validaciones = {
    minimo: password.length >= 8,
    numero: /\d/.test(password),
    mayuscula: /[A-Z]/.test(password),
    coinciden: password === confirmarPassword && password !== ""
  };

  const todoValido = Object.values(validaciones).every(v => v === true);

  const handleEnviarMail = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post("http://localhost:3000/api/auth/recuperar-password", { 
        email: email.trim().toLowerCase() 
      });
      setPaso(2);
    } catch (err) {
      setError("No encontramos ese correo.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async (e: any) => {
    e.preventDefault();
    if (!todoValido) return;
    setLoading(true);
    try {
      await axios.post("http://localhost:3000/api/auth/update-password", { email, codigo, password });
      setPaso(3);
    } catch (err: any) {
      setError(err.response?.data || "Error al actualizar.");
    } finally {
      setLoading(false);
    }
  };

  // --- SOLUCIÓN: RENDERIZADO POR FUNCIONES SEPARADAS ---
  
  const renderPaso1 = () => (
    <div key="p1">
      <div className="text-center mb-4">
        <EnvelopeFill size={50} className="text-danger mb-3" />
        <h2 className="fw-bold">RECUPERAR CLAVE</h2>
      </div>
      <form onSubmit={handleEnviarMail}>
        <div className="mb-4">
          <label className="form-label fw-bold small">CORREO ELECTRÓNICO</label>
          <input type="email" className="form-control form-control-lg" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger py-2 small text-center">{error}</div>}
        <button type="submit" className="btn btn-danger btn-lg w-100 fw-bold" disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR CÓDIGO"}
        </button>
      </form>
    </div>
  );

  const renderPaso2 = () => (
    <div key="p2">
      <div className="text-center mb-4">
        <ShieldLockFill size={50} className="text-danger mb-3" />
        <h2 className="fw-bold">NUEVA CONTRASEÑA</h2>
      </div>
      <form onSubmit={handleRestablecer}>
        <div className="mb-3">
          <label className="form-label fw-bold small">CÓDIGO</label>
          <input type="text" className="form-control form-control-lg text-center fw-bold" maxLength={6} required value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ letterSpacing: '5px' }} />
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold small">NUEVA CLAVE</label>
          <div className="input-group">
            <input type={showPassword ? "text" : "password"} className="form-control form-control-lg" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="input-group-text bg-white" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeSlashFill /> : <EyeFill />}
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label fw-bold small">CONFIRMAR CLAVE</label>
          <input type={showPassword ? "text" : "password"} className="form-control form-control-lg" required value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} />
        </div>
        <div className="card bg-light border-0 p-3 mb-4 small">
           <div className={validaciones.minimo ? "text-success" : "text-muted"}><CheckCircleFill className="me-2"/>Mínimo 8 caracteres</div>
           <div className={validaciones.numero ? "text-success" : "text-muted"}><CheckCircleFill className="me-2"/>Un número</div>
           <div className={validaciones.mayuscula ? "text-success" : "text-muted"}><CheckCircleFill className="me-2"/>Una mayúscula</div>
        </div>
        {error && <div className="alert alert-danger py-2 small text-center">{error}</div>}
        <button type="submit" className="btn btn-danger btn-lg w-100 fw-bold" disabled={!todoValido || loading}>GUARDAR CAMBIOS</button>
      </form>
    </div>
  );

  const renderPaso3 = () => (
    <div key="p3" className="text-center py-4">
      <CheckCircleFill size={70} className="text-success mb-3" />
      <h2 className="fw-bold">¡ÉXITO!</h2>
      <button onClick={() => window.location.href = "/login"} className="btn btn-dark btn-lg w-100 fw-bold mt-3">INICIAR SESIÓN</button>
    </div>
  );

  return (
    <div className="login-page">
      <header className="header">
        <a href="/" className="logo-text">JADDA SPORTS <span className="logo-sub">SPORT STORE</span></a>
      </header>
      <main className="main-container">
        <div className="form-area shadow-lg p-4 p-md-5">
          {/* AQUÍ ESTÁ EL TRUCO: Solo un hijo directo que cambia completamente */}
          {paso === 1 && renderPaso1()}
          {paso === 2 && renderPaso2()}
          {paso === 3 && renderPaso3()}

          {paso !== 3 && (
            <div className="text-center mt-4 pt-3 border-top">
              <a href="/login" className="text-muted small text-decoration-none fw-bold">
                <ArrowLeft className="me-2" /> VOLVER AL LOGIN
              </a>
            </div>
          )}
        </div>
      </main>
      <footer className="footer"><p>© 2026 JADDA SPORTS.</p></footer>
    </div>
  );
}

export default Recuperar;
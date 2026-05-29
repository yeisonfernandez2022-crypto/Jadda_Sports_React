import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react"; // <-- Agrega KeyboardEvent aquí
import axios from "axios";
import { 
  EyeFill, EyeSlashFill, 
  ShieldLockFill, ArrowLeft, CheckCircleFill
} from "react-bootstrap-icons"; 
import { Link } from "react-router-dom";
import "../css/Recuperar.css";

function Recuperar() {
  // ESTADOS DE FLUJO Y DATOS
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState("");
  const [codigoArray, setCodigoArray] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  
  // ESTADOS DE INTERFAZ
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  // ESTADOS DEL TEMPORIZADOR (REENVÍO)
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // --- LÓGICA DEL TEMPORIZADOR PERSISTENTE ---
  
  const iniciarTemporizador = (segundos: number) => {
    const ahora = Date.now();
    const expiracion = ahora + segundos * 1000;
    localStorage.setItem("resendExpiry", expiracion.toString());
    setTimeLeft(segundos);
    setCanResend(false);
  };

  useEffect(() => {
    if (paso === 2) {
      const savedExpiry = localStorage.getItem("resendExpiry");
      if (savedExpiry) {
        const diff = Math.round((parseInt(savedExpiry) - Date.now()) / 1000);
        if (diff > 0) {
          setTimeLeft(diff);
          setCanResend(false);
        } else {
          setCanResend(true);
        }
      } else {
        iniciarTemporizador(60);
      }
    }
  }, [paso]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // --- UTILIDADES ---

  const aplicarShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const calcularFuerza = (): number => {
    let fuerza = 0;
    if (/[A-Z]/.test(password)) fuerza++;
    if (/[0-9]/.test(password)) fuerza++;
    if (password.length >= 8) fuerza++;
    return fuerza;
  };

  const fuerza = calcularFuerza();
  const todoValido = fuerza === 3 && password === confirmarPassword && password !== "";

  const handleCodigoChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const nuevoCodigo = [...codigoArray];
    nuevoCodigo[index] = value.substring(value.length - 1);
    setCodigoArray(nuevoCodigo);

    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !codigoArray[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  // --- HANDLERS DE API ---

  const handleEnviarMail = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/recuperar-password", { 
        email: email.trim().toLowerCase() 
      });
      setPaso(2);
    } catch (err) {
      aplicarShake();
      setError("No encontramos ese correo en nuestra base de datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleReenviarCodigo = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    setError("");
    try {
      // Usando la ruta exacta de tu authroutes.js
      await axios.post("/api/auth/reenviar-codigo", { 
        email: email.trim().toLowerCase() 
      });
      iniciarTemporizador(60);
      setCodigoArray(["", "", "", "", "", ""]);
      document.getElementById("code-0")?.focus();
    } catch (err) {
      aplicarShake();
      setError("Error al reenviar el código. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    const codigoCompleto = codigoArray.join("").trim();
    
    if (codigoCompleto.length < 6) {
      aplicarShake();
      setError("Por favor completa el código de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // CORRECCIÓN AQUÍ: Cambiamos '/confirmar' por '/verificar-codigo'
      await axios.post("/api/auth/verificar-codigo", { 
        email: email.trim().toLowerCase(), 
        codigo: codigoCompleto 
      });
      
      localStorage.removeItem("resendExpiry"); 
      setPaso(3); // Ahora sí te dejará pasar al Paso 3
    } catch (err: any) {
      aplicarShake();
      // Ahora el mensaje vendrá de la nueva lógica del backend
      setError(err.response?.data?.message || "Código inválido o expirado.");
    } finally {
      setLoading(false);
    }
};

  const handleRestablecer = async (e: FormEvent) => {
    e.preventDefault();
    if (!todoValido) return;
    setLoading(true);
    setError("");
    try {
      const codigoFinal = codigoArray.join("").trim();
      await axios.post("/api/auth/update-password", { 
        email: email.trim().toLowerCase(), 
        codigo: codigoFinal, 
        password 
      });
      setPaso(4);
    } catch (err: any) {
      aplicarShake();
      setError(err.response?.data?.message || "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERS ---

  const renderPaso1 = () => (
    <div key="p1">
      <div className="login-brand">
        <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
        <p className="brand-tagline">RECUPERACIÓN DE CUENTA</p>
      </div>
      <header className="login-header">
        <p>Ingresa tu correo para recibir un código de seguridad.</p>
      </header>
      <form onSubmit={handleEnviarMail} className="login-form">
        <div className="form-group-custom">
          <label>CORREO ELECTRÓNICO</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </div>
        {error && <div className="error-banner-pro footer-error">{error}</div>}
        <button type="submit" className="btn-login-submit" disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR CÓDIGO"}
        </button>
      </form>
    </div>
  );

  const renderPaso2 = () => (
    <div key="p2">
      <div className="login-brand">
        <ShieldLockFill size={40} color="#e63946" style={{ marginBottom: '10px' }} />
        <h1 className="brand-name">VERIFICAR <span>CÓDIGO</span></h1>
      </div>
      <header className="login-header">
        <p>Introduce los 6 dígitos enviados a <strong>{email}</strong></p>
      </header>
      <form onSubmit={handleValidarCodigo} className="login-form">
        <div className="codigo-container-cuadritos">
          {codigoArray.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              className="input-cuadrito"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodigoChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              required
            />
          ))}
        </div>
        {error && <div className="error-banner-pro footer-error">{error}</div>}
        <button type="submit" className="btn-login-submit" disabled={loading}>
          {loading ? "VERIFICANDO..." : "CONTINUAR"}
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <button 
            type="button" 
            onClick={handleReenviarCodigo}
            disabled={!canResend || loading}
            style={{
              background: 'none',
              border: 'none',
              color: canResend ? '#e63946' : '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: canResend ? 'pointer' : 'not-allowed',
              textDecoration: canResend ? 'underline' : 'none'
            }}
          >
            {canResend ? "Reenviar nuevo código" : `Reenviar en ${timeLeft}s`}
          </button>
        </div>
      </form>
    </div>
  );

  const renderPaso3 = () => (
    <div key="p3">
      <div className="login-brand">
        <h1 className="brand-name">NUEVA <span>CLAVE</span></h1>
        <p className="brand-tagline">ESTABLECE TU SEGURIDAD</p>
      </div>
      <form onSubmit={handleRestablecer} className="login-form">
        <div className="form-group-custom">
          <label>NUEVA CONTRASEÑA</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Mínimo 8 caracteres"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle-btn-custom"
              style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              {showPassword ? <EyeSlashFill size={20} /> : <EyeFill size={20} />}
            </button>
          </div>

          <div className="password-checker">
            <div className="checker-list">
              <span className={/[A-Z]/.test(password) ? "valid" : ""}>✔ Mayúscula</span>
              <span className={/[0-9]/.test(password) ? "valid" : ""}>✔ Número</span>
              <span className={password.length >= 8 ? "valid" : ""}>✔ +8 Caracteres</span>
            </div>
            <div className="progress-mini">
              <div 
                className={`bar ${fuerza === 3 ? "strong" : fuerza === 2 ? "medium" : "weak"}`}
                style={{ width: `${(fuerza / 3) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="form-group-custom">
          <label>CONFIRMAR CONTRASEÑA</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required 
            value={confirmarPassword} 
            onChange={(e) => setConfirmarPassword(e.target.value)} 
            placeholder="Repite tu contraseña"
          />
        </div>

        {error && <div className="error-banner-pro footer-error">{error}</div>}

        <button type="submit" className="btn-login-submit" disabled={!todoValido || loading}>
          {loading ? "GUARDANDO..." : "ACTUALIZAR CONTRASEÑA"}
        </button>
      </form>
    </div>
  );

  const renderPaso4 = () => (
    <div key="p4" style={{ textAlign: 'center', padding: '20px' }}>
      <CheckCircleFill size={80} color="#10b981" style={{ marginBottom: '20px' }} />
      <h2 className="brand-name">¡CAMBIO EXITOSO!</h2>
      <p style={{ color: '#64748b', margin: '15px 0' }}>Tu cuenta está protegida. Ya puedes iniciar sesión.</p>
      <Link to="/login" className="btn-login-submit" style={{ textDecoration: 'none', display: 'block' }}>
        IR AL LOGIN
      </Link>
    </div>
  );

  return (
    <div className="login-container-wrapper">
      <main className="login-main">
        <div className={`login-card register-card ${shake ? "shake-animation" : ""}`}>
          {paso === 1 && renderPaso1()}
          {paso === 2 && renderPaso2()}
          {paso === 3 && renderPaso3()}
          {paso === 4 && renderPaso4()}

          {paso < 4 && (
            <footer className="login-footer-links" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <Link to="/login" className="back-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', color: '#64748b', fontWeight: '700' }}>
                <ArrowLeft /> VOLVER AL LOGIN
              </Link>
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}

export default Recuperar;
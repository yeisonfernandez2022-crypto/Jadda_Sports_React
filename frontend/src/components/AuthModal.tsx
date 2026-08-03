import { useState, type ChangeEvent, type FormEvent, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import "../css/Login.css";
import "../css/Register.css";
import "../css/AuthModal.css";

interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
}

interface RegisterForm {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  direccion: string;
  password: string;
  confirmar: string;
}

type View = 'login' | 'register' | 'verify' | 'forgot-email' | 'forgot-code' | 'forgot-password' | 'forgot-success';

export default function AuthModal({ mode, onClose }: AuthModalProps) {
  const { login, refreshPerfil } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<View>(mode);

  // Login state
  const [correo, setCorreo] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register state
  const [form, setForm] = useState<RegisterForm>({
    nombre: "", apellido: "", email: "", telefono: "", direccion: "", password: "", confirmar: ""
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [aceptaDevoluciones, setAceptaDevoluciones] = useState(false);
  const [errorBackend, setErrorBackend] = useState<string | null>(null);
  const [camposError, setCamposError] = useState<Record<string, boolean>>({});
  const [loginCamposError, setLoginCamposError] = useState<Record<string, boolean>>({});
  const [forgotCamposError, setForgotCamposError] = useState<Record<string, boolean>>({});
  const [modalType, setModalType] = useState<'terminos' | 'privacidad' | 'devoluciones' | null>(null);

  // Verify state
  const [verifyCodigos, setVerifyCodigos] = useState(["", "", "", "", "", ""]);
  const [verifySegundos, setVerifySegundos] = useState(0);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [iniciandoSesion, setIniciandoSesion] = useState(false);
  const [reenvioBloqueado, setReenvioBloqueado] = useState(false);
  const verifyInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCodigos, setForgotCodigos] = useState(["", "", "", "", "", ""]);
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [forgotTimeLeft, setForgotTimeLeft] = useState(0);
  const [forgotCanResend, setForgotCanResend] = useState(false);
  const [forgotReenvioBloqueado, setForgotReenvioBloqueado] = useState(false);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // OAuth popup
  const openOAuthPopup = useCallback((provider: 'google' | 'facebook') => {
    const url = `/api/auth/${provider}?from=/oauth-popup-callback`;
    const w = 600, h = 700;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    window.open(url, `oauth-${provider}`, `width=${w},height=${h},left=${left},top=${top},popup=1`);
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'oauth-success') {
        refreshPerfil().then(() => onClose());
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose, refreshPerfil]);

  // ESC close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Sync view with mode
  useEffect(() => {
    setView(mode);
    setError("");
    setErrorBackend(null);
  }, [mode]);

  // Verify timer
  useEffect(() => {
    if (view !== 'verify' || !verifyEmail || verifySegundos <= 0) return;
    const intervalo = setInterval(() => {
      const meta = localStorage.getItem(`timer_expira_${verifyEmail}`);
      if (meta) {
        const restante = Math.ceil((parseInt(meta) - Date.now()) / 1000);
        if (restante > 0) setVerifySegundos(restante);
        else {
          setVerifySegundos(0);
          localStorage.removeItem(`timer_expira_${verifyEmail}`);
          clearInterval(intervalo);
        }
      }
    }, 1000);
    return () => clearInterval(intervalo);
  }, [view, verifyEmail, verifySegundos]);

  // Forgot timer
  useEffect(() => {
    if (view !== 'forgot-code') return;
    const savedExpiry = localStorage.getItem("resendExpiry");
    if (savedExpiry) {
      const diff = Math.round((parseInt(savedExpiry) - Date.now()) / 1000);
      if (diff > 0) { setForgotTimeLeft(diff); setForgotCanResend(false); }
      else { setForgotCanResend(true); }
    } else {
      iniciarForgotTimer(60);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'forgot-code') return;
    if (forgotTimeLeft <= 0) { setForgotCanResend(true); return; }
    const timer = setInterval(() => {
      setForgotTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); setForgotCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotTimeLeft, view]);

  const aplicarShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  // ==================== LOGIN ====================
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginCamposError({});
    const loginErrores: Record<string, boolean> = {};
    if (!correo.trim()) loginErrores.correo = true;
    if (!passwordLogin.trim()) loginErrores.password = true;
    if (Object.keys(loginErrores).length) { setLoginCamposError(loginErrores); setError("Completa todos los campos."); aplicarShake(); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: correo, password: passwordLogin })
      });
      const data = await response.json();
      if (response.ok) {
        login({
          ID_USUARIO: data.usuario?.ID_USUARIO || data.id,
          NOMBRE_USUARIO: data.nombre || "Usuario",
          foto_url: data.usuario?.foto_url || null,
          ID_ROL: data.usuario?.ID_ROL
        });
        onClose();
        // El administrador entra directo al panel
        if (data.usuario?.ID_ROL === 1) {
          navigate("/admin");
        }
      } else {
        aplicarShake();
        setError(data.message || "Credenciales incorrectas");
      }
    } catch {
      aplicarShake();
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== REGISTER ====================
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setCamposError(prev => { if (prev[name]) { const n = { ...prev }; delete n[name]; return n; } return prev; });
    if (errorBackend) setErrorBackend(null);
  };

  const validarPasswordRegister = () => {
    return /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && form.password.length >= 8;
  };

  const calcularFuerza = (): number => {
    let f = 0;
    if (/[A-Z]/.test(form.password)) f++;
    if (/[0-9]/.test(form.password)) f++;
    if (form.password.length >= 8) f++;
    return f;
  };

  const fuerza = calcularFuerza();

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorBackend(null);
    setCamposError({});

    const nuevos: Record<string, boolean> = {};
    if (!form.nombre.trim()) nuevos.nombre = true;
    if (!form.apellido.trim()) nuevos.apellido = true;
    if (!form.email.trim()) nuevos.email = true;
    if (!form.telefono.trim()) nuevos.telefono = true;
    if (!form.direccion.trim()) nuevos.direccion = true;
    if (Object.keys(nuevos).length) { setCamposError(nuevos); setErrorBackend("Completa todos los campos obligatorios."); aplicarShake(); return; }
    if (!aceptaTerminos) { setErrorBackend("Debes aceptar los Términos y Condiciones para continuar."); aplicarShake(); return; }
    if (!aceptaPrivacidad) { setErrorBackend("Debes aceptar la Política de Privacidad para continuar."); aplicarShake(); return; }
    if (!aceptaDevoluciones) { setErrorBackend("Debes aceptar la Política de Devoluciones y Garantías para continuar."); aplicarShake(); return; }
    if (!validarPasswordRegister()) { setErrorBackend("La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número."); aplicarShake(); return; }
    if (form.password !== form.confirmar) { setErrorBackend("Las contraseñas ingresadas no coinciden."); aplicarShake(); return; }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/registro", form);
      if (res.data.ok || res.status === 200 || res.status === 201) {
        setVerifyEmail(form.email);
        const nuevaMeta = Date.now() + 60 * 1000;
        localStorage.setItem(`timer_expira_${form.email}`, nuevaMeta.toString());
        setVerifySegundos(60);
        setView('verify');
      }
    } catch (error: any) {
      aplicarShake();
      const mensaje = error.response?.data?.message || "Error al registrar el usuario. Intente de nuevo.";
      setErrorBackend(mensaje);
    } finally {
      setLoading(false);
    }
  };

  // ==================== VERIFY ====================
  const handleVerifyChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nuevos = [...verifyCodigos];
    nuevos[index] = value.slice(-1);
    setVerifyCodigos(nuevos);
    if (value && index < 5) verifyInputs.current[index + 1]?.focus();
  };

  const handleVerifyKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verifyCodigos[index] && index > 0) {
      verifyInputs.current[index - 1]?.focus();
    }
  };

  const handleReenviarVerify = async () => {
    if (verifySegundos > 0 || loading) return;
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/reenviar-codigo", { email: verifyEmail, tipo: 'verify' });
      const nuevaMeta = Date.now() + 60 * 1000;
      localStorage.setItem(`timer_expira_${verifyEmail}`, nuevaMeta.toString());
      setVerifySegundos(60);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setReenvioBloqueado(true);
      }
      setError(err.response?.data?.message || "No se pudo enviar el código.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    const codigo = verifyCodigos.join("");
    if (codigo.length < 6) return;
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/confirmar", { email: verifyEmail, codigo });
      setVerificado(true);
      localStorage.removeItem(`timer_expira_${verifyEmail}`);
      setIniciandoSesion(true);
      // Auto-login después de verificar
      try {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: form.email, password: form.password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          login({
            ID_USUARIO: loginData.usuario?.ID_USUARIO || loginData.id,
            NOMBRE_USUARIO: loginData.nombre || "Usuario",
            foto_url: loginData.usuario?.foto_url || null,
            ID_ROL: loginData.usuario?.ID_ROL
          });
        }
      } catch {
        // Si el auto-login falla, el usuario puede iniciar sesión manualmente
      }
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setIniciandoSesion(false);
      setError(err.response?.data?.message || "Código incorrecto");
    } finally {
      setLoading(false);
    }
  };

  // ==================== FORGOT PASSWORD ====================
  const iniciarForgotTimer = (segundos: number) => {
    const ahora = Date.now();
    localStorage.setItem("resendExpiry", (ahora + segundos * 1000).toString());
    setForgotTimeLeft(segundos);
    setForgotCanResend(false);
  };

  const handleForgotEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setForgotCamposError({});
    if (!forgotEmail.trim()) { setForgotCamposError({ email: true }); setError("Ingresa tu correo electrónico."); aplicarShake(); return; }
    setLoading(true);
    try {
      await axios.post("/api/auth/recuperar-password", { email: forgotEmail.trim().toLowerCase() });
      setView('forgot-code');
    } catch {
      aplicarShake();
      setError("No encontramos ese correo en nuestra base de datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotCodigoChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const nuevo = [...forgotCodigos];
    nuevo[index] = value.substring(value.length - 1);
    setForgotCodigos(nuevo);
    if (value && index < 5) document.getElementById(`fcode-${index + 1}`)?.focus();
  };

  const handleForgotKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !forgotCodigos[index] && index > 0) {
      document.getElementById(`fcode-${index - 1}`)?.focus();
    }
  };

  const handleReenviarForgot = async () => {
    if (!forgotCanResend || loading) return;
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/reenviar-codigo", { email: forgotEmail.trim().toLowerCase(), tipo: 'recovery' });
      iniciarForgotTimer(60);
      setForgotCodigos(["", "", "", "", "", ""]);
      document.getElementById("fcode-0")?.focus();
    } catch (err: any) {
      if (err.response?.status === 429) {
        setForgotReenvioBloqueado(true);
      }
      aplicarShake();
      setError(err.response?.data?.message || "Error al reenviar el código.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const codigo = forgotCodigos.join("").trim();
    if (codigo.length < 6) { aplicarShake(); setError("Completa el código de 6 dígitos."); return; }
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/verificar-codigo", { email: forgotEmail.trim().toLowerCase(), codigo });
      localStorage.removeItem("resendExpiry");
      setView('forgot-password');
    } catch (err: any) {
      aplicarShake();
      setError(err.response?.data?.message || "Código inválido o expirado.");
    } finally {
      setLoading(false);
    }
  };

  const calcularFuerzaForgot = (): number => {
    let f = 0;
    if (/[A-Z]/.test(forgotNewPassword)) f++;
    if (/[0-9]/.test(forgotNewPassword)) f++;
    if (forgotNewPassword.length >= 8) f++;
    return f;
  };

  const fuerzaForgot = calcularFuerzaForgot();
  const forgotValido = fuerzaForgot === 3 && forgotNewPassword === forgotConfirmPassword && forgotNewPassword !== "";

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotValido) return;
    setLoading(true);
    setError("");
    try {
      const codigoFinal = forgotCodigos.join("").trim();
      await axios.post("/api/auth/update-password", { email: forgotEmail.trim().toLowerCase(), codigo: codigoFinal, password: forgotNewPassword });
      setView('forgot-success');
    } catch (err: any) {
      aplicarShake();
      setError(err.response?.data?.message || "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDERERS ====================
  const renderLoginForm = () => (
    <>
      <div className="login-brand">
        <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
        <p className="brand-tagline">PREMIUM SPORT STORE</p>
      </div>
      <header className="login-header">
        <h2>Iniciar Sesión</h2>
        <p>Ingresa tus datos para acceder a tu cuenta</p>
      </header>
      <form onSubmit={handleLogin} className="login-form" autoComplete="off" noValidate>
        <div className="form-group-custom">
          <label htmlFor="email-modal">CORREO ELECTRÓNICO</label>
          <input id="email-modal" type="email" placeholder="correo@ejemplo.com" value={correo} onChange={(e) => { setCorreo(e.target.value); setLoginCamposError(prev => { const n = { ...prev }; delete n.correo; return n; }); }} className={loginCamposError.correo ? 'input-error' : ''} />
        </div>
        <div className="form-group-custom">
          <div className="label-row">
            <label htmlFor="password-modal">CONTRASEÑA</label>
            <span className="forgot-password" style={{ cursor: 'pointer' }} onClick={() => setView('forgot-email')}>¿Olvidaste tu contraseña?</span>
          </div>
          <div className="password-input-container">
            <input id="password-modal" type={mostrar ? "text" : "password"} placeholder="Tu contraseña" value={passwordLogin} onChange={(e) => { setPasswordLogin(e.target.value); setLoginCamposError(prev => { const n = { ...prev }; delete n.password; return n; }); }} className={loginCamposError.password ? 'input-error' : ''} />
            <button type="button" className="btn-toggle-view" onClick={() => setMostrar(!mostrar)}>
              <i className={`fas ${mostrar ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
        </div>
        <button type="submit" className="btn-login-submit" disabled={loading}>{loading ? "ENTRANDO..." : "ENTRAR"}</button>
        {error && <div className="error-badge">{error}</div>}
      </form>
      <div className="social-divider"><span>O continúa con</span></div>
      <div className="social-actions">
        <button type="button" className="social-btn google" onClick={() => openOAuthPopup('google')}><i className="fab fa-google"></i> Google</button>
        <button type="button" className="social-btn facebook" onClick={() => openOAuthPopup('facebook')}><i className="fab fa-facebook-f"></i> Facebook</button>
      </div>
      <footer className="login-footer-links">
        <p>¿No tienes una cuenta? <span className="link-terms" onClick={() => setView('register')}>Regístrate gratis</span></p>
      </footer>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <div className="login-brand">
        <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
        <p className="brand-tagline">PREMIUM SPORT STORE</p>
      </div>
      <header className="login-header">
        <h2>Crear Cuenta</h2>
        <p>Regístrate para gestionar tus pedidos y favoritos</p>
      </header>
      <form onSubmit={handleRegister} className="login-form" autoComplete="off" noValidate>
        <div className="register-row">
          <div className="form-group-custom">
            <label>NOMBRE</label>
            <input type="text" name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} className={camposError.nombre ? 'input-error' : ''} />
          </div>
          <div className="form-group-custom">
            <label>APELLIDO</label>
            <input type="text" name="apellido" placeholder="Apellido" value={form.apellido} onChange={handleChange} className={camposError.apellido ? 'input-error' : ''} />
          </div>
        </div>
        <div className="form-group-custom">
          <label>CORREO ELECTRÓNICO</label>
          <input type="email" name="email" placeholder="correo@ejemplo.com" value={form.email} onChange={handleChange} className={camposError.email ? 'input-error' : ''} />
        </div>
        <div className="register-row">
          <div className="form-group-custom">
            <label>TELÉFONO</label>
            <input type="tel" name="telefono" placeholder="Ej: 3001234567" value={form.telefono} onChange={handleChange} className={camposError.telefono ? 'input-error' : ''} />
          </div>
          <div className="form-group-custom">
            <label>DIRECCIÓN</label>
            <input type="text" name="direccion" placeholder="Calle, Carrera, Barrio" value={form.direccion} onChange={handleChange} className={camposError.direccion ? 'input-error' : ''} />
          </div>
        </div>
        <div className="form-group-custom">
          <label>CONTRASEÑA</label>
          <input type="password" name="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={handleChange} className={camposError.password ? 'input-error' : ''} />
          <div className="password-checker">
            <div className="checker-list">
              <span className={/[A-Z]/.test(form.password) ? "valid" : ""}>{/[A-Z]/.test(form.password) ? "✔" : "○"} Mayúscula</span>
              <span className={/[0-9]/.test(form.password) ? "valid" : ""}>{/[0-9]/.test(form.password) ? "✔" : "○"} Número</span>
              <span className={form.password.length >= 8 ? "valid" : ""}>{form.password.length >= 8 ? "✔" : "○"} +8 Caracteres</span>
            </div>
            <div className="progress-mini">
              <div className={`bar ${fuerza === 3 ? "strong" : fuerza === 2 ? "medium" : "weak"}`} style={{ width: `${(fuerza / 3) * 100}%` }}></div>
            </div>
          </div>
        </div>
        <div className="form-group-custom">
          <label>CONFIRMAR CONTRASEÑA</label>
          <input type="password" name="confirmar" placeholder="Repite tu contraseña" value={form.confirmar} onChange={handleChange} className={camposError.confirmar ? 'input-error' : ''} />
        </div>
        <div className="terms-group">
          <div className="terms-container">
            <input type="checkbox" id="terms-modal" checked={aceptaTerminos} onChange={() => setAceptaTerminos(!aceptaTerminos)} />
            <label htmlFor="terms-modal">Acepto los <span className="link-terms" onClick={(e) => { e.preventDefault(); setModalType('terminos'); }}>Términos y Condiciones</span></label>
          </div>
          <div className="terms-container">
            <input type="checkbox" id="privacidad-modal" checked={aceptaPrivacidad} onChange={() => setAceptaPrivacidad(!aceptaPrivacidad)} />
            <label htmlFor="privacidad-modal">Acepto la <span className="link-terms" onClick={(e) => { e.preventDefault(); setModalType('privacidad'); }}>Política de Privacidad</span></label>
          </div>
          <div className="terms-container">
            <input type="checkbox" id="devoluciones-modal" checked={aceptaDevoluciones} onChange={() => setAceptaDevoluciones(!aceptaDevoluciones)} />
            <label htmlFor="devoluciones-modal">Acepto la <span className="link-terms" onClick={(e) => { e.preventDefault(); setModalType('devoluciones'); }}>Política de Devoluciones y Garantías</span></label>
          </div>
        </div>
        {errorBackend && <div className="error-badge" style={{ marginTop: "10px", marginBottom: "15px", textAlign: "center" }}>{errorBackend}</div>}
        <button type="submit" className="btn-login-submit" disabled={loading}>{loading ? "PROCESANDO..." : "CREAR CUENTA"}</button>
      </form>
      <div className="social-divider"><span>O regístrate con</span></div>
      <div className="social-actions">
        <button type="button" className="social-btn google" onClick={() => openOAuthPopup('google')}><i className="fab fa-google"></i> Google</button>
        <button type="button" className="social-btn facebook" onClick={() => openOAuthPopup('facebook')}><i className="fab fa-facebook-f"></i> Facebook</button>
      </div>
      <footer className="login-footer-links">
        <p>¿Ya tienes cuenta? <span className="link-terms" onClick={() => setView('login')}>Inicia sesión</span></p>
      </footer>
    </>
  );

  const renderVerify = () => {
    if (verificado) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '80px', color: '#e63946', marginBottom: '20px' }}><i className="fas fa-check-circle"></i></div>
          <h2 className="brand-name">¡LISTO!</h2>
          <p style={{ color: '#64748b' }}>Cuenta verificada en JADDA SPORTS.</p>
          {iniciandoSesion && (
            <div style={{ marginTop: '16px' }}>
              <div className="spinner-border spinner-border-sm text-danger me-2" role="status" />
              <span style={{ color: '#64748b', fontSize: '14px' }}>Iniciando sesión...</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="login-brand">
          <h1 className="brand-name">VERIFICAR <span>CÓDIGO</span></h1>
        </div>
        <p className="text-center small text-muted mb-4">Enviado a: <b>{verifyEmail}</b></p>
        <form onSubmit={handleVerifySubmit} className="login-form" noValidate>
          <div className="auth-codigo-container">
            {verifyCodigos.map((digito, index) => (
              <input
                key={index}
                ref={(el) => { verifyInputs.current[index] = el; }}
                type="text"
                className="auth-cuadrito-input"
                value={digito}
                onChange={(e) => handleVerifyChange(index, e.target.value)}
                onKeyDown={(e) => handleVerifyKeyDown(index, e)}
                maxLength={1}
                disabled={loading}
              />
            ))}
          </div>
          {error && <div className="error-badge">{error}</div>}
          <button type="submit" className="btn-login-submit" disabled={loading || verifyCodigos.join("").length < 6}>
            {loading ? "VALIDANDO..." : "CONFIRMAR"}
          </button>
        </form>
        <div className="mt-3 text-center">
          {reenvioBloqueado ? (
            <p className="text-muted small" style={{ color: '#e63946' }}>
              <i className="fas fa-ban me-1"></i> Límite de reenvíos alcanzado. Intenta más tarde.
            </p>
          ) : verifySegundos > 0 ? (
            <p className="text-muted small">Podrás reenviar en <b>{verifySegundos}s</b></p>
          ) : (
            <button type="button" className="btn-reenviar" onClick={handleReenviarVerify}
              style={{ background: 'none', border: 'none', color: '#e63946', fontWeight: 700, cursor: 'pointer' }}>
              <i className="fas fa-redo me-2"></i> REENVIAR CÓDIGO
            </button>
          )}
        </div>
        <footer className="login-footer-links border-top pt-3 mt-4">
          <span className="back-link" onClick={() => setView('register')}
            style={{ textDecoration: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer' }}>
            <i className="fas fa-arrow-left me-2"></i> VOLVER A REGISTRO
          </span>
        </footer>
      </>
    );
  };

  const renderForgotEmail = () => (
    <>
      <div className="login-brand">
        <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
        <p className="brand-tagline">RECUPERACIÓN DE CUENTA</p>
      </div>
      <header className="login-header">
        <p>Ingresa tu correo para recibir un código de seguridad.</p>
      </header>
      <form onSubmit={handleForgotEmail} className="login-form" noValidate>
        <div className="form-group-custom">
          <label>CORREO ELECTRÓNICO</label>
          <input type="email" value={forgotEmail} onChange={(e) => { setForgotEmail(e.target.value); setForgotCamposError(prev => { const n = { ...prev }; delete n.email; return n; }); }} placeholder="tu@correo.com" className={forgotCamposError.email ? 'input-error' : ''} />
        </div>
        {error && <div className="error-badge">{error}</div>}
        <button type="submit" className="btn-login-submit" disabled={loading}>{loading ? "ENVIANDO..." : "ENVIAR CÓDIGO"}</button>
      </form>
      <footer className="login-footer-links">
        <span className="back-link" onClick={() => setView('login')}
          style={{ textDecoration: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
          <i className="fas fa-arrow-left me-2"></i> VOLVER AL LOGIN
        </span>
      </footer>
    </>
  );

  const renderForgotCode = () => (
    <>
      <div className="login-brand">
        <i className="fas fa-shield-alt" style={{ fontSize: '40px', color: '#e63946', marginBottom: '10px' }}></i>
        <h1 className="brand-name">VERIFICAR <span>CÓDIGO</span></h1>
      </div>
      <header className="login-header">
        <p>Introduce los 6 dígitos enviados a <strong>{forgotEmail}</strong></p>
      </header>
      <form onSubmit={handleForgotCodeSubmit} className="login-form" noValidate>
        <div className="auth-codigo-container">
          {forgotCodigos.map((digit, index) => (
            <input
              key={index}
              id={`fcode-${index}`}
              type="text"
              className="auth-cuadrito-input"
              maxLength={1}
              value={digit}
              onChange={(e) => handleForgotCodigoChange(e.target.value, index)}
              onKeyDown={(e) => handleForgotKeyDown(e, index)}
            />
          ))}
        </div>
        {error && <div className="error-badge">{error}</div>}
        <button type="submit" className="btn-login-submit" disabled={loading}>{loading ? "VERIFICANDO..." : "CONTINUAR"}</button>
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          {forgotReenvioBloqueado ? (
            <p className="text-muted small" style={{ color: '#e63946' }}>
              <i className="fas fa-ban me-1"></i> Límite de reenvíos alcanzado. Intenta más tarde.
            </p>
          ) : (
            <button type="button" onClick={handleReenviarForgot} disabled={!forgotCanResend || loading}
              style={{ background: 'none', border: 'none', color: forgotCanResend ? '#e63946' : '#94a3b8', fontSize: '0.85rem', fontWeight: 700, cursor: forgotCanResend ? 'pointer' : 'not-allowed', textDecoration: forgotCanResend ? 'underline' : 'none' }}>
              {forgotCanResend ? "Reenviar nuevo código" : `Reenviar en ${forgotTimeLeft}s`}
            </button>
          )}
        </div>
      </form>
      <footer className="login-footer-links">
        <span className="back-link" onClick={() => setView('forgot-email')}
          style={{ textDecoration: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
          <i className="fas fa-arrow-left me-2"></i> VOLVER
        </span>
      </footer>
    </>
  );

  const renderForgotPassword = () => (
    <>
      <div className="login-brand">
        <h1 className="brand-name">NUEVA <span>CLAVE</span></h1>
        <p className="brand-tagline">ESTABLECE TU SEGURIDAD</p>
      </div>
      <form onSubmit={handleForgotReset} className="login-form" noValidate>
        <div className="form-group-custom">
          <label>NUEVA CONTRASEÑA</label>
          <div style={{ position: 'relative' }}>
            <input type={forgotShowPassword ? "text" : "password"} value={forgotNewPassword}
              onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <button type="button" onClick={() => setForgotShowPassword(!forgotShowPassword)}
              style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <i className={`fas ${forgotShowPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <div className="password-checker">
            <div className="checker-list">
              <span className={/[A-Z]/.test(forgotNewPassword) ? "valid" : ""}>✔ Mayúscula</span>
              <span className={/[0-9]/.test(forgotNewPassword) ? "valid" : ""}>✔ Número</span>
              <span className={forgotNewPassword.length >= 8 ? "valid" : ""}>✔ +8 Caracteres</span>
            </div>
            <div className="progress-mini">
              <div className={`bar ${fuerzaForgot === 3 ? "strong" : fuerzaForgot === 2 ? "medium" : "weak"}`}
                style={{ width: `${(fuerzaForgot / 3) * 100}%` }}></div>
            </div>
          </div>
        </div>
        <div className="form-group-custom">
          <label>CONFIRMAR CONTRASEÑA</label>
          <input type={forgotShowPassword ? "text" : "password"} value={forgotConfirmPassword}
            onChange={(e) => setForgotConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" />
        </div>
        {error && <div className="error-badge">{error}</div>}
        <button type="submit" className="btn-login-submit" disabled={!forgotValido || loading}>
          {loading ? "GUARDANDO..." : "ACTUALIZAR CONTRASEÑA"}
        </button>
      </form>
    </>
  );

  const renderForgotSuccess = () => (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: '80px', color: '#10b981', marginBottom: '20px' }}><i className="fas fa-check-circle"></i></div>
      <h2 className="brand-name">¡CAMBIO EXITOSO!</h2>
      <p style={{ color: '#64748b', margin: '15px 0' }}>Tu cuenta está protegida. Ya puedes iniciar sesión.</p>
      <button className="btn-login-submit" onClick={() => setView('login')}>IR AL LOGIN</button>
    </div>
  );

  const isMainView = view === 'login' || view === 'register';

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className={`auth-modal-card ${shake ? "shake-animation" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>&times;</button>

        {isMainView ? (
          <>
            <div className="auth-modal-tabs">
              <button className={`auth-modal-tab ${view === 'login' ? 'active' : ''}`} onClick={() => setView('login')}>INICIAR SESIÓN</button>
              <button className={`auth-modal-tab ${view === 'register' ? 'active' : ''}`} onClick={() => setView('register')}>CREAR CUENTA</button>
            </div>
            {view === 'login' ? renderLoginForm() : renderRegisterForm()}
          </>
        ) : view === 'verify' ? renderVerify()
        : view === 'forgot-email' ? renderForgotEmail()
        : view === 'forgot-code' ? renderForgotCode()
        : view === 'forgot-password' ? renderForgotPassword()
        : renderForgotSuccess()}
      </div>

      {/* Portal inner modals for terms/privacy/devoluciones */}
      {modalType === 'terminos' && createPortal(
        <div className="modal-overlay" onClick={() => setModalType(null)}><div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Términos y Condiciones de Uso</h3><div className="modal-body">
            <p>Bienvenido a Jadda Sports. Al acceder y utilizar nuestro sitio web, el usuario acepta los presentes Términos y Condiciones. Si no está de acuerdo con alguno de ellos, deberá abstenerse de utilizar nuestros servicios.</p>
            <h4>1. Objeto</h4><p>Jadda Sports es una tienda virtual dedicada a la comercialización de artículos deportivos, incluyendo calzado, ropa, accesorios y demás productos relacionados con la práctica del deporte.</p>
            <h4>2. Registro de usuarios</h4><p>El usuario podrá navegar libremente por el sitio web. Para realizar compras, podrá ser necesario proporcionar información personal veraz y actualizada. El usuario es responsable de la confidencialidad de sus datos de acceso.</p>
            <h4>3. Productos</h4><p>Los productos publicados incluyen fotografías, descripciones y precios con fines informativos. Aunque procuramos mantener la información actualizada, pueden presentarse diferencias mínimas en colores, tallas o especificaciones según el fabricante. La disponibilidad de los productos está sujeta al inventario existente al momento de la compra.</p>
            <h4>4. Precios</h4><p>Todos los precios se expresan en pesos colombianos (COP) e incluyen los impuestos aplicables, salvo que se indique lo contrario. Jadda Sports podrá modificar los precios en cualquier momento sin previo aviso. Los cambios no afectarán las compras que ya hayan sido confirmadas.</p>
            <h4>5. Formas de pago</h4><p>El cliente podrá realizar sus compras mediante los medios de pago habilitados en la plataforma. Toda transacción estará sujeta a procesos de validación y autorización por parte de la entidad financiera correspondiente.</p>
            <h4>6. Envíos</h4><p>Los pedidos serán despachados dentro de los tiempos informados durante el proceso de compra. Los tiempos de entrega pueden variar según la ciudad de destino, la empresa transportadora y circunstancias externas.</p>
            <h4>7. Garantías</h4><p>Todos los productos cuentan con garantía por defectos de fabricación conforme a la legislación colombiana. La garantía no cubre daños ocasionados por uso indebido, accidentes, desgaste natural o manipulación incorrecta del producto.</p>
            <h4>8. Propiedad intelectual</h4><p>Todo el contenido del sitio web, incluyendo imágenes, logotipos, diseños, textos y demás elementos gráficos, pertenece a Jadda Sports o cuenta con la autorización correspondiente para su uso. Queda prohibida su reproducción sin autorización previa.</p>
            <h4>9. Uso adecuado del sitio</h4><p>El usuario se compromete a utilizar el sitio web de manera responsable, absteniéndose de realizar actividades que puedan afectar su funcionamiento, vulnerar la seguridad o perjudicar a otros usuarios.</p>
            <h4>10. Modificaciones</h4><p>Jadda Sports podrá modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor desde su publicación en el sitio web.</p>
            <h4>11. Legislación aplicable</h4><p>Estos Términos y Condiciones se rigen por las leyes de la República de Colombia, especialmente por las disposiciones aplicables en materia de comercio electrónico y protección al consumidor.</p>
          </div><div className="modal-actions">
            <button type="button" className="btn-no" onClick={() => { setAceptaTerminos(false); setModalType(null); }}>NO ACEPTO</button>
            <button type="button" className="btn-si" onClick={() => { setAceptaTerminos(true); setModalType(null); }}>ACEPTO</button>
          </div></div></div>, document.body
      )}
      {modalType === 'privacidad' && createPortal(
        <div className="modal-overlay" onClick={() => setModalType(null)}><div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Política de Privacidad</h3><div className="modal-body">
            <p>En Jadda Sports valoramos la privacidad de nuestros usuarios y protegemos la información personal suministrada durante el uso de nuestro sitio web.</p>
            <h4>1. Información recopilada</h4><p>Podremos recopilar información como:</p><ul><li>Nombre y apellidos.</li><li>Documento de identificación.</li><li>Dirección de entrega.</li><li>Número de teléfono.</li><li>Correo electrónico.</li><li>Historial de compras.</li><li>Información necesaria para la atención al cliente.</li></ul>
            <h4>2. Finalidad del tratamiento de los datos</h4><p>La información recopilada será utilizada para:</p><ul><li>Procesar pedidos.</li><li>Gestionar pagos.</li><li>Realizar envíos.</li><li>Brindar atención al cliente.</li><li>Informar sobre el estado de las compras.</li><li>Mejorar la experiencia de navegación.</li><li>Cumplir obligaciones legales.</li></ul>
            <h4>3. Protección de la información</h4><p>Jadda Sports implementa medidas de seguridad administrativas, técnicas y organizacionales para proteger la información personal contra pérdida, acceso no autorizado, alteración o divulgación.</p>
            <h4>4. Compartición de datos</h4><p>La información personal únicamente podrá compartirse con empresas transportadoras, entidades financieras o autoridades competentes cuando sea necesario para la prestación del servicio o por obligación legal. Jadda Sports no vende ni comercializa la información personal de sus usuarios.</p>
            <h4>5. Derechos del titular</h4><p>El usuario podrá:</p><ul><li>Conocer la información almacenada.</li><li>Solicitar su actualización.</li><li>Corregir datos inexactos.</li><li>Solicitar la eliminación de la información cuando sea procedente.</li><li>Revocar la autorización para el tratamiento de datos en los casos permitidos por la ley.</li></ul>
            <h4>6. Uso de cookies</h4><p>Nuestro sitio puede utilizar cookies para mejorar la experiencia de navegación, recordar preferencias del usuario y obtener estadísticas de uso.</p>
            <h4>7. Conservación de la información</h4><p>Los datos personales serán conservados durante el tiempo necesario para cumplir las finalidades descritas o mientras exista una obligación legal que así lo requiera.</p>
            <h4>8. Cambios a esta política</h4><p>Jadda Sports podrá actualizar esta Política de Privacidad cuando sea necesario. Las modificaciones serán publicadas oportunamente en el sitio web. Esta política se encuentra elaborada conforme a la legislación colombiana sobre protección de datos personales.</p>
          </div><div className="modal-actions">
            <button type="button" className="btn-no" onClick={() => { setAceptaPrivacidad(false); setModalType(null); }}>NO ACEPTO</button>
            <button type="button" className="btn-si" onClick={() => { setAceptaPrivacidad(true); setModalType(null); }}>ACEPTO</button>
          </div></div></div>, document.body
      )}
      {modalType === 'devoluciones' && createPortal(
        <div className="modal-overlay" onClick={() => setModalType(null)}><div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Política de Devoluciones y Garantías</h3><div className="modal-body">
            <p>En Jadda Sports buscamos garantizar la satisfacción de nuestros clientes mediante un proceso claro y transparente para cambios, devoluciones y garantías.</p>
            <h4>1. Cambios de productos</h4><p>Los clientes podrán solicitar el cambio de un producto dentro de los treinta (30) días calendario siguientes a la entrega, siempre que:</p><ul><li>El producto no haya sido utilizado.</li><li>Se encuentre limpio y en perfecto estado.</li><li>Conserve sus etiquetas originales.</li><li>Se entregue con su empaque original.</li></ul>
            <h4>2. Productos que no admiten cambios</h4><p>No se aceptarán cambios de:</p><ul><li>Productos personalizados.</li><li>Productos deteriorados por mal uso.</li><li>Artículos sin etiquetas o con signos evidentes de uso.</li><li>Productos adquiridos mediante promociones especiales cuando así se indique.</li></ul>
            <h4>3. Garantía</h4><p>Todos los productos vendidos por Jadda Sports cuentan con garantía por defectos de fabricación conforme a la legislación colombiana. La garantía no cubre daños ocasionados por:</p><ul><li>Uso inadecuado.</li><li>Desgaste normal.</li><li>Accidentes.</li><li>Alteraciones realizadas por terceros.</li><li>Incumplimiento de las recomendaciones de cuidado del fabricante.</li></ul>
            <h4>4. Procedimiento para solicitar una garantía</h4><p>El cliente deberá comunicarse con el servicio de atención al cliente indicando:</p><ul><li>Número del pedido.</li><li>Nombre del comprador.</li><li>Descripción del inconveniente.</li><li>Evidencia fotográfica cuando sea necesaria.</li></ul><p>Una vez recibida la solicitud, Jadda Sports evaluará el caso y dará respuesta dentro de los plazos establecidos por la legislación colombiana.</p>
            <h4>5. Reembolsos</h4><p>Cuando proceda un reembolso, este se realizará utilizando el mismo medio de pago empleado por el cliente o mediante otro mecanismo acordado entre las partes. Los tiempos del reembolso dependerán de la entidad financiera correspondiente.</p>
            <h4>6. Derecho de retracto</h4><p>Cuando la legislación colombiana lo permita, el consumidor podrá ejercer su derecho de retracto dentro del término legal establecido, siempre que el producto sea devuelto en las mismas condiciones en que fue entregado.</p>
            <h4>7. Atención al cliente</h4><p>Para cualquier solicitud relacionada con cambios, devoluciones o garantías, el cliente podrá comunicarse a través de los canales oficiales de atención de Jadda Sports.</p>
          </div><div className="modal-actions">
            <button type="button" className="btn-no" onClick={() => { setAceptaDevoluciones(false); setModalType(null); }}>NO ACEPTO</button>
            <button type="button" className="btn-si" onClick={() => { setAceptaDevoluciones(true); setModalType(null); }}>ACEPTO</button>
          </div></div></div>, document.body
      )}
    </div>
  );
}

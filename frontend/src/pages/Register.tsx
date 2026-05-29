import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../css/Register.css";

interface RegisterForm {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  direccion: string;
  password: string;
  confirmar: string;
}

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    direccion: "",
    password: "",
    confirmar: ""
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [aceptaTerminos, setAceptaTerminos] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  
  // Estados para el manejo de errores estéticos
  const [errorBackend, setErrorBackend] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState<boolean>(false);

  const aplicarShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errorBackend) setErrorBackend(null); // Borra el error automáticamente al escribir
  };

  // Validación rápida de requisitos mínimos
  const validarPassword = () => {
    const tieneMayuscula = /[A-Z]/.test(form.password);
    const tieneNumero = /[0-9]/.test(form.password);
    const largoSuficiente = form.password.length >= 8;
    return tieneMayuscula && tieneNumero && largoSuficiente;
  };

  const calcularFuerza = (): number => {
    let fuerza = 0;
    if (/[A-Z]/.test(form.password)) fuerza++;
    if (/[0-9]/.test(form.password)) fuerza++;
    if (form.password.length >= 8) fuerza++;
    return fuerza;
  };

  const fuerza = calcularFuerza();

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorBackend(null);

    if (!aceptaTerminos) {
      setErrorBackend("Debes aceptar los términos y condiciones para continuar.");
      aplicarShake();
      return;
    }

    if (!validarPassword()) {
      setErrorBackend("La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.");
      aplicarShake();
      return;
    }

    if (form.password !== form.confirmar) {
      setErrorBackend("Las contraseñas ingresadas no coinciden.");
      aplicarShake();
      return;
    }

    setLoading(true);

    try {
      // Petición directa a tu backend de Express
      const res = await axios.post("http://localhost:5000/api/auth/registro", form);
      
      if (res.data.ok || res.status === 200 || res.status === 201) {
        navigate("/verificar-codigo", { state: { email: form.email } });
      }
    } catch (error: any) {
      aplicarShake();
      // Capturamos el error si el correo ya existe o falla el servidor y lo mandamos directo al estado
      const mensaje = error.response?.data?.message || "Error al registrar el usuario. Intente de nuevo.";
      setErrorBackend(mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container-wrapper">
      <main className="login-main">
        <div className={`login-card register-card ${shake ? "shake-animation" : ""}`}>
          <Link to="/" className="btn-back-home" style={{ 
  position: 'absolute', 
  top: '20px', 
  left: '20px', 
  color: '#e63946', 
  textDecoration: 'none', 
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '0.9rem'
}}>
  <i className="fas fa-arrow-left"></i> INICIO
</Link>
          
          <div className="login-brand">
            <h1 className="brand-name">JADDA <span>SPORTS</span></h1>
            <p className="brand-tagline">PREMIUM SPORT STORE</p>
          </div>

          <header className="login-header">
            <h2>Crear Cuenta</h2>
            <p>Regístrate para gestionar tus pedidos y favoritos</p>
          </header>

          <form onSubmit={handleRegister} className="login-form" autoComplete="off">
            <div className="register-row">
              <div className="form-group-custom">
                <label>NOMBRE</label>
                <input type="text" name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} required />
              </div>
              <div className="form-group-custom">
                <label>APELLIDO</label>
                <input type="text" name="apellido" placeholder="Apellido" value={form.apellido} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group-custom">
              <label>CORREO ELECTRÓNICO</label>
              <input type="email" name="email" placeholder="correo@ejemplo.com" value={form.email} onChange={handleChange} required />
            </div>

            <div className="register-row">
              <div className="form-group-custom">
                <label>TELÉFONO</label>
                <input type="tel" name="telefono" placeholder="Ej: 3001234567" value={form.telefono} onChange={handleChange} required />
              </div>
              <div className="form-group-custom">
                <label>DIRECCIÓN</label>
                <input type="text" name="direccion" placeholder="Calle, Carrera, Barrio" value={form.direccion} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group-custom">
              <label>CONTRASEÑA</label>
              <input type="password" name="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={handleChange} required />
              
              <div className="password-checker">
                <div className="checker-list">
                  <span className={/[A-Z]/.test(form.password) ? "valid" : ""}>
                    {/[A-Z]/.test(form.password) ? "✔" : "○"} Mayúscula
                  </span>
                  <span className={/[0-9]/.test(form.password) ? "valid" : ""}>
                    {/[0-9]/.test(form.password) ? "✔" : "○"} Número
                  </span>
                  <span className={form.password.length >= 8 ? "valid" : ""}>
                    {form.password.length >= 8 ? "✔" : "○"} +8 Caracteres
                  </span>
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
              <input type="password" name="confirmar" placeholder="Repite tu contraseña" value={form.confirmar} onChange={handleChange} required />
            </div>

            <div className="terms-container">
              <input type="checkbox" id="terms" checked={aceptaTerminos} onChange={() => setAceptaTerminos(!aceptaTerminos)} />
              <label htmlFor="terms">
                Acepto los <span className="link-terms" onClick={() => setMostrarModal(true)}>Términos y Condiciones</span>
              </label>
            </div>

            {/* ERROR REDIRECCIONADO ABAJO EN LETRAS ROJAS (Evita alerts molestos) */}
            {errorBackend && (
              <div className="error-badge" style={{ marginTop: "10px", marginBottom: "15px", textAlign: "center" }}>
                {errorBackend}
              </div>
            )}

            <button type="submit" className="btn-login-submit" disabled={loading}>
              {loading ? "PROCESANDO..." : "CREAR CUENTA"}
            </button>
          </form>

          {/* SECCIÓN INTERMEZZO DE REDES SOCIALES IDENTICA A LOGIN */}
          <div className="social-divider">
            <span>O regístrate con</span>
          </div>

          <div className="social-actions">
            <a 
  href={`http://localhost:5000/api/auth/google?from=${encodeURIComponent(deDondeViene)}`} 
  className="social-btn google"
>
  <i className="fab fa-google"></i> Google
</a>
            <a 
  href={`http://localhost:5000/api/auth/facebook?from=${encodeURIComponent(deDondeViene)}`} 
  className="social-btn facebook"
>
  <i className="fab fa-facebook-f"></i> Facebook
</a>
          </div>

          <footer className="login-footer-links">
            <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
          </footer>
        </div>
      </main>

      {/* MODAL DE TÉRMINOS Y CONDICIONES */}
      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Términos y Condiciones JADDA SPORTS</h3>
            <div className="modal-body">
              <p>1. <strong>Uso de datos:</strong> Sus datos serán tratados bajo la ley de protección de datos de Colombia.</p>
              <p>2. <strong>Privacidad:</strong> No compartiremos su información con terceros sin su consentimiento previo.</p>
              <p>3. <strong>Seguridad:</strong> El usuario es responsable de mantener la confidencialidad de su contraseña.</p>
              <p>4. <strong>Compras:</strong> JADDA SPORTS se reserva el derecho de cancelar pedidos sospechosos de fraude.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-no" onClick={() => { setAceptaTerminos(false); setMostrarModal(false); }}>NO ACEPTO</button>
              <button type="button" className="btn-si" onClick={() => { setAceptaTerminos(true); setMostrarModal(false); }}>ACEPTO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;
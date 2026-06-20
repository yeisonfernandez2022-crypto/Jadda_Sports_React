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
  href={`http://localhost:5000/api/auth/google?from=${encodeURIComponent('/Principal')}`} 
  className="social-btn google"
>
  <i className="fab fa-google"></i> Google
</a>
            <a 
  href={`http://localhost:5000/api/auth/facebook?from=${encodeURIComponent('/Principal')}`} 
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
            <h3>Términos y Condiciones - JADDA SPORTS</h3>
            <div className="modal-body">
              <h4>1. Términos y Condiciones de Uso</h4>
              <p>1.1 Al registrarse y utilizar la plataforma de JADDA SPORTS, el usuario acepta cumplir con estos términos y condiciones. Si no está de acuerdo, no debe usar nuestros servicios.</p>
              <p>1.2 El usuario declara ser mayor de edad (18 años o más) o contar con autorización de sus padres o tutores legales para realizar compras en línea.</p>
              <p>1.3 JADDA SPORTS se reserva el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el sitio web.</p>
              <p>1.4 El usuario es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta. JADDA SPORTS no será responsable por accesos no autorizados.</p>
              <p>1.5 El usuario se compromete a proporcionar información veraz, precisa y actualizada durante el proceso de registro y compra.</p>
              <p>1.6 JADDA SPORTS se reserva el derecho de rechazar, suspender o cancelar pedidos que considere sospechosos de fraude, violación de estos términos o por cualquier otra razón justificada.</p>
              <p>1.7 Los precios y la disponibilidad de los productos están sujetos a cambio sin previo aviso. El precio final será el confirmado al momento del pago.</p>
              <p>1.8 Las imágenes de los productos son referenciales. El producto real puede variar ligeramente en color, diseño o acabado respecto a la imagen mostrada.</p>
              <p>1.9 Queda prohibido el uso de la plataforma para fines ilícitos, la reproducción no autorizada de contenido, o cualquier actividad que pueda dañar la imagen de JADDA SPORTS.</p>

              <h4>2. Política de Devolución y Cambios</h4>
              <p>2.1 El cliente tiene derecho a solicitar devolución o cambio dentro de los 30 días calendario siguientes a la recepción del producto.</p>
              <p>2.2 Para ser elegible para una devolución, el producto debe estar sin usar, en las mismas condiciones en que fue recibido, con todas sus etiquetas y empaques originales.</p>
              <p>2.3 No se aceptan devoluciones de productos en las siguientes categorías: ropa interior, medias, artículos de uso personal o productos que hayan sido personalizados.</p>
              <p>2.4 Para iniciar una devolución, el cliente debe contactar a nuestro equipo de soporte a través del correo soporte@jaddasports.com o mediante el formulario PQR en nuestra página web.</p>
              <p>2.5 Los costos de envío de la devolución corren por cuenta del cliente, a menos que el producto llegue dañado o con defectos de fábrica.</p>
              <p>2.6 Una vez recibido y verificado el producto devuelto, JADDA SPORTS procesará el reembolso dentro de los 10 días hábiles siguientes. El reembolso se realizará a través del mismo método de pago utilizado en la compra.</p>
              <p>2.7 Para cambios por talla o color, el cliente puede solicitar el cambio directamente. Si hay diferencia de precio, deberá asumir el costo adicional.</p>
              <p>2.8 JADDA SPORTS no se hace responsable por daños causados durante el transporte una vez el producto ha sido entregado al cliente.</p>
              <p>2.9 En caso de productos defectuosos o errores en el envío, JADDA SPORTS cubrirá todos los costos de devolución y reemplazo.</p>

              <h4>3. Política de Privacidad y Protección de Datos</h4>
              <p>3.1 JADDA SPORTS, en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 de la República de Colombia, se compromete a proteger la privacidad de los datos personales suministrados por los usuarios.</p>
              <p>3.2 Los datos personales recopilados incluyen, entre otros: nombre, apellido, documento de identidad, dirección de correo electrónico, número de teléfono, dirección de envío e información de pago.</p>
              <p>3.3 Estos datos serán utilizados exclusivamente para los siguientes fines: procesar pedidos, gestionar pagos, realizar envíos, atender solicitudes de servicio al cliente, enviar información promocional (con autorización previa del usuario) y mejorar nuestros servicios.</p>
              <p>3.4 JADDA SPORTS no compartirá, venderá ni alquilará información personal del usuario a terceros sin su consentimiento explícito, excepto cuando sea requerido por ley o para el procesamiento de pagos y envíos (entidades bancarias, empresas de mensajería).</p>
              <p>3.5 El usuario tiene derecho a conocer, actualizar, rectificar y solicitar la eliminación de sus datos personales en cualquier momento. Para ejercer estos derechos, puede contactarnos a través del correo soporte@jaddasports.com.</p>
              <p>3.6 JADDA SPORTS implementa medidas de seguridad técnicas, administrativas y físicas para proteger los datos personales contra acceso no autorizado, pérdida, uso indebido o alteración.</p>
              <p>3.7 Las transacciones realizadas en nuestra plataforma están protegidas mediante encriptación SSL (Secure Socket Layer), garantizando que la información de pago viaje de forma segura.</p>
              <p>3.8 Al registrarse, el usuario autoriza a JADDA SPORTS a enviar comunicaciones comerciales y promociones a través de correo electrónico o mensajes de texto. El usuario puede cancelar esta autorización en cualquier momento mediante el enlace de "desuscribirse" incluido en cada comunicación.</p>
              <p>3.9 Esta política de privacidad puede ser actualizada periódicamente. Recomendamos a los usuarios revisarla regularmente para estar informados sobre cómo protegemos su información.</p>
              <p>3.10 Para cualquier consulta relacionada con el tratamiento de datos personales, el usuario puede comunicarse con nuestro Oficial de Protección de Datos al correo privacidad@jaddasports.com.</p>
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
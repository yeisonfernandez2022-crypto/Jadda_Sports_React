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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const calcularFuerza = (): number => {
    let fuerza = 0;
    if (/[A-Z]/.test(form.password)) fuerza++;
    if (/[\W_]/.test(form.password)) fuerza++;
    if (form.password.length >= 7) fuerza++;
    return fuerza;
  };

  const fuerza = calcularFuerza();

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!aceptaTerminos) return alert("Debes aceptar los términos y condiciones.");
    if (!form.email.includes("@")) return alert("Correo inválido");
    if (form.password.length < 8) return alert("La contraseña debe tener mínimo 8 caracteres");
    if (form.password !== form.confirmar) return alert("Las contraseñas no coinciden");

    setLoading(true);

    try {
      await axios.post("http://localhost:3000/api/auth/registro", {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        direccion: form.direccion,
        password: form.password
      });

      // IMPORTANTE: Esta ruta debe existir en App.tsx
      navigate("/verificar-codigo", { state: { email: form.email } });

    } catch (error: any) {
      console.error(error);
      alert(error.response?.data || "Error al registrar usuario");
    } finally {
      setLoading(false);
    }
  };

  const mostrarTerminos = () => {
    alert("Términos y Condiciones:\n\n1. Uso exclusivo de JADDA SPORTS.\n2. Protección de datos personales.");
  };

  return (
    <div>
      <header className="header">
        <Link to="/" className="logo-text" style={{ textDecoration: 'none' }}>
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </Link>
      </header>

      <main className="main-container">
        <div className="form-area">
          <h2>REGISTRARSE</h2>
          <form onSubmit={handleRegister}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">NOMBRE</label>
                <input type="text" className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required/>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">APELLIDO</label>
                <input type="text" className="form-control" name="apellido" value={form.apellido} onChange={handleChange} required/>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">EMAIL</label>
              <input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} required/>
            </div>

            <div className="mb-3">
              <label className="form-label">TELÉFONO</label>
              <input type="tel" className="form-control" name="telefono" value={form.telefono} onChange={handleChange} required/>
            </div>

            <div className="mb-3">
              <label className="form-label">DIRECCIÓN</label>
              <input type="text" className="form-control" name="direccion" value={form.direccion} onChange={handleChange} required/>
            </div>

            <div className="mb-3">
              <label className="form-label">CONTRASEÑA</label>
              <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange} required/>
              
              {/* AQUÍ ESTÁN TUS VALIDACIONES DE VUELTA */}
              <div style={{marginTop:"10px"}}>
                <small>Debe tener:</small>
                <ul style={{fontSize:"13px", listStyle: "none", paddingLeft: 0}}>
                  <li style={{color: /[A-Z]/.test(form.password) ? "green" : "red"}}>
                    {/[A-Z]/.test(form.password) ? "✔" : "✖"} Mayúscula
                  </li>
                  <li style={{color: /[\W_]/.test(form.password) ? "green" : "red"}}>
                    {/[\W_]/.test(form.password) ? "✔" : "✖"} Símbolo
                  </li>
                  <li style={{color: form.password.length >= 7 ? "green" : "red"}}>
                    {form.password.length >= 7 ? "✔" : "✖"} Mínimo 7 caracteres
                  </li>
                </ul>
                <div className="progress" style={{height:"10px"}}>
                  <div
                    className={`progress-bar ${fuerza === 3 ? "bg-success" : fuerza === 2 ? "bg-warning" : "bg-danger"}`}
                    style={{ width: `${(fuerza / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">CONFIRMAR CONTRASEÑA</label>
              <input type="password" className="form-control" name="confirmar" value={form.confirmar} onChange={handleChange} required/>
            </div>

            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" checked={aceptaTerminos} onChange={() => setAceptaTerminos(!aceptaTerminos)} required />
              <label className="form-check-label small">
                Acepto los <span onClick={mostrarTerminos} style={{ color: "red", cursor: "pointer", fontWeight: "bold" }}>Términos y Condiciones</span>
              </label>
            </div>

            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-danger btn-lg fw-bold" disabled={loading}>
                {loading ? "PROCESANDO..." : "CREAR CUENTA"}
              </button>
            </div>
          </form>

          <hr className="my-4" />

          <div className="text-center">
            <p className="text-muted small">O REGÍSTRATE CON</p>
            <div className="d-flex flex-column gap-2">
              <a href="http://localhost:3000/api/auth/google" className="btn btn-outline-dark w-100">
                <i className="fab fa-google me-2 text-danger"></i> GOOGLE
              </a>
              <a href="http://localhost:3000/api/auth/facebook" className="btn btn-outline-dark w-100">
                <i className="fab fa-facebook-f me-2 text-primary"></i> FACEBOOK
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Register;
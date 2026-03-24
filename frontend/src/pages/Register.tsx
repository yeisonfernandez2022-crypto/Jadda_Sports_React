import { useState, type ChangeEvent, type FormEvent } from "react";
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
  const [form, setForm] = useState<RegisterForm>({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    direccion: "",
    password: "",
    confirmar: ""
  });

  const [mostrarExito, setMostrarExito] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [aceptaTerminos, setAceptaTerminos] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: value
    });
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

    if (!aceptaTerminos) {
      alert("Debes aceptar los términos y condiciones.");
      return;
    }

    if (!form.email.includes("@")) {
      alert("Correo inválido");
      return;
    }

    if (form.password.length < 8) {
      alert("La contraseña debe tener mínimo 8 caracteres");
      return;
    }

    if (form.password !== form.confirmar) {
      alert("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          telefono: form.telefono,
          direccion: form.direccion,
          password: form.password
        })
      });

      const text = await response.text();

      if (response.ok) {
        setMostrarExito(true);
      } else {
        alert(text);
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión");
      setLoading(false);
    }
  };

  const mostrarTerminos = () => {
    alert("Términos y Condiciones:\n\n1. Uso exclusivo de la plataforma.\n2. Respeto a la comunidad.\n3. Protección de datos personales.\n\nAl registrarte aceptas estas condiciones.");
  };

  return (
    <div>
      <header className="header">
        <a href="/principal" className="logo-text">
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </a>
      </header>

      <main className="main-container">
        <div className="form-area">
          {!mostrarExito ? (
            <>
              <h2>REGISTRARSE</h2>
              <form onSubmit={handleRegister}>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">NOMBRE</label>
                    <input type="text" className="form-control" name="nombre" value={form.nombre} onChange={handleChange}/>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">APELLIDO</label>
                    <input type="text" className="form-control" name="apellido" value={form.apellido} onChange={handleChange}/>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">EMAIL</label>
                  <input type="email" className="form-control" name="email" value={form.email} onChange={handleChange}/>
                </div>

                <div className="mb-3">
                  <label className="form-label">TELÉFONO</label>
                  <input type="tel" className="form-control" name="telefono" value={form.telefono} onChange={handleChange}/>
                </div>

                <div className="mb-3">
                  <label className="form-label">DIRECCIÓN</label>
                  <input type="text" className="form-control" name="direccion" value={form.direccion} onChange={handleChange}/>
                </div>

                <div className="mb-3">
                  <label className="form-label">CONTRASEÑA</label>
                  <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange}/>
                  
                  <div style={{marginTop:"10px"}}>
                    <small>Debe tener:</small>
                    <ul style={{fontSize:"13px"}}>
                      <li style={{color: /[A-Z]/.test(form.password) ? "green" : "red"}}>Mayúscula</li>
                      <li style={{color: /[\W_]/.test(form.password) ? "green" : "red"}}>Símbolo</li>
                      <li style={{color: form.password.length >= 7 ? "green" : "red"}}>Mínimo 7 caracteres</li>
                    </ul>
                    <div className="progress" style={{height:"10px"}}>
                      <div
                        className={`progress-bar ${
                          fuerza === 3 ? "bg-success" :
                          fuerza === 2 ? "bg-warning" :
                          fuerza === 1 ? "bg-danger" : ""
                        }`}
                        style={{
                          width: fuerza === 1 ? "33%" : fuerza === 2 ? "66%" : fuerza === 3 ? "100%" : "0%"
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">CONFIRMAR CONTRASEÑA</label>
                  <input type="password" className="form-control" name="confirmar" value={form.confirmar} onChange={handleChange}/>
                </div>

                {/* Términos y condiciones con hipervínculo */}
                <div className="form-check mb-3">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    checked={aceptaTerminos}
                    onChange={() => setAceptaTerminos(!aceptaTerminos)}
                    required 
                  />
                  <label className="form-check-label">
                    Acepto los{" "}
                    <span 
                      onClick={mostrarTerminos} 
                      style={{ color: "red", cursor: "pointer", fontWeight: "bold" }}
                    >
                      Términos y Condiciones
                    </span>
                  </label>
                </div>

                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-danger btn-lg" disabled={loading}>
                    {loading ? "Registrando..." : "CREAR CUENTA"}
                  </button>
                </div>
              </form>

              <hr className="my-4" />

              {/* Botones sociales igual que en login */}
              <div className="text-center">
                <p className="text-muted small">O REGÍSTRATE CON</p>
                <div className="d-flex flex-column align-items-center gap-3">
                  <a href="http://localhost:3000/api/auth/google" className="btn btn-outline-dark w-100 py-2">
                    <i className="fab fa-google me-2 text-danger"></i> GOOGLE
                  </a>
                  <a href="http://localhost:3000/api/auth/facebook" className="btn btn-outline-dark w-100 py-2">
                    <i className="fab fa-facebook-f me-2 text-primary"></i> FACEBOOK
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", marginTop: "30px" }}>
              <h3 className="text-warning">📩 CONFIRMA TU CORREO</h3>
              <p>Te enviamos un enlace de activación.</p>
              <button onClick={() => window.location.href = "/login"} className="btn btn-secondary">
                VOLVER
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Register;

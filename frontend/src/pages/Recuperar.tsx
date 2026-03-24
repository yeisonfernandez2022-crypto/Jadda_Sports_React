import { useState, type ChangeEvent, type FormEvent } from "react";
import "../css/Login.css"; // Reutilizamos el CSS del login para mantener la facha

function Recuperar() {
  const [email, setEmail] = useState<string>("");
  const [enviado, setEnviado] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/auth/recuperar-password", { 
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: email.trim().toLowerCase() }) 
});

      if (res.ok) {
        setEnviado(true);
      } else {
        alert("No encontramos ese correo en nuestra base de datos.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* HEADER COHERENTE CON EL PROYECTO */}
      <header className="header">
        <a href="/principal" className="logo-text">
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </a>
      </header>

      <main className="main-container">
        <div className="form-area">
          {!enviado ? (
            <>
              <h2 className="mb-4">RECUPERAR CLAVE</h2>
              <p className="text-muted small mb-4">
                Te enviaremos un enlace a tu correo para que puedas restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label">CORREO ELECTRÓNICO</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Correo electronico"
                    required
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  />
                </div>

                <div className="d-grid gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-danger btn-lg fw-bold" 
                    disabled={loading}
                  >
                    {loading ? "ENVIANDO..." : "ENVIAR ENLACE"}
                  </button>
                </div>
              </form>

              <div className="text-center mt-4">
                <a href="/login" className="text-danger small fw-bold text-decoration-none">
                  VOLVER AL INICIO DE SESIÓN
                </a>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mb-3">
                <i className="fas fa-envelope-open-text fa-3x text-danger"></i>
              </div>
              <h3 className="fw-bold text-dark">📩 CORREO ENVIADO</h3>
              <p className="text-muted small mt-2">
                Revisa tu bandeja de entrada. Si no lo ves, chequea la carpeta de spam.
              </p>
              <button 
                onClick={() => window.location.href = "/login"} 
                className="btn btn-dark mt-3 w-100"
              >
                VOLVER AL LOGIN
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

export default Recuperar;
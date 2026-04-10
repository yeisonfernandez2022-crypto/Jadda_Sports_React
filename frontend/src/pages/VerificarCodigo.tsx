import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import "../css/inicio.css";

const VerificarCodigo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as any)?.email || "";

  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificado, setVerificado] = useState(false); 
  const [segundos, setSegundos] = useState(60);

  // SEGURIDAD 1: Si entran por link directo sin email (atrás/adelante), fuera.
  useEffect(() => {
    if (!email) {
      navigate("/registro", { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    let timer: any;
    if (segundos > 0 && !verificado) {
      timer = setTimeout(() => setSegundos(segundos - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [segundos, verificado]);

  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Usamos el endpoint que ya corregimos en el backend
      await axios.post("http://localhost:3000/api/auth/confirmar", { email, codigo });
      
      // Bloqueamos la UI inmediatamente
      setVerificado(true); 
      setMensaje("¡Cuenta verificada con éxito!");

      // SEGURIDAD 2: El 'replace: true' borra esta página del historial.
      // Si el usuario da "atrás" desde el Login, irá al Registro o al Inicio, saltándose esta.
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);

    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || "Código incorrecto";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="header">
        <Link to="/" className="logo-text" style={{ textDecoration: 'none' }}>
          JADDA SPORTS <span className="logo-sub">SPORT STORE</span>
        </Link>
      </header>

      <main className="main-container">
        <div className="form-area shadow-lg p-5 text-center" style={{ position: 'relative', overflow: 'hidden' }}>
          
          {/* BLOQUEO VISUAL: Si ya verificó, no puede ver el formulario aunque se quede 2 seg más */}
          {verificado && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'white', zIndex: 10,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              animation: 'fadeIn 0.5s ease'
            }}>
              <i className="fas fa-check-circle text-success" style={{ fontSize: '5rem' }}></i>
              <h2 className="fw-bold mt-3">¡VERIFICADO!</h2>
              <p className="text-muted">Redirigiendo de forma segura...</p>
            </div>
          )}

          <h2 className="fw-bold mb-3" style={{ color: '#E63946' }}>VERIFICAR CÓDIGO</h2>
          <p className="text-muted small">Código enviado a: <b>{email}</b></p>

          <form onSubmit={handleVerificar}>
            <input
              type="text"
              className="form-control form-control-lg text-center mb-4"
              placeholder="Escribe el código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              disabled={loading || verificado}
              style={{ letterSpacing: "8px", fontSize: "1.8rem", fontWeight: "bold" }}
              required
            />

            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            
            <button type="submit" className="btn btn-danger w-100 btn-lg fw-bold" disabled={loading || verificado}>
              {loading ? "VERIFICANDO..." : "CONFIRMAR"}
            </button>
          </form>

          <div className="mt-3">
             {segundos > 0 ? (
               <p className="small text-muted">Reenviar en: {segundos}s</p>
             ) : (
               <button type="button" onClick={() => { /* tu lógica de reenvío */ }} className="btn btn-link text-danger p-0 fw-bold text-decoration-none">
                 Reenviar código
               </button>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VerificarCodigo;
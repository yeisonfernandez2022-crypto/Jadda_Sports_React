import React, { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { CheckCircleFill, ArrowRepeat, ArrowLeft } from "react-bootstrap-icons";
import "../css/verificarCodigo.css";

// Función auxiliar para leer el tiempo restante antes de que cargue el componente
const obtenerTiempoInicial = (email: string): number => {
  if (!email) return 0;
  const meta = localStorage.getItem(`timer_expira_${email}`);
  if (meta) {
    const restante = Math.ceil((parseInt(meta) - Date.now()) / 1000);
    return restante > 0 ? restante : 0;
  }
  return 0;
};

const VerificarCodigo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as any)?.email || "";

  // ESTADOS
  // Inicialización perezosa: solo se ejecuta una vez al montar el componente
  const [segundos, setSegundos] = useState<number>(() => obtenerTiempoInicial(email));
  const [codigos, setCodigos] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [verificado, setVerificado] = useState<boolean>(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Seguridad: Redirigir si no hay email
  useEffect(() => {
    if (!email) navigate("/registro", { replace: true });
  }, [email, navigate]);

  // 2. Lógica del Contador (Sync con localStorage)
  useEffect(() => {
    if (!email || segundos <= 0) return;

    const intervalo = setInterval(() => {
      const meta = localStorage.getItem(`timer_expira_${email}`);
      if (meta) {
        const restante = Math.ceil((parseInt(meta) - Date.now()) / 1000);
        if (restante > 0) {
          setSegundos(restante);
        } else {
          setSegundos(0);
          localStorage.removeItem(`timer_expira_${email}`);
          clearInterval(intervalo);
        }
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, [email, segundos]);

  // 3. Manejo de Inputs
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nuevos = [...codigos];
    nuevos[index] = value.slice(-1);
    setCodigos(nuevos);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codigos[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 4. Acción: Reenviar Código
  const handleReenviar = async () => {
  // 1. Evitamos clics accidentales si el contador está activo o si ya está cargando
  if (segundos > 0 || loading) return;

  setLoading(true);
  setError("");

  try {
    // 2. Llamada real a tu servidor (Ajusta la URL si es necesario)
    const response = await axios.post("/api/auth/reenviar-codigo", { 
      email 
    });

    if (response.status === 200) {
      // 3. Solo si el servidor confirma el envío, reiniciamos el timer
      const nuevaMeta = Date.now() + 60 * 1000;
      localStorage.setItem(`timer_expira_${email}`, nuevaMeta.toString());
      setSegundos(60);
      
      // Opcional: Una pequeña notificación de éxito
      console.log("Código reenviado con éxito");
    }
  } catch (err: any) {
    // 4. Capturamos el error del backend (ej: "Demasiados intentos")
    const mensajeError = err.response?.data?.message || "No se pudo enviar el código. Intenta más tarde.";
    setError(mensajeError);
  } finally {
    setLoading(false);
  }
};

  // 5. Acción: Verificar Código
  const handleVerificar = async (e: FormEvent) => {
    e.preventDefault();
    const codigoCompleto = codigos.join("");
    if (codigoCompleto.length < 6) return;

    setLoading(true);
    setError("");

    try {
      await axios.post("/api/auth/verificar-codigo", { email, codigo: codigoCompleto });
      setVerificado(true);
      localStorage.removeItem(`timer_expira_${email}`); // Limpiar timer al tener éxito
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Código incorrecto");
      setLoading(false);
    }
  };

  return (
    <div className="login-container-wrapper">
      <main className="login-main">
        <div className={`login-card ${verificado ? "success-state" : ""}`}>
          
          {verificado && (
            <div className="success-overlay">
              <CheckCircleFill size={80} color="#e63946" className="success-icon-anim" />
              <h2 className="brand-name mt-3">¡LISTO!</h2>
              <p>Cuenta verificada en JADDA SPORTS.</p>
            </div>
          )}

          <div className="login-brand">
            <h1 className="brand-name">VERIFICAR <span>CÓDIGO</span></h1>
          </div>

          <p className="text-center small text-muted mb-4">Enviado a: <b>{email}</b></p>

          <form onSubmit={handleVerificar} className="login-form">
            <div className="codigo-container-inputs">
              {codigos.map((digito, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  className="cuadrito-input"
                  value={digito}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  maxLength={1}
                  disabled={loading || verificado}
                  required
                />
              ))}
            </div>

            {error && <div className="error-badge shake-animation">{error}</div>}
            
            <button 
              type="submit" 
              className="btn-login-submit" 
              disabled={loading || verificado || codigos.join("").length < 6}
            >
              {loading ? "VALIDANDO..." : "CONFIRMAR"}
            </button>
          </form>

          <div className="mt-4 text-center">
             {segundos > 0 ? (
               <p className="text-muted small">Podrás reenviar en <b>{segundos}s</b></p>
             ) : (
               <button 
                 type="button" 
                 className="btn-reenviar" 
                 onClick={handleReenviar}
                 style={{ background: 'none', border: 'none', color: '#e63946', fontWeight: 700, cursor: 'pointer' }}
               >
                 <ArrowRepeat className="me-2" /> REENVIAR CÓDIGO
               </button>
             )}
          </div>

          <footer className="login-footer-links border-top pt-3 mt-4">
              <Link to="/registro" className="back-link" style={{textDecoration:'none', color:'#6b7280', fontSize:'0.85rem'}}>
                <ArrowLeft className="me-2" /> VOLVER A REGISTRO
              </Link>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default VerificarCodigo;
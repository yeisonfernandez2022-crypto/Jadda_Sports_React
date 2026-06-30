import "../css/Pqr.css";
import { useState } from "react";
import { FaPaperPlane, FaExclamationTriangle, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";

const TIPOS = ["Petición", "Queja", "Reclamo", "Sugerencia"];

export default function Pqr() {
  const navigate = useNavigate();
  const { usuarioLogueado, loadingAuth } = useAuth();
  const { openLogin } = useAuthModal();
  const [tipo, setTipo] = useState("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  const ok = tipo && asunto.trim() && descripcion.trim();

  const handleSubmit = async () => {
    if (!ok) return;
    setEnviando(true);
    try {
      await axios.post("/api/pqr", {
        tipo, asunto: asunto.trim(), descripcion: descripcion.trim(), numeroPedido: numeroPedido.trim() || null,
      }, { withCredentials: true });
      setExito(true);
    } catch {
      alert("Error al enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (loadingAuth) return null;

  if (!usuarioLogueado) {
    return (
      <div className="pqr-page">
        <div className="pqr-card">
          <button className="btn-volver-pqr" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Volver
          </button>
          <div className="pqr-header">
            <FaExclamationTriangle className="pqr-icon" />
            <h1>PQR</h1>
            <p>Peticiones, Quejas, Reclamos y Sugerencias</p>
          </div>
          <div className="pqr-login-msg">
            <p>Debes <span className="link-terms" onClick={openLogin}>iniciar sesión</span> para enviar un PQR.</p>
          </div>
        </div>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="pqr-page">
        <div className="pqr-card pqr-exito">
          <div className="pqr-exito-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <h2>¡PQR enviada con éxito!</h2>
          <p>Te responderemos a la brevedad.</p>
          <button className="btn-volver-inicio" onClick={() => navigate("/")}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pqr-page">
      <div className="pqr-card">
        <button className="btn-volver-pqr" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Volver
        </button>
        <div className="pqr-header">
          <FaExclamationTriangle className="pqr-icon" />
          <h1>PQR</h1>
          <p>Peticiones, Quejas, Reclamos y Sugerencias</p>
        </div>

        <div className="pqr-form">
          <div className="mb-3">
            <label className="form-label">Tipo <span className="text-danger">*</span></label>
            <select className={`form-select${tipo ? "" : " is-invalid"}`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Selecciona un tipo</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Asunto <span className="text-danger">*</span></label>
            <input type="text" className={`form-control${asunto.trim() ? "" : " is-invalid"}`} placeholder="Asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">Descripción <span className="text-danger">*</span></label>
            <textarea className={`form-control${descripcion.trim() ? "" : " is-invalid"}`} rows={5} placeholder="Describe tu solicitud..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="form-label">Número de pedido (opcional)</label>
            <input type="text" className="form-control" placeholder="#123" value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} />
          </div>

          <button className="btn-enviar-pqr" onClick={handleSubmit} disabled={!ok || enviando}>
            <FaPaperPlane /> {enviando ? "Enviando..." : "Enviar PQR"}
          </button>
        </div>
      </div>
    </div>
  );
}

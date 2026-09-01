import { useState, type FormEvent } from "react";
import axios from "axios";
import "../css/Login.css";

export default function Contacto() {
  const [form, setForm] = useState({ nombre: "", email: "", asunto: "", mensaje: "" });
  const [camposError, setCamposError] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setCamposError(prev => { if (prev[name]) { const n = { ...prev }; delete n[name]; return n; } return prev; });
    if (error) setError("");
    if (exito) setExito(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCamposError({});
    setExito(false);

    const nuevos: Record<string, boolean> = {};
    if (!form.nombre.trim()) nuevos.nombre = true;
    if (!form.email.trim()) nuevos.email = true;
    if (!form.asunto.trim()) nuevos.asunto = true;
    if (!form.mensaje.trim()) nuevos.mensaje = true;
    if (Object.keys(nuevos).length) {
      setCamposError(nuevos);
      setError("Completa todos los campos.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/contacto", form);
      setExito(true);
      setForm({ nombre: "", email: "", asunto: "", mensaje: "" });
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al enviar el mensaje.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div className="login-card" style={{ maxWidth: "520px" }}>
        <div className="login-brand">
          <h1 className="brand-name">CONTÁCTANOS</h1>
          <p className="brand-tagline">ESCRÍBENOS Y TE RESPONDEREMOS</p>
        </div>

        {exito ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: "64px", color: "#10b981", marginBottom: "16px" }}>
              <i className="fas fa-check-circle"></i>
            </div>
            <h3 style={{ color: "#1f2937", fontWeight: 700 }}>¡Mensaje enviado!</h3>
            <p style={{ color: "#64748b", marginTop: "8px" }}>
              Gracias por contactarnos. Te responderemos pronto.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group-custom">
              <label>NOMBRE</label>
              <input type="text" name="nombre" placeholder="Tu nombre" value={form.nombre} onChange={handleChange} className={camposError.nombre ? "input-error" : ""} />
            </div>
            <div className="form-group-custom">
              <label>CORREO ELECTRÓNICO</label>
              <input type="email" name="email" placeholder="tu@correo.com" value={form.email} onChange={handleChange} className={camposError.email ? "input-error" : ""} />
            </div>
            <div className="form-group-custom">
              <label>ASUNTO</label>
              <select name="asunto" value={form.asunto} onChange={handleChange} className={camposError.asunto ? "input-error" : ""} style={{ width: "100%", padding: "12px 16px", border: "2px solid #d1d5db", borderRadius: "12px", fontSize: "0.95rem", outline: "none", background: "white" }}>
                <option value="">Selecciona un asunto</option>
                <option value="Consulta general">Consulta general</option>
                <option value="Pedidos y envíos">Pedidos y envíos</option>
                <option value="Productos y tallas">Productos y tallas</option>
                <option value="Devoluciones y garantías">Devoluciones y garantías</option>
                <option value="Sugerencias">Sugerencias</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group-custom">
              <label>MENSAJE</label>
              <textarea name="mensaje" placeholder="Escribe tu mensaje aquí..." value={form.mensaje} onChange={handleChange} className={camposError.mensaje ? "input-error" : ""} rows={5} style={{ width: "100%", padding: "12px 16px", border: "2px solid #d1d5db", borderRadius: "12px", fontSize: "0.95rem", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            {error && <div className="error-badge" style={{ marginBottom: "15px", textAlign: "center" }}>{error}</div>}
            <button type="submit" className="btn-login-submit" disabled={loading}>
              {loading ? "ENVIANDO..." : "ENVIAR MENSAJE"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

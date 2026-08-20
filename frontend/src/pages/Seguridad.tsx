import "../css/Seguridad.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaEye, FaEyeSlash, FaHistory } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";

export default function Seguridad() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });
  const [ultimaConexion, setUltimaConexion] = useState<string | null>(null);

  const [form, setForm] = useState({
    password_actual: "",
    password_nueva: "",
    password_confirmar: ""
  });

  useEffect(() => {
    axios.get("/api/auth/perfil", { withCredentials: true })
      .then(res => {
        const data = res.data.usuario;
        if (!data?.ULTIMA_CONEXION) return;
        const fecha = new Date(data.ULTIMA_CONEXION).toLocaleString("es-CO", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });
        const lugar = data.ULTIMA_UBICACION || "";
        setUltimaConexion(lugar ? `${fecha} · ${lugar}` : fecha);
      })
      .catch(() => {});
  }, []);

  function mostrarToast(mensaje: string, tipo: "success" | "error") {
    setToast({ mostrar: true, mensaje, tipo });
    setTimeout(() => setToast(prev => ({ ...prev, mostrar: false })), 3000);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.password_actual || !form.password_nueva || !form.password_confirmar) {
      return mostrarToast("Todos los campos son obligatorios.", "error");
    }

    if (form.password_nueva.length < 8) {
      return mostrarToast("La nueva contraseña debe tener al menos 8 caracteres.", "error");
    }

    if (form.password_nueva !== form.password_confirmar) {
      return mostrarToast("Las contraseñas nuevas no coinciden.", "error");
    }

    try {
      setLoading(true);
      const res = await axios.post("/api/auth/cambiar-password", {
        password_actual: form.password_actual,
        password_nueva: form.password_nueva
      }, { withCredentials: true });

      if (res.data.ok) {
        mostrarToast("Contraseña actualizada correctamente.", "success");
        setForm({ password_actual: "", password_nueva: "", password_confirmar: "" });
      }
    } catch (err: any) {
      const msg = err.response?.data?.msg || "Error al cambiar la contraseña.";
      mostrarToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  const fuerza = (() => {
    let pts = 0;
    if (/[A-Z]/.test(form.password_nueva)) pts++;
    if (/[0-9]/.test(form.password_nueva)) pts++;
    if (form.password_nueva.length >= 8) pts++;
    return pts;
  })();

  return (
    <div className="seguridad-page">
      {toast.mostrar && (
        <div className={`toast-seguridad ${toast.tipo}`}>
          {toast.tipo === "success" ? "✅" : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="seguridad-card">
        <button className="btn-volver-seg" onClick={() => navigate("/perfil")}>
          <FaArrowLeft /> Volver
        </button>

        <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Seguridad" }]} />

        <div className="seguridad-header">
          <div className="seguridad-icon">🔒</div>
          <h1>Seguridad</h1>
          <p>Cambia tu contraseña de acceso</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group-seg">
            <label>Contraseña actual</label>
            <div className="input-wrapper">
              <input
                type={showActual ? "text" : "password"}
                name="password_actual"
                value={form.password_actual}
                onChange={handleChange}
                placeholder="Ingresa tu contraseña actual"
              />
              <button type="button" className="toggle-pass" onClick={() => setShowActual(!showActual)}>
                {showActual ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="input-group-seg">
            <label>Nueva contraseña</label>
            <div className="input-wrapper">
              <input
                type={showNueva ? "text" : "password"}
                name="password_nueva"
                value={form.password_nueva}
                onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
              />
              <button type="button" className="toggle-pass" onClick={() => setShowNueva(!showNueva)}>
                {showNueva ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className="password-strength">
              <div className="strength-bar">
                <div className={`strength-fill ${fuerza === 3 ? "strong" : fuerza === 2 ? "medium" : "weak"}`}
                  style={{ width: `${(fuerza / 3) * 100}%` }} />
              </div>
              <div className="strength-checks">
                <span className={/[A-Z]/.test(form.password_nueva) ? "valid" : ""}>
                  Mayúscula
                </span>
                <span className={/[0-9]/.test(form.password_nueva) ? "valid" : ""}>
                  Número
                </span>
                <span className={form.password_nueva.length >= 8 ? "valid" : ""}>
                  8+ caracteres
                </span>
              </div>
            </div>
          </div>

          <div className="input-group-seg">
            <label>Confirmar nueva contraseña</label>
            <div className="input-wrapper">
              <input
                type={showConfirmar ? "text" : "password"}
                name="password_confirmar"
                value={form.password_confirmar}
                onChange={handleChange}
                placeholder="Repite la nueva contraseña"
              />
              <button type="button" className="toggle-pass" onClick={() => setShowConfirmar(!showConfirmar)}>
                {showConfirmar ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button className="btn-cambiar" disabled={loading}>
            {loading ? "Cambiando..." : "Cambiar contraseña"}
          </button>
        </form>

        <div className="ultima-conexion">
          <FaHistory className="ultima-conexion-icono" />
          <div>
            <span className="ultima-conexion-label">Última conexión</span>
            <span className="ultima-conexion-valor">
              {ultimaConexion || "Aún no hay registros de conexión"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

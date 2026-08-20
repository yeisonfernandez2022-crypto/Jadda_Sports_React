import "../css/DireccionesPerfil.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaPlus, FaTrash, FaPencilAlt, FaMapMarkerAlt, FaCity, FaPhone, FaEnvelope, FaHome } from "react-icons/fa";
import { DEPARTAMENTOS } from "../data/colombia";
import Breadcrumb from "../components/Breadcrumb";

interface Direccion {
  ID_DIRECCION: number;
  DIRECCION: string;
  BARRIO: string | null;
  CIUDAD: string;
  DEPARTAMENTO: string;
  CODIGO_POSTAL: string | null;
  TELEFONO_CONTACTO: string | null;
  ES_PRINCIPAL: number;
  ETIQUETA?: string;
}

export default function DireccionesPerfil() {
  const navigate = useNavigate();
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });

  const [form, setForm] = useState({
    direccion: "", barrio: "", ciudad: "", departamento: "",
    codigo_postal: "", telefono_contacto: "", es_principal: false, etiqueta: ""
  });

  const fetchDirecciones = async () => {
    try {
      const res = await axios.get("/api/direcciones", { withCredentials: true });
      setDirecciones(res.data);
    } catch { mostrarToast("Error al cargar direcciones.", "error");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDirecciones(); }, []);

  function mostrarToast(mensaje: string, tipo: "success" | "error") {
    setToast({ mostrar: true, mensaje, tipo });
    setTimeout(() => setToast(prev => ({ ...prev, mostrar: false })), 3000);
  }

  function resetForm() {
    setForm({ direccion: "", barrio: "", ciudad: "", departamento: "", codigo_postal: "", telefono_contacto: "", es_principal: false, etiqueta: "" });
    setEditingId(null);
    setShowForm(false);
  }

  function openEdit(dir: Direccion) {
    setForm({
      direccion: dir.DIRECCION, barrio: dir.BARRIO || "", ciudad: dir.CIUDAD,
      departamento: dir.DEPARTAMENTO, codigo_postal: dir.CODIGO_POSTAL || "",
      telefono_contacto: dir.TELEFONO_CONTACTO || "", es_principal: !!dir.ES_PRINCIPAL,
      etiqueta: dir.ETIQUETA || ""
    });
    setEditingId(dir.ID_DIRECCION);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.direccion || !form.ciudad || !form.departamento) {
      return mostrarToast("Dirección, ciudad y departamento son obligatorios.", "error");
    }
    try {
      if (editingId) {
        await axios.put(`/api/direcciones/${editingId}`, form, { withCredentials: true });
        mostrarToast("Dirección actualizada.", "success");
      } else {
        await axios.post("/api/direcciones", form, { withCredentials: true });
        mostrarToast("Dirección agregada.", "success");
      }
      resetForm();
      fetchDirecciones();
    } catch { mostrarToast("Error al guardar.", "error"); }
  }

  async function eliminarDireccion(id: number) {
    try {
      await axios.delete(`/api/direcciones/${id}`, { withCredentials: true });
      mostrarToast("Dirección eliminada.", "success");
      fetchDirecciones();
    } catch { mostrarToast("Error al eliminar.", "error"); }
  }

  return (
    <div className="direcciones-page">
      {toast.mostrar && (
        <div className={`toast-dir ${toast.tipo}`}>
          {toast.tipo === "success" ? "✅" : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="direcciones-card">
        <div className="dir-header">
          <button className="btn-volver-dir" onClick={() => navigate("/perfil")}>
            <FaArrowLeft /> Volver
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Direcciones" }]} />
          <h1>
            <FaMapMarkerAlt className="dir-icon-title" /> Mis Direcciones
          </h1>
        </div>

        {!showForm && (
          <button className="btn-agregar" onClick={() => setShowForm(true)}>
            <FaPlus /> Agregar dirección
          </button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="dir-form">
            <div className="dir-form-grid">
              <div className="form-group full">
                <label>Etiqueta (ej: Casa, Trabajo)</label>
                <input type="text" value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} placeholder="Casa, Trabajo, etc." />
              </div>
              <div className="form-group full">
                <label>Dirección *</label>
                <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Cra 45 # 23-12" />
              </div>
              <div className="form-group">
                <label>Barrio</label>
                <input type="text" value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value })} placeholder="Barrio" />
              </div>
              <div className="form-group">
                <label>Departamento *</label>
                <select
                  value={form.departamento}
                  onChange={e => { setForm({ ...form, departamento: e.target.value, ciudad: "" }); }}
                >
                  <option value="">Selecciona departamento</option>
                  {Object.keys(DEPARTAMENTOS).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ciudad *</label>
                <select
                  value={form.ciudad}
                  onChange={e => setForm({ ...form, ciudad: e.target.value })}
                  disabled={!form.departamento}
                >
                  <option value="">{form.departamento ? "Selecciona ciudad" : "Primero elige departamento"}</option>
                  {(DEPARTAMENTOS[form.departamento] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Código postal</label>
                <input type="text" value={form.codigo_postal} onChange={e => setForm({ ...form, codigo_postal: e.target.value })} placeholder="Código postal" />
              </div>
              <div className="form-group">
                <label>Teléfono de contacto</label>
                <input type="text" value={form.telefono_contacto} onChange={e => setForm({ ...form, telefono_contacto: e.target.value })} placeholder="Teléfono" />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={form.es_principal} onChange={e => setForm({ ...form, es_principal: e.target.checked })} />
                  Establecer como dirección principal
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-guardar-dir">{editingId ? "Actualizar" : "Guardar"}</button>
              <button type="button" className="btn-cancelar-dir" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="dir-loading">Cargando...</div>
        ) : direcciones.length === 0 ? (
          <div className="dir-empty">
            <FaMapMarkerAlt className="dir-empty-icon" />
            <p>No tienes direcciones guardadas</p>
          </div>
        ) : (
          <div className="dir-lista">
            {direcciones.map(dir => (
              <div key={dir.ID_DIRECCION} className={`dir-item ${dir.ES_PRINCIPAL ? "principal" : ""}`}>
                <div className="dir-item-info">
                  <div className="dir-item-header">
                    <strong><FaHome className="dir-info-icon" /> {dir.ETIQUETA ? dir.ETIQUETA : "Dirección"}</strong>
                    {dir.ES_PRINCIPAL === 1 && <span className="dir-badge">Principal</span>}
                  </div>
                  <p className="dir-linea dir-linea-dir"><FaMapMarkerAlt className="dir-info-icon" /> {dir.DIRECCION}</p>
                  <p className="dir-linea"><FaCity className="dir-info-icon" /> {dir.CIUDAD}, {dir.DEPARTAMENTO}{dir.BARRIO ? ` · ${dir.BARRIO}` : ""}</p>
                  {dir.TELEFONO_CONTACTO && (
                    <p className="dir-linea"><FaPhone className="dir-info-icon" /> {dir.TELEFONO_CONTACTO}</p>
                  )}
                  {dir.CODIGO_POSTAL && (
                    <p className="dir-linea"><FaEnvelope className="dir-info-icon" /> CP: {dir.CODIGO_POSTAL}</p>
                  )}
                </div>
                <div className="dir-item-actions">
                  <button className="btn-edit-dir" onClick={() => openEdit(dir)} title="Editar">
                    <FaPencilAlt />
                  </button>
                  <button className="btn-del-dir" onClick={() => eliminarDireccion(dir.ID_DIRECCION)} title="Eliminar">
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

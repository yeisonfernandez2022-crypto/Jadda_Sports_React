import "../css/DireccionesPerfil.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaPlus, FaTrash, FaPencilAlt, FaMapMarkerAlt } from "react-icons/fa";

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
                <label>Ciudad *</label>
                <input type="text" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Ciudad" />
              </div>
              <div className="form-group">
                <label>Departamento *</label>
                <input type="text" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} placeholder="Departamento" />
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
                    <strong>{dir.ETIQUETA ? dir.ETIQUETA : dir.DIRECCION}</strong>
                    {dir.ES_PRINCIPAL === 1 && <span className="dir-badge">Principal</span>}
                  </div>
                  <p>{dir.DIRECCION} — {dir.CIUDAD}, {dir.DEPARTAMENTO}{dir.BARRIO ? ` - ${dir.BARRIO}` : ""}</p>
                  {dir.CODIGO_POSTAL && <small>CP: {dir.CODIGO_POSTAL}</small>}
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

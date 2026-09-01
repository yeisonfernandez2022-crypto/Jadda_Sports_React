import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaTags, FaSearch } from "react-icons/fa";
import { escapeHtml } from "../utils/escapeHtml";

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
  DESCRIPCION: string | null;
  TOTAL_PRODUCTOS: number;
}

const AdminCategorias = () => {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const filtradas = categorias.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      (c.NOMBRE_CATEGORIA || "").toLowerCase().includes(q) ||
      (c.DESCRIPCION || "").toLowerCase().includes(q)
    );
  });
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const fetchCategorias = async () => {
    try {
      const res = await fetch("/api/productos/categorias");
      setCategorias(await res.json());
    } catch {
      console.error("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  const abrirNueva = () => {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setShowModal(true);
  };

  const abrirEdicion = (cat: Categoria) => {
    setEditando(cat);
    setNombre(cat.NOMBRE_CATEGORIA);
    setDescripcion(cat.DESCRIPCION || "");
    setShowModal(true);
  };

  const guardar = async () => {
    if (nombre.trim().length < 3) {
      Swal.fire("Campo obligatorio", "El nombre debe tener al menos 3 caracteres", "warning");
      return;
    }
    setGuardando(true);
    try {
      const url = editando ? `/api/productos/categorias/${editando.ID_CATEGORIA}` : "/api/productos/categorias";
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nombre.trim(), description: descripcion.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        setShowModal(false);
        fetchCategorias();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al guardar la categoría" });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (cat: Categoria) => {
    if (cat.TOTAL_PRODUCTOS > 0) {
      Swal.fire({
        icon: "warning",
        title: "No se puede eliminar",
        html: `La categoría <strong>${escapeHtml(cat.NOMBRE_CATEGORIA)}</strong> tiene ${cat.TOTAL_PRODUCTOS} producto(s). Mueve o elimina esos productos primero.`,
        confirmButtonColor: "#e73737",
      });
      return;
    }
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: `¿Eliminar "${escapeHtml(cat.NOMBRE_CATEGORIA)}"?`,
      text: "Esta acción no se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/productos/categorias/${cat.ID_CATEGORIA}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        fetchCategorias();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo eliminar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al eliminar la categoría" });
    }
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al inicio
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Categorías" }]} />
            <div className="au-titulos">
              <h1>Categorías</h1>
              <p>
                {categorias.length} categorías — crea, edita o elimina las categorías de la tienda (RF-027)
              </p>
            </div>
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <FaSearch />
              <input
                type="text"
                placeholder="Buscar categoría por nombre o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <span className="ap-count">
              <FaTags /> {filtradas.length} categoría{filtradas.length !== 1 ? "s" : ""}
            </span>
            <button className="btn-save-admin" style={{ marginLeft: "auto" }} onClick={abrirNueva}>
              <FaPlus /> Nueva categoría
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando categorías...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {busqueda.trim() ? `Sin resultados para "${busqueda}"` : "No hay categorías registradas"}
            </div>
          ) : (
            <div className="ap-tabla-wrap">
              <table className="ap-tabla">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>#</th>
                    <th style={{ width: "26%" }}>Nombre</th>
                    <th style={{ width: "34%" }}>Descripción</th>
                    <th style={{ width: "14%", textAlign: "center" }}>Productos</th>
                    <th style={{ width: "18%", textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((cat) => (
                    <tr key={cat.ID_CATEGORIA}>
                      <td><span className="ap-id">{cat.ID_CATEGORIA}</span></td>
                      <td><span className="tb-ellip tb-strong" title={cat.NOMBRE_CATEGORIA}>{cat.NOMBRE_CATEGORIA}</span></td>
                      <td><span className="tb-ellip tb-sub2" title={cat.DESCRIPCION || ""}>{cat.DESCRIPCION || "—"}</span></td>
                      <td className="text-center">
                        <span className={`badge ${cat.TOTAL_PRODUCTOS > 0 ? "bg-dark" : "bg-secondary"}`}>
                          {cat.TOTAL_PRODUCTOS}
                        </span>
                      </td>
                      <td className="text-center">
                        <button className="ap-btn-accion editar" title="Editar" onClick={() => abrirEdicion(cat)}>
                          <FaEdit />
                        </button>
                        <button className="ap-btn-accion eliminar" title="Eliminar" onClick={() => eliminar(cat)}>
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="evidencia-overlay" onClick={() => setShowModal(false)}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <button className="au-modal-x" onClick={() => setShowModal(false)}>✕</button>
            <div className="au-modal-hero">
              <div className="au-modal-avatar"><FaTags /></div>
              <div className="au-modal-hero-info">
                <h2>{editando ? `Editar categoría` : "Nueva categoría"}</h2>
                <p className="au-modal-usuario">{editando ? editando.NOMBRE_CATEGORIA : "Catálogo JADDA SPORTS"}</p>
              </div>
            </div>
            <div className="au-modal-body" style={{ paddingTop: 18 }}>
              <label className="form-label fw-bold small">Nombre *</label>
              <input
                className="form-control mb-3"
                placeholder="Ej: Tenis"
                value={nombre}
                maxLength={100}
                onChange={(e) => setNombre(e.target.value)}
              />
              <label className="form-label fw-bold small">Descripción</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Nota descriptiva opcional"
                value={descripcion}
                maxLength={100}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="evidencia-modal-footer" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Descartar</button>
              <button type="button" className="btn-save-admin" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear categoría"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminFooter />
    </div>
  );
};

export default AdminCategorias;

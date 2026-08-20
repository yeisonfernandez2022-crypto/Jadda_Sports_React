import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
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
            <div className="w-100 d-flex justify-content-between align-items-start">
              <div>
                <button className="admin-volver" onClick={() => navigate("/admin")}>
                  <FaArrowLeft /> Volver al Dashboard
                </button>
                <div className="mt-2">
                  <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Categorías" }]} />
                </div>
                <div className="au-titulos">
                  <h1>Categorías</h1>
                  <p>
                    {categorias.length} categorías — crea, edita o elimina las categorías de la tienda (RF-027)
                  </p>
                </div>
              </div>
              <button className="btn btn-success fw-bold px-4 shadow-sm" onClick={abrirNueva}>
                <FaPlus className="me-1" /> Nueva categoría
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando categorías...</div>
          ) : categorias.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay categorías registradas</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th className="text-center">Productos</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((cat) => (
                    <tr key={cat.ID_CATEGORIA}>
                      <td className="fw-bold">{cat.ID_CATEGORIA}</td>
                      <td className="fw-bold">{cat.NOMBRE_CATEGORIA}</td>
                      <td className="text-muted">{cat.DESCRIPCION || "—"}</td>
                      <td className="text-center">
                        <span className={`badge ${cat.TOTAL_PRODUCTOS > 0 ? "bg-dark" : "bg-secondary"}`}>
                          {cat.TOTAL_PRODUCTOS}
                        </span>
                      </td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-primary me-2" title="Editar" onClick={() => abrirEdicion(cat)}>
                          <FaEdit />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(cat)}>
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
        <div className="custom-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="custom-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-header-admin">
              <h5 className="m-0">{editando ? `Editar "${editando.NOMBRE_CATEGORIA}"` : "Nueva categoría"}</h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="custom-modal-body">
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
            <div className="modal-footer-admin">
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaUser, FaArrowLeft } from "react-icons/fa";

const AdminUsuarios = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = async () => {
    try {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      const data = await res.json();
      setUsuarios(data);
    } catch {
      console.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-2">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="fw-bold text-dark m-0">Usuarios</h1>
                <p className="text-muted small m-0">Gestiona los usuarios registrados</p>
              </div>
              <p className="text-muted small m-0">{usuarios.length} usuarios</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay usuarios registrados</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Registro</th>
                    <th className="text-center">Confirmado</th>
                    <th>Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.ID_USUARIO}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}
                          >
                            {u.NOMBRE_USUARIO?.[0] || <FaUser size={14} />}
                          </div>
                          <span className="fw-bold">{u.USUARIO}</span>
                        </div>
                      </td>
                      <td>{u.NOMBRE_USUARIO} {u.APELLIDO_USUARIO}</td>
                      <td className="small">{u.EMAIL}</td>
                      <td className="small">{u.TELEFONO || "-"}</td>
                      <td>
                        <span className={`badge ${u.ID_ROL === 1 ? "bg-danger" : u.ID_ROL === 2 ? "bg-primary" : u.ID_ROL === 3 ? "bg-warning text-dark" : "bg-secondary"}`}>
                          {u.NOMBRE_ROL || "Sin rol"}
                        </span>
                      </td>
                      <td className="small">
                        {u.FECHA_REGISTRO ? new Date(u.FECHA_REGISTRO).toLocaleDateString("es-CO") : "-"}
                      </td>
                      <td className="text-center">
                        {u.CONFIRMADO ? (
                          <span className="badge bg-success">Sí</span>
                        ) : (
                          <span className="badge bg-secondary">No</span>
                        )}
                      </td>
                      <td className="small">{u.AUTH_PROVIDER || "local"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminUsuarios;

import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaEye, FaSearch, FaUser } from "react-icons/fa";

/**
 * Listado de usuarios del panel admin. Cada fila enlaza a la página de
 * detalle (/admin/usuarios/:id); el detalle ya no se abre en un modal.
 */
const AdminUsuarios = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const fetchUsuarios = async () => {
    try {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsuarios(); }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      `${u.NOMBRE_USUARIO || ""} ${u.APELLIDO_USUARIO || ""} ${u.EMAIL || ""} ${u.USUARIO || ""}`.toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  const claseRol = (idRol: number) =>
    idRol === 1 ? "au-rol-admin" : idRol === 2 ? "au-rol-cliente" : idRol === 3 ? "au-rol-asesor" : idRol === 6 ? "au-rol-vendedor" : "au-rol-otro";

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="au-wrap">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al inicio
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Usuarios" }]} />
            <div className="au-titulos">
              <h1>Usuarios</h1>
              <p>Gestiona los usuarios registrados</p>
            </div>
          </div>

          <div className="au-toolbar">
            <div className="ap-search au-search">
              <FaSearch />
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <span className="ap-count">{filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="au-vacio">Cargando usuarios...</div>
          ) : filtrados.length === 0 ? (
            <div className="au-vacio">
              <FaUser style={{ fontSize: "2rem", color: "#94a3b8" }} />
              <p>{usuarios.length === 0 ? "No hay usuarios registrados" : "No se encontraron resultados"}</p>
            </div>
          ) : (
            <div className="au-tabla-wrap">
              <table className="au-tabla">
                <thead>
                  <tr>
                    <th className="au-col-usuario">Usuario</th>
                    <th className="au-col-nombre">Nombre</th>
                    <th className="au-col-email">Correo</th>
                    <th className="au-col-rol">Rol</th>
                    <th className="au-col-fecha">Fecha registro</th>
                    <th className="au-col-ver">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.ID_USUARIO}>
                      <td className="au-col-usuario">
                        <div className="au-usuario">
                          <div className="au-avatar">
                            {u.NOMBRE_USUARIO?.[0] || <FaUser size={13} />}
                          </div>
                          <span className="au-usuario-nombre" title={u.USUARIO}>{u.USUARIO}</span>
                        </div>
                      </td>
                      <td className="au-col-nombre" title={`${u.NOMBRE_USUARIO || ""} ${u.APELLIDO_USUARIO || ""}`}>
                        {u.NOMBRE_USUARIO} {u.APELLIDO_USUARIO}
                      </td>
                      <td className="au-col-email" title={u.EMAIL}>{u.EMAIL}</td>
                      <td className="au-col-rol">
                        <span className={`au-rol ${claseRol(u.ID_ROL)}`}>{u.NOMBRE_ROL || "Sin rol"}</span>
                      </td>
                      <td className="au-col-fecha">
                        {u.FECHA_REGISTRO ? new Date(u.FECHA_REGISTRO).toLocaleDateString("es-CO") : "-"}
                      </td>
                      <td className="au-col-ver">
                        <Link className="au-btn-ver" to={`/admin/usuarios/${u.ID_USUARIO}`}>
                          <FaEye /> Ver usuario
                        </Link>
                      </td>
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

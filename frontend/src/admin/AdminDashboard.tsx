import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaBox, FaShoppingCart, FaUsers, FaDollarSign, FaArrowRight } from "react-icons/fa";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalProductos: 0, totalOrdenes: 0, totalUsuarios: 0, totalIngresos: 0 });
  const [ordenesRecientes, setOrdenesRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/dashboard", { credentials: "include" });
        const data = await res.json();
        setStats(data.stats);
        setOrdenesRecientes(data.ordenesRecientes);
      } catch {
        console.error("Error al cargar dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const tarjetas = [
    { label: "Productos", value: stats.totalProductos, icon: <FaBox />, color: "#e73737", path: "/admin/productos" },
    { label: "Órdenes", value: stats.totalOrdenes, icon: <FaShoppingCart />, color: "#0d6efd", path: "/admin/ordenes" },
    { label: "Usuarios", value: stats.totalUsuarios, icon: <FaUsers />, color: "#198754", path: "/admin/usuarios" },
    { label: "Ingresos", value: `$${stats.totalIngresos.toLocaleString()}`, icon: <FaDollarSign />, color: "#6f42c1", path: "" },
  ];

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-2">
            <h1 className="fw-bold text-dark m-0">Dashboard</h1>
            <p className="text-muted small m-0">Resumen general de la tienda</p>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando dashboard...</div>
          ) : (
            <>
              <div className="row g-4 mb-5">
                {tarjetas.map((t, i) => (
                  <div className="col-md-3 col-6" key={i}>
                    <div
                      className="bg-white rounded-4 shadow-sm p-4 h-100 border"
                      style={{ cursor: t.path ? "pointer" : "default", transition: "transform 0.2s", borderLeft: `4px solid ${t.color}` }}
                      onClick={() => t.path && navigate(t.path)}
                      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: "48px", height: "48px", background: `${t.color}15`, color: t.color, fontSize: "1.3rem" }}>
                          {t.icon}
                        </div>
                        <div>
                          <div className="text-muted text-uppercase small fw-bold">{t.label}</div>
                          <div className="fw-bold fs-4">{t.value}</div>
                        </div>
                      </div>
                      {t.path && (
                        <div className="small text-muted d-flex align-items-center gap-1">
                          Ver detalle <FaArrowRight size={10} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded shadow-sm border">
                <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                  <h5 className="fw-bold m-0">Órdenes recientes</h5>
                  <button className="btn btn-outline-dark btn-sm fw-bold" onClick={() => navigate("/admin/ordenes")}>
                    Ver todas
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light text-uppercase small text-secondary">
                      <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenesRecientes.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted py-4">No hay órdenes recientes</td></tr>
                      ) : (
                        ordenesRecientes.map((o) => (
                          <tr key={o.ID_VENTA} style={{ cursor: "pointer" }} onClick={() => navigate("/admin/ordenes")}>
                            <td className="fw-bold">#{o.ID_VENTA}</td>
                            <td>{o.NOMBRE_USUARIO} {o.APELLIDO_USUARIO}</td>
                            <td>{new Date(o.FECHA_VENTA).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                            <td className="fw-bold">${Number(o.TOTAL).toLocaleString()}</td>
                            <td>
                              <span className={`badge ${o.ESTADO === "COMPLETADA" ? "bg-success" : o.ESTADO === "CANCELADA" ? "bg-danger" : o.ESTADO === "ENVIADA" ? "bg-primary" : "bg-warning text-dark"}`}>
                                {o.ESTADO}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminDashboard;

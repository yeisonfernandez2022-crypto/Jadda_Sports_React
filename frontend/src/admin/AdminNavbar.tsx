import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaStore, FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaUsers, FaTrophy, FaUndoAlt, FaFolderOpen, FaChartLine, FaBars,
  FaStoreAlt,
} from "react-icons/fa";
import BellNotificaciones from "../components/BellNotificaciones";
import { useAuth } from "../context/AuthContext";
import { navegarConGuardia, puedeNavegar } from "../utils/navigationGuard";

const tabs = [
  { path: "/admin", label: "Dashboard", icon: FaTachometerAlt },
  { path: "/admin/productos", label: "Productos", icon: FaBoxOpen, badge: "productos" },
  { path: "/admin/ordenes", label: "Órdenes", icon: FaShoppingCart },
  { path: "/admin/usuarios", label: "Usuarios", icon: FaUsers },
  { path: "/admin/retos", label: "Retos", icon: FaTrophy, badge: "evidencias" },
  { path: "/admin/devoluciones", label: "Devoluciones", icon: FaUndoAlt, badge: "devoluciones" },
  { path: "/admin/vendedores", label: "Vendedores", icon: FaStoreAlt, badge: "vendedores" },
  { path: "/admin/categorias", label: "Categorías", icon: FaFolderOpen },
  { path: "/admin/reportes", label: "Reportes", icon: FaChartLine },
];

const AdminNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logoutGlobal } = useAuth();
  const [pendientes, setPendientes] = useState<{ evidencias: number; devoluciones: number; vendedores: number; productos: number }>({ evidencias: 0, devoluciones: 0, vendedores: 0, productos: 0 });
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pendientes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPendientes({ evidencias: d.evidencias || 0, devoluciones: d.devoluciones || 0, vendedores: d.vendedores || 0, productos: d.productos || 0 }))
      .catch(() => {});
  }, [location.pathname]);

  const cerrarSesion = async () => {
    if (!(await puedeNavegar())) return;
    await logoutGlobal();
    navigate("/");
  };

  return (
    <>
      <button
        className="admin-sidebar-toggle"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Abrir menú"
      >
        <FaBars />
      </button>
      {abierto && <div className="admin-sidebar-backdrop" onClick={() => setAbierto(false)} />}
      <aside className={`admin-sidebar ${abierto ? "admin-sidebar-open" : ""}`}>
        <div className="admin-sidebar-brand" onClick={() => { setAbierto(false); navegarConGuardia("/admin", navigate); }}>
          <div className="admin-sidebar-logo">JS</div>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Panel de control</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path ||
              (location.pathname.startsWith(tab.path) && tab.path !== "/admin");
            const num = tab.badge ? pendientes[tab.badge as keyof typeof pendientes] || 0 : 0;
            return (
              <button
                key={tab.path}
                className={`admin-sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => { setAbierto(false); navegarConGuardia(tab.path, navigate); }}
              >
                <Icon />
                <span className="admin-sidebar-label">{tab.label}</span>
                {num > 0 && <span className="admin-sidebar-badge">{num}</span>}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">
              {usuario?.NOMBRE_USUARIO?.charAt(0) || "A"}
            </div>
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Admin"}</strong>
              <span>Administrador</span>
            </div>
          </div>
          <div className="admin-sidebar-actions">
            <BellNotificaciones tema="oscuro" />
            <button onClick={() => navegarConGuardia("/", navigate)} title="Ir a la tienda">
              <FaStore />
            </button>
            <button onClick={cerrarSesion} title="Cerrar sesión" className="logout">
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminNavbar;

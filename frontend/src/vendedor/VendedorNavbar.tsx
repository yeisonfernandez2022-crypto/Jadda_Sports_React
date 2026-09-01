import { useNavigate, useLocation } from "react-router-dom";
import {
  FaStore, FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaPlusCircle, FaCog, FaUndoAlt, FaChartLine,
} from "react-icons/fa";
import BellNotificaciones from "../components/BellNotificaciones";
import { useAuth } from "../context/AuthContext";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

const tabs = [
  { path: "/vendedor", label: "Mi tienda", icon: FaTachometerAlt, exact: true },
  { path: "/vendedor/productos", label: "Mis productos", icon: FaBoxOpen },
  { path: "/vendedor/productos/nuevo", label: "Publicar producto", icon: FaPlusCircle },
  { path: "/vendedor/ventas", label: "Mis ventas", icon: FaShoppingCart },
  { path: "/vendedor/devoluciones", label: "Devoluciones", icon: FaUndoAlt },
  { path: "/vendedor/reportes", label: "Reportes", icon: FaChartLine },
];

const esActivo = (tab: { path: string; exact?: boolean }, pathname: string) => {
  if (tab.exact) return pathname === tab.path;
  if (tab.path === "/vendedor/productos") {
    return pathname === "/vendedor/productos" || pathname.startsWith("/vendedor/productos/editar");
  }
  return pathname.startsWith(tab.path);
};

const VendedorNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logoutGlobal } = useAuth();


  const cerrarSesion = async () => {
    await logoutGlobal();
  };

  const ir = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <aside className="admin-sidebar ven-sidebar">
        <div className="admin-sidebar-brand" onClick={() => ir("/vendedor")}>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Tienda de vendedor</span>
          </div>
        </div>

        {/* {usuario} arriba - solo nombre, sin foto/cuadro - igual que admin */}
        <div className="admin-sidebar-user-top" style={{ cursor: "default", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Vendedor"}</strong>
              <span>Vendedor</span>
            </div>
          </div>
          <div className="admin-sidebar-user-actions">
            <BellNotificaciones tema="oscuro" />
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = esActivo(tab, location.pathname);
            return (
              <button
                key={tab.path}
                className={`admin-sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => ir(tab.path)}
              >
                <Icon />
                <span className="admin-sidebar-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot" style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="admin-sidebar-link" onClick={() => ir("/vendedor/configuracion")}>
            <FaCog />
            <span className="admin-sidebar-label">Configuración</span>
          </button>
          <button className="admin-sidebar-link" onClick={() => ir("/")}>
            <FaStore />
            <span className="admin-sidebar-label">Ver tienda</span>
          </button>
          <button className="admin-sidebar-link logout" onClick={cerrarSesion} style={{ color: "#f87171", background: "rgba(248,113,113,0.08)" }}>
            <FaSignOutAlt />
            <span className="admin-sidebar-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default VendedorNavbar;

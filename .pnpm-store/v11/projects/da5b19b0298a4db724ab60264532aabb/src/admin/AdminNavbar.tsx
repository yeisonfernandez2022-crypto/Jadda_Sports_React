import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaUsers, FaTrophy, FaUndoAlt, FaFolderOpen, FaChartLine, FaBars,
  FaStoreAlt, FaCog,
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
  const [pendientes, setPendientes] = useState<{ evidencias: number; devoluciones: number; vendedores: number; productos: number; chats: number }>({ evidencias: 0, devoluciones: 0, vendedores: 0, productos: 0, chats: 0 });
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pendientes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPendientes({ evidencias: d.evidencias || 0, devoluciones: d.devoluciones || 0, vendedores: d.vendedores || 0, productos: d.productos || 0, chats: d.chats || 0 }))
      .catch(() => {});
  }, [location.pathname]);

  const cerrarSesion = async () => {
    if (!(await puedeNavegar())) return;
    await logoutGlobal();
    navigate("/");
  };

  return (
    <>
      <button className="admin-sidebar-toggle" onClick={() => setAbierto((v) => !v)} aria-label="Abrir menú">
        <FaBars />
      </button>
      {abierto && <div className="admin-sidebar-backdrop" onClick={() => setAbierto(false)} />}
      <aside className={`admin-sidebar ${abierto ? "admin-sidebar-open" : ""}`}>
        <div className="admin-sidebar-brand" onClick={() => { setAbierto(false); navegarConGuardia("/admin", navigate); }}>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Panel de control</span>
          </div>
        </div>

        {/* {usuario} arriba - solo nombre, sin foto/cuadro */}
        <div className="admin-sidebar-user-top" style={{ cursor: "default", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Admin"}</strong>
              <span>Administrador</span>
            </div>
          </div>
          <div className="admin-sidebar-user-actions">
            <BellNotificaciones tema="oscuro" />
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (location.pathname.startsWith(tab.path) && tab.path !== "/admin");
            const num = tab.badge ? pendientes[tab.badge as keyof typeof pendientes] || 0 : 0;
            return (
              <button key={tab.path} className={`admin-sidebar-link ${isActive ? "active" : ""}`} onClick={() => { setAbierto(false); navegarConGuardia(tab.path, navigate); }}>
                <Icon />
                <span className="admin-sidebar-label">{tab.label}</span>
                {num > 0 && <span className="admin-sidebar-badge">{num}</span>}
              </button>
            );
          })}
        </nav>

        {/* Penúltimo: Configuración */}
        <div className="admin-sidebar-foot" style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="admin-sidebar-link" onClick={() => { setAbierto(false); navegarConGuardia("/admin/configuracion", navigate); }}>
            <FaCog />
            <span className="admin-sidebar-label">Configuración</span>
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

export default AdminNavbar;

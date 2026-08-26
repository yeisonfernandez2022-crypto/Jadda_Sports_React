import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaStore, FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaBuilding, FaBars, FaPlusCircle, FaChevronRight, FaCog, FaUndoAlt, FaComments, FaChartLine,
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
  { path: "/vendedor/chats", label: "Chats", icon: FaComments, chats: true },
  { path: "/vendedor/reportes", label: "Reportes", icon: FaChartLine },
  { path: "/vendedor/empresa", label: "Mi empresa", icon: FaBuilding },
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
  const [abierto, setAbierto] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [chatsSinLeer, setChatsSinLeer] = useState(0);

  // Badge de mensajes sin leer en los chats (polling cada 20s)
  useEffect(() => {
    const cargar = () => {
      fetch("/api/chat/no-leidos", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setChatsSinLeer(d.total || 0))
        .catch(() => {});
    };
    cargar();
    const t = setInterval(cargar, 20000);
    return () => clearInterval(t);
  }, []);

  const cerrarSesion = async () => {
    await logoutGlobal();
  };

  const ir = (path: string) => {
    setAbierto(false);
    setUserPanelOpen(false);
    navigate(path);
  };

  return (
    <>
      <button className="admin-sidebar-toggle" onClick={() => setAbierto((v) => !v)} aria-label="Abrir menú">
        <FaBars />
      </button>
      {abierto && <div className="admin-sidebar-backdrop" onClick={() => setAbierto(false)} />}
      <aside className={`admin-sidebar ven-sidebar ${abierto ? "admin-sidebar-open" : ""}`}>
        <div className="admin-sidebar-brand" onClick={() => ir("/vendedor")}>
          <div className="admin-sidebar-avatar">
            {usuario?.foto_url ? (
              <img src={usuario.foto_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "12px", objectFit: "cover" }} />
            ) : (
              <span className="admin-sidebar-logo-text">JS</span>
            )}
          </div>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Tienda de vendedor</span>
          </div>
        </div>

        <div className="admin-sidebar-user-top" onClick={() => setUserPanelOpen((v) => !v)}>
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Vendedor"}</strong>
              <span>Vendedor</span>
            </div>
          </div>
          <div className="admin-sidebar-user-actions">
            <BellNotificaciones tema="oscuro" />
            <FaChevronRight className={`admin-sidebar-chevron ${userPanelOpen ? "open" : ""}`} />
          </div>
        </div>

        {userPanelOpen && (
          <div className="admin-sidebar-userpanel">
            <div className="admin-sidebar-userpanel-header">
              <span>Opciones</span>
            </div>
            <button className="admin-sidebar-userpanel-item" onClick={() => ir("/vendedor/configuracion")}>
              <FaCog />
              <span>Configuración</span>
            </button>
            <button className="admin-sidebar-userpanel-item" onClick={() => ir("/")}>
              <FaStore />
              <span>Ver tienda</span>
            </button>
            <button className="admin-sidebar-userpanel-item logout" onClick={cerrarSesion}>
              <FaSignOutAlt />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}

        <nav className="admin-sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = esActivo(tab, location.pathname);
            const badgeChats = tab.path === "/vendedor/chats" ? chatsSinLeer : 0;
            return (
              <button
                key={tab.path}
                className={`admin-sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => ir(tab.path)}
              >
                <Icon />
                <span className="admin-sidebar-label">{tab.label}</span>
                {badgeChats > 0 && <span className="admin-sidebar-badge">{badgeChats > 99 ? "99+" : badgeChats}</span>}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-sidebar-actions-minimal"></div>
        </div>
      </aside>
    </>
  );
};

export default VendedorNavbar;

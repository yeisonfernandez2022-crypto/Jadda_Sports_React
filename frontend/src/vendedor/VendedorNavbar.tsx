import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaStore, FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaBuilding, FaBars, FaPlusCircle,
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

  const cerrarSesion = async () => {
    await logoutGlobal();
    navigate("/");
  };

  const ir = (path: string) => {
    setAbierto(false);
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
          <div className="admin-sidebar-logo ven-logo">JS</div>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Tienda de vendedor</span>
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
          <div className="ven-sidebar-sep" />
          <button className="admin-sidebar-link" onClick={() => ir("/perfil")}>
            <FaStore />
            <span className="admin-sidebar-label">Mi perfil</span>
          </button>
          <button className="admin-sidebar-link" onClick={() => ir("/perfil/compras")}>
            <FaShoppingCart />
            <span className="admin-sidebar-label">Mis compras</span>
          </button>
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar ven-avatar">
              {usuario?.NOMBRE_USUARIO?.charAt(0) || "V"}
            </div>
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Vendedor"}</strong>
              <span>Vendedor</span>
            </div>
          </div>
          <div className="admin-sidebar-actions">
            <BellNotificaciones tema="oscuro" />
            <button onClick={() => ir("/")} title="Ir a la tienda">
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

export default VendedorNavbar;
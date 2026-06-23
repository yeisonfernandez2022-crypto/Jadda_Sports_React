import { useNavigate, useLocation } from "react-router-dom";
import { FaStore } from "react-icons/fa";

const tabs = [
  { path: "/admin", label: "Dashboard", icon: "📊" },
  { path: "/admin/productos", label: "Productos", icon: "🏷️" },
  { path: "/admin/ordenes", label: "Órdenes", icon: "📦" },
  { path: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

const AdminNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="admin-navbar">
      <div className="admin-navbar-inner">
        <div className="admin-navbar-left">
          <div className="admin-brand" onClick={() => navigate("/admin")}>
            <span className="admin-brand-icon">🔥</span>
            <div>
              <span className="admin-brand-name">JADDA SPORTS</span>
              <span className="admin-brand-sub">Panel Admin</span>
            </div>
          </div>
          <div className="admin-nav-links">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path || 
                (tab.path === "/admin" && location.pathname === "/admin");
              return (
                <button
                  key={tab.path}
                  className={`admin-nav-link ${isActive ? "active" : ""}`}
                  onClick={() => navigate(tab.path)}
                >
                  <span className="admin-nav-link-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="admin-navbar-right">
          <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 fw-bold px-3" onClick={() => navigate("/")} style={{ borderRadius: "8px" }}>
            <FaStore /> Ir a la tienda
          </button>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;

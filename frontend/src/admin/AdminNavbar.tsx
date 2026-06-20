import { useNavigate, useLocation } from "react-router-dom";

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
          <button className="admin-nav-icon-btn" title="Buscar" onClick={() => {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button className="admin-nav-icon-btn" title="Notificaciones" onClick={() => {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
          <button className="admin-nav-icon-btn" title="Configuración" onClick={() => {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <div className="admin-nav-avatar" onClick={() => navigate("/")} title="Ir a la tienda">
            AD
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;

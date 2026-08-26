import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaStore, FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaUsers, FaTrophy, FaUndoAlt, FaFolderOpen, FaChartLine, FaBars,
  FaStoreAlt, FaChevronRight, FaCamera, FaCog, FaComments,
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
  { path: "/admin/chats", label: "Chats", icon: FaComments, badge: "chats" },
  { path: "/admin/vendedores", label: "Vendedores", icon: FaStoreAlt, badge: "vendedores" },
  { path: "/admin/categorias", label: "Categorías", icon: FaFolderOpen },
  { path: "/admin/reportes", label: "Reportes", icon: FaChartLine },
];

const AdminNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logoutGlobal, refreshPerfil } = useAuth();
  const [pendientes, setPendientes] = useState<{ evidencias: number; devoluciones: number; vendedores: number; productos: number; chats: number }>({ evidencias: 0, devoluciones: 0, vendedores: 0, productos: 0, chats: 0 });
  const [abierto, setAbierto] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const userPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userPanelRef.current && !userPanelRef.current.contains(e.target as Node)) {
        setUserPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const irTienda = () => navegarConGuardia("/", navigate);

  const toggleUserPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserPanelOpen((v) => !v);
  };

  const closeUserPanel = () => setUserPanelOpen(false);

  const abrirSelectorFoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/auth/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ foto: base64 }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        await refreshPerfil();
      }
    } catch {
      /* ignore */
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          <div className="admin-sidebar-avatar-wrapper" onClick={abrirSelectorFoto} title="Cambiar foto">
            <div className="admin-sidebar-avatar">
              {usuario?.foto_url ? (
                <img src={usuario.foto_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "12px", objectFit: "cover" }} />
              ) : (
                <span className="admin-sidebar-logo-text">JS</span>
              )}
            </div>
            <FaCamera className="admin-sidebar-avatar-camera" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Panel de control</span>
          </div>
        </div>

        <div className="admin-sidebar-user-top" onClick={toggleUserPanel}>
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-userinfo">
              <strong>{usuario?.NOMBRE_USUARIO || "Admin"}</strong>
              <span>Administrador</span>
            </div>
          </div>
          <div className="admin-sidebar-user-actions">
            <BellNotificaciones tema="oscuro" />
            <FaChevronRight className={`admin-sidebar-chevron ${userPanelOpen ? "open" : ""}`} />
          </div>
        </div>

{userPanelOpen && (
            <div className="admin-sidebar-userpanel" ref={userPanelRef}>
              <div className="admin-sidebar-userpanel-header">
                <span>Opciones</span>
              </div>
              <button className="admin-sidebar-userpanel-item" onClick={() => { closeUserPanel(); navegarConGuardia("/admin/configuracion", navigate); }}>
                <FaCog />
                <span>Configuración</span>
              </button>
              <button className="admin-sidebar-userpanel-item" onClick={() => { closeUserPanel(); irTienda(); }}>
                <FaStore />
                <span>Ver tienda</span>
              </button>
              <button className="admin-sidebar-userpanel-item logout" onClick={() => { closeUserPanel(); cerrarSesion(); }}>
                <FaSignOutAlt />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}

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
          <div className="admin-sidebar-actions-minimal">
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminNavbar;
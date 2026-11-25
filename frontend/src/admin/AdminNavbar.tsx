import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaSignOutAlt, FaTachometerAlt, FaBoxOpen, FaShoppingCart,
  FaUsers, FaTrophy, FaUndoAlt, FaChartLine, FaBars,
  FaStoreAlt, FaCog, FaChevronRight,
} from "react-icons/fa";
import BellNotificaciones from "../components/BellNotificaciones";
import { useAuth } from "../context/AuthContext";
import { navegarConGuardia, puedeNavegar } from "../utils/navigationGuard";
import { PENDIENTES_ACTUALIZADOS } from "../utils/eventosAdmin";

const INTERVALO_PENDIENTES_MS = 10000;

const tabs = [
  { path: "/admin", label: "Dashboard", icon: FaTachometerAlt },
  { path: "/admin/productos", label: "Productos", icon: FaBoxOpen, badge: "productos" },
  { path: "/admin/ordenes", label: "Órdenes", icon: FaShoppingCart },
  { path: "/admin/usuarios", label: "Usuarios", icon: FaUsers },
  { path: "/admin/retos", label: "Retos", icon: FaTrophy, badge: "evidencias" },
  { path: "/admin/devoluciones", label: "Devoluciones y reembolsos", icon: FaUndoAlt, badge: "devoluciones" },
  { path: "/admin/vendedores", label: "Vendedores", icon: FaStoreAlt, badge: "vendedores" },
  { path: "/admin/reportes", label: "Reportes", icon: FaChartLine },
];

const AdminNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logoutGlobal } = useAuth();
  const [pendientes, setPendientes] = useState<{ evidencias: number; devoluciones: number; vendedores: number; productos: number }>({ evidencias: 0, devoluciones: 0, vendedores: 0, productos: 0 });
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const menuUsuarioRef = useRef<HTMLDivElement>(null);

  const cargarPendientes = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/pendientes", { credentials: "include", cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setPendientes({
        evidencias: d.evidencias || 0,
        devoluciones: d.devoluciones || 0,
        vendedores: d.vendedores || 0,
        productos: d.productos || 0,
      });
    } catch {
      /* sin conexión: se reintenta con el sondeo */
    }
  }, []);

  // Se actualiza al navegar y cada 10 s (solo con la pestaña visible), para
  // que las insignias no queden congeladas mientras el admin trabaja.
  useEffect(() => {
    void cargarPendientes();
  }, [cargarPendientes, location.pathname]);

  useEffect(() => {
    const actualizar = () => { void cargarPendientes(); };
    const actualizarSiVisible = () => {
      if (document.visibilityState === "visible") void cargarPendientes();
    };
    const intervalo = window.setInterval(actualizarSiVisible, INTERVALO_PENDIENTES_MS);
    window.addEventListener("focus", actualizar);
    window.addEventListener(PENDIENTES_ACTUALIZADOS, actualizar);
    document.addEventListener("visibilitychange", actualizarSiVisible);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizar);
      window.removeEventListener(PENDIENTES_ACTUALIZADOS, actualizar);
      document.removeEventListener("visibilitychange", actualizarSiVisible);
    };
  }, [cargarPendientes]);

  // Cierra el menú de usuario al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!menuUsuario) return;
    const alHacerClicFuera = (e: MouseEvent) => {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(e.target as Node)) {
        setMenuUsuario(false);
      }
    };
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuUsuario(false);
    };
    document.addEventListener("mousedown", alHacerClicFuera);
    document.addEventListener("keydown", alPresionarTecla);
    return () => {
      document.removeEventListener("mousedown", alHacerClicFuera);
      document.removeEventListener("keydown", alPresionarTecla);
    };
  }, [menuUsuario]);

  const cerrarSesion = async () => {
    if (!(await puedeNavegar())) return;
    await logoutGlobal();
    void navigate("/");
  };

  return (
    <>
      <button className="admin-sidebar-toggle" onClick={() => setAbierto((v) => !v)} aria-label="Abrir menú">
        <FaBars />
      </button>
      {abierto && <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }} className="admin-sidebar-backdrop" onClick={() => setAbierto(false)} />}
      <aside className={`admin-sidebar ${abierto ? "admin-sidebar-open" : ""}`}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }} className="admin-sidebar-brand" onClick={() => { setAbierto(false); void navegarConGuardia("/admin", navigate); }}>
          <div>
            <span className="admin-sidebar-title">JADDA SPORTS</span>
            <span className="admin-sidebar-sub">Panel de control</span>
          </div>
        </div>

        {/* {usuario} arriba: al hacer clic despliega las opciones a la derecha */}
        <div className="admin-sidebar-user-menu" ref={menuUsuarioRef}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Opciones de usuario"
            aria-expanded={menuUsuario}
            aria-controls="admin-menu-usuario"
            className="admin-sidebar-user-top"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest(".admin-sidebar-user-bell")) return;
              setMenuUsuario((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMenuUsuario((v) => !v);
              }
            }}
          >
            <div className="admin-sidebar-user">
              <div className="admin-sidebar-userinfo">
                <strong>{usuario?.NOMBRE_USUARIO || "Admin"}</strong>
                <span>Administrador</span>
              </div>
            </div>
            <div className="admin-sidebar-user-actions">
              <span className="admin-sidebar-user-bell">
                <BellNotificaciones tema="oscuro" />
              </span>
              <FaChevronRight
                className={`admin-sidebar-chevron ${menuUsuario ? "open" : ""}`}
                aria-hidden="true"
              />
            </div>
          </div>

          {menuUsuario && (
            <div className="admin-sidebar-userpanel" id="admin-menu-usuario">
              <div className="admin-sidebar-userpanel-header">Opciones</div>
              <button
                type="button"
                className="admin-sidebar-userpanel-item"
                onClick={() => {
                  setMenuUsuario(false);
                  setAbierto(false);
                  void navegarConGuardia("/admin/configuracion", navigate);
                }}
              >
                <FaCog aria-hidden="true" />
                <span>Configuración</span>
              </button>
              <button
                type="button"
                className="admin-sidebar-userpanel-item logout"
                onClick={() => {
                  setMenuUsuario(false);
                  setAbierto(false);
                  void cerrarSesion();
                }}
              >
                <FaSignOutAlt aria-hidden="true" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (location.pathname.startsWith(tab.path) && tab.path !== "/admin");
            const num = tab.badge ? pendientes[tab.badge as keyof typeof pendientes] || 0 : 0;
            return (
              <button key={tab.path} className={`admin-sidebar-link ${isActive ? "active" : ""}`} onClick={() => { setAbierto(false); void navegarConGuardia(tab.path, navigate); }}>
                <Icon />
                <span className="admin-sidebar-label">{tab.label}</span>
                {num > 0 && <span className="admin-sidebar-badge">{num}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default AdminNavbar;

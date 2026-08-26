import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import {
  FaBox, FaShoppingCart, FaUsers, FaDollarSign, FaTrophy, FaUndoAlt,
  FaExclamationTriangle, FaBell, FaChartLine, FaArrowRight, FaArrowUp,
  FaArrowDown, FaMinus,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";

const fmtCOP = (n: number) => `$${n.toLocaleString("es-CO")}`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/admin/dashboard", { credentials: "include" });
        if (res.ok) setData(await res.json());
      } catch {
        console.error("Error al cargar dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = data?.stats || {};
  const hoy = data?.hoy || {};
  const pendientes = data?.pendientes || {};
  const serie = data?.serie || [];
  const masVendidos = data?.masVendidos || [];
  const ordenesRecientes = data?.ordenesRecientes || [];
  const usuariosRecientes = data?.usuariosRecientes || [];

  const fechaHoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const maxSerie = Math.max(1, ...serie.map((s: any) => s.ingresos));
  const maxUnidades = Math.max(1, ...masVendidos.map((m: any) => m.unidades));

  const kpis = [
    { label: "Ingresos (30 días)", value: fmtCOP(stats.ingresos30 || 0), icon: FaDollarSign, grad: "linear-gradient(135deg,#e73737,#b32a2a)", path: "/admin/reportes" },
    { label: "Pedidos (30 días)", value: String(stats.ordenes30 || 0), icon: FaShoppingCart, grad: "linear-gradient(135deg,#2563eb,#1e40af)", path: "/admin/ordenes" },
    { label: "Clientes", value: String(stats.totalUsuarios || 0), icon: FaUsers, grad: "linear-gradient(135deg,#16a34a,#15803d)", path: "/admin/usuarios" },
    { label: "Productos", value: String(stats.totalProductos || 0), icon: FaBox, grad: "linear-gradient(135deg,#9333ea,#7e22ce)", path: "/admin/productos" },
  ];

  const pendientesList = [
    { label: "Evidencias de retos por revisar", valor: pendientes.evidenciasPend || 0, icon: FaTrophy, path: "/admin/retos", color: "#e73737" },
    { label: "Devoluciones por procesar", valor: pendientes.devolucionesPend || 0, icon: FaUndoAlt, path: "/admin/devoluciones", color: "#2563eb" },
    { label: "Productos con stock bajo", valor: pendientes.stockBajo || 0, icon: FaExclamationTriangle, path: "/admin/productos?stock_bajo=true&solo_jadda=true", color: "#f59e0b" },
    { label: "Avisos de reposición pendientes", valor: pendientes.avisosPend || 0, icon: FaBell, path: "/admin/productos", color: "#16a34a" },
  ];

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="admin-container">
          <div className="adm-header">
            <div>
              <h1 className="adm-header-title">Panel de Control</h1>
              <p className="adm-header-sub">Bienvenido de nuevo. Este es el resumen de tu tienda · {fechaHoy}</p>
            </div>
            <div className="adm-header-actions">
              <button className="adm-btn-outline" onClick={() => navigate("/admin/reportes")}>
                <FaChartLine /> Reportes
              </button>
              <button className="adm-btn-primary" onClick={() => navigate("/")}>
                Ver tienda
              </button>
            </div>
          </div>

          {loading ? (
            <div className="adm-loading">
              <div className="adm-loading-spinner" />
              <p>Cargando datos del panel...</p>
            </div>
          ) : (
            <>
              <div className="adm-kpi-row">
                {kpis.map((k, i) => {
                  const Icon = k.icon;
                  return (
                    <div key={i} className="adm-kpi-card" onClick={() => k.path && navigate(k.path)}>
                      <div className="adm-kpi-icon" style={{ background: k.grad }}>
                        <Icon />
                      </div>
                      <div className="adm-kpi-body">
                        <span className="adm-kpi-label">{k.label}</span>
                        <span className="adm-kpi-value">{k.value}</span>
                      </div>
                      <FaArrowRight className="adm-kpi-arrow" />
                    </div>
                  );
                })}
              </div>

              <div className="adm-subrow">
                <div className="adm-hoy-card">
                  <div className="adm-hoy-title">
                    <span>Hoy</span>
                    {hoy.pctVsAyer !== null && hoy.pctVsAyer !== undefined && (
                      <span className={`adm-hoy-pct ${hoy.pctVsAyer > 0 ? "up" : hoy.pctVsAyer < 0 ? "down" : ""}`}>
                        {hoy.pctVsAyer > 0 ? <FaArrowUp /> : hoy.pctVsAyer < 0 ? <FaArrowDown /> : <FaMinus />}
                        {Math.abs(hoy.pctVsAyer)}% vs ayer
                      </span>
                    )}
                  </div>
                  <div className="adm-hoy-metrics">
                    <div>
                      <span className="adm-hoy-value">{fmtCOP(hoy.ingresosHoy || 0)}</span>
                      <span className="adm-hoy-label">Ingresos</span>
                    </div>
                    <div>
                      <span className="adm-hoy-value">{hoy.ordenesHoy || 0}</span>
                      <span className="adm-hoy-label">Pedidos</span>
                    </div>
                    <div>
                      <span className="adm-hoy-value">{fmtCOP(stats.ticket30 || 0)}</span>
                      <span className="adm-hoy-label">Ticket promedio 30d</span>
                    </div>
                    <div>
                      <span className="adm-hoy-value">{stats.unidades30 || 0}</span>
                      <span className="adm-hoy-label">Unidades 30d</span>
                    </div>
                  </div>
                </div>

                <div className="adm-pendientes-card">
                  <div className="adm-card-title">
                    <span>Por revisar</span>
                    <span className="adm-card-sub">Acciones que necesitan tu atención</span>
                  </div>
                  {pendientesList.map((p, i) => {
                    const Icon = p.icon;
                    return (
                      <div key={i} className="adm-pendiente-row" onClick={() => navigate(p.path)}>
                        <div className="adm-pendiente-icon" style={{ background: `${p.color}18`, color: p.color }}>
                          <Icon />
                        </div>
                        <span className="adm-pendiente-label">{p.label}</span>
                        <span className={`adm-pendiente-num ${p.valor > 0 ? "con" : ""}`}>{p.valor}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="adm-chart-card">
                <div className="adm-card-title">
                  <span>Ventas · últimos 30 días</span>
                  <span className="adm-card-sub">Ingresos diarios (COP)</span>
                </div>
                {serie.length === 0 ? (
                  <div className="adm-chart-empty">Sin ventas en los últimos 30 días</div>
                ) : (
                  <div className="adm-chart-bars">
                    {serie.map((s: any, i: number) => (
                      <div key={i} className="adm-chart-bar" title={`${s.dia}: ${fmtCOP(s.ingresos)} (${s.ordenes} pedidos)`}>
                        <div className="adm-chart-bar-fill" style={{ height: `${Math.max(3, (s.ingresos / maxSerie) * 100)}%` }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="adm-cols2">
                <div className="adm-card">
                  <div className="adm-card-title">
                    <span>Top 5 más vendidos</span>
                    <span className="adm-card-link" onClick={() => navigate("/admin/reportes")}>
                      Ver reportes <FaArrowRight />
                    </span>
                  </div>
                  {masVendidos.length === 0 ? (
                    <div className="adm-chart-empty">Aún no hay ventas</div>
                  ) : (
                    masVendidos.map((m: any, i: number) => (
                      <div key={i} className="adm-top-row" onClick={() => navigate(`/admin/editar/${m.ID}`)}>
                        <span className="adm-top-pos">{i + 1}</span>
                        <img src={m.IMAGEN || "https://placehold.co/80x80?text=JADDA"} alt={m.NOMBRE} className="adm-top-img" loading="lazy" />
                        <div className="adm-top-info">
                          <span className="adm-top-name">{m.NOMBRE}</span>
                          <span className="adm-top-units">{m.unidades} und · {fmtCOP(m.ingresos)}</span>
                        </div>
                        <div className="adm-top-bar-wrap">
                          <div className="adm-top-bar" style={{ width: `${(m.unidades / maxUnidades) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="adm-card">
                  <div className="adm-card-title">
                    <span>Últimas órdenes</span>
                    <span className="adm-card-link" onClick={() => navigate("/admin/ordenes")}>
                      Ver todas <FaArrowRight />
                    </span>
                  </div>
                  {ordenesRecientes.length === 0 ? (
                    <div className="adm-chart-empty">Sin órdenes todavía</div>
                  ) : (
                    ordenesRecientes.map((o: any) => (
                      <div key={o.ID_VENTA} className="adm-order-row" onClick={() => navigate("/admin/ordenes")}>
                        <div>
                          <strong>{numeroPedido(o.ID_VENTA)}</strong>
                          <span className="adm-order-client">{o.NOMBRE_USUARIO} {o.APELLIDO_USUARIO}</span>
                        </div>
                        <div className="adm-order-right">
                          <span className={`adm-estado adm-estado-${(o.ESTADO || "").toLowerCase()}`}>{o.ESTADO}</span>
                          <strong>{fmtCOP(Number(o.TOTAL))}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="adm-cols2">
                <div className="adm-card">
                  <div className="adm-card-title">
                    <span>Usuarios recientes</span>
                    <span className="adm-card-link" onClick={() => navigate("/admin/usuarios")}>
                      Ver todos <FaArrowRight />
                    </span>
                  </div>
                  {usuariosRecientes.length === 0 ? (
                    <div className="adm-chart-empty">Sin usuarios</div>
                  ) : (
                    usuariosRecientes.map((u: any) => (
                      <div key={u.ID_USUARIO} className="adm-user-row">
                        <div className="adm-user-avatar">{u.NOMBRE_USUARIO?.charAt(0) || "?"}</div>
                        <div className="adm-top-info">
                          <span className="adm-top-name">{u.NOMBRE_USUARIO} {u.APELLIDO_USUARIO}</span>
                          <span className="adm-top-units">{u.EMAIL}</span>
                        </div>
                        <span className="adm-user-date">
                          {new Date(u.FECHA_REGISTRO).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="adm-card">
                  <div className="adm-card-title">
                    <span>Resumen global</span>
                    <span className="adm-card-sub">Histórico de la tienda</span>
                  </div>
                  <div className="adm-global-grid">
                    <div>
                      <span className="adm-global-value">{fmtCOP(stats.totalIngresos || 0)}</span>
                      <span className="adm-global-label">Ingresos confirmados</span>
                    </div>
                    <div>
                      <span className="adm-global-value">{stats.totalOrdenes || 0}</span>
                      <span className="adm-global-label">Órdenes totales</span>
                    </div>
                    <div>
                      <span className="adm-global-value">{stats.totalUsuarios || 0}</span>
                      <span className="adm-global-label">Usuarios registrados</span>
                    </div>
                    <div>
                      <span className="adm-global-value">{stats.totalProductos || 0}</span>
                      <span className="adm-global-label">Productos activos</span>
                    </div>
                  </div>
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

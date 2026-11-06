import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartLine, FaDollarSign, FaShoppingCart, FaTicketAlt, FaBoxes, FaFileExcel, FaFilePdf } from "react-icons/fa";
import { fechaHoy, fechaHaceDias, formatearFecha, muestrear, descargarReporte, TarjetaMasVendidos } from "../utils/reportes";
import type { MasVendido } from "../utils/reportes";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

interface Reporte {
  desde: string;
  hasta: string;
  totalOrdenes: number;
  totalIngresos: number;
  totalUnidades: number;
  productosVendidos: number;
  ticketPromedio: number;
  serie: { dia: string; pedidos: number; ingresos: number }[];
  masVendidos: MasVendido[];
}

const VendedorReportes = () => {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(fechaHaceDias(29));
  const [hasta, setHasta] = useState(fechaHoy());
  const [granularidad, setGranularidad] = useState<"dia" | "semana" | "mes" | "anio">("dia");
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState<"excel" | "pdf" | null>(null);

  /** Descarga blob del reporte en Excel o PDF con el rango actual. */
  const descargar = async (formato: "excel" | "pdf") => {
    await descargarReporte({
      formato,
      url: `/api/vendedor/reportes/${formato}?desde=${desde}&hasta=${hasta}`,
      desde,
      hasta,
      prefijoArchivo: "reporte-vendedor",
      setDescargando,
    });
  };

  const cargar = useCallback(async (d: string, h: string, gran: string = granularidad) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/vendedor/reportes?desde=${d}&hasta=${h}&granularidad=${gran}`, { credentials: "include" });
      if (!res.ok) throw new Error("error");
      setReporte(await res.json());
    } catch {
      setError("No se pudieron cargar tus reportes. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [granularidad]);

  useEffect(() => { void cargar(desde, hasta, granularidad); }, [cargar, desde, hasta, granularidad]);

  const aplicar = () => { if (desde && hasta && desde <= hasta) void cargar(desde, hasta, granularidad); };

  const maxIngreso = reporte?.serie?.length ? Math.max(...reporte.serie.map((s) => s.ingresos), 1) : 1;

  const tarjetas = reporte ? [
    { label: "Ingresos tuyos", value: `$${reporte.totalIngresos.toLocaleString("es-CO")}`, icon: <FaDollarSign />, color: "#6f42c1" },
    { label: "Pedidos con tus productos", value: reporte.totalOrdenes.toLocaleString("es-CO"), icon: <FaShoppingCart />, color: "#0d6efd" },
    { label: "Unidades vendidas", value: reporte.totalUnidades.toLocaleString("es-CO"), icon: <FaBoxes />, color: "#e73737" },
    { label: "Venta promedio por pedido", value: `$${reporte.ticketPromedio.toLocaleString("es-CO")}`, icon: <FaTicketAlt />, color: "#198754" },
  ] : [];

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/vendedor")}>
              <FaArrowLeft /> Volver al Dashboard
            </button>
            <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Reportes" }]} />
            <div className="au-titulos">
              <h1><FaChartLine className="me-2 text-danger" />Mis reportes</h1>
              <p>Ventas de TUS productos por rango de fechas: ingresos, pedidos y más vendidos</p>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border p-3 mb-4">
            <div className="row g-2 align-items-end">
              <div className="col-auto">
                <label htmlFor="ctrl-l124" className="form-label small text-muted fw-bold mb-1">Desde</label>
                <input id="ctrl-l124" type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="col-auto">
                <label htmlFor="ctrl-l128" className="form-label small text-muted fw-bold mb-1">Hasta</label>
                <input id="ctrl-l128" type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="col-auto">
                <label htmlFor="ctrl-l132" className="form-label small text-muted fw-bold mb-1">Ver por</label>
                <select id="ctrl-l132" className="form-select form-select-sm" value={granularidad} onChange={(e) => setGranularidad(e.target.value as any)} style={{ minWidth: 110 }}>
                  <option value="dia">Día</option>
                  <option value="semana">Semana</option>
                  <option value="mes">Mes</option>
                  <option value="anio">Año</option>
                </select>
              </div>
              <div className="col-auto">
                <button className="btn btn-danger btn-sm fw-bold" onClick={aplicar} disabled={loading}>
                  {loading ? "Cargando..." : "Aplicar"}
                </button>
              </div>
              <div className="col-auto d-flex gap-2 ms-auto">
                {[{ d: 6, l: "7 días" }, { d: 29, l: "30 días" }, { d: 89, l: "90 días" }].map((p) => (
                  <button key={p.d} className="btn btn-outline-secondary btn-sm" onClick={() => { const d = fechaHaceDias(p.d); const h = fechaHoy(); setDesde(d); setHasta(h); void cargar(d, h, granularidad); }}>
                    {p.l}
                  </button>
                ))}
                <button className="btn btn-sm fw-bold text-success border-success-subtle bg-white border" style={{ borderWidth: 1.5 }} onClick={() => descargar("excel")} disabled={descargando !== null} title="Descarga tu reporte en Excel con fórmulas">
                  <FaFileExcel className="me-1" /> {descargando === "excel" ? "Generando..." : "Excel"}
                </button>
                <button className="btn btn-sm fw-bold text-danger border-danger-subtle bg-white border" style={{ borderWidth: 1.5 }} onClick={() => descargar("pdf")} disabled={descargando !== null} title="Descarga tu reporte ejecutivo en PDF">
                  <FaFilePdf className="me-1" /> {descargando === "pdf" ? "Generando..." : "PDF"}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando tus reportes...</div>
          ) : reporte ? (
            <>
              <div className="row g-4 mb-4">
                {tarjetas.map((t, i) => (
                  <div className="col-md-3 col-6" key={i}>
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100 border" style={{ borderLeft: `4px solid ${t.color}` }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: "44px", height: "44px", background: `${t.color}15`, color: t.color, fontSize: "1.2rem" }}>
                          {t.icon}
                        </div>
                        <div>
                          <div className="text-muted text-uppercase small fw-bold">{t.label}</div>
                          <div className="fw-bold fs-5">{t.value}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded shadow-sm border mb-4">
                <div className="p-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h5 className="fw-bold m-0">Ventas por día (solo tus productos)</h5>
                  <small className="text-muted">{reporte.desde} → {reporte.hasta}</small>
                </div>
                <div className="p-3">
                  {(() => {
                    const visible = muestrear(reporte.serie.filter((s) => s.ingresos > 0 || s.pedidos > 0), 8);
                    const totalFiltrada = reporte.serie.filter((s) => s.ingresos > 0 || s.pedidos > 0).length;
                    if (visible.length === 0) return <div className="text-center text-muted py-4">Sin ventas en el rango seleccionado</div>;
                    return (
                      <>
                        {totalFiltrada > 8 && <div className="text-end small text-muted mb-1" style={{ fontSize: "0.7rem" }}>Mostrando {visible.length} de {totalFiltrada} · intervalo</div>}
                        <div className="reporte-bars">
                          {visible.map((s) => (
                            <div className="reporte-bar" key={s.dia} title={`${s.dia}: $${s.ingresos.toLocaleString("es-CO")} · ${s.pedidos} pedido(s)`}>
                              <div className="reporte-bar-fill" style={{ height: `${Math.max((s.ingresos / maxIngreso) * 100, 3)}%` }} />
                              <span className="reporte-bar-label">{formatearFecha(s.dia)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <TarjetaMasVendidos
                titulo="Tus productos más vendidos"
                items={reporte.masVendidos}
                onAbrirEdicion={(idp) => navigate(`/vendedor/productos/editar/${idp}`)}
                anchos={["8%", "46%", "14%", "16%", "16%"]}
              />
            </>
          ) : null}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorReportes;

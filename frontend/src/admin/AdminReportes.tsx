import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaChartLine, FaDollarSign, FaShoppingCart, FaTicketAlt, FaBoxes, FaBoxOpen, FaExclamationTriangle, FaFileExcel, FaFilePdf, FaUsers, FaChartBar } from "react-icons/fa";

interface Reporte {
  desde: string;
  hasta: string;
  totalOrdenes: number;
  totalIngresos: number;
  ticketPromedio: number;
  totalUnidades: number;
  totalUsuarios: number;
  serie: { dia: string; ordenes: number; ingresos: number; unidades: number; nuevosUsuarios: number }[];
}

interface MasVendido {
  ID: number;
  NOMBRE: string;
  IMAGEN: string;
  unidades: number;
  ingresos: number;
  stock: number;
}

const fechaHoy = () => new Date().toISOString().slice(0, 10);
const fechaHaceDias = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

const formatearFecha = (iso: string) => {
  if (/^\d{4}$/.test(iso)) return iso;
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const d = new Date(iso + "-01T00:00:00");
    if (isNaN(d.getTime())) return iso.slice(5);
    return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
  }
  const soloFecha = iso.includes("T") ? iso.slice(0, 10) : iso;
  const d = new Date(soloFecha + "T00:00:00");
  if (isNaN(d.getTime())) return soloFecha.slice(5);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

const AdminReportes = () => {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(fechaHaceDias(29));
  const [hasta, setHasta] = useState(fechaHoy());
  const [granularidad, setGranularidad] = useState<"dia" | "semana" | "mes" | "anio">("dia");
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [masVendidos, setMasVendidos] = useState<MasVendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState<"excel" | "pdf" | null>(null);
  const [tabGrafica, setTabGrafica] = useState<"ingresos" | "ordenes" | "unidades" | "usuarios">("ingresos");

  /** Descarga blob del reporte en Excel o PDF con el rango actual. */
  const descargar = async (formato: "excel" | "pdf") => {
    setDescargando(formato);
    try {
      const res = await fetch(`/api/admin/reportes/${formato}?desde=${desde}&hasta=${hasta}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-jadda_${desde}_a_${hasta}.${formato === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Swal.fire({ icon: "success", title: formato === "excel" ? "Excel descargado" : "PDF descargado", text: `Reporte del ${desde} al ${hasta}`, timer: 1800, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "No se pudo descargar", text: "Intenta de nuevo en unos segundos." });
    } finally {
      setDescargando(null);
    }
  };

  const cargar = useCallback(async (d: string, h: string, gran: string = granularidad) => {
    setLoading(true);
    setError("");
    try {
      const [resR, resM] = await Promise.all([
        fetch(`/api/admin/reportes/ventas?desde=${d}&hasta=${h}&granularidad=${gran}`, { credentials: "include" }),
        fetch(`/api/admin/analytics/mas-vendidos?desde=${d}&hasta=${h}&limite=10`, { credentials: "include" }),
      ]);
      if (!resR.ok || !resM.ok) throw new Error("Error al cargar los reportes");
      const dataR = await resR.json();
      // Compatibilidad: si el backend aún no devuelve nuevos campos, los inicializa en 0
      const serieCompat = (dataR.serie || []).map((s: any) => ({
        dia: s.dia,
        ordenes: Number(s.ordenes || 0),
        ingresos: Number(s.ingresos || 0),
        unidades: Number(s.unidades || 0),
        nuevosUsuarios: Number(s.nuevosUsuarios || 0),
      }));
      setReporte({ ...dataR, totalUsuarios: Number(dataR.totalUsuarios || 0), serie: serieCompat });
      setMasVendidos(await resM.json());
    } catch {
      setError("No se pudieron cargar los reportes. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [granularidad]);

  useEffect(() => { cargar(desde, hasta, granularidad); }, [cargar, desde, hasta, granularidad]);

  const aplicar = () => { if (desde && hasta && desde <= hasta) cargar(desde, hasta, granularidad); };

  const maxIngreso = reporte?.serie?.length ? Math.max(...reporte.serie.map((s) => s.ingresos), 1) : 1;
  const maxOrdenes = reporte?.serie?.length ? Math.max(...reporte.serie.map((s) => s.ordenes), 1) : 1;
  const maxUnidades = reporte?.serie?.length ? Math.max(...reporte.serie.map((s) => s.unidades), 1) : 1;
  const maxUsuarios = reporte?.serie?.length ? Math.max(...reporte.serie.map((s) => s.nuevosUsuarios), 1) : 1;

  const tarjetas = reporte ? [
    { label: "Ingresos", value: `$${reporte.totalIngresos.toLocaleString("es-CO")}`, icon: <FaDollarSign />, color: "#6f42c1", sub: `${reporte.totalOrdenes} órdenes` },
    { label: "Órdenes", value: reporte.totalOrdenes.toLocaleString("es-CO"), icon: <FaShoppingCart />, color: "#0d6efd", sub: `$${reporte.ticketPromedio.toLocaleString("es-CO")} ticket` },
    { label: "Ticket promedio", value: `$${reporte.ticketPromedio.toLocaleString("es-CO")}`, icon: <FaTicketAlt />, color: "#198754", sub: `${reporte.totalUnidades} unidades` },
    { label: "Unidades vendidas", value: reporte.totalUnidades.toLocaleString("es-CO"), icon: <FaBoxes />, color: "#e73737", sub: `${reporte.totalOrdenes} pedidos` },
    { label: "Usuarios nuevos", value: (reporte.totalUsuarios || 0).toLocaleString("es-CO"), icon: <FaUsers />, color: "#fd7e14", sub: `registrados en el rango` },
  ] : [];

  // Muestreo para no amontonar: máximo 12 barras visibles, con intervalo en diario
  const muestrear = <T,>(arr: T[], max = 12): T[] => {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
  };

  const renderBarras = (clave: "ingresos" | "ordenes" | "unidades" | "nuevosUsuarios", color: string, max: number, formatearValor: (v: number) => string) => {
    const filtrada = reporte!.serie.filter((s) => (s as any)[clave] > 0);
    if (filtrada.length === 0) return <div className="text-center text-muted py-4">Sin datos para esta métrica en el rango</div>;
    const visible = muestrear(filtrada, 12);
    const intervalo = granularidad === "dia" && filtrada.length > 14 ? Math.ceil(filtrada.length / 12) : 1;
    return (
      <>
        {filtrada.length > 12 && <div className="text-end small text-muted mb-1">Mostrando {visible.length} de {filtrada.length} · intervalo cada {intervalo} {granularidad === "dia" ? "días" : granularidad}</div>}
        <div className="reporte-bars">
          {visible.map((s) => {
            const v = (s as any)[clave] as number;
            const pct = Math.max((v / max) * 100, 3);
            const label = formatearValor(v);
            return (
              <div className="reporte-bar" key={s.dia} title={`${s.dia}: ${label} · ${s.ordenes} órdenes · $${s.ingresos.toLocaleString("es-CO")}`}>
                <div className="reporte-bar-fill" style={{ height: `${pct}%`, background: color }} />
                <span className="reporte-bar-label">{formatearFecha(s.dia)}</span>
                <span className="reporte-bar-valor" style={{ color }}>{clave === "ingresos" ? `$${(v/1000).toFixed(v>=1000000?1:0)}k` : v}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al inicio
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Reportes" }]} />
            <div className="au-titulos">
              <h1><FaChartLine className="me-2 text-danger" />Reportes de ventas</h1>
              <p>Métricas financieras, operativas y de usuarios por rango de fechas</p>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border p-3 mb-4">
            <div className="row g-2 align-items-end">
              <div className="col-auto">
                <label className="form-label small text-muted fw-bold mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="col-auto">
                <label className="form-label small text-muted fw-bold mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="col-auto">
                <label className="form-label small text-muted fw-bold mb-1">Ver por</label>
                <select className="form-select form-select-sm" value={granularidad} onChange={(e) => setGranularidad(e.target.value as any)} style={{ minWidth: 110 }}>
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
              <div className="col-auto d-flex gap-2 ms-auto flex-wrap">
                {[{ d: 6, l: "7 días" }, { d: 29, l: "30 días" }, { d: 89, l: "90 días" }].map((p) => (
                  <button key={p.d} className="btn btn-outline-secondary btn-sm" onClick={() => { const d = fechaHaceDias(p.d); const h = fechaHoy(); setDesde(d); setHasta(h); cargar(d, h, granularidad); }}>
                    {p.l}
                  </button>
                ))}
                <button className="btn btn-sm fw-bold text-success border-success-subtle bg-white border" style={{ borderWidth: 1.5 }} onClick={() => descargar("excel")} disabled={descargando !== null} title="Descarga el reporte completo en Excel con fórmulas">
                  <FaFileExcel className="me-1" /> {descargando === "excel" ? "Generando..." : "Excel"}
                </button>
                <button className="btn btn-sm fw-bold text-danger border-danger-subtle bg-white border" style={{ borderWidth: 1.5 }} onClick={() => descargar("pdf")} disabled={descargando !== null} title="Descarga el reporte ejecutivo en PDF">
                  <FaFilePdf className="me-1" /> {descargando === "pdf" ? "Generando..." : "PDF"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando reportes...</div>
          ) : reporte ? (
            <>
              <div className="mb-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.9rem" }}>
                {tarjetas.map((t, i) => (
                  <div key={i}>
                    <div className="bg-white rounded-4 shadow-sm p-3 h-100 border d-flex flex-column justify-content-center" style={{ borderLeft: `4px solid ${t.color}`, minHeight: 92 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: "36px", height: "36px", background: `${t.color}15`, color: t.color, fontSize: "1rem", flexShrink: 0 }}>
                          {t.icon}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="text-muted text-uppercase small fw-bold text-truncate" style={{ fontSize: "0.66rem", letterSpacing: 0.3 }}>{t.label}</div>
                          <div className="fw-bold text-truncate" style={{ fontSize: "1.15rem", lineHeight: 1.1 }}>{t.value}</div>
                          <div className="text-muted small text-truncate" style={{ fontSize: "0.64rem" }}>{t.sub}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded shadow-sm border mb-4">
                <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center justify-content-between">
                  <div>
                    <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><FaChartBar className="text-danger" /> Gráficas del rango</h5>
                    <small className="text-muted">{reporte.desde} → {reporte.hasta} · {granularidad === "dia" ? "por día" : granularidad === "semana" ? "por semana (lunes)" : granularidad === "mes" ? "por mes" : "por año"}</small>
                  </div>
                  <div className="d-flex gap-1 flex-wrap">
                    {[
                      { k: "ingresos", l: "Ganancias", c: "#6f42c1" },
                      { k: "ordenes", l: "Ventas", c: "#0d6efd" },
                      { k: "unidades", l: "Unidades", c: "#e73737" },
                      { k: "usuarios", l: "Usuarios", c: "#fd7e14" },
                    ].map((x) => (
                      <button key={x.k} onClick={() => setTabGrafica(x.k as any)} className={`btn btn-sm fw-bold ${tabGrafica === x.k ? "btn-dark" : "btn-outline-secondary"}`} style={tabGrafica === x.k ? { background: x.c, borderColor: x.c } : {}}>
                        <span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: x.c, verticalAlign: "middle" }} /> {x.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  {reporte.serie.length === 0 ? (
                    <div className="text-center text-muted py-4">Sin datos en el rango seleccionado</div>
                  ) : (
                    <>
                      {tabGrafica === "ingresos" && (
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge" style={{ background: "#6f42c120", color: "#6f42c1", border: "1px solid #6f42c140" }}><FaDollarSign className="me-1" /> Ganancias (COP)</span>
                            <small className="text-muted">Total {reporte.desde}→{reporte.hasta}: <b style={{ color: "#6f42c1" }}>${reporte.totalIngresos.toLocaleString("es-CO")}</b> · {reporte.totalOrdenes} órdenes</small>
                          </div>
                          {renderBarras("ingresos", "#6f42c1", maxIngreso, (v) => `$${v.toLocaleString("es-CO")}`)}
                        </div>
                      )}
                      {tabGrafica === "ordenes" && (
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge" style={{ background: "#0d6efd15", color: "#0d6efd", border: "1px solid #0d6efd30" }}><FaShoppingCart className="me-1" /> Ventas (nº pedidos)</span>
                            <small className="text-muted">Total: <b style={{ color: "#0d6efd" }}>{reporte.totalOrdenes}</b> órdenes · Ticket ${reporte.ticketPromedio.toLocaleString("es-CO")}</small>
                          </div>
                          {renderBarras("ordenes", "#0d6efd", maxOrdenes, (v) => `${v} pedidos`)}
                        </div>
                      )}
                      {tabGrafica === "unidades" && (
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge" style={{ background: "#e7373715", color: "#e73737", border: "1px solid #e7373730" }}><FaBoxes className="me-1" /> Unidades vendidas</span>
                            <small className="text-muted">Total: <b style={{ color: "#e73737" }}>{reporte.totalUnidades}</b> unidades en {reporte.totalOrdenes} pedidos</small>
                          </div>
                          {renderBarras("unidades", "#e73737", maxUnidades, (v) => `${v} uds`)}
                        </div>
                      )}
                      {tabGrafica === "usuarios" && (
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge" style={{ background: "#fd7e1415", color: "#fd7e14", border: "1px solid #fd7e1430" }}><FaUsers className="me-1" /> Usuarios nuevos</span>
                            <small className="text-muted">Registrados en el rango: <b style={{ color: "#fd7e14" }}>{reporte.totalUsuarios}</b> · Total en sistema se ve en Dashboard</small>
                          </div>
                          {renderBarras("nuevosUsuarios", "#fd7e14", maxUsuarios, (v) => `${v} usuarios`)}
                        </div>
                      )}
                      <div className="d-flex flex-wrap gap-3 mt-3 pt-3 border-top small text-muted">
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: "#6f42c1" }} /> Ingresos: ${reporte.totalIngresos.toLocaleString("es-CO")}</span>
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: "#0d6efd" }} /> Órdenes: {reporte.totalOrdenes}</span>
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: "#e73737" }} /> Unidades: {reporte.totalUnidades}</span>
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: "#fd7e14" }} /> Usuarios nuevos: {reporte.totalUsuarios}</span>
                        <span className="ms-auto">Ticket promedio: <b>${reporte.ticketPromedio.toLocaleString("es-CO")}</b></span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-lg-6">
                  <div className="bg-white rounded shadow-sm border h-100">
                    <div className="p-3 border-bottom">
                      <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, background: "#6f42c1" }} /> Ingresos por {granularidad}</h6>
                      <small className="text-muted">Evolución de ganancias en el tiempo</small>
                    </div>
                    <div className="p-3">
                      {(() => {
                        const filtrada = reporte.serie.filter((s) => s.ingresos > 0);
                        if (filtrada.length === 0) return <div className="text-center text-muted py-3">Sin ingresos en el rango</div>;
                        const visible = muestrear(filtrada, 8);
                        return (
                          <>
                            {filtrada.length > 8 && <div className="text-end small text-muted mb-1" style={{ fontSize: "0.7rem" }}>Mostrando {visible.length} de {filtrada.length} · intervalo</div>}
                            <div className="reporte-bars" style={{ height: 140 }}>
                              {visible.map((s) => (
                                <div className="reporte-bar" key={s.dia + "-ing"} title={`${s.dia}: $${s.ingresos.toLocaleString("es-CO")}`}>
                                  <div className="reporte-bar-fill" style={{ height: `${(s.ingresos / maxIngreso) * 100}%`, background: "#6f42c1" }} />
                                  <span className="reporte-bar-label" style={{ fontSize: "0.65rem" }}>{formatearFecha(s.dia)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="bg-white rounded shadow-sm border h-100">
                    <div className="p-3 border-bottom">
                      <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, background: "#0d6efd" }} /> Ventas por {granularidad}</h6>
                      <small className="text-muted">Número de pedidos y unidades</small>
                    </div>
                    <div className="p-3">
                      {(() => {
                        const filtrada = reporte.serie.filter((s) => s.ordenes > 0 || s.unidades > 0);
                        if (filtrada.length === 0) return <div className="text-center text-muted py-3">Sin ventas en el rango</div>;
                        const visible = muestrear(filtrada, 8);
                        return (
                          <>
                            {filtrada.length > 8 && <div className="text-end small text-muted mb-1" style={{ fontSize: "0.7rem" }}>Mostrando {visible.length} de {filtrada.length} · intervalo</div>}
                            <div className="reporte-bars" style={{ height: 140 }}>
                              {visible.map((s) => (
                                <div className="reporte-bar" key={s.dia + "-ord"} title={`${s.dia}: ${s.ordenes} pedidos · ${s.unidades} uds`}>
                                  <div className="d-flex flex-column align-items-center justify-content-end" style={{ height: "100%", width: "100%", gap: 2 }}>
                                    <div className="reporte-bar-fill" style={{ height: `${(s.ordenes / maxOrdenes) * 60}%`, background: "#0d6efd", width: "100%", borderRadius: "4px 4px 0 0" }} />
                                    <div className="reporte-bar-fill" style={{ height: `${(s.unidades / maxUnidades) * 40}%`, background: "#e73737", width: "100%", borderRadius: "4px 4px 0 0", opacity: 0.85 }} />
                                  </div>
                                  <span className="reporte-bar-label" style={{ fontSize: "0.65rem" }}>{formatearFecha(s.dia)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                      <div className="d-flex gap-3 justify-content-center mt-2 small">
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: "#0d6efd" }} /> Pedidos</span>
                        <span><span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: "#e73737" }} /> Unidades</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="bg-white rounded shadow-sm border h-100">
                    <div className="p-3 border-bottom">
                      <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, background: "#fd7e14" }} /> Usuarios nuevos por {granularidad}</h6>
                      <small className="text-muted">Altas de clientes en el rango</small>
                    </div>
                    <div className="p-3">
                      {(() => {
                        const filtrada = reporte.serie.filter((s) => s.nuevosUsuarios > 0);
                        if (filtrada.length === 0) return <div className="text-center text-muted py-3">Sin usuarios nuevos en el rango</div>;
                        const visible = muestrear(filtrada, 8);
                        return (
                          <>
                            {filtrada.length > 8 && <div className="text-end small text-muted mb-1" style={{ fontSize: "0.7rem" }}>Mostrando {visible.length} de {filtrada.length} · intervalo</div>}
                            <div className="reporte-bars" style={{ height: 140 }}>
                              {visible.map((s) => (
                                <div className="reporte-bar" key={s.dia + "-usr"} title={`${s.dia}: ${s.nuevosUsuarios} nuevos usuarios`}>
                                  <div className="reporte-bar-fill" style={{ height: `${(s.nuevosUsuarios / maxUsuarios) * 100}%`, background: "#fd7e14" }} />
                                  <span className="reporte-bar-label" style={{ fontSize: "0.65rem" }}>{formatearFecha(s.dia)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                      <div className="text-center mt-2 small text-muted">Total nuevos: <b style={{ color: "#fd7e14" }}>{reporte.totalUsuarios}</b></div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="bg-white rounded shadow-sm border h-100">
                    <div className="p-3 border-bottom">
                      <h6 className="fw-bold m-0"><FaTicketAlt className="me-2" style={{ color: "#198754" }} /> Ticket y conversión</h6>
                      <small className="text-muted">Valor medio por pedido</small>
                    </div>
                    <div className="p-3 d-flex flex-column justify-content-center" style={{ height: 140 }}>
                      <div className="d-flex align-items-end gap-2 mb-2">
                        <span className="fw-bold" style={{ fontSize: "2rem", color: "#198754" }}>${reporte.ticketPromedio.toLocaleString("es-CO")}</span>
                        <span className="text-muted small mb-2">ticket promedio</span>
                      </div>
                      <div className="progress" style={{ height: 10, background: "#e9ecef" }}>
                        <div className="progress-bar" role="progressbar" style={{ width: `${Math.min((reporte.ticketPromedio / 500000) * 100, 100)}%`, background: "#198754" }} />
                      </div>
                      <div className="d-flex justify-content-between small text-muted mt-1">
                        <span>$0</span><span>$500k</span>
                      </div>
                      <div className="small text-muted mt-2">
                        {reporte.totalOrdenes} pedidos · {reporte.totalUnidades} unidades · {reporte.totalOrdenes>0 ? (reporte.totalUnidades/reporte.totalOrdenes).toFixed(1) : 0} uds/pedido
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded shadow-sm border">
                <div className="p-3 border-bottom">
                  <h5 className="fw-bold m-0"><FaBoxOpen className="me-2 text-danger" />Productos más vendidos</h5>
                  <small className="text-muted">Ranking por unidades facturadas (excluye pedidos cancelados)</small>
                </div>
                <div>
                  <table className="ap-tabla">
                    <thead>
                      <tr>
                        <th style={{ width: "8%" }}>#</th>
                        <th style={{ width: "44%" }}>Producto</th>
                        <th style={{ width: "12%", textAlign: "center" }}>Unidades</th>
                        <th style={{ width: "16%", textAlign: "right" }}>Ingresos</th>
                        <th style={{ width: "20%", textAlign: "center" }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masVendidos.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted py-4">Sin ventas en el rango seleccionado</td></tr>
                      ) : (
                        masVendidos.map((p, i) => (
                          <tr key={p.ID} style={{ cursor: "pointer" }} onClick={() => navigate(`/admin/editar/${p.ID}`)}>
                            <td><span className="ap-id">{i + 1}</span></td>
                            <td>
                              <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                <img
                                  src={p.IMAGEN || "https://placehold.co/400x400?text=JADDA"}
                                  alt={p.NOMBRE}
                                  className="ap-img"
                                  onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                                />
                                <span className="tb-ellip tb-strong" title={p.NOMBRE}>{p.NOMBRE}</span>
                              </div>
                            </td>
                            <td className="text-center tb-strong">{p.unidades}</td>
                            <td className="text-end tb-strong">${p.ingresos.toLocaleString("es-CO")}</td>
                            <td className="text-center">
                              {p.stock === 0 ? (
                                <span className="ap-stock agotado">Agotado</span>
                              ) : p.stock <= 10 ? (
                                <span className="ap-stock bajo">¡Solo quedan {p.stock}!</span>
                              ) : (
                                <span className="ap-stock ok">{p.stock} uds</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminReportes;

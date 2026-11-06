import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaChartLine, FaDollarSign, FaShoppingCart, FaTicketAlt, FaBoxes, FaExclamationTriangle, FaFileExcel, FaFilePdf, FaUsers, FaChartBar } from "react-icons/fa";
import { fechaHoy, fechaHaceDias, formatearFecha, muestrear, descargarReporte, TarjetaMasVendidos } from "../utils/reportes";
import type { MasVendido } from "../utils/reportes";

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
    await descargarReporte({
      formato,
      url: `/api/admin/reportes/${formato}?desde=${desde}&hasta=${hasta}`,
      desde,
      hasta,
      prefijoArchivo: "reporte-jadda",
      setDescargando,
    });
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

  useEffect(() => { void cargar(desde, hasta, granularidad); }, [cargar, desde, hasta, granularidad]);

  const aplicar = () => { if (desde && hasta && desde <= hasta) void cargar(desde, hasta, granularidad); };

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
                <label htmlFor="ctrl-l177" className="form-label small text-muted fw-bold mb-1">Desde</label>
                <input id="ctrl-l177" type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="col-auto">
                <label htmlFor="ctrl-l181" className="form-label small text-muted fw-bold mb-1">Hasta</label>
                <input id="ctrl-l181" type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="col-auto">
                <label htmlFor="ctrl-l185" className="form-label small text-muted fw-bold mb-1">Ver por</label>
                <select id="ctrl-l185" className="form-select form-select-sm" value={granularidad} onChange={(e) => setGranularidad(e.target.value as any)} style={{ minWidth: 110 }}>
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
                  <button key={p.d} className="btn btn-outline-secondary btn-sm" onClick={() => { const d = fechaHaceDias(p.d); const h = fechaHoy(); setDesde(d); setHasta(h); void cargar(d, h, granularidad); }}>
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

              <TarjetaMasVendidos
                titulo="Productos más vendidos"
                items={masVendidos}
                onAbrirEdicion={(idp) => navigate(`/admin/editar/${idp}`)}
                anchos={["8%", "44%", "12%", "16%", "20%"]}
              />
            </>
          ) : null}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminReportes;

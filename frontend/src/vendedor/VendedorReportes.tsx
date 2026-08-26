import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FaArrowLeft, FaChartLine, FaDollarSign, FaShoppingCart, FaTicketAlt, FaBoxes, FaBoxOpen, FaFileExcel, FaFilePdf } from "react-icons/fa";
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
  masVendidos: { ID: number; NOMBRE: string; IMAGEN: string; unidades: number; ingresos: number; stock: number }[];
}

const fechaHoy = () => new Date().toISOString().slice(0, 10);
const fechaHaceDias = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

const formatearFecha = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

const VendedorReportes = () => {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(fechaHaceDias(29));
  const [hasta, setHasta] = useState(fechaHoy());
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState<"excel" | "pdf" | null>(null);

  /** Descarga blob del reporte en Excel o PDF con el rango actual. */
  const descargar = async (formato: "excel" | "pdf") => {
    setDescargando(formato);
    try {
      const res = await fetch(`/api/vendedor/reportes/${formato}?desde=${desde}&hasta=${hasta}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-vendedor_${desde}_a_${hasta}.${formato === "excel" ? "xlsx" : "pdf"}`;
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

  const cargar = useCallback(async (d: string, h: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/vendedor/reportes?desde=${d}&hasta=${h}`, { credentials: "include" });
      if (!res.ok) throw new Error("error");
      setReporte(await res.json());
    } catch {
      setError("No se pudieron cargar tus reportes. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(desde, hasta); }, [cargar]);

  const aplicar = () => { if (desde && hasta && desde <= hasta) cargar(desde, hasta); };

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
                <label className="form-label small text-muted fw-bold mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="col-auto">
                <label className="form-label small text-muted fw-bold mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="col-auto">
                <button className="btn btn-danger btn-sm fw-bold" onClick={aplicar} disabled={loading}>
                  {loading ? "Cargando..." : "Aplicar"}
                </button>
              </div>
              <div className="col-auto d-flex gap-2 ms-auto">
                {[{ d: 6, l: "7 días" }, { d: 29, l: "30 días" }, { d: 89, l: "90 días" }].map((p) => (
                  <button key={p.d} className="btn btn-outline-secondary btn-sm" onClick={() => { setDesde(fechaHaceDias(p.d)); setHasta(fechaHoy()); cargar(fechaHaceDias(p.d), fechaHoy()); }}>
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
                  {reporte.serie.length === 0 ? (
                    <div className="text-center text-muted py-4">Sin ventas en el rango seleccionado</div>
                  ) : (
                    <div className="reporte-bars">
                      {reporte.serie.map((s) => (
                        <div className="reporte-bar" key={s.dia} title={`${s.dia}: $${s.ingresos.toLocaleString("es-CO")} · ${s.pedidos} pedido(s)`}>
                          <div className="reporte-bar-fill" style={{ height: `${Math.max((s.ingresos / maxIngreso) * 100, 3)}%` }} />
                          <span className="reporte-bar-label">{formatearFecha(s.dia)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded shadow-sm border">
                <div className="p-3 border-bottom">
                  <h5 className="fw-bold m-0"><FaBoxOpen className="me-2 text-danger" />Tus productos más vendidos</h5>
                  <small className="text-muted">Ranking por unidades facturadas (excluye pedidos cancelados)</small>
                </div>
                <div>
                  <table className="ap-tabla">
                    <thead>
                      <tr>
                        <th style={{ width: "8%" }}>#</th>
                        <th style={{ width: "46%" }}>Producto</th>
                        <th style={{ width: "14%", textAlign: "center" }}>Unidades</th>
                        <th style={{ width: "16%", textAlign: "right" }}>Ingresos</th>
                        <th style={{ width: "16%", textAlign: "center" }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.masVendidos.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted py-4">Sin ventas en el rango seleccionado</td></tr>
                      ) : (
                        reporte.masVendidos.map((p, i) => (
                          <tr key={p.ID} style={{ cursor: "pointer" }} onClick={() => navigate(`/vendedor/productos/editar/${p.ID}`)}>
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

export default VendedorReportes;

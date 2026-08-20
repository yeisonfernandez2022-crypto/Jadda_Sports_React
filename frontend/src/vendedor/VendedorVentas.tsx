import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaShoppingCart, FaArrowLeft } from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

const formatear = (n: number | string | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("es-CO");

const estadoVenta = (e: string) => {
  const map: Record<string, string> = {
    COMPLETADA: "completada",
    PENDIENTE: "pendiente",
    CANCELADA: "cancelada",
    CONFIRMADA: "confirmada",
    ENVIADA: "enviada",
  };
  return map[e] || "pendiente";
};

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const VendedorVentas = () => {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/vendedor/ventas", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setVentas)
      .catch(() => setVentas([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="admin-volver" onClick={() => navigate("/vendedor")}>
            <FaArrowLeft /> Volver al Dashboard
          </button>
          <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Mis ventas" }]} />
          <div className="au-titulos">
            <h1>Mis ventas</h1>
            <p>{ventas.length} pedido(s) con productos tuyos</p>
          </div>
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando ventas…</div>
        ) : ventas.length === 0 ? (
          <div className="ven-vacio">
            <FaShoppingCart />
            <div>Aún no tienes ventas. Cuando alguien compre tus productos aparecerán aquí.</div>
          </div>
        ) : (
          ventas.map((v) => (
            <div key={v.ID_VENTA} className="ven-venta-card">
              <div className="ven-venta-head">
                <div>
                  <strong>Pedido #{v.ID_VENTA}</strong>
                  <div className="ven-venta-meta">
                    <span>👤 {v.CLIENTE || "Cliente"}</span>
                    <span>📅 {new Date(v.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</span>
                    <span>💳 {v.REFERENCIA_PAGO}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`ven-badge-venta ${estadoVenta(v.ESTADO)}`}>{v.ESTADO}</span>
                  <span className="ven-venta-total">{formatear(v.TOTAL)}</span>
                </div>
              </div>
              <div className="ven-venta-items">
                {v.items.map((it: any, i: number) => (
                  <div key={i} className="ven-venta-item">
                    <img src={it.IMAGEN || PLACEHOLDER_IMG} alt={it.NOMBRE} />
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{it.NOMBRE}</span>
                    {it.COLOR && <span className="ven-chip">Color: {it.COLOR}</span>}
                    {it.ATRIBUTO && <span className="ven-chip">{it.NOMBRE_ATRIBUTO}: {it.ATRIBUTO}</span>}
                    <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>x{it.CANTIDAD} · {formatear(it.SUBTOTAL)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorVentas;
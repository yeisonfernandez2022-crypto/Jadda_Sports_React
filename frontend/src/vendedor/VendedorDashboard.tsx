import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBoxOpen, FaBoxes, FaShoppingCart, FaMoneyBillWave,
  FaClock, FaExclamationTriangle, FaPlusCircle, FaStore, FaArrowLeft,
} from "react-icons/fa";
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

const VendedorDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/vendedor/mi-tienda", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div className="admin-page">
        <VendedorNavbar />
        <div className="admin-content">
          <div className="ven-vacio">Cargando tu tienda…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-page">
        <VendedorNavbar />
        <div className="admin-content">
          <div className="ven-vacio">No pudimos cargar tu tienda. Intenta de nuevo.</div>
        </div>
      </div>
    );
  }

  const { vendedor, stats, ultimasVentas, stockBajo } = data;

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <div className="w-100 d-flex justify-content-between align-items-start">
            <div>
              <button className="admin-volver" onClick={() => navigate("/vendedor")}>
                <FaArrowLeft /> Volver al Dashboard
              </button>
              <div className="mt-2">
                <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Resumen" }]} />
              </div>
              <div className="au-titulos">
                <h1>Mi tienda</h1>
                <p>{vendedor.NOMBRE_EMPRESA} · {vendedor.CIUDAD}, {vendedor.DEPARTAMENTO}</p>
              </div>
            </div>
            <button className="ven-btn nuevo" onClick={() => navigate("/vendedor/productos/nuevo")}>
              <FaPlusCircle /> Publicar producto
            </button>
          </div>
        </div>

        {Number(stats.productosPendientes) > 0 && (
          <div className="ven-aviso pendiente">
            <FaClock /> Tienes {stats.productosPendientes} producto(s) en revisión. El equipo de JADDA los revisa en menos de 48 horas.
          </div>
        )}

        <div className="ven-kpis">
          <div className="ven-kpi">
            <div className="ven-kpi-icon i-verde"><FaBoxOpen /></div>
            <div>
              <div className="ven-kpi-val">{stats.productosPublicados}</div>
              <div className="ven-kpi-lab">Productos</div>
            </div>
          </div>
          <div className="ven-kpi">
            <div className="ven-kpi-icon i-azul"><FaBoxes /></div>
            <div>
              <div className="ven-kpi-val">{stats.unidadesVendidas}</div>
              <div className="ven-kpi-lab">Unidades vendidas</div>
            </div>
          </div>
          <div className="ven-kpi">
            <div className="ven-kpi-icon i-rojo"><FaShoppingCart /></div>
            <div>
              <div className="ven-kpi-val">{stats.totalVentas}</div>
              <div className="ven-kpi-lab">Ventas</div>
            </div>
          </div>
          <div className="ven-kpi">
            <div className="ven-kpi-icon i-ambar"><FaMoneyBillWave /></div>
            <div>
              <div className="ven-kpi-val">{formatear(stats.totalIngresos)}</div>
              <div className="ven-kpi-lab">Ingresos</div>
            </div>
          </div>
        </div>

        <div className="ven-grid-2">
          <div className="ven-card">
            <h3 className="ven-card-title"><FaShoppingCart /> Últimas ventas</h3>
            {ultimasVentas.length === 0 ? (
              <div className="ven-vacio">Aún no tienes ventas. Publica tus productos para empezar.</div>
            ) : (
              ultimasVentas.map((v: any) => (
                <div key={v.ID_VENTA} className="ven-venta-card" style={{ marginBottom: 10 }}>
                  <div className="ven-venta-head">
                    <div>
                      <strong>Pedido #{v.ID_VENTA}</strong>
                      <div className="ven-venta-meta">
                        <span>{v.CLIENTE || "Cliente"}</span>
                        <span>{new Date(v.FECHA_VENTA).toLocaleDateString("es-CO")}</span>
                        <span>{v.ARTICULOS} artículo(s)</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`ven-badge-venta ${estadoVenta(v.ESTADO)}`}>{v.ESTADO}</span>
                      <span className="ven-venta-total">{formatear(v.TOTAL)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            {ultimasVentas.length > 0 && (
              <button className="ven-btn editar" onClick={() => navigate("/vendedor/ventas")}>
                Ver todas mis ventas
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="ven-card">
              <h3 className="ven-card-title"><FaExclamationTriangle /> Stock bajo (≤ 10)</h3>
              {stockBajo.length === 0 ? (
                <div className="ven-vacio">No hay variantes con stock bajo.</div>
              ) : (
                stockBajo.map((s: any, i: number) => (
                  <div key={i} className="ven-venta-item" style={{ marginBottom: 7 }}>
                    <span className="ven-chip">{s.NOMBRE_ATRIBUTO}: {s.ATRIBUTO}</span>
                    <span style={{ flex: 1, fontSize: "0.8rem", color: "#334155" }}>{s.NOMBRE}</span>
                    <span className={`ven-stock ${Number(s.STOCK) === 0 ? "agotado" : "bajo"}`}>
                      {Number(s.STOCK) === 0 ? "Agotado" : `${s.STOCK} uds`}
                    </span>
                  </div>
                ))
              )}
            </div>
            <button className="ven-btn nuevo" onClick={() => navigate("/vendedor/productos")}>
              <FaStore /> Gestionar mis productos
            </button>
          </div>
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorDashboard;
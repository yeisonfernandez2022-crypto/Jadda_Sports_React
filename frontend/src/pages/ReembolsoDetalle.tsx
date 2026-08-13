import "../css/ReembolsoDetalle.css";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft, FaWallet, FaFilePdf, FaCreditCard, FaCalendarAlt, FaClock,
  FaCheckCircle, FaTimesCircle, FaUndoAlt, FaBoxOpen,
} from "react-icons/fa";

interface ReembolsoItem {
  ID_DEVOLUCION: number;
  ID_PRODUCTO: number;
  NOMBRE: string;
  IMAGEN: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  MOTIVO: string | null;
  ESTADO: string;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
}

interface ReembolsoData {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string | null;
  METODO_PAGO: string | null;
  totalReembolso: number;
  reembolsos: ReembolsoItem[];
}

const estadoInfo: Record<string, { label: string; color: string; icon: any }> = {
  SOLICITADA: { label: "En revisión", color: "#f59e0b", icon: FaClock },
  APROBADA: { label: "Reembolso aprobado", color: "#22c55e", icon: FaCheckCircle },
  RECHAZADA: { label: "Reembolso rechazado", color: "#ef4444", icon: FaTimesCircle },
};

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

export default function ReembolsoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ReembolsoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`/api/compras/${id}/reembolso`, { withCredentials: true })
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rr-page"><div className="rr-loading">Cargando tu reembolso...</div></div>;

  if (error || !data) {
    return (
      <div className="rr-page">
        <div className="rr-error">
          <FaBoxOpen style={{ fontSize: "2.2rem", color: "#e63946" }} />
          <h3>No encontramos este reembolso</h3>
          <p>Verifica que tengas sesión iniciada y que el pedido te pertenezca.</p>
          <button className="rr-btn rr-btn-primario" onClick={() => navigate("/perfil/compras")}>
            Volver a mis compras
          </button>
        </div>
      </div>
    );
  }

  const estadoGlobal = data.reembolsos.some((r) => r.ESTADO === "APROBADA")
    ? "APROBADA"
    : data.reembolsos.some((r) => r.ESTADO === "SOLICITADA")
      ? "SOLICITADA"
      : "RECHAZADA";

  const info = estadoInfo[estadoGlobal] || estadoInfo.RECHAZADA;
  const EstadoIcon = info.icon;
  const primeraFecha = data.reembolsos.length ? data.reembolsos[0].FECHA_CREACION : data.FECHA_VENTA;
  const fechaLimite = new Date(new Date(primeraFecha).getTime() + 7 * 24 * 60 * 60 * 1000);
  const fechaLimiteTxt = fechaLimite.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const pasos: { etiqueta: string; estado: "hecho" | "activo" | "pendiente" | "rechazado" }[] = [
    { etiqueta: "Solicitud recibida", estado: "hecho" },
    { etiqueta: "En revisión", estado: estadoGlobal === "SOLICITADA" ? "activo" : estadoGlobal === "APROBADA" ? "hecho" : "rechazado" },
    { etiqueta: "Reembolsado", estado: estadoGlobal === "APROBADA" ? "hecho" : "pendiente" },
  ];

  return (
    <div className="rr-page">
      <div className="rr-card">
        <div className="rr-header">
          <button className="rr-volver" onClick={() => navigate("/perfil/compras")}>
            <FaArrowLeft /> Mis compras
          </button>
          <h1 className="rr-header-titulo"><FaWallet /> Mi Reembolso — Pedido #{data.ID_VENTA}</h1>
        </div>

        <div className="rr-hero">
          <span className="rr-estado-badge" style={{ background: info.color }}>
            <EstadoIcon /> {info.label.toUpperCase()}
          </span>
          <div className="rr-monto">
            {fmt(data.totalReembolso)}
            <small>A DEVOLVER</small>
          </div>
          {estadoGlobal === "SOLICITADA" && (
            <div className="rr-aviso-7dias">
              <FaClock />
              <span>
                <strong>Se reembolsará en un máximo de 7 días.</strong><br />
                Fecha estimada: {fechaLimiteTxt} — el dinero vuelve al método de pago con el que compraste.
              </span>
            </div>
          )}
        </div>

        <div className="rr-timeline">
          {pasos.map((p, i) => (
            <div key={i} className={`rr-timeline-paso ${p.estado}`}>
              <div className="rr-timeline-circulo">
                {p.estado === "hecho" ? <FaCheckCircle /> : i + 1}
              </div>
              <div className="rr-timeline-label">{p.etiqueta}</div>
            </div>
          ))}
        </div>

        {estadoGlobal === "RECHAZADA" && (
          <div className="rr-banner-rechazado">
            <FaTimesCircle />
            <span>Tu solicitud de reembolso fue rechazada. Si consideras que es un error, contáctanos por los canales de atención.</span>
          </div>
        )}

        {estadoGlobal === "APROBADA" && (
          <div className="rr-banner-rechazado" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
            <FaCheckCircle style={{ color: "#16a34a" }} />
            <span>Tu reembolso fue aprobado. El dinero se gestiona por el método de pago original y llegará en un máximo de 7 días.</span>
          </div>
        )}

        <div className="rr-seccion">
          <h4 className="rr-seccion-titulo"><FaCreditCard /> Información del pedido</h4>
          <div className="rr-datos">
            <div className="rr-dato"><span>Pedido</span><strong>#{data.ID_VENTA}</strong></div>
            <div className="rr-dato"><span>Fecha de compra</span><strong>{new Date(data.FECHA_VENTA).toLocaleDateString("es-CO")}</strong></div>
            <div className="rr-dato"><span>Método de pago</span><strong>{data.METODO_PAGO || "—"}</strong></div>
            <div className="rr-dato"><span>Referencia</span><strong>{data.REFERENCIA_PAGO || "—"}</strong></div>
          </div>
        </div>

        <div className="rr-seccion">
          <h4 className="rr-seccion-titulo"><FaUndoAlt /> Productos del reembolso</h4>
          {data.reembolsos.map((r) => (
            <div key={r.ID_DEVOLUCION} className="rr-producto">
              <img className="rr-prod-img" src={r.IMAGEN || "https://placehold.co/400x400?text=JADDA"} alt={r.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400?text=JADDA"; }} />
              <div>
                <p className="rr-prod-nombre">{r.NOMBRE}</p>
                <p className="rr-prod-meta">
                  <FaCalendarAlt style={{ marginRight: 4 }} />
                  Solicitado el {new Date(r.FECHA_CREACION).toLocaleDateString("es-CO")}
                  {r.FECHA_PROCESADA && <> · Procesado el {new Date(r.FECHA_PROCESADA).toLocaleDateString("es-CO")}</>}
                </p>
              </div>
              <span className="rr-prod-cant">x{r.CANTIDAD}</span>
              <span className="rr-prod-subtotal">{fmt(r.PRECIO_UNITARIO * r.CANTIDAD)}</span>
            </div>
          ))}
        </div>

        <div className="rr-total-refund">
          <span>Total a reembolsar</span>
          <strong>{fmt(data.totalReembolso)}</strong>
        </div>

        <div className="rr-acciones">
          <button className="rr-btn rr-btn-secundario" onClick={() => navigate("/perfil/compras")}>
            Volver a mis compras
          </button>
          <button className="rr-btn rr-btn-primario" onClick={() => {
            const w = window.open(`/api/compras/${data.ID_VENTA}/factura`, "_blank");
            if (w) w.focus();
          }}>
            <FaFilePdf /> Factura PDF
          </button>
        </div>
      </div>
    </div>
  );
}

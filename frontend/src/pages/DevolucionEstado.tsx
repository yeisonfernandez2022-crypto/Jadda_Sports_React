import "../css/ReembolsoDetalle.css";
import "../css/DevolucionEstado.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaArrowLeft, FaBoxOpen, FaClock, FaPaperclip, FaUndoAlt, FaWallet } from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import Breadcrumb from "../components/Breadcrumb";

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  SOLICITADA: { label: "En revisión", color: "#f59e0b" },
  MAS_PRUEBAS: { label: "Pide más pruebas", color: "#3b82f6" },
  APROBADA: { label: "Aprobada", color: "#16a34a" },
  RECHAZADA: { label: "Rechazada", color: "#ef4444" },
};

interface Devolucion {
  ID_DEVOLUCION: number;
  ID_VENTA: number;
  ID_PRODUCTO: number;
  NOMBRE: string;
  IMAGEN: string | null;
  CANTIDAD: number;
  MOTIVO: string | null;
  DESCRIPCION: string | null;
  TIPO: string | null;
  ESTADO: string;
  OBSERVACION: string | null;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
  EVIDENCIAS: string | null;
}

const esVideo = (ruta: string) => /\.(mp4|webm|mov|m4v)$/i.test(ruta);

export default function DevolucionEstado() {
  const { idVenta } = useParams();
  const navigate = useNavigate();
  const [venta, setVenta] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const cargar = async () => {
    try {
      const [v, d] = await Promise.all([
        axios.get(`/api/compras/${idVenta}`, { withCredentials: true }),
        axios.get("/api/devoluciones", { withCredentials: true }),
      ]);
      setVenta(v.data);
      setSolicitudes((d.data || []).filter((x: Devolucion) => String(x.ID_VENTA) === String(idVenta)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [idVenta]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjuntarEvidencias = async (idDevolucion: number, files: FileList | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("evidencias", f));
      const res = await axios.post(`/api/devoluciones/${idDevolucion}/evidencias`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire({ icon: "success", title: "Evidencias enviadas", text: res.data.msg, background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      await cargar();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "No se pudieron subir las evidencias", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
    } finally {
      setSubiendo(false);
    }
  };

  if (loading) return <div className="rr-page"><div className="rr-loading">Cargando estado de tu solicitud...</div></div>;

  if (error || !venta) {
    return (
      <div className="rr-page">
        <div className="rr-error">
          <FaBoxOpen style={{ fontSize: "2.2rem", color: "#e63946" }} />
          <h3>No encontramos este pedido</h3>
          <p>Verifica que tengas sesión iniciada y que el pedido te pertenezca.</p>
          <button className="rr-btn rr-btn-primario" onClick={() => navigate("/perfil/compras")}>
            Volver a mis compras
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rr-page">
      <div className="rr-card">
        <div className="rr-header">
          <button className="rr-volver" onClick={() => navigate("/perfil/compras")}>
            <FaArrowLeft /> Mis compras
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Compras", to: "/perfil/compras" }, { label: `Devolución · Pedido ${numeroPedido(venta.ID_VENTA)}` }]} />
          <h1 className="rr-header-titulo"><FaUndoAlt /> Devolución o reembolso — Pedido {numeroPedido(venta.ID_VENTA)}</h1>
        </div>

        <div className="rr-hero">
          <span className="de-fecha">
            Comprado el {new Date(venta.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
            {venta.METODO_PAGO ? ` · Pagado con ${venta.METODO_PAGO}` : ""}
          </span>
          <div className="rr-monto">
            {fmt(venta.TOTAL)}
            <small>TOTAL DEL PEDIDO</small>
          </div>
        </div>

        {solicitudes.length === 0 ? (
          <div className="de-vacio">
            <FaBoxOpen style={{ fontSize: "2rem", color: "#94a3b8" }} />
            <p>Este pedido no tiene solicitudes de devolución o reembolso.</p>
          </div>
        ) : (
          solicitudes.map((s) => {
            const info = ESTADO_INFO[s.ESTADO] || ESTADO_INFO.SOLICITADA;
            const evidencias = s.EVIDENCIAS ? s.EVIDENCIAS.split("|").filter(Boolean) : [];
            const esDevolucion = s.TIPO === "DEVOLUCION";
            const pasos = s.ESTADO === "APROBADA"
              ? [{ etiqueta: "Solicitud recibida", estado: "hecho" }, { etiqueta: "En revisión", estado: "hecho" }, { etiqueta: "Aprobada", estado: "hecho" }]
              : s.ESTADO === "RECHAZADA"
                ? [{ etiqueta: "Solicitud recibida", estado: "hecho" }, { etiqueta: "En revisión", estado: "rechazado" }, { etiqueta: "Aprobada", estado: "pendiente" }]
                : [{ etiqueta: "Solicitud recibida", estado: "hecho" }, { etiqueta: "En revisión", estado: "activo" }, { etiqueta: "Aprobada", estado: "pendiente" }];

            return (
              <div key={s.ID_DEVOLUCION} className="de-solicitud">
                <div className="de-solicitud-head">
                  <div className="de-prod">
                    <img src={s.IMAGEN || "https://placehold.co/56x56?text=JADDA"} alt={s.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = "https://placehold.co/56x56?text=JADDA"; }} />
                    <div>
                      <h4>{s.NOMBRE}</h4>
                      <span className="de-prod-meta">x{s.CANTIDAD} · {new Date(s.FECHA_CREACION).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="de-badges">
                    <span className={`de-tipo-badge ${esDevolucion ? "" : "de-tipo-reembolso"}`}>
                      <FaWallet /> {esDevolucion ? "DEVOLUCIÓN" : "REEMBOLSO"}
                    </span>
                    <span className="de-estado-badge" style={{ background: info.color }}>{info.label.toUpperCase()}</span>
                  </div>
                </div>

                <div className="rr-timeline">
                  {pasos.map((p, idx) => (
                    <div key={idx} className={`rr-timeline-paso ${p.estado}`}>
                      <div className="rr-timeline-circulo">{p.estado === "hecho" ? "✓" : p.estado === "rechazado" ? "✕" : idx + 1}</div>
                      <div className="rr-timeline-label">{p.etiqueta}</div>
                    </div>
                  ))}
                </div>

                <div className="rr-seccion">
                  <h3 className="rr-seccion-titulo"><FaUndoAlt /> Detalle de la solicitud</h3>
                  <div className="de-detalle">
                    {s.MOTIVO && <p><strong>Motivo:</strong> {s.MOTIVO}</p>}
                    {s.DESCRIPCION && <p><strong>Descripción:</strong> {s.DESCRIPCION}</p>}
                    {s.OBSERVACION && (
                      <div className="de-observacion">
                        <strong>Observación del equipo:</strong> {s.OBSERVACION}
                      </div>
                    )}
                  </div>
                </div>

                {evidencias.length > 0 && (
                  <div className="rr-seccion">
                    <h3 className="rr-seccion-titulo"><FaPaperclip /> Evidencias enviadas ({evidencias.length})</h3>
                    <div className="de-evidencias">
                      {evidencias.map((ruta, idx) => (
                        esVideo(ruta) ? (
                          <video key={idx} src={ruta} controls preload="metadata" className="de-evid" />
                        ) : (
                          <img key={idx} src={ruta} alt={`Evidencia ${idx + 1}`} className="de-evid" loading="lazy" onClick={() => window.open(ruta, "_blank")} />
                        )
                      ))}
                    </div>
                  </div>
                )}

                {(s.ESTADO === "SOLICITADA" || s.ESTADO === "MAS_PRUEBAS") && (
                  <div className="rr-aviso-7dias" style={{ margin: "0 24px 8px" }}>
                    <FaClock />
                    <span>
                      <strong>{s.ESTADO === "MAS_PRUEBAS" ? "El equipo pidió más evidencias." : "Tu solicitud está en revisión."}</strong>
                      {s.ESTADO === "SOLICITADA" ? " Si es un reembolso, el dinero vuelve al método de pago en un máximo de 7 días." : " Adjunta más fotos o videos para agilizar la revisión."}
                    </span>
                  </div>
                )}

                {s.ESTADO === "MAS_PRUEBAS" && (
                  <div className="de-acciones">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      ref={(el) => { fileRefs.current[s.ID_DEVOLUCION] = el; }}
                      onChange={(e) => adjuntarEvidencias(s.ID_DEVOLUCION, e.target.files)}
                    />
                    <button
                      className="rr-btn rr-btn-primario"
                      disabled={subiendo}
                      onClick={() => fileRefs.current[s.ID_DEVOLUCION]?.click()}
                    >
                      <FaPaperclip /> {subiendo ? "Subiendo..." : "Adjuntar más evidencias"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

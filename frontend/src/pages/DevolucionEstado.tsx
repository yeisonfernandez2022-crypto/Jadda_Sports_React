import "../css/ReembolsoDetalle.css";
import "../css/DevolucionEstado.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaArrowLeft, FaBoxOpen, FaClock, FaPaperclip, FaUndoAlt, FaWallet } from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import Breadcrumb from "../components/Breadcrumb";
import ChatHilo from "../components/ChatHilo";

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  SOLICITADA: { label: "En revisión", color: "#f59e0b" },
  MAS_PRUEBAS: { label: "Pide más pruebas", color: "#3b82f6" },
  ESCALADA: { label: "En decisión de JADDA", color: "#7c3aed" },
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
  ID_CHAT?: number | null;
  PARTE_CHAT?: string | null;
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
  const [seleccion, setSeleccion] = useState<Record<number, File[]>>({});
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<Record<number, number | null>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const abrirChatDevolucion = async (s: Devolucion) => {
    if (s.ID_CHAT) {
      setChatAbierto(chatAbierto === s.ID_CHAT ? null : (s.ID_CHAT ?? null));
      return;
    }
    try {
      const res = await fetch("/api/chat/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tipo: "DEVOLUCION", id_devolucion: s.ID_DEVOLUCION }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.id_chat) {
        setChatIds((prev) => ({ ...prev, [s.ID_DEVOLUCION]: data.id_chat }));
        setChatAbierto(data.id_chat);
        // Actualizar solicitudes para reflejar nuevo chat
        setSolicitudes((prev) => prev.map((x) => (x.ID_DEVOLUCION === s.ID_DEVOLUCION ? { ...x, ID_CHAT: data.id_chat } : x)));
      } else if (data.msg) {
        Swal.fire({ icon: "info", title: "Chat", text: data.msg, background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      }
    } catch {}
  };

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

  // Tras un rechazo del vendedor, el cliente puede llevar el caso con soporte JADDA
  const llevarSoporte = async (s: Devolucion) => {
    if (!s.ID_CHAT) return;
    const r = await Swal.fire({
      icon: "question",
      title: "¿Llevarlo con soporte de JADDA?",
      text: "El equipo JADDA revisará las evidencias de la solicitud y decidirá el resultado. Se abrirá un chat contigo y otro con el vendedor.",
      showCancelButton: true,
      confirmButtonText: "Sí, llevar con soporte",
      cancelButtonText: "Volver",
      confirmButtonColor: "#7c3aed",
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    try {
      const res = await axios.post(`/api/chat/${s.ID_CHAT}/escalar`, {}, { withCredentials: true });
      Swal.fire({
        icon: res.data?.ok ? "success" : "warning",
        title: res.data?.ok ? "Enviado a soporte" : "No se pudo escalar",
        text: res.data?.msg || "",
      });
      cargar();
    } catch (err: any) {
      Swal.fire({ icon: "warning", title: "No se pudo escalar", text: err.response?.data?.msg || "" });
    }
  };

  const adjuntarEvidencias = async (idDevolucion: number, files: File[] | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("evidencias", f));
      const res = await axios.post(`/api/devoluciones/${idDevolucion}/evidencias`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire({ icon: "success", title: "Evidencias enviadas", text: res.data.msg, background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      setSeleccion((sel) => ({ ...sel, [idDevolucion]: [] }));
      await cargar();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "No se pudieron subir las evidencias", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
    } finally {
      setSubiendo(false);
    }
  };

  const seleccionarArchivos = (idDevolucion: number, files: FileList | null) => {
    if (!files || !files.length) return;
    setSeleccion((sel) => ({ ...sel, [idDevolucion]: Array.from(files) }));
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
          <h1 className="rr-header-titulo"><FaUndoAlt /> Devolución o reembolso �?? Pedido {numeroPedido(venta.ID_VENTA)}</h1>
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
                : s.ESTADO === "ESCALADA"
                  ? [{ etiqueta: "Solicitud recibida", estado: "hecho" }, { etiqueta: "Acuerdo con el vendedor", estado: "rechazado" }, { etiqueta: "Decisión JADDA", estado: "activo" }]
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
                      <FaWallet /> {esDevolucion ? "DEVOLUCI�?N" : "REEMBOLSO"}
                    </span>
                    <span className="de-estado-badge" style={{ background: info.color }}>{info.label.toUpperCase()}</span>
                  </div>
                </div>

                {s.ESTADO === "RECHAZADA" && !s.PARTE_CHAT && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    <button
                      className="rr-btn de-btn-chat"
                      style={{ width: "100%", background: "#7c3aed", color: "#fff", border: "none", fontWeight: 800 }}
                      onClick={() => llevarSoporte(s)}
                    >
                      ⚖️ Llevarlo con soporte de JADDA — que ellos decidan
                    </button>
                    <button
                      className="rr-btn rr-btn-secundario de-btn-chat"
                      style={{ width: "100%" }}
                      onClick={() => abrirChatDevolucion(s)}
                    >
                      💬 {chatAbierto === (s.ID_CHAT || chatIds[s.ID_DEVOLUCION]) ? "Ocultar conversación con el vendedor" : s.ID_CHAT || chatIds[s.ID_DEVOLUCION] ? "Ver conversación con el vendedor" : "Abrir chat"}
                    </button>
                  </div>
                )}

                {!(s.ESTADO === "RECHAZADA" && !s.PARTE_CHAT) && (
                  <button
                    className="rr-btn rr-btn-secundario de-btn-chat"
                    style={{ width: "100%", marginBottom: 10 }}
                    onClick={() => abrirChatDevolucion(s)}
                  >
                    💬 {chatAbierto === (s.ID_CHAT || chatIds[s.ID_DEVOLUCION])
                      ? "Ocultar el chat"
                      : s.PARTE_CHAT || s.ESTADO === "ESCALADA"
                        ? "Tu conversación con el soporte de JADDA"
                        : s.ID_CHAT || chatIds[s.ID_DEVOLUCION]
                          ? "Ver la conversación de esta solicitud"
                          : "Abrir chat"}
                  </button>
                )}

                {(s.ID_CHAT || chatIds[s.ID_DEVOLUCION]) && chatAbierto === (s.ID_CHAT || chatIds[s.ID_DEVOLUCION]) && (
                  <ChatHilo idChat={s.ID_CHAT || chatIds[s.ID_DEVOLUCION]!} altura={300} />
                )}

                <div className="rr-timeline">
                  {pasos.map((p, idx) => (
                    <div key={idx} className={`rr-timeline-paso ${p.estado}`}>
                      <div className="rr-timeline-circulo">{p.estado === "hecho" ? "�??" : p.estado === "rechazado" ? "�??" : idx + 1}</div>
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
                      onChange={(e) => {
                        seleccionarArchivos(s.ID_DEVOLUCION, e.target.files);
                        setTimeout(() => { e.target.value = ""; }, 0);
                      }}
                    />
                    {seleccion[s.ID_DEVOLUCION]?.length ? (
                      <div className="de-seleccion">
                        <div className="de-seleccion-lista">
                          {seleccion[s.ID_DEVOLUCION].map((f, i) => (
                            <span key={i} className="de-seleccion-chip" title={f.name}>
                              {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          ))}
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                          <button
                            className="rr-btn rr-btn-primario"
                            disabled={subiendo}
                            onClick={() => adjuntarEvidencias(s.ID_DEVOLUCION, seleccion[s.ID_DEVOLUCION])}
                          >
                            <FaPaperclip /> {subiendo ? "Subiendo..." : `Subir ${seleccion[s.ID_DEVOLUCION].length} archivo${seleccion[s.ID_DEVOLUCION].length > 1 ? "s" : ""}`}
                          </button>
                          <button
                            className="rr-btn rr-btn-secundario"
                            disabled={subiendo}
                            onClick={() => setSeleccion((sel) => ({ ...sel, [s.ID_DEVOLUCION]: [] }))}
                          >
                            Quitar selección
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="rr-btn rr-btn-primario"
                        disabled={subiendo}
                        onClick={() => fileRefs.current[s.ID_DEVOLUCION]?.click()}
                      >
                        <FaPaperclip /> {subiendo ? "Subiendo..." : "Adjuntar más evidencias"}
                      </button>
                    )}
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


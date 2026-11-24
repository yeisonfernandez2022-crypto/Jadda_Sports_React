import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import EncabezadoDetalle from "./EncabezadoDetalle";
import { notificarPendientesActualizados } from "../utils/eventosAdmin";
import "../css/adminDashboard.css";
import {
  FaBoxOpen, FaCalendarAlt, FaCheck, FaImage, FaTimes, FaTrophy, FaUser, FaVideo,
} from "react-icons/fa";

const esVideoRuta = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

const fechaHora = (f: string | null | undefined) => {
  if (!f) return "Sin registros";
  const fecha = new Date(f);
  return Number.isNaN(fecha.getTime()) ? "Sin registros" : fecha.toLocaleString("es-CO");
};

const etiquetaEstado = (estado: string) =>
  estado === "pendiente" ? "EN REVISIÓN" : estado === "aprobado" ? "APROBADO" : "RECHAZADO";

const claseEstado = (estado: string) => {
  if (estado === "aprobado") return "au-badge au-badge-si";
  if (estado === "rechazado") return "au-badge au-badge-no";
  return "au-badge au-badge-progreso";
};

interface Evidencia {
  ID_EVIDENCIA: number;
  TIPO: string;
  RUTA: string | null;
  RUTAS_EXTRA: string | null;
  CANTIDAD: number;
  ESTADO: string;
  OBSERVACION: string | null;
  FECHA_SUBIDA: string;
  ID_RETO_USUARIO: number;
  ID_USUARIO: number;
  USUARIO_NOMBRE: string;
  USUARIO_APELLIDO: string;
  USUARIO_EMAIL: string;
  RETO_TITULO: string;
  RETO_DESCRIPCION: string | null;
  PROGRESO: number;
  META_VALOR: number;
  META_TIPO: string;
}

/** Todas las rutas del avance: la principal + RUTAS_EXTRA (JSON válido). */
const rutasDe = (e: Evidencia): string[] => {
  const rutas: string[] = e.RUTA ? [e.RUTA] : [];
  try {
    const extra: unknown = JSON.parse(e.RUTAS_EXTRA || "[]");
    if (Array.isArray(extra)) {
      rutas.push(...extra.filter((r): r is string => typeof r === "string"));
    }
  } catch {
    /* RUTAS_EXTRA inválida o nula: se conserva la ruta principal */
  }
  return rutas;
};

const DetalleEvidenciaAdmin = () => {
  const { id } = useParams();
  const [datos, setDatos] = useState<Evidencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(`/api/retos/admin/evidencias/${id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.msg || "No se pudo cargar la evidencia.");
        if (!cancelado) setDatos(data as Evidencia);
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la evidencia.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    void cargar();
    return () => { cancelado = true; };
  }, [id, intento]);

  useEffect(() => {
    if (!ampliada) return;
    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAmpliada(null);
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [ampliada]);

  const revisar = async (accion: "aprobar" | "rechazar") => {
    if (!datos || procesando) return;
    const esAprobar = accion === "aprobar";
    let observacion = "";

    if (esAprobar) {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: "¿Aprobar esta evidencia?",
        html: "El avance se sumará al progreso del usuario y le llegará una notificación.",
        showCancelButton: true,
        confirmButtonText: "Sí, aprobar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
      });
      if (!isConfirmed) return;
    } else {
      const { value: motivo, isConfirmed } = await Swal.fire({
        icon: "question",
        title: "¿Rechazar esta evidencia?",
        html: "El avance NO se sumará al progreso y el usuario recibirá una notificación para que lo reintente.<br/><br/><small>Puedes indicar un motivo (opcional) que el usuario verá junto a su avance.</small>",
        input: "textarea",
        inputPlaceholder: "Ej. La evidencia no corresponde al reto…",
        inputAttributes: { maxlength: "500", style: "resize:vertical" },
        showCancelButton: true,
        confirmButtonText: "Sí, rechazar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
      });
      if (!isConfirmed) return;
      observacion = (motivo || "").trim().slice(0, 500);
    }

    setProcesando(true);
    try {
      const res = await fetch(`/api/retos/admin/evidencias/${datos.ID_EVIDENCIA}/${accion}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        notificarPendientesActualizados();
        setDatos((prev) => prev
          ? {
              ...prev,
              ESTADO: esAprobar ? "aprobado" : "rechazado",
              OBSERVACION: observacion || prev.OBSERVACION,
            }
          : prev);
        if (esAprobar && data.completado && data.cupon) {
          await Swal.fire({
            icon: "success",
            title: "Reto completado",
            html: `El usuario alcanzó la meta. Cupón generado: <strong style="color:#e73737">${data.cupon}</strong>`,
            confirmButtonColor: "#e73737",
          });
        } else {
          void Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        }
      } else {
        void Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar la evidencia" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al procesar la evidencia" });
    } finally {
      setProcesando(false);
    }
  };

  const rutas = datos ? rutasDe(datos) : [];
  const esPendiente = datos?.ESTADO === "pendiente";
  const nombreUsuario = datos ? `${datos.USUARIO_NOMBRE} ${datos.USUARIO_APELLIDO}`.trim() : "";

  const material = rutas.length === 0 ? (
    <div className="evidencia-modal-vacio">
      <FaBoxOpen size={44} className="mb-3" />
      <p className="mb-1 fw-bold">Sin material adjunto</p>
      <small>El avance fue enviado sin fotos o videos.</small>
    </div>
  ) : rutas.length === 1 ? (
    esVideoRuta(rutas[0]) ? (
      <video aria-label="Evidencia en video" src={rutas[0]} controls className="evidencia-modal-media-unica" />
    ) : (
      <img
        src={rutas[0]}
        alt="Evidencia 1"
        className="evidencia-modal-media-unica"
        onClick={() => setAmpliada(rutas[0])}
      />
    )
  ) : (
    <>
      <div className="evidencia-grid">
        {rutas.map((ruta, i) => (
          <div key={`${ruta}-${i}`} className="evidencia-grid-item">
            {esVideoRuta(ruta) ? (
              <video
                aria-label={`Evidencia en video ${i + 1}`}
                src={ruta}
                controls
                style={{ width: "100%", maxHeight: 320, borderRadius: 10 }}
              />
            ) : (
              <img
                src={ruta}
                alt={`Evidencia ${i + 1}`}
                onClick={() => setAmpliada(ruta)}
                style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 10, cursor: "zoom-in" }}
              />
            )}
            <span className="evidencia-grid-tag">{esVideoRuta(ruta) ? <FaVideo /> : <FaImage />} {i + 1}</span>
          </div>
        ))}
      </div>
      <div className="evidencia-modal-adjuntos">
        <FaImage /> {rutas.length} archivos adjuntos en este avance
      </div>
    </>
  );

  const contenido = cargando ? (
    <div className="adp-empty">Cargando evidencia...</div>
  ) : error || !datos ? (
    <div className="adp-empty">
      <p>{error || "No se pudo cargar la evidencia."}</p>
      <div className="adp-empty-acciones">
        <button className="au-btn-ver" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        <Link className="au-btn-ver" to="/admin/retos">Volver a evidencias</Link>
      </div>
    </div>
  ) : (
    <>
      <EncabezadoDetalle
        icono={<FaTrophy />}
        titulo="Evidencia de reto"
        subtitulo={nombreUsuario}
        volver={{ to: "/admin/retos", label: "Volver a evidencias" }}
        breadcrumb={[
          { label: "Dashboard", to: "/admin" },
          { label: "Retos", to: "/admin/retos" },
          { label: "Evidencia" },
        ]}
        badges={(
          <>
            <span className={claseEstado(datos.ESTADO)}>{etiquetaEstado(datos.ESTADO)}</span>
            <span className="au-badge"><FaCalendarAlt /> {fechaHora(datos.FECHA_SUBIDA)}</span>
          </>
        )}
        acciones={esPendiente ? (
          <>
            <button
              type="button"
              className="evidencia-modal-btn aprobar"
              disabled={procesando}
              onClick={() => void revisar("aprobar")}
            >
              <FaCheck className="me-1" /> Aprobar avance
            </button>
            <button
              type="button"
              className="evidencia-modal-btn rechazar"
              disabled={procesando}
              onClick={() => void revisar("rechazar")}
            >
              <FaTimes className="me-1" /> Rechazar
            </button>
          </>
        ) : undefined}
      />

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaUser /> Usuario</h2>
        <div className="au-info-grid">
          <div className="au-dato"><span>Correo</span><strong className="au-dato-email">{datos.USUARIO_EMAIL}</strong></div>
          <div className="au-dato"><span>ID de usuario</span><strong>#{datos.ID_USUARIO}</strong></div>
        </div>
        <Link className="au-btn-ver" to={`/admin/usuarios/${datos.ID_USUARIO}`}>
          <FaUser /> Ver usuario
        </Link>
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaTrophy /> Reto</h2>
        <p className="adp-meta"><strong>{datos.RETO_TITULO}</strong></p>
        {datos.RETO_DESCRIPCION && <p className="adp-parrafo">{datos.RETO_DESCRIPCION}</p>}
        <div className="au-tarjeta-compra">
          <div className="au-tarjeta-compra-titulo">
            <strong><span>{datos.PROGRESO}/{datos.META_VALOR}</span> {datos.META_TIPO}</strong>
            <span className="au-badge">{Math.min(100, Math.round((datos.PROGRESO / Math.max(1, datos.META_VALOR)) * 100))}%</span>
          </div>
          <div className="au-reto-barra">
            <div style={{ width: `${Math.min(100, Math.round((datos.PROGRESO / Math.max(1, datos.META_VALOR)) * 100))}%` }} />
          </div>
        </div>
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaImage /> Evidencia</h2>
        <div className="au-info-grid">
          <div className="au-dato"><span>Tipo</span><strong>{datos.TIPO || "—"}</strong></div>
          <div className="au-dato"><span>Cantidad sumada</span><strong>+{datos.CANTIDAD}</strong></div>
          <div className="au-dato"><span>Fecha de envío</span><strong>{fechaHora(datos.FECHA_SUBIDA)}</strong></div>
          <div className="au-dato"><span>Material adjunto</span><strong>{rutas.length} archivo(s)</strong></div>
        </div>

        {datos.OBSERVACION && (
          <div className="ad-obs-admin">
            <strong>Motivo de la revisión:</strong> {datos.OBSERVACION}
          </div>
        )}

        <div className="au-seccion">
          <h3><FaImage /> Material del avance</h3>
          {material}
        </div>
      </section>
    </>
  );

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="adp-page">
          {contenido}
        </div>
      </div>

      {ampliada && (
        <div
          className="evidencia-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Evidencia ampliada"
          onClick={() => setAmpliada(null)}
        >
          <button
            type="button"
            className="au-modal-x"
            aria-label="Cerrar evidencia ampliada"
            onClick={() => setAmpliada(null)}
          >
            ✕
          </button>
          <img
            src={ampliada}
            alt="Evidencia ampliada"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 12 }}
          />
        </div>
      )}

      <AdminFooter />
    </div>
  );
};

export default DetalleEvidenciaAdmin;

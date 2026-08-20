import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaImage, FaVideo, FaEye, FaBoxOpen, FaClock, FaCheckCircle, FaChevronDown, FaAlignLeft } from "react-icons/fa";

const esVideoRuta = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

const AdminRetos = () => {
  const navigate = useNavigate();
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState<{ evidencia: any; rutas: string[] } | null>(null);
  const [grupos, setGrupos] = useState({ pendientes: true, revisados: false });

  const toggleGrupo = (clave: "pendientes" | "revisados") =>
    setGrupos((g) => ({ ...g, [clave]: !g[clave] }));

  const fetchEvidencias = async () => {
    try {
      const res = await fetch("/api/retos/admin/evidencias", { credentials: "include" });
      const data = await res.json();
      setEvidencias(data);
    } catch {
      console.error("Error al cargar evidencias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvidencias(); }, []);

  const todasLasRutas = (e: any): string[] => {
    if (!e.RUTA) return [];
    let rutas = [e.RUTA];
    try {
      const extra = JSON.parse(e.RUTAS_EXTRA || "[]");
      if (Array.isArray(extra)) rutas = rutas.concat(extra);
    } catch {
      /* RUTAS_EXTRA inválida o nula */
    }
    return rutas;
  };

  const revisar = async (id: number, accion: "aprobar" | "rechazar") => {
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

    try {
      const res = await fetch(`/api/retos/admin/evidencias/${id}/${accion}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion }),
      });
      const data = await res.json();
      if (data.ok) {
        if (accion === "aprobar" && data.completado && data.cupon) {
          await Swal.fire({
            icon: "success",
            title: "Reto completado",
            html: `El usuario alcanzó la meta. Cupón generado: <strong style="color:#e73737">${data.cupon}</strong>`,
            confirmButtonColor: "#e73737",
          });
        } else {
          Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        }
        fetchEvidencias();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al procesar la evidencia" });
    }
  };

  const pendientes = evidencias.filter((e) => e.ESTADO === "pendiente").length;

  const filaEvidencia = (e: any) => (
    <tr key={e.ID_EVIDENCIA} className={e.ESTADO === "pendiente" ? "table-warning" : ""}>
      <td>
        <div className="fw-bold">{e.USUARIO_NOMBRE} {e.USUARIO_APELLIDO}</div>
        <small className="text-muted">{e.USUARIO_EMAIL}</small>
      </td>
      <td className="fw-bold">{e.RETO_TITULO}</td>
      <td>
        <span className="fw-bold">{e.PROGRESO}</span>
        <span className="text-muted">/{e.META_VALOR} {e.META_TIPO}</span>
      </td>
      <td>{new Date(e.FECHA_SUBIDA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
      <td>
        <span className={`badge ${e.ESTADO === "pendiente" ? "bg-warning text-dark" : e.ESTADO === "aprobado" ? "bg-success" : "bg-danger"}`}>
          {e.ESTADO === "pendiente" ? "EN REVISIÓN" : e.ESTADO === "aprobado" ? "APROBADO" : "RECHAZADO"}
        </span>
      </td>
      <td className="text-center">
        <button className="btn btn-sm btn-outline-primary" title="Ver avance" onClick={() => setVer({ evidencia: e, rutas: todasLasRutas(e) })}>
          <FaEye className="me-1" /> Ver
        </button>
      </td>
    </tr>
  );

  const grupoEvidencias = (titulo: string, Icono: any, lista: any[], abierto: boolean, onToggle: () => void, vacio: string) => (
    <div className={`admin-grupo ${abierto ? "abierto" : ""}`}>
      <button className="admin-grupo-head" onClick={onToggle}>
        <Icono />
        <span className="admin-grupo-titulo">{titulo}</span>
        <span className="admin-grupo-count">{lista.length}</span>
        <FaChevronDown className="admin-grupo-cheuron" />
      </button>
      {abierto && (
        <div className="admin-grupo-body">
          {lista.length === 0 ? (
            <div className="text-center py-4 text-muted">{vacio}</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th>Usuario</th>
                    <th>Reto</th>
                    <th>Progreso</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th className="text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>{lista.map(filaEvidencia)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al Dashboard
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Retos" }]} />
            <div className="au-titulos">
              <h1>Evidencias de Retos</h1>
              <p>
                {pendientes > 0 ? `${pendientes} avances pendientes de revisión` : "Sin avances pendientes"} — Aprueba el material para sumar progreso al reto del usuario
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando evidencias...</div>
          ) : evidencias.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay evidencias registradas</div>
          ) : (
            <>
              {grupoEvidencias("No revisados", FaClock, evidencias.filter((e) => e.ESTADO === "pendiente"), grupos.pendientes, () => toggleGrupo("pendientes"), "No hay avances pendientes de revisión")}
              {grupoEvidencias("Ya revisados", FaCheckCircle, evidencias.filter((e) => e.ESTADO !== "pendiente"), grupos.revisados, () => toggleGrupo("revisados"), "Aún no hay avances revisados")}
            </>
          )}
        </div>
      </div>

      {ver && (
        <div
          className="evidencia-overlay"
          onClick={() => setVer(null)}
        >
          <div className="evidencia-modal" onClick={(e) => e.stopPropagation()}>
            <div className="evidencia-modal-header">
              <div className="evidencia-modal-avatar">
                {(ver.evidencia.USUARIO_NOMBRE || "?").charAt(0).toUpperCase()}
              </div>
              <div className="evidencia-modal-titulos">
                <span className="evidencia-modal-reto">{ver.evidencia.RETO_TITULO}</span>
                <span className="evidencia-modal-usuario">
                  {ver.evidencia.USUARIO_NOMBRE} {ver.evidencia.USUARIO_APELLIDO} · {ver.evidencia.USUARIO_EMAIL}
                </span>
              </div>
              <span className={`evidencia-modal-estado ${ver.evidencia.ESTADO}`}>
                {ver.evidencia.ESTADO === "pendiente" ? "EN REVISIÓN" : ver.evidencia.ESTADO === "aprobado" ? "APROBADO" : "RECHAZADO"}
              </span>
              <button className="btn-close" onClick={() => setVer(null)} />
            </div>
            <div className="evidencia-modal-meta">
              <span><FaBoxOpen /> Progreso: <strong>{ver.evidencia.PROGRESO}</strong>/{ver.evidencia.META_VALOR} {ver.evidencia.META_TIPO}</span>
              <span><FaCheck /> Cantidad: +{ver.evidencia.CANTIDAD}</span>
              <span><FaImage /> {ver.rutas.filter((r) => !esVideoRuta(r)).length} imagen{ver.rutas.filter((r) => !esVideoRuta(r)).length !== 1 ? "es" : ""}</span>
              <span><FaVideo /> {ver.rutas.filter(esVideoRuta).length} video{ver.rutas.filter(esVideoRuta).length !== 1 ? "s" : ""}</span>
              <span><FaEye /> {new Date(ver.evidencia.FECHA_SUBIDA).toLocaleString("es-CO", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {ver.evidencia.OBSERVACION && (
              <div className="evidencia-modal-desc observacion">
                <FaAlignLeft /> <div><strong>Motivo de la revisión:</strong> {ver.evidencia.OBSERVACION}</div>
              </div>
            )}
            {ver.evidencia.RETO_DESCRIPCION && (
              <div className="evidencia-modal-desc">
                <FaAlignLeft /> <div><strong>Descripción del reto:</strong> {ver.evidencia.RETO_DESCRIPCION}</div>
              </div>
            )}
            <div className="evidencia-modal-body">
              {ver.rutas.length === 0 ? (
                <div className="evidencia-modal-vacio">
                  <FaBoxOpen size={44} className="mb-3" />
                  <p className="mb-1 fw-bold">Este avance no tiene material adjunto</p>
                  <small>Fue enviado sin fotos o videos, o su material se eliminó en una revisión anterior.</small>
                </div>
              ) : ver.rutas.length === 1 ? (
                esVideoRuta(ver.rutas[0]) ? (
                  <video src={ver.rutas[0]} controls className="evidencia-modal-media-unica" />
                ) : (
                  <img src={ver.rutas[0]} alt="Evidencia" className="evidencia-modal-media-unica" />
                )
              ) : (
                <div className="evidencia-grid">
                  {ver.rutas.map((ruta, i) => (
                    <div key={i} className="evidencia-grid-item">
                      {esVideoRuta(ruta) ? (
                        <video src={ruta} controls style={{ width: "100%", maxHeight: 320, borderRadius: 10 }} />
                      ) : (
                        <img src={ruta} alt={`Evidencia ${i + 1}`} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 10 }} />
                      )}
                      <span className="evidencia-grid-tag">{esVideoRuta(ruta) ? <FaVideo /> : <FaImage />} {i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
              {ver.rutas.length > 1 && (
                <div className="evidencia-modal-adjuntos">
                  <FaEye /> {ver.rutas.length} archivos adjuntos en este avance
                </div>
              )}
            </div>
            {ver.evidencia.ESTADO === "pendiente" && (
              <div className="evidencia-modal-footer">
                <button className="evidencia-modal-btn aprobar" onClick={() => { revisar(ver.evidencia.ID_EVIDENCIA, "aprobar"); setVer(null); }}>
                  <FaCheck className="me-1" /> Aprobar avance
                </button>
                <button className="evidencia-modal-btn rechazar" onClick={() => { revisar(ver.evidencia.ID_EVIDENCIA, "rechazar"); setVer(null); }}>
                  <FaTimes className="me-1" /> Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AdminFooter />
    </div>
  );
};

export default AdminRetos;

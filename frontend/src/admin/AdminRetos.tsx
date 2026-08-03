import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaImage, FaVideo, FaPlay, FaEye } from "react-icons/fa";

const AdminRetos = () => {
  const navigate = useNavigate();
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState<{ evidencia: any; rutas: string[] } | null>(null);

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
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: esAprobar ? "¿Aprobar esta evidencia?" : "¿Rechazar esta evidencia?",
      html: esAprobar
        ? "El avance se sumará al progreso del usuario y le llegará una notificación."
        : "El avance NO se sumará al progreso y el usuario recibirá una notificación para que lo reintente.",
      showCancelButton: true,
      confirmButtonText: esAprobar ? "Sí, aprobar" : "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: esAprobar ? "#198754" : "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/retos/admin/evidencias/${id}/${accion}`, {
        method: "POST",
        credentials: "include",
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

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-3">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <h1 className="fw-bold text-dark m-0">Evidencias de Retos</h1>
            <p className="text-muted small m-0">
              {pendientes > 0 ? `${pendientes} avances pendientes de revisión` : "Sin avances pendientes"} — Aprueba el material para sumar progreso al reto del usuario
            </p>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando evidencias...</div>
          ) : evidencias.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay evidencias registradas</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th>#</th>
                    <th>Usuario</th>
                    <th>Reto</th>
                    <th>Progreso</th>
                    <th>Material</th>
                    <th>Cant.</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th className="text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {evidencias.map((e) => {
                    const rutas = todasLasRutas(e);
                    return (
                      <tr key={e.ID_EVIDENCIA} className={e.ESTADO === "pendiente" ? "table-warning" : ""}>
                        <td className="fw-bold">{e.ID_EVIDENCIA}</td>
                        <td>
                          <div className="fw-bold">{e.USUARIO_NOMBRE} {e.USUARIO_APELLIDO}</div>
                          <small className="text-muted">{e.USUARIO_EMAIL}</small>
                        </td>
                        <td className="fw-bold">{e.RETO_TITULO}</td>
                        <td>
                          <span className="fw-bold">{e.PROGRESO}</span>
                          <span className="text-muted">/{e.META_VALOR} {e.META_TIPO}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-dark d-flex align-items-center gap-2"
                            onClick={() => setVer({ evidencia: e, rutas })}
                          >
                            {e.TIPO === "video" ? <FaVideo className="text-danger" /> : <FaImage className="text-danger" />}
                            <span className="d-flex align-items-center gap-1">
                              <span className="material-thumb d-inline-flex align-items-center justify-content-center">
                                {e.TIPO === "video" ? (
                                  <FaPlay style={{ fontSize: "0.7rem" }} />
                                ) : (
                                  <img src={e.RUTA} alt="" style={{ width: 28, height: 28, objectFit: "cover" }} onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                )}
                              </span>
                              Ver {rutas.length > 1 ? `(${rutas.length} archivos)` : ""}
                            </span>
                          </button>
                        </td>
                        <td>+{e.CANTIDAD}</td>
                        <td>{new Date(e.FECHA_SUBIDA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>
                          <span className={`badge ${e.ESTADO === "pendiente" ? "bg-warning text-dark" : e.ESTADO === "aprobado" ? "bg-success" : "bg-danger"}`}>
                            {e.ESTADO}
                          </span>
                        </td>
                        <td className="text-center">
                          {e.ESTADO === "pendiente" ? (
                            <div className="d-flex gap-1 justify-content-center">
                              <button className="btn btn-sm btn-success" title="Aprobar" onClick={() => revisar(e.ID_EVIDENCIA, "aprobar")}>
                                <FaCheck />
                              </button>
                              <button className="btn btn-sm btn-outline-danger" title="Rechazar" onClick={() => revisar(e.ID_EVIDENCIA, "rechazar")}>
                                <FaTimes />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted small">Revisada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
              <div>
                <h5 className="m-0">{ver.evidencia.RETO_TITULO}</h5>
                <small>
                  {ver.evidencia.USUARIO_NOMBRE} {ver.evidencia.USUARIO_APELLIDO} — +{ver.evidencia.CANTIDAD} {ver.evidencia.META_TIPO} · {new Date(ver.evidencia.FECHA_SUBIDA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </small>
              </div>
              <button className="btn-close btn-close-white" onClick={() => setVer(null)} />
            </div>
            <div className="evidencia-modal-body">
              {ver.rutas.length === 1 ? (
                ver.evidencia.TIPO === "video" ? (
                  <video src={ver.rutas[0]} controls style={{ maxWidth: "100%", maxHeight: "68vh", borderRadius: 12 }} />
                ) : (
                  <img src={ver.rutas[0]} alt="Evidencia" style={{ maxWidth: "100%", maxHeight: "68vh", borderRadius: 12 }} />
                )
              ) : (
                <div className="evidencia-grid">
                  {ver.rutas.map((ruta, i) => {
                    const esVideo = ver.evidencia.TIPO === "video";
                    return (
                      <div key={i} className="evidencia-grid-item">
                        {esVideo ? (
                          <video src={ruta} controls style={{ width: "100%", maxHeight: 320, borderRadius: 10 }} />
                        ) : (
                          <img src={ruta} alt={`Evidencia ${i + 1}`} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 10 }} />
                        )}
                        <span className="evidencia-grid-tag">{esVideo ? <FaVideo /> : <FaImage />} {i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {ver.rutas.length > 1 && (
                <div className="text-center text-muted small mt-3 d-flex align-items-center justify-content-center gap-2">
                  <FaEye /> {ver.rutas.length} archivos adjuntos en este avance
                </div>
              )}
            </div>
            {ver.evidencia.ESTADO === "pendiente" && (
              <div className="evidencia-modal-footer">
                <button className="btn btn-success px-4" onClick={() => { revisar(ver.evidencia.ID_EVIDENCIA, "aprobar"); setVer(null); }}>
                  <FaCheck className="me-1" /> Aprobar
                </button>
                <button className="btn btn-outline-danger px-4" onClick={() => { revisar(ver.evidencia.ID_EVIDENCIA, "rechazar"); setVer(null); }}>
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

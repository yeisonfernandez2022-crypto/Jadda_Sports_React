import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaStore, FaUserTie, FaIdCard, FaEnvelope, FaPhoneAlt, FaMapMarkerAlt, FaClock } from "react-icons/fa";

interface SolicitudVendedor {
  ID_SOLICITUD: number;
  ID_USUARIO: number;
  NOMBRE_EMPRESA: string;
  NIT: string;
  NOMBRE_REPRESENTANTE: string;
  EMAIL_EMPRESA: string;
  TELEFONO: string;
  DEPARTAMENTO: string;
  CIUDAD: string;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  DESCRIPCION: string | null;
  ESTADO: string;
  OBSERVACION_ADMIN: string | null;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
  SOLICITANTE_NOMBRE: string;
  SOLICITANTE_EMAIL: string;
  VENDEDOR_ID: number | null;
  VENDEDOR_ESTADO: string | null;
}

const estadoBadge: Record<string, string> = {
  PENDIENTE: "badge-avs-pend",
  APROBADA: "badge-avs-ok",
  RECHAZADA: "badge-avs-rech",
};

const AdminVendedores = () => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState<SolicitudVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState<SolicitudVendedor | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pendientes" | "aprobadas" | "rechazadas">("todas");

  const fetchSolicitudes = async () => {
    try {
      const res = await fetch("/api/vendedor/admin", { credentials: "include" });
      if (res.ok) setSolicitudes(await res.json());
    } catch {
      console.error("Error al cargar solicitudes de vendedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSolicitudes(); }, []);

  const procesar = async (s: SolicitudVendedor, estado: "APROBADA" | "RECHAZADA") => {
    const esAprobar = estado === "APROBADA";
    const observacion = !esAprobar
      ? await Swal.fire({
          icon: "warning",
          title: "Rechazar solicitud",
          input: "textarea",
          inputPlaceholder: "Motivo del rechazo (opcional) — se notificará al solicitante",
          showCancelButton: true,
          confirmButtonText: "Sí, rechazar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          inputValidator: (v) => (v && v.length > 500 ? "Máximo 500 caracteres" : undefined),
        })
      : null;

    if (!esAprobar && !observacion?.isConfirmed) return;

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: esAprobar ? "¿Aprobar solicitud?" : "¿Confirmar rechazo?",
      html: esAprobar
        ? `Se creará una cuenta de vendedor con el correo <strong>${s.EMAIL_EMPRESA}</strong> y una <strong>contraseña temporal</strong>. Las credenciales se enviarán por correo.`
        : "La solicitud quedará rechazada y se notificará al solicitante.",
      showCancelButton: true,
      confirmButtonText: esAprobar ? "Sí, aprobar" : "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: esAprobar ? "#198754" : "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/vendedor/admin/${s.ID_SOLICITUD}/procesar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado, observacion: observacion?.value || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg, timer: 2000, showConfirmButton: false });
        fetchSolicitudes();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al procesar la solicitud" });
    }
  };

  const pendientes = solicitudes.filter((s) => s.ESTADO === "PENDIENTE").length;
  const filtradas = solicitudes.filter((s) => {
    if (filtro === "pendientes") return s.ESTADO === "PENDIENTE";
    if (filtro === "aprobadas") return s.ESTADO === "APROBADA";
    if (filtro === "rechazadas") return s.ESTADO === "RECHAZADA";
    return true;
  });

  const fmtFecha = (f: string) => {
    if (!f) return "—";
    try {
      return new Date(f).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return f;
    }
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="admin-volver" onClick={() => navigate("/admin")}>
            <FaArrowLeft /> Volver al Dashboard
          </button>
          <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Vendedores" }]} />
          <div className="au-titulos">
            <h1>Vendedores <span className="badge bg-warning text-dark ms-2" style={{ fontSize: "0.65rem", verticalAlign: "middle" }}>{pendientes} pendiente(s)</span></h1>
            <p>Revisa y aprueba las solicitudes de vendedor</p>
          </div>
        </div>

        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {(["todas", "pendientes", "aprobadas", "rechazadas"] as const).map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${filtro === f ? "btn-danger" : "btn-outline-secondary"}`}
                  onClick={() => setFiltro(f)}
                >
                  {f === "todas" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center text-muted py-4">Cargando solicitudes...</div>
            ) : filtradas.length === 0 ? (
              <div className="text-center text-muted py-4">No hay solicitudes de vendedor.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Solicitante</th>
                      <th>NIT</th>
                      <th>Ubicación</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((s) => (
                      <tr key={s.ID_SOLICITUD}>
                        <td>
                          <div className="fw-semibold">{s.NOMBRE_EMPRESA || "Vendedor informal"}</div>
                          <small className="text-muted">{s.EMAIL_EMPRESA}</small>
                        </td>
                        <td>
                          <div>{s.SOLICITANTE_NOMBRE || "Sin cuenta (formulario público)"}</div>
                          <small className="text-muted">{s.SOLICITANTE_EMAIL || "—"}</small>
                        </td>
                        <td>{s.NIT || "—"}</td>
                        <td>{s.CIUDAD}, {s.DEPARTAMENTO}</td>
                        <td>{fmtFecha(s.FECHA_CREACION)}</td>
                        <td>
                          <span className={`badge ${estadoBadge[s.ESTADO] || "bg-secondary"}`}>
                            {s.ESTADO}
                            {s.ESTADO === "APROBADA" && s.VENDEDOR_ESTADO ? ` · ${s.VENDEDOR_ESTADO}` : ""}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-outline-secondary btn-sm" title="Ver detalle" onClick={() => setVer(s)}>
                              <FaEye />
                            </button>
                            {s.ESTADO === "PENDIENTE" && (
                              <>
                                <button className="btn btn-success btn-sm" title="Aprobar" onClick={() => procesar(s, "APROBADA")}>
                                  <FaCheck />
                                </button>
                                <button className="btn btn-danger btn-sm" title="Rechazar" onClick={() => procesar(s, "RECHAZADA")}>
                                  <FaTimes />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {ver && (
        <div className="custom-modal-overlay" onClick={() => setVer(null)}>
          <div className="custom-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h5 className="mb-0"><FaStore /> {ver.NOMBRE_EMPRESA || "Vendedor informal"}</h5>
              <button type="button" className="btn-close" onClick={() => setVer(null)} />
            </div>
            <div className="custom-modal-body">
              <span className={`badge ${estadoBadge[ver.ESTADO] || "bg-secondary"} mb-3`}>{ver.ESTADO}</span>
              {ver.OBSERVACION_ADMIN && (
                <div className="alert alert-secondary py-2">{ver.OBSERVACION_ADMIN}</div>
              )}
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="text-muted small"><FaUserTie /> Representante legal</div>
                  <div className="fw-semibold">{ver.NOMBRE_REPRESENTANTE}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small"><FaIdCard /> NIT</div>
                  <div className="fw-semibold">{ver.NIT || "—"}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small"><FaEnvelope /> Correo de empresa</div>
                  <div className="fw-semibold">{ver.EMAIL_EMPRESA}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small"><FaPhoneAlt /> Teléfono</div>
                  <div className="fw-semibold">{ver.TELEFONO}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small"><FaMapMarkerAlt /> Ubicación</div>
                  <div className="fw-semibold">{ver.CIUDAD}, {ver.DEPARTAMENTO}{ver.DIRECCION ? ` — ${ver.DIRECCION}` : ""}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small"><FaClock /> Solicitud</div>
                  <div className="fw-semibold">{fmtFecha(ver.FECHA_CREACION)}{ver.FECHA_PROCESADA ? ` · procesada ${fmtFecha(ver.FECHA_PROCESADA)}` : ""}</div>
                </div>
                {ver.CATEGORIAS && (
                  <div className="col-12">
                    <div className="text-muted small">Categorías</div>
                    <div className="fw-semibold">{ver.CATEGORIAS}</div>
                  </div>
                )}
                {ver.DESCRIPCION && (
                  <div className="col-12">
                    <div className="text-muted small">Descripción del negocio</div>
                    <div className="fw-semibold">{ver.DESCRIPCION}</div>
                  </div>
                )}
              </div>
              {ver.ESTADO === "PENDIENTE" && (
                <div className="d-flex gap-2 mt-4">
                  <button className="btn btn-success" onClick={() => { const s = ver; setVer(null); procesar(s, "APROBADA"); }}>
                    <FaCheck /> Aprobar y enviar credenciales
                  </button>
                  <button className="btn btn-danger" onClick={() => { const s = ver; setVer(null); procesar(s, "RECHAZADA"); }}>
                    <FaTimes /> Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AdminFooter />
    </div>
  );
};

export default AdminVendedores;

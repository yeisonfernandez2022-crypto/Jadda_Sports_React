import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaStore, FaUserTie, FaMapMarkerAlt } from "react-icons/fa";

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
          inputPlaceholder: "Explica por qué no se aprueba — el vendedor verá este motivo y podrá intentarlo de nuevo",
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          inputValidator: (v) => {
            const t = (v || "").trim();
            if (!t) return "Debes indicar el motivo del rechazo";
            if (t.length > 500) return "Máximo 500 caracteres";
            return undefined;
          },
        })
      : null;

    if (!esAprobar && !observacion?.isConfirmed) return;

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: esAprobar ? "¿Aprobar solicitud?" : "¿Confirmar rechazo?",
      html: esAprobar
        ? `Se creará una cuenta de vendedor con el correo <strong>${s.EMAIL_EMPRESA}</strong> y una <strong>contraseña temporal</strong>. Las credenciales se enviarán por correo.`
        : `La solicitud quedará rechazada y el vendedor recibirá por correo el motivo: "<em>${(observacion?.value || "").trim()}</em>". Podrá corregir y volver a enviar.`,
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

        <div className="d-flex gap-2 mt-3 mb-3">
          {(["todas", "pendientes", "aprobadas", "rechazadas"] as const).map((f) => (
            <button
              key={f}
              className={`btn btn-sm fw-bold ${filtro === f ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setFiltro(f)}
            >
              {f === "todas" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="ap-count" style={{ marginLeft: "auto" }}>
            <FaStore /> {filtradas.length} solicitud{filtradas.length !== 1 ? "es" : ""}
          </span>
        </div>

        {loading ? (
          <div className="text-center text-muted py-4">Cargando solicitudes...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center text-muted py-4">No hay solicitudes de vendedor.</div>
        ) : (
          <div className="av-tabla-wrap">
                <table className="av-tabla">
                  <thead>
                    <tr>
                      <th className="av-col-emp">Empresa</th>
                      <th className="av-col-sol">Solicitante</th>
                      <th className="av-col-ubi">Ubicación</th>
                      <th className="av-col-fec">Fecha</th>
                      <th className="av-col-est">Estado</th>
                      <th className="av-col-acc">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((s) => (
                      <tr key={s.ID_SOLICITUD}>
                        <td className="av-col-emp">
                          <div className="av-emp-nombre" title={s.NOMBRE_EMPRESA || "Vendedor informal"}>{s.NOMBRE_EMPRESA || "Vendedor informal"}</div>
                          <small className="av-mail" title={s.EMAIL_EMPRESA}>{s.EMAIL_EMPRESA}</small>
                        </td>
                        <td className="av-col-sol">
                          <div className="av-sol-nombre" title={s.SOLICITANTE_NOMBRE || "Sin cuenta (formulario público)"}>{s.SOLICITANTE_NOMBRE || "Sin cuenta (formulario público)"}</div>
                          <small className="av-sol-mail" title={s.SOLICITANTE_EMAIL || ""}>{s.SOLICITANTE_EMAIL || "—"}</small>
                        </td>
                        <td className="av-col-ubi"><span className="av-ubic">{s.CIUDAD}, {s.DEPARTAMENTO}</span></td>
                        <td className="av-col-fec">{fmtFecha(s.FECHA_CREACION)}</td>
                        <td className="av-col-est">
                          <span className={`badge ${estadoBadge[s.ESTADO] || "bg-secondary"}`}>
                            {s.ESTADO === "PENDIENTE" ? "En revisión" : s.ESTADO}
                            {s.ESTADO === "APROBADA" && s.VENDEDOR_ESTADO ? ` · ${s.VENDEDOR_ESTADO}` : ""}
                          </span>
                        </td>
                        <td className="av-col-acc">
                          {s.ESTADO === "PENDIENTE" ? (
                            <button className="av-btn-gestionar" onClick={() => setVer(s)}>
                              <FaEye /> Gestionar
                            </button>
                          ) : (
                            <button className="av-btn-ver" title="Ver detalle" onClick={() => setVer(s)}>
                              <FaEye />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      {ver && (
        <div className="evidencia-overlay" onClick={() => setVer(null)}>
          <div className="au-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <button className="au-modal-x" onClick={() => setVer(null)}>✕</button>

            <div className="au-modal-hero">
              <div className="au-modal-avatar">
                {(ver.NOMBRE_EMPRESA || "V")[0].toUpperCase()}
              </div>
              <div className="au-modal-hero-info">
                <h2>{ver.NOMBRE_EMPRESA || "Vendedor informal"}</h2>
                <p className="au-modal-usuario">{ver.NOMBRE_REPRESENTANTE} · {ver.EMAIL_EMPRESA}</p>
                <div className="au-modal-badges">
                  <span className={`badge ${estadoBadge[ver.ESTADO] || "bg-secondary"}`}>
                    {ver.ESTADO === "PENDIENTE" ? "EN REVISIÓN" : ver.ESTADO}
                  </span>
                  <span className="badge bg-secondary">Solicitud de vendedor</span>
                </div>
              </div>
            </div>

            <div className="au-modal-body" style={{ textAlign: "left" }}>
              {ver.OBSERVACION_ADMIN && (
                <div className="ad-obs-admin">
                  <strong>Tu observación:</strong> {ver.OBSERVACION_ADMIN}
                </div>
              )}

              <div className="au-seccion">
                <h3><FaUserTie /> Solicitante</h3>
                <div className="au-info-grid">
                  <div className="au-dato"><span>Representante legal</span><strong>{ver.NOMBRE_REPRESENTANTE || "-"}</strong></div>
                  <div className="au-dato"><span>Teléfono</span><strong>{ver.TELEFONO || "-"}</strong></div>
                  <div className="au-dato"><span>Correo de empresa</span><strong className="au-dato-email">{ver.EMAIL_EMPRESA}</strong></div>
                  <div className="au-dato"><span>Solicitud enviada</span><strong>{fmtFecha(ver.FECHA_CREACION)}{ver.FECHA_PROCESADA ? ` · procesada ${fmtFecha(ver.FECHA_PROCESADA)}` : ""}</strong></div>
                </div>
              </div>

              <div className="au-seccion">
                <h3><FaStore /> Empresa y ubicación</h3>
                <div className="au-info-grid">
                  <div className="au-dato"><span>NIT</span><strong>{ver.NIT || "— (vendedor informal)"}</strong></div>
                  <div className="au-dato"><span>Ciudad / Departamento</span><strong>{ver.CIUDAD}, {ver.DEPARTAMENTO}</strong></div>
                  {ver.DIRECCION && (
                    <div className="au-dato"><span>Dirección</span><strong className="au-dato-email"><FaMapMarkerAlt />{ver.DIRECCION}</strong></div>
                  )}
                  {ver.CATEGORIAS && (
                    <div className="au-dato"><span>Categorías</span><strong>{ver.CATEGORIAS}</strong></div>
                  )}
                </div>
                {ver.DESCRIPCION && (
                  <>
                    <p className="mt-3 mb-1" style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8" }}>DESCRIPCIÓN DEL NEGOCIO</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", whiteSpace: "pre-wrap" }}>{ver.DESCRIPCION}</p>
                  </>
                )}
              </div>
            </div>

            {ver.ESTADO === "PENDIENTE" && (
              <div className="evidencia-modal-footer">
                <button className="btn btn-success px-3" onClick={() => { const s = ver; setVer(null); procesar(s, "APROBADA"); }}>
                  <FaCheck /> Aprobar y enviar credenciales
                </button>
                <button className="btn btn-outline-danger px-3" onClick={() => { const s = ver; setVer(null); procesar(s, "RECHAZADA"); }}>
                  <FaTimes /> Rechazar
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

export default AdminVendedores;

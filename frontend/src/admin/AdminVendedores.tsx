import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaEye, FaStore } from "react-icons/fa";

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

  useEffect(() => { void fetchSolicitudes(); }, []);

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
            <FaArrowLeft /> Volver al inicio
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
                            <Link className="av-btn-gestionar" to={`/admin/vendedores/${s.ID_SOLICITUD}`}>
                              <FaEye /> Gestionar
                            </Link>
                          ) : (
                            <Link className="av-btn-ver" title="Ver detalle" aria-label="Ver detalle" to={`/admin/vendedores/${s.ID_SOLICITUD}`}>
                              <FaEye />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      <AdminFooter />
    </div>
  );
};

export default AdminVendedores;

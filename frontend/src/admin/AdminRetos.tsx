import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaEye, FaClock, FaCheckCircle, FaChevronDown } from "react-icons/fa";

const AdminRetos = () => {
  const navigate = useNavigate();
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { void fetchEvidencias(); }, []);

  const pendientes = evidencias.filter((e) => e.ESTADO === "pendiente").length;

  const filaEvidencia = (e: any) => (
    <tr key={e.ID_EVIDENCIA} className={e.ESTADO === "pendiente" ? "ad-fila-pend" : ""}>
      <td>
        <div className="tb-ellip tb-strong">{e.USUARIO_NOMBRE} {e.USUARIO_APELLIDO}</div>
        <small className="tb-sub">{e.USUARIO_EMAIL}</small>
      </td>
      <td><span className="tb-ellip tb-strong">{e.RETO_TITULO}</span></td>
      <td>
        <span className="tb-strong">{e.PROGRESO}</span>
        <span className="tb-sub">/{e.META_VALOR} {e.META_TIPO}</span>
      </td>
      <td className="tb-fecha">{new Date(e.FECHA_SUBIDA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
      <td>
        <span className={`badge ${e.ESTADO === "pendiente" ? "bg-warning text-dark" : e.ESTADO === "aprobado" ? "bg-success" : "bg-danger"}`}>
          {e.ESTADO === "pendiente" ? "EN REVISIÓN" : e.ESTADO === "aprobado" ? "APROBADO" : "RECHAZADO"}
        </span>
      </td>
      <td className="text-center">
        <Link className="ad-btn-gestionar" title="Ver avance" to={`/admin/retos/${e.ID_EVIDENCIA}`}>
          <FaEye /> Ver
        </Link>
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
            <div className="ap-tabla-wrap">
              <table className="ap-tabla">
                <thead>
                  <tr>
                    <th style={{ width: "24%" }}>Usuario</th>
                    <th style={{ width: "22%" }}>Reto</th>
                    <th style={{ width: "12%" }}>Progreso</th>
                    <th style={{ width: "18%" }}>Fecha</th>
                    <th style={{ width: "12%" }}>Estado</th>
                    <th style={{ width: "12%", textAlign: "center" }}>Acción</th>
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
              <FaArrowLeft /> Volver al inicio
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

      <AdminFooter />
    </div>
  );
};

export default AdminRetos;

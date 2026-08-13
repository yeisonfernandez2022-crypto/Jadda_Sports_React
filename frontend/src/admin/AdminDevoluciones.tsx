import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaWallet, FaUndoAlt } from "react-icons/fa";

interface Devolucion {
  ID_DEVOLUCION: number;
  ID_USUARIO: number;
  NOMBRE_USUARIO: string;
  EMAIL: string;
  ID_VENTA: number;
  VENTA_TOTAL: number;
  PRODUCTO_NOMBRE: string;
  IMAGEN: string | null;
  CANTIDAD: number;
  MOTIVO: string | null;
  ESTADO: string;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
}

const estadoBadge: Record<string, string> = {
  SOLICITADA: "bg-warning text-dark",
  APROBADA: "bg-success",
  RECHAZADA: "bg-danger",
};

const AdminDevoluciones = () => {
  const navigate = useNavigate();
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState<Devolucion | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "reembolso" | "devolucion">("todos");

  const esReembolso = (d: Devolucion) => !!d.MOTIVO && d.MOTIVO.includes("Reembolso por cancelación");

  const fetchDevoluciones = async () => {
    try {
      const res = await fetch("/api/devoluciones/admin", { credentials: "include" });
      if (res.ok) setDevoluciones(await res.json());
    } catch {
      console.error("Error al cargar devoluciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevoluciones(); }, []);

  const procesar = async (d: Devolucion, estado: "APROBADA" | "RECHAZADA") => {
    const esAprobar = estado === "APROBADA";
    const reembolso = esReembolso(d);
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: esAprobar ? (reembolso ? "¿Aprobar este reembolso?" : "¿Aprobar esta devolución?") : (reembolso ? "¿Rechazar este reembolso?" : "¿Rechazar esta devolución?"),
      html: esAprobar
        ? reembolso
          ? `Se reingresarán <strong>${d.CANTIDAD} unidad(es)</strong> al stock del producto. El dinero <strong>se reembolsará al cliente en un máximo de 7 días</strong> por el método de pago original, y se le notificará.`
          : `Se reingresarán <strong>${d.CANTIDAD} unidad(es)</strong> al stock del producto y se notificará al cliente. El reembolso se gestiona por el método de pago original.`
        : "Se notificará al cliente y no habrá reingreso de stock.",
      showCancelButton: true,
      confirmButtonText: esAprobar ? "Sí, aprobar" : "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: esAprobar ? "#198754" : "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/devoluciones/admin/${d.ID_DEVOLUCION}/procesar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg, timer: 1800, showConfirmButton: false });
        fetchDevoluciones();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al procesar la devolución" });
    }
  };

  const pendientes = devoluciones.filter((d) => d.ESTADO === "SOLICITADA").length;
  const filtradas = devoluciones.filter((d) => {
    if (filtro === "reembolso") return esReembolso(d);
    if (filtro === "devolucion") return !esReembolso(d);
    return true;
  });

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-3">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <h1 className="fw-bold text-dark m-0">Devoluciones y reembolsos</h1>
            <p className="text-muted small m-0">
              {pendientes > 0 ? `${pendientes} solicitud(es) pendientes de revisión` : "Sin solicitudes pendientes"} — al aprobar se reingresa el stock automáticamente (RF-033)
            </p>
            <div className="d-flex gap-2 mt-2">
              {([
                { valor: "todos", label: `Todos (${devoluciones.length})`, icon: null },
                { valor: "reembolso", label: `Reembolsos (${devoluciones.filter((d) => esReembolso(d)).length})`, icon: <FaWallet /> },
                { valor: "devolucion", label: `Devoluciones (${devoluciones.filter((d) => !esReembolso(d)).length})`, icon: <FaUndoAlt /> },
              ] as const).map(({ valor, label, icon }) => (
                <button
                  key={valor}
                  onClick={() => setFiltro(valor)}
                  className={`btn btn-sm ${filtro === valor ? "btn-dark" : "btn-outline-dark"} fw-bold`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando devoluciones...</div>
          ) : devoluciones.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay solicitudes de devolución</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Pedido</th>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Tipo / Motivo</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th className="text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-muted py-4">No hay solicitudes {filtro === "reembolso" ? "de reembolso" : filtro === "devolucion" ? "de devolución" : ""}</td></tr>
                  ) : filtradas.map((d) => (
                    <tr key={d.ID_DEVOLUCION} className={d.ESTADO === "SOLICITADA" ? "table-warning" : ""}>
                      <td className="fw-bold">{d.ID_DEVOLUCION}</td>
                      <td>
                        <div className="fw-bold">{d.NOMBRE_USUARIO}</div>
                        <small className="text-muted">{d.EMAIL}</small>
                      </td>
                      <td className="fw-bold">#{d.ID_VENTA}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {d.IMAGEN && (
                            <img
                              src={d.IMAGEN}
                              alt=""
                              style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6 }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <span className="fw-bold">{d.PRODUCTO_NOMBRE}</span>
                        </div>
                      </td>
                      <td className="fw-bold">{d.CANTIDAD}</td>
                      <td style={{ maxWidth: 260 }}>
                        <div>
                          <span className={`badge ${esReembolso(d) ? "bg-danger" : "bg-secondary"} text-uppercase`}>
                            {esReembolso(d) ? <><FaWallet className="me-1" />Reembolso</> : <><FaUndoAlt className="me-1" />Devolución</>}
                          </span>
                          <span className="d-block text-truncate mt-1" style={{ maxWidth: 240 }} title={d.MOTIVO || ""}>
                            <small className="text-muted">{d.MOTIVO || "—"}</small>
                          </span>
                        </div>
                      </td>
                      <td>{new Date(d.FECHA_CREACION).toLocaleDateString("es-CO")}</td>
                      <td>
                        <span className={`badge ${estadoBadge[d.ESTADO] || "bg-secondary"}`}>{d.ESTADO}</span>
                      </td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-dark me-1" title="Ver detalle" onClick={() => setVer(d)}>
                          <FaEye />
                        </button>
                        {d.ESTADO === "SOLICITADA" ? (
                          <>
                            <button className="btn btn-sm btn-success me-1" title="Aprobar (reingresa stock)" onClick={() => procesar(d, "APROBADA")}>
                              <FaCheck />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" title="Rechazar" onClick={() => procesar(d, "RECHAZADA")}>
                              <FaTimes />
                            </button>
                          </>
                        ) : (
                          <span className="text-muted small">Procesada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {ver && (
        <div className="evidencia-overlay" onClick={() => setVer(null)}>
          <div className="evidencia-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="evidencia-modal-header">
              <div>
                <h5 className="m-0">Devolución #{ver.ID_DEVOLUCION}</h5>
                <small>{ver.PRODUCTO_NOMBRE} — x{ver.CANTIDAD} · Pedido #{ver.ID_VENTA}</small>
              </div>
              <button className="btn-close btn-close-white" onClick={() => setVer(null)} />
            </div>
            <div className="evidencia-modal-body">
              <div className="d-flex align-items-center gap-3 mb-3">
                {ver.IMAGEN && (
                  <img src={ver.IMAGEN} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} />
                )}
                <div>
                  <div className="fw-bold">{ver.NOMBRE_USUARIO}</div>
                  <small className="text-muted">{ver.EMAIL}</small>
                  <div>
                    <span className={`badge ${estadoBadge[ver.ESTADO] || "bg-secondary"}`}>{ver.ESTADO}</span>
                  </div>
                </div>
              </div>
              <p className="mb-1"><strong>Motivo:</strong></p>
              <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>{ver.MOTIVO || "Sin motivo especificado"}</p>
              <small className="text-muted">
                Solicitada: {new Date(ver.FECHA_CREACION).toLocaleString("es-CO")}
                {ver.FECHA_PROCESADA && <> · Procesada: {new Date(ver.FECHA_PROCESADA).toLocaleString("es-CO")}</>}
              </small>
            </div>
            {ver.ESTADO === "SOLICITADA" && (
              <div className="evidencia-modal-footer">
                <button className="btn btn-success px-4" onClick={() => { procesar(ver, "APROBADA"); setVer(null); }}>
                  <FaCheck className="me-1" /> Aprobar y reingresar stock
                </button>
                <button className="btn btn-outline-danger px-4" onClick={() => { procesar(ver, "RECHAZADA"); setVer(null); }}>
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

export default AdminDevoluciones;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaWallet, FaUndoAlt, FaImage, FaSearchPlus } from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";

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
  DESCRIPCION: string | null;
  TIPO: string | null;
  OBSERVACION: string | null;
  ESTADO: string;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
  EVIDENCIAS: string | null;
}

const estadoBadge: Record<string, string> = {
  SOLICITADA: "bg-warning text-dark",
  MAS_PRUEBAS: "bg-info text-dark",
  APROBADA: "bg-success",
  RECHAZADA: "bg-danger",
};

const estadoTexto: Record<string, string> = {
  SOLICITADA: "En revisión",
  MAS_PRUEBAS: "Pide más pruebas",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const AdminDevoluciones = () => {
  const navigate = useNavigate();
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState<Devolucion | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "reembolso" | "devolucion">("todos");

  const esReembolso = (d: Devolucion) =>
    d.TIPO === "REEMBOLSO" || (!!d.MOTIVO && d.MOTIVO.includes("Reembolso por cancelación"));

  const evidenciasDe = (d: Devolucion): string[] =>
    d.EVIDENCIAS ? d.EVIDENCIAS.split("|").filter(Boolean) : [];

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

  const procesar = async (d: Devolucion, decision: "devolver" | "reembolsar" | "mas_pruebas" | "rechazar") => {
    const labels: Record<string, { titulo: string; html: string; btn: string; color: string }> = {
      devolver: {
        titulo: "¿Aceptar esta devolución?",
        html: `Se reingresarán <strong>${d.CANTIDAD} unidad(es)</strong> al stock del producto y se notificará al cliente. El reembolso se gestiona por el método de pago original.`,
        btn: "Sí, aceptar devolución",
        color: "#198754",
      },
      reembolsar: {
        titulo: "¿Reembolsar sin devolver?",
        html: `El cliente <strong>no envía el producto</strong>. El dinero <strong>se reembolsará en un máximo de 7 días</strong> por el método de pago original. NO se reingresa stock.`,
        btn: "Sí, reembolsar",
        color: "#0d6efd",
      },
      mas_pruebas: {
        titulo: "¿Pedir más pruebas?",
        html: "Se pedirá al cliente más evidencias. La solicitud vuelve a revisión cuando las adjunte.",
        btn: "Sí, pedir más pruebas",
        color: "#ffc107",
      },
      rechazar: {
        titulo: "¿Rechazar esta solicitud?",
        html: "Se notificará al cliente y no habrá reingreso de stock.",
        btn: "Sí, rechazar",
        color: "#dc3545",
      },
    };
    const l = labels[decision];

    let observacion: string | undefined;
    if (decision === "mas_pruebas" || decision === "rechazar") {
      const { value } = await Swal.fire({
        icon: "question",
        title: l.titulo,
        html: l.html,
        input: "textarea",
        inputLabel: "Observación para el cliente (opcional)",
        inputPlaceholder: "Ej: necesitamos fotos del empaque y la factura...",
        inputValidator: (v) => {
          if (v && v.trim().length > 500) return "Máximo 500 caracteres";
          return undefined;
        },
        showCancelButton: true,
        confirmButtonText: l.btn,
        cancelButtonText: "Cancelar",
        confirmButtonColor: l.color,
        cancelButtonColor: "#6c757d",
      });
      if (!value) return;
      observacion = (value as string).trim() || undefined;
    } else {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: l.titulo,
        html: l.html,
        showCancelButton: true,
        confirmButtonText: l.btn,
        cancelButtonText: "Cancelar",
        confirmButtonColor: l.color,
        cancelButtonColor: "#6c757d",
      });
      if (!isConfirmed) return;
    }

    try {
      const res = await fetch(`/api/devoluciones/admin/${d.ID_DEVOLUCION}/procesar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision, observacion }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg, timer: 1800, showConfirmButton: false });
        setVer(null);
        fetchDevoluciones();
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al procesar la solicitud" });
    }
  };

  const pendientes = devoluciones.filter((d) => ["SOLICITADA", "MAS_PRUEBAS"].includes(d.ESTADO)).length;
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
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al Dashboard
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Devoluciones y reembolsos" }]} />
            <div className="au-titulos">
              <h1>Devoluciones y reembolsos</h1>
              <p>
                {pendientes > 0 ? `${pendientes} solicitud(es) pendientes de revisión` : "Sin solicitudes pendientes"} — al aceptar una devolución se reingresa el stock automáticamente (RF-033)
              </p>
            </div>
          </div>
          <div className="d-flex gap-2 mt-3">
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

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando devoluciones...</div>
          ) : devoluciones.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay solicitudes de devolución</div>
          ) : (
            <div className="ad-tabla-wrap bg-white rounded shadow-sm border">
              <table className="ad-tabla">
                <thead>
                  <tr>
                    <th className="ad-col-cliente">Cliente</th>
                    <th className="ad-col-pedido">Pedido</th>
                    <th className="ad-col-producto">Producto</th>
                    <th className="ad-col-tipo">Tipo / Motivo</th>
                    <th className="ad-col-estado">Estado</th>
                    <th className="ad-col-accion">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="ad-vacio">
                        No hay solicitudes {filtro === "reembolso" ? "de reembolso" : filtro === "devolucion" ? "de devolución" : ""}
                      </td>
                    </tr>
                  ) : filtradas.map((d) => (
                    <tr key={d.ID_DEVOLUCION} className={d.ESTADO === "SOLICITADA" ? "ad-fila-pend" : d.ESTADO === "MAS_PRUEBAS" ? "ad-fila-pruebas" : ""}>
                      <td>
                        <div className="ad-cliente">{d.NOMBRE_USUARIO}</div>
                        <small className="ad-mail">{d.EMAIL}</small>
                      </td>
                      <td className="ad-pedido">{numeroPedido(d.ID_VENTA)}</td>
                      <td>
                        <div className="ad-prod">
                          {d.IMAGEN && (
                            <img
                              src={d.IMAGEN}
                              alt=""
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <span className="ad-prod-nombre" title={d.PRODUCTO_NOMBRE}>{d.PRODUCTO_NOMBRE}</span>
                          <span className="ad-prod-cant">×{d.CANTIDAD}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`ad-badge-tipo ${esReembolso(d) ? "ad-tipo-reembolso" : "ad-tipo-devolucion"}`}>
                          {esReembolso(d) ? <><FaWallet className="me-1" />Reembolso</> : <><FaUndoAlt className="me-1" />Devolución</>}
                        </span>
                        {d.MOTIVO && <div className="ad-motivo" title={d.MOTIVO}>{d.MOTIVO}</div>}
                      </td>
                      <td>
                        <span className={`badge ${estadoBadge[d.ESTADO] || "bg-secondary"}`}>{estadoTexto[d.ESTADO] || d.ESTADO}</span>
                      </td>
                      <td className="ad-accion">
                        <button className="ad-btn-gestionar" onClick={() => setVer(d)}>
                          <FaEye /> Gestionar
                        </button>
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
          <div className="evidencia-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="evidencia-modal-header">
              <div>
                <h5 className="m-0">Solicitud #{ver.ID_DEVOLUCION}</h5>
                <small>{ver.PRODUCTO_NOMBRE} — x{ver.CANTIDAD} · Pedido {numeroPedido(ver.ID_VENTA)}</small>
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
                  <div className="d-flex gap-2 mt-1">
                    <span className={`badge ${esReembolso(ver) ? "bg-danger" : "bg-secondary"}`}>
                      {esReembolso(ver) ? "REEMBOLSO" : "DEVOLUCIÓN"}
                    </span>
                    <span className={`badge ${estadoBadge[ver.ESTADO] || "bg-secondary"}`}>{estadoTexto[ver.ESTADO] || ver.ESTADO}</span>
                  </div>
                </div>
              </div>

              <p className="mb-1"><strong>Motivo:</strong></p>
              <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>{ver.MOTIVO || "Sin motivo especificado"}</p>

              {ver.DESCRIPCION && (
                <>
                  <p className="mb-1"><strong>Descripción del cliente:</strong></p>
                  <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>{ver.DESCRIPCION}</p>
                </>
              )}

              {ver.OBSERVACION && (
                <div className="alert alert-info py-2 small mb-3">
                  <strong>Tu observación:</strong> {ver.OBSERVACION}
                </div>
              )}

              {evidenciasDe(ver).length > 0 && (
                <>
                  <p className="mb-2"><strong>Evidencias del cliente ({evidenciasDe(ver).length}):</strong></p>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {evidenciasDe(ver).map((url, i) => {
                      const esVideo = /\.(mp4|webm|mov)$/i.test(url);
                      return esVideo ? (
                        <video key={i} src={url} controls preload="metadata" style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 8, background: "#0f172a" }} />
                      ) : (
                        <a key={i} href={url} target="_blank" rel="noreferrer" title="Ver imagen completa">
                          <img src={url} alt={`Evidencia ${i + 1}`} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        </a>
                      );
                    })}
                  </div>
                  {evidenciasDe(ver).some(u => !/\.(mp4|webm|mov)$/i.test(u)) && (
                    <small className="text-muted d-block mb-2"><FaSearchPlus className="me-1" />Haz clic en una foto para verla completa</small>
                  )}
                </>
              )}

              <small className="text-muted">
                Solicitada: {new Date(ver.FECHA_CREACION).toLocaleString("es-CO")}
                {ver.FECHA_PROCESADA && <> · Procesada: {new Date(ver.FECHA_PROCESADA).toLocaleString("es-CO")}</>}
              </small>
            </div>
            {["SOLICITADA", "MAS_PRUEBAS"].includes(ver.ESTADO) && (
              <div className="evidencia-modal-footer">
                <button className="btn btn-success px-3" onClick={() => procesar(ver, "devolver")}>
                  <FaCheck className="me-1" /> Aceptar devolución
                </button>
                <button className="btn btn-primary px-3" onClick={() => procesar(ver, "reembolsar")}>
                  <FaWallet className="me-1" /> Reembolsar sin devolver
                </button>
                <button className="btn btn-warning text-dark px-3" onClick={() => procesar(ver, "mas_pruebas")}>
                  <FaImage className="me-1" /> Pedir más pruebas
                </button>
                <button className="btn btn-outline-danger px-3" onClick={() => procesar(ver, "rechazar")}>
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
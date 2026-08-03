import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaChevronDown, FaChevronUp, FaArrowLeft } from "react-icons/fa";

const estados = ["PENDIENTE", "CONFIRMADA", "ENVIADA", "COMPLETADA", "CANCELADA"];

const estadosEnvio = [
  { valor: "PENDIENTE", etiqueta: "Pendiente" },
  { valor: "POR_EMPAQUETAR", etiqueta: "Por empaquetar" },
  { valor: "EMPACADO", etiqueta: "Empacado" },
  { valor: "EN_CAMINO", etiqueta: "En camino" },
  { valor: "ENTREGADO", etiqueta: "Entregado" },
  { valor: "CANCELADO", etiqueta: "Cancelado" },
];

const badgeEnvio = (estado: string) => {
  switch (estado) {
    case "ENTREGADO": return <span className="badge bg-success">{estado}</span>;
    case "EN_CAMINO": return <span className="badge bg-primary">{estado}</span>;
    case "EMPACADO": return <span className="badge bg-info text-dark">{estado}</span>;
    case "CANCELADO": return <span className="badge bg-danger">{estado}</span>;
    case "POR_EMPAQUETAR": return <span className="badge bg-secondary">{estado}</span>;
    default: return <span className="badge bg-warning text-dark">{estado || "PENDIENTE"}</span>;
  }
};

const AdminOrdenes = () => {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);

  const fetchOrdenes = async () => {
    try {
      const res = await fetch("/api/admin/compras", { credentials: "include" });
      const data = await res.json();
      setOrdenes(data);
    } catch {
      console.error("Error al cargar órdenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrdenes(); }, []);

  const cambiarEstado = async (id: number, estado: string) => {
    try {
      const res = await fetch(`/api/admin/compras/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado })
      });
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Estado actualizado", timer: 1500, showConfirmButton: false });
        fetchOrdenes();
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al actualizar" });
    }
  };

  const cambiarEstadoEnvio = async (id: number, estado_envio: string) => {
    try {
      const res = await fetch(`/api/admin/compras/${id}/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado_envio })
      });
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Envío actualizado", timer: 1500, showConfirmButton: false });
        fetchOrdenes();
      } else {
        Swal.fire({ icon: "warning", title: "No se pudo actualizar el envío" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al actualizar el envío" });
    }
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-2">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <h1 className="fw-bold text-dark m-0">Órdenes</h1>
            <p className="text-muted small m-0">Gestiona las órdenes de compra</p>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando órdenes...</div>
          ) : ordenes.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay órdenes registradas</div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-secondary">
                  <tr>
                    <th style={{ width: "40px" }}></th>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Envío</th>
                    <th className="text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((orden) => (
                    <React.Fragment key={orden.ID_VENTA}>
                      <tr>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-secondary border-0"
                            onClick={() => setExpandida(expandida === orden.ID_VENTA ? null : orden.ID_VENTA)}
                          >
                            {expandida === orden.ID_VENTA ? <FaChevronUp /> : <FaChevronDown />}
                          </button>
                        </td>
                        <td className="fw-bold">#{orden.ID_VENTA}</td>
                        <td>{orden.NOMBRE_USUARIO} {orden.APELLIDO_USUARIO}<br /><small className="text-muted">{orden.EMAIL}</small></td>
                        <td className="small">{new Date(orden.FECHA_VENTA).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="fw-bold">${Number(orden.TOTAL).toLocaleString()}</td>
                        <td><span className="badge bg-info">{orden.METODO_PAGO || "N/A"}</span></td>
                        <td>
                          <span className={`badge ${orden.ESTADO === "COMPLETADA" ? "bg-success" : orden.ESTADO === "CANCELADA" ? "bg-danger" : orden.ESTADO === "ENVIADA" ? "bg-primary" : "bg-warning text-dark"}`}>
                            {orden.ESTADO}
                          </span>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm d-inline-block"
                            style={{ width: "auto" }}
                            value={orden.ESTADO_ENVIO || "PENDIENTE"}
                            onChange={(e) => cambiarEstadoEnvio(orden.ID_VENTA, e.target.value)}
                          >
                            {estadosEnvio.map((est) => (
                              <option key={est.valor} value={est.valor}>{est.etiqueta}</option>
                            ))}
                          </select>
                          <div className="mt-1">{badgeEnvio(orden.ESTADO_ENVIO || "PENDIENTE")}</div>
                        </td>
                        <td className="text-center">
                          <select
                            className="form-select form-select-sm d-inline-block"
                            style={{ width: "auto" }}
                            value={orden.ESTADO}
                            onChange={(e) => cambiarEstado(orden.ID_VENTA, e.target.value)}
                          >
                            {estados.map((est) => (
                              <option key={est} value={est}>{est}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                      {expandida === orden.ID_VENTA && (
                        <tr key={`detalle-${orden.ID_VENTA}`}>
                          <td colSpan={9} className="bg-light p-3">
                            <div className="row g-2">
                              {orden.productos?.map((prod: any) => (
                                <div key={prod.ID} className="col-md-4">
                                  <div className="d-flex align-items-center gap-2 p-2 bg-white rounded border">
                                    <img
                                      src={prod.IMAGEN || "https://via.placeholder.com/50"}
                                      alt={prod.NOMBRE}
                                      style={{ width: "40px", height: "40px", objectFit: "cover" }}
                                      className="rounded"
                                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                                    />
                                    <div className="small">
                                      <div className="fw-bold">{prod.NOMBRE}</div>
                                      <div className="text-muted">x{prod.CANTIDAD} — ${Number(prod.SUBTOTAL).toLocaleString()}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {orden.DIRECCION_ENVIO && (
                                <div className="col-12 mt-2">
                                  <small className="text-muted">
                                    <strong>Envío:</strong> {orden.DIRECCION_ENVIO}, {orden.CIUDAD}{orden.DEPARTAMENTO ? `, ${orden.DEPARTAMENTO}` : ""}
                                  </small>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminOrdenes;

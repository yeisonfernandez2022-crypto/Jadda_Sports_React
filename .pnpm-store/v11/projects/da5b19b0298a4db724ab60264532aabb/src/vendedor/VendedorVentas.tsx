import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaShoppingCart, FaArrowLeft, FaTruck, FaHourglassStart, FaClipboardCheck,
  FaBoxOpen, FaShippingFast, FaCheckCircle, FaTimesCircle, FaMapMarkerAlt,
  FaCity, FaPhone, FaHome,
} from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

const formatear = (n: number | string | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("es-CO");

const estadosVenta = ["PENDIENTE", "CONFIRMADA", "ENVIADA", "COMPLETADA", "CANCELADA"];

const pasosEnvio = [
  { valor: "PENDIENTE", etiqueta: "Pendiente", icono: FaHourglassStart },
  { valor: "POR_EMPAQUETAR", etiqueta: "Por empaquetar", icono: FaClipboardCheck },
  { valor: "EMPACADO", etiqueta: "Empacado", icono: FaBoxOpen },
  { valor: "EN_CAMINO", etiqueta: "En camino", icono: FaShippingFast },
  { valor: "ENTREGADO", etiqueta: "Entregado", icono: FaCheckCircle },
];

const claseVenta = (e: string) => {
  const map: Record<string, string> = {
    COMPLETADA: "completada",
    PENDIENTE: "pendiente",
    CANCELADA: "cancelada",
    CONFIRMADA: "confirmada",
    ENVIADA: "enviada",
  };
  return map[e] || "pendiente";
};

const indiceEnvio = (est?: string | null) => {
  if (!est || est === "CANCELADO") return -1;
  return pasosEnvio.findIndex((p) => p.valor === est);
};

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const VendedorVentas = () => {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<number | null>(null);

  const cargarVentas = () => {
    fetch("/api/vendedor/ventas", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setVentas)
      .catch(() => setVentas([]))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargarVentas(); }, []);

  const actualizarEnvio = async (idVenta: number, estado_envio: string) => {
    if (procesando !== null) return;
    if (estado_envio === "CANCELADO") {
      const r = await Swal.fire({
        title: "¿Cancelar el envío?",
        text: "El envío quedará cancelado para esta orden.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, cancelar",
        cancelButtonText: "Volver",
        confirmButtonColor: "#d33",
        reverseButtons: true,
      });
      if (!r.isConfirmed) return;
    }
    setProcesando(idVenta);
    try {
      const res = await fetch(`/api/vendedor/ventas/${idVenta}/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado_envio }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.sinCambios) {
        Swal.fire({ icon: "success", title: "Envío actualizado", timer: 1500, showConfirmButton: false });
      }
      if (!res.ok) {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo actualizar el envío" });
      }
      cargarVentas();
    } catch {
      Swal.fire({ icon: "error", title: "Error al actualizar el envío" });
    } finally {
      setProcesando(null);
    }
  };

  const cambiarEstadoVenta = async (idVenta: number, estado: string) => {
    if (procesando !== null) return;
    if (estado === "CANCELADA") {
      const r = await Swal.fire({
        title: "¿Cancelar la venta?",
        text: "La orden quedará marcada como cancelada.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, cancelar",
        cancelButtonText: "Volver",
        confirmButtonColor: "#d33",
        reverseButtons: true,
      });
      if (!r.isConfirmed) return;
    }
    setProcesando(idVenta);
    try {
      const res = await fetch(`/api/vendedor/ventas/${idVenta}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.sinCambios) {
        Swal.fire({ icon: "success", title: "Estado actualizado", timer: 1500, showConfirmButton: false });
      }
      if (!res.ok) {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo actualizar el estado" });
      }
      cargarVentas();
    } catch {
      Swal.fire({ icon: "error", title: "Error al actualizar el estado" });
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="admin-volver" onClick={() => navigate("/vendedor")}>
            <FaArrowLeft /> Volver al Dashboard
          </button>
          <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Mis ventas" }]} />
          <div className="au-titulos">
            <h1>Mis ventas</h1>
            <p>{ventas.length} pedido(s) con productos tuyos · actualiza el estado del envío desde aquí</p>
          </div>
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando ventas…</div>
        ) : ventas.length === 0 ? (
          <div className="ven-vacio">
            <FaShoppingCart />
            <div>Aún no tienes ventas. Cuando alguien compre tus productos aparecerán aquí.</div>
          </div>
        ) : (
          ventas.map((v) => {
            const idxEnvio = indiceEnvio(v.ESTADO_ENVIO);
            const siguiente = idxEnvio >= 0 && idxEnvio < pasosEnvio.length - 1 ? pasosEnvio[idxEnvio + 1] : null;
            return (
              <div key={v.ID_VENTA} className="ven-venta-card">
                <div className="ven-venta-head">
                  <div>
                    <strong>Pedido #{v.ID_VENTA}</strong>
                    <div className="ven-venta-meta">
                      <span>👤 {v.CLIENTE || "Cliente"}</span>
                      <span>📅 {new Date(v.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</span>
                      <span>💳 {v.REFERENCIA_PAGO}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`ven-badge-venta ${claseVenta(v.ESTADO)}`}>{v.ESTADO}</span>
                    <span className="ven-venta-total">{formatear(v.TOTAL)}</span>
                  </div>
                </div>

                <div className="ven-venta-items">
                  {v.items.map((it: any, i: number) => (
                    <div key={i} className="ven-venta-item">
                      <img src={it.IMAGEN || PLACEHOLDER_IMG} alt={it.NOMBRE} />
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{it.NOMBRE}</span>
                      {it.COLOR && <span className="ven-chip">Color: {it.COLOR}</span>}
                      {it.ATRIBUTO && <span className="ven-chip">{it.NOMBRE_ATRIBUTO}: {it.ATRIBUTO}</span>}
                      <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>x{it.CANTIDAD} · {formatear(it.SUBTOTAL)}</span>
                    </div>
                  ))}
                </div>

                {/* ===== GESTIÓN DEL ENVÍO (como en AdminOrdenes) ===== */}
                <div className="ven-envio-gestion">
                  <div className="ao-detalle-titulo"><FaTruck /> Estado del envío</div>
                  {v.ESTADO_ENVIO === "CANCELADO" ? (
                    <div className="ao-envio-cancelado"><FaTimesCircle /> Este envío fue cancelado</div>
                  ) : (
                    <div className="ao-stepper ven-stepper">
                      {pasosEnvio.map((paso, i) => {
                        const Icono = paso.icono;
                        const hecho = i < idxEnvio;
                        const activo = i === idxEnvio;
                        return (
                          <button
                            key={paso.valor}
                            className={`ao-step ${hecho ? "hecho" : ""} ${activo ? "activo" : ""}`}
                            onClick={() => actualizarEnvio(v.ID_VENTA, paso.valor)}
                            title={`Marcar como ${paso.etiqueta}`}
                            disabled={procesando === v.ID_VENTA}
                          >
                            <span className="ao-step-circulo">{hecho ? <FaCheckCircle /> : <Icono />}</span>
                            <span className="ao-step-etiqueta">{paso.etiqueta}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {siguiente && v.ESTADO_ENVIO !== "CANCELADO" && (
                    <button
                      className="ao-btn-avanzar"
                      onClick={() => actualizarEnvio(v.ID_VENTA, siguiente.valor)}
                      disabled={procesando === v.ID_VENTA}
                    >
                      <FaShippingFast /> {procesando === v.ID_VENTA ? "Actualizando..." : `Avanzar: marcar como ${siguiente.etiqueta.toLowerCase()}`}
                    </button>
                  )}

                  {(v.DIRECCION_ENVIO || v.CIUDAD || v.TELEFONO_CONTACTO) && (
                    <div className="ao-envio-info">
                      {v.DIRECCION_ENVIO && (
                        <div className="ao-info-fila"><FaHome /> <span><strong>{v.DIRECCION_ENVIO}</strong>{v.BARRIO ? ` · ${v.BARRIO}` : ""}</span></div>
                      )}
                      {(v.CIUDAD || v.DEPARTAMENTO) && (
                        <div className="ao-info-fila"><FaCity /> <span>{[v.CIUDAD, v.DEPARTAMENTO].filter(Boolean).join(", ")}</span></div>
                      )}
                      {v.TELEFONO_CONTACTO && (
                        <div className="ao-info-fila"><FaPhone /> <span>{v.TELEFONO_CONTACTO}</span></div>
                      )}
                      {v.OBSERVACIONES && (
                        <div className="ao-info-fila observacion"><FaMapMarkerAlt /> <span>{v.OBSERVACIONES}</span></div>
                      )}
                    </div>
                  )}

                  <div className="ao-detalle-acciones">
                    <div className="ao-accion-estado">
                      <label>Estado de la venta</label>
                      <select
                        className="form-select form-select-sm"
                        value={v.ESTADO}
                        disabled={procesando === v.ID_VENTA}
                        onChange={(e) => cambiarEstadoVenta(v.ID_VENTA, e.target.value)}
                      >
                        {estadosVenta.map((est) => <option key={est} value={est}>{est}</option>)}
                      </select>
                    </div>
                    <div className="ao-accion-botones">
                      {v.ESTADO_ENVIO !== "CANCELADO" && v.ESTADO_ENVIO !== "ENTREGADO" && (
                        <button
                          className="ao-btn-cancelar"
                          onClick={() => actualizarEnvio(v.ID_VENTA, "CANCELADO")}
                          disabled={procesando === v.ID_VENTA}
                        >
                          Cancelar envío
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorVentas;

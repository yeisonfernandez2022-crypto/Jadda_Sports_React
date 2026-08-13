import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import {
  FaChevronDown, FaChevronUp, FaFilePdf, FaSearch, FaTruck, FaMapMarkerAlt,
  FaPhone, FaEnvelope, FaCity, FaCheckCircle, FaTimesCircle, FaBoxes,
  FaTag, FaPalette, FaCalendarAlt, FaHourglassStart, FaBoxOpen,
  FaShippingFast, FaClipboardCheck, FaHome, FaHashtag, FaMoneyBillWave, FaArrowLeft, FaUser,
} from "react-icons/fa";

const estadosVenta = ["PENDIENTE", "CONFIRMADA", "ENVIADA", "COMPLETADA", "CANCELADA"];

const pasosEnvio = [
  { valor: "PENDIENTE", etiqueta: "Pendiente", icono: FaHourglassStart, desc: "Orden recibida" },
  { valor: "POR_EMPAQUETAR", etiqueta: "Por empaquetar", icono: FaClipboardCheck, desc: "Preparando el paquete" },
  { valor: "EMPACADO", etiqueta: "Empacado", icono: FaBoxOpen, desc: "Paquete listo" },
  { valor: "EN_CAMINO", etiqueta: "En camino", icono: FaShippingFast, desc: "Con el transportador" },
  { valor: "ENTREGADO", etiqueta: "Entregado", icono: FaCheckCircle, desc: "Entregado al cliente" },
];

const claseVenta = (estado: string) => {
  switch (estado) {
    case "COMPLETADA": return "ao-bv-completada";
    case "CANCELADA": return "ao-bv-cancelada";
    case "ENVIADA": return "ao-bv-enviada";
    case "CONFIRMADA": return "ao-bv-confirmada";
    default: return "ao-bv-pendiente";
  }
};

const claseEnvio = (estado: string) => {
  switch (estado) {
    case "ENTREGADO": return "ao-be-entregado";
    case "EN_CAMINO": return "ao-be-en-camino";
    case "EMPACADO": return "ao-be-empacado";
    case "POR_EMPAQUETAR": return "ao-be-por-empaquetar";
    case "CANCELADO": return "ao-be-cancelado";
    default: return "ao-be-pendiente";
  }
};

const formatearFecha = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const formatearFechaSola = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

const AdminOrdenes = () => {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVenta, setFiltroVenta] = useState("");
  const [filtroEnvio, setFiltroEnvio] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [pagina, setPagina] = useState(1);
  const [procesandoEnvio, setProcesandoEnvio] = useState<number | null>(null);
  const POR_PAGINA = 10;

  const fetchOrdenes = async () => {
    try {
      const res = await fetch("/api/admin/compras", { credentials: "include" });
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error al cargar órdenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrdenes(); }, []);

  const kpis = useMemo(() => {
    const k = { total: ordenes.length, pendientes: 0, enCamino: 0, entregadas: 0, canceladas: 0 };
    for (const o of ordenes) {
      if (o.ESTADO === "CANCELADA") k.canceladas++;
      if (o.ESTADO_ENVIO === "EN_CAMINO") k.enCamino++;
      if (o.ESTADO_ENVIO === "ENTREGADO") k.entregadas++;
      if (o.ESTADO === "PENDIENTE") k.pendientes++;
    }
    return k;
  }, [ordenes]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const corte = filtroFecha === "7" ? Date.now() - 7 * 86400000 : filtroFecha === "30" ? Date.now() - 30 * 86400000 : 0;
    return ordenes.filter((o) => {
      if (q) {
        const text = `${o.ID_VENTA} ${o.NOMBRE_USUARIO || ""} ${o.APELLIDO_USUARIO || ""} ${o.EMAIL || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (filtroVenta && o.ESTADO !== filtroVenta) return false;
      if (filtroEnvio && (o.ESTADO_ENVIO || "PENDIENTE") !== filtroEnvio) return false;
      if (corte && new Date(o.FECHA_VENTA).getTime() < corte) return false;
      return true;
    });
  }, [ordenes, busqueda, filtroVenta, filtroEnvio, filtroFecha]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  useEffect(() => { setPagina(1); }, [busqueda, filtroVenta, filtroEnvio, filtroFecha]);

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
    if (procesandoEnvio !== null) return;
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
    setProcesandoEnvio(id);
    try {
      const res = await fetch(`/api/admin/compras/${id}/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado_envio })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (!data.sinCambios) {
          Swal.fire({ icon: "success", title: "Envío actualizado", timer: 1500, showConfirmButton: false });
        }
        fetchOrdenes();
      } else {
        Swal.fire({ icon: "warning", title: "No se pudo actualizar el envío" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al actualizar el envío" });
    } finally {
      setProcesandoEnvio(null);
    }
  };

  const descargarFactura = (id: number) => {
    const w = window.open(`/api/admin/compras/${id}/factura`, "_blank");
    if (w) w.focus();
  };

  const kpiCards = [
    { etiqueta: "Órdenes totales", valor: kpis.total, icono: FaHashtag, clase: "ao-kpi-total", onClick: () => { setFiltroVenta(""); setFiltroEnvio(""); } },
    { etiqueta: "Pendientes", valor: kpis.pendientes, icono: FaHourglassStart, clase: "ao-kpi-pendientes", onClick: () => setFiltroVenta("PENDIENTE") },
    { etiqueta: "En camino", valor: kpis.enCamino, icono: FaTruck, clase: "ao-kpi-en-camino", onClick: () => setFiltroEnvio("EN_CAMINO") },
    { etiqueta: "Entregadas", valor: kpis.entregadas, icono: FaCheckCircle, clase: "ao-kpi-entregadas", onClick: () => setFiltroEnvio("ENTREGADO") },
    { etiqueta: "Canceladas", valor: kpis.canceladas, icono: FaTimesCircle, clase: "ao-kpi-canceladas", onClick: () => setFiltroVenta("CANCELADA") },
  ];

  const indiceEnvio = (o: any) => {
    const est = o.ESTADO_ENVIO || "PENDIENTE";
    if (est === "CANCELADO") return -1;
    return pasosEnvio.findIndex((p) => p.valor === est);
  };

  const siguientePaso = (o: any) => {
    const i = indiceEnvio(o);
    if (i < 0 || i >= pasosEnvio.length - 1) return null;
    return pasosEnvio[i + 1];
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="mb-3">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <h1 className="fw-bold text-dark m-0">Órdenes</h1>
            <p className="text-muted small m-0">Gestiona las órdenes, envíos y entregas de la tienda</p>
          </div>

          <div className="ao-kpis">
            {kpiCards.map((k) => {
              const Icono = k.icono;
              return (
                <button key={k.etiqueta} className={`ao-kpi ${k.clase}`} onClick={k.onClick} title="Filtrar por este estado">
                  <div className="ao-kpi-icono"><Icono /></div>
                  <div className="ao-kpi-info">
                    <span className="ao-kpi-valor">{k.valor}</span>
                    <span className="ao-kpi-etiqueta">{k.etiqueta}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <FaSearch />
              <input
                placeholder="Buscar por # orden, cliente o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select className="ap-filtro" value={filtroVenta} onChange={(e) => setFiltroVenta(e.target.value)}>
              <option value="">Estado: todos</option>
              {estadosVenta.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select className="ap-filtro" value={filtroEnvio} onChange={(e) => setFiltroEnvio(e.target.value)}>
              <option value="">Envío: todos</option>
              {pasosEnvio.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
              <option value="CANCELADO">Cancelado</option>
            </select>
            <select className="ap-filtro" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}>
              <option value="">Todas las fechas</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
            <div className="ap-count"><FaBoxes /> {filtradas.length} órdenes</div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando órdenes...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-5 text-muted">No hay órdenes con estos filtros</div>
          ) : (
            <>
              <div className="ap-tabla-wrap">
                <table className="ap-tabla ao-tabla">
                  <thead>
                    <tr>
                      <th style={{ width: "36px" }}></th>
                      <th>Orden</th>
                      <th>Cliente</th>
                      <th>Artículos</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Envío</th>
                      <th className="text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((orden) => {
                      const idxEnvio = indiceEnvio(orden);
                      const siguiente = siguientePaso(orden);
                      const esExpandida = expandida === orden.ID_VENTA;
                      return (
                        <React.Fragment key={orden.ID_VENTA}>
                          <tr className={`ao-fila ${esExpandida ? "abierta" : ""}`}>
                            <td>
                              <button
                                className="ao-toggle"
                                onClick={() => setExpandida(esExpandida ? null : orden.ID_VENTA)}
                                title={esExpandida ? "Cerrar detalle" : "Ver detalle"}
                              >
                                {esExpandida ? <FaChevronUp /> : <FaChevronDown />}
                              </button>
                            </td>
                            <td>
                              <div className="ao-orden-id">#{orden.ID_VENTA}</div>
                              <div className="ao-orden-fecha"><FaCalendarAlt /> {formatearFecha(orden.FECHA_VENTA)}</div>
                            </td>
                            <td>
                              <div className="ao-cliente-nombre"><FaUser /> {orden.NOMBRE_USUARIO} {orden.APELLIDO_USUARIO}</div>
                              <div className="ao-cliente-mail"><FaEnvelope /> {orden.EMAIL}</div>
                            </td>
                            <td>
                              <span className="ao-articulos">{orden.TOTAL_ARTICULOS} art.</span>
                              <span className="ao-unidades">· {orden.TOTAL_UNIDADES} uds</span>
                            </td>
                            <td>
                              <div className="ao-total">${Number(orden.TOTAL).toLocaleString()}</div>
                              <div className="ao-metodo">{orden.METODO_PAGO || "N/A"}</div>
                            </td>
                            <td><span className={`ao-badge-venta ${claseVenta(orden.ESTADO)}`}>{orden.ESTADO}</span></td>
                            <td>
                              <span className={`ao-badge-envio ${claseEnvio(orden.ESTADO_ENVIO || "PENDIENTE")}`}>
                                <FaTruck /> {orden.ESTADO_ENVIO || "PENDIENTE"}
                              </span>
                            </td>
                            <td className="text-center">
                              <button className="ao-btn-gestionar" onClick={() => setExpandida(esExpandida ? null : orden.ID_VENTA)}>
                                {esExpandida ? "Cerrar" : "Gestionar"}
                              </button>
                            </td>
                          </tr>
                          {esExpandida && (
                            <tr className="ao-detalle-row">
                              <td colSpan={8} className="ao-detalle-celda">
                                <div className="ao-detalle">
                                  <div className="ao-detalle-izq">
                                    <div className="ao-detalle-titulo"><FaBoxes /> Artículos ({orden.TOTAL_ARTICULOS})</div>
                                    <div className="ao-prods">
                                      {orden.productos?.map((prod: any, i: number) => (
                                        <div className="ao-prod" key={`${prod.ID}-${i}`}>
                                          <img
                                            src={prod.IMAGEN || "https://placehold.co/400x400?text=JADDA"}
                                            alt={prod.NOMBRE}
                                            onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400?text=JADDA"; }}
                                          />
                                          <div className="ao-prod-info">
                                            <div className="ao-prod-nombre">{prod.NOMBRE}</div>
                                            {(prod.COLOR || (prod.NOMBRE_ATRIBUTO && prod.ATRIBUTO)) && (
                                              <div className="ao-prod-variantes">
                                                {prod.COLOR && <span className="ao-chip-var"><FaPalette /> {prod.COLOR}</span>}
                                                {prod.NOMBRE_ATRIBUTO && prod.ATRIBUTO && <span className="ao-chip-var"><FaTag /> {prod.NOMBRE_ATRIBUTO}: {prod.ATRIBUTO}</span>}
                                              </div>
                                            )}
                                            <div className="ao-prod-pie">
                                              <span className="ao-prod-cant">x{prod.CANTIDAD}</span>
                                              <span className="ao-prod-subtotal">${Number(prod.SUBTOTAL).toLocaleString()}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="ao-totales">
                                      <div className="ao-total-fila">
                                        <span>Subtotal productos</span>
                                        <span>${Number(orden.TOTAL - (orden.COSTO_ENVIO || 0)).toLocaleString()}</span>
                                      </div>
                                      <div className="ao-total-fila">
                                        <span>Envío</span>
                                        <span>{orden.COSTO_ENVIO ? `$${Number(orden.COSTO_ENVIO).toLocaleString()}` : "Gratis"}</span>
                                      </div>
                                      <div className="ao-total-fila total">
                                        <span>Total</span>
                                        <span>${Number(orden.TOTAL).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="ao-detalle-der">
                                    <div className="ao-detalle-titulo"><FaTruck /> Envío y entrega</div>
                                    {orden.ESTADO_ENVIO === "CANCELADO" ? (
                                      <div className="ao-envio-cancelado">
                                        <FaTimesCircle /> Este envío fue cancelado
                                      </div>
                                    ) : (
                                      <div className="ao-stepper">
                                        {pasosEnvio.map((paso, i) => {
                                          const Icono = paso.icono;
                                          const hecho = i < idxEnvio;
                                          const activo = i === idxEnvio;
                                          return (
                                            <React.Fragment key={paso.valor}>
                                              {i > 0 && <div className={`ao-step-line ${i <= idxEnvio ? "hecho" : ""}`} />}
                                              <button
                                                className={`ao-step ${hecho ? "hecho" : ""} ${activo ? "activo" : ""}`}
                                                onClick={() => cambiarEstadoEnvio(orden.ID_VENTA, paso.valor)}
                                                title={`Marcar como ${paso.etiqueta}`}
                                                disabled={procesandoEnvio !== null}
                                              >
                                                <span className="ao-step-circulo">{hecho ? <FaCheckCircle /> : <Icono />}</span>
                                                <span className="ao-step-etiqueta">{paso.etiqueta}</span>
                                              </button>
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {siguiente && (
                                      <button className="ao-btn-avanzar" onClick={() => cambiarEstadoEnvio(orden.ID_VENTA, siguiente.valor)} disabled={procesandoEnvio !== null}>
                                        <FaShippingFast /> {procesandoEnvio === orden.ID_VENTA ? "Actualizando..." : `Avanzar: marcar como ${siguiente.etiqueta.toLowerCase()}`}
                                      </button>
                                    )}

                                    <div className="ao-envio-info">
                                      {orden.DIRECCION_ENVIO && (
                                        <div className="ao-info-fila"><FaHome /> <span><strong>{orden.DIRECCION_ENVIO}</strong>{orden.BARRIO ? ` · ${orden.BARRIO}` : ""}</span></div>
                                      )}
                                      {(orden.CIUDAD || orden.DEPARTAMENTO) && (
                                        <div className="ao-info-fila"><FaCity /> <span>{[orden.CIUDAD, orden.DEPARTAMENTO].filter(Boolean).join(", ")}{orden.CODIGO_POSTAL ? ` · CP ${orden.CODIGO_POSTAL}` : ""}</span></div>
                                      )}
                                      {orden.TELEFONO_CONTACTO && (
                                        <div className="ao-info-fila"><FaPhone /> <span>{orden.TELEFONO_CONTACTO}</span></div>
                                      )}
                                      {orden.OBSERVACIONES && (
                                        <div className="ao-info-fila observacion"><FaMapMarkerAlt /> <span>{orden.OBSERVACIONES}</span></div>
                                      )}
                                      {orden.COSTO_ENVIO !== null && orden.COSTO_ENVIO !== undefined && (
                                        <div className="ao-info-fila"><FaMoneyBillWave /> <span>Costo envío: {orden.COSTO_ENVIO === 0 ? "Gratis" : `$${Number(orden.COSTO_ENVIO).toLocaleString()}`}</span></div>
                                      )}
                                      {orden.FECHA_ENVIO && (
                                        <div className="ao-info-fila"><FaCalendarAlt /> <span>Fecha de envío: {formatearFechaSola(orden.FECHA_ENVIO)}</span></div>
                                      )}
                                    </div>

                                    <div className="ao-detalle-acciones">
                                      <div className="ao-accion-estado">
                                        <label>Estado de la orden</label>
                                        <select
                                          className="form-select form-select-sm"
                                          value={orden.ESTADO}
                                          onChange={(e) => cambiarEstado(orden.ID_VENTA, e.target.value)}
                                        >
                                          {estadosVenta.map((est) => <option key={est} value={est}>{est}</option>)}
                                        </select>
                                      </div>
                                      <div className="ao-accion-botones">
                                        <button className="ao-btn-factura" onClick={() => descargarFactura(orden.ID_VENTA)}>
                                          <FaFilePdf /> Factura PDF
                                        </button>
                                        {orden.ESTADO_ENVIO !== "CANCELADO" && orden.ESTADO_ENVIO !== "ENTREGADO" && (
                                          <button className="ao-btn-cancelar" onClick={() => cambiarEstadoEnvio(orden.ID_VENTA, "CANCELADO")} disabled={procesandoEnvio !== null}>
                                            Cancelar envío
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="ap-paginacion">
                  <button className="ap-page-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>← Anterior</button>
                  <div className="ap-pages">
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                      <button key={n} className={`ap-page-num ${n === paginaActual ? "activa" : ""}`} onClick={() => setPagina(n)}>{n}</button>
                    ))}
                  </div>
                  <button className="ap-page-btn" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminOrdenes;

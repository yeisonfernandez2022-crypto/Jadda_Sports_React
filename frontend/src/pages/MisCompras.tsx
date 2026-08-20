import "../css/MisCompras.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaBan, FaBoxOpen, FaCartPlus, FaFilePdf, FaHistory, FaSearch, FaUndoAlt, FaWallet } from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import { escapeHtml } from "../utils/escapeHtml";
import { estadoVisible, tieneDevolucionActiva, puedeDevolver, devolucionVencida, DIAS_DEVOLUCION } from "../utils/estadoCompra";
import { useCart } from "../context/CartContext";
import Breadcrumb from "../components/Breadcrumb";

interface Producto {
  ID: number;
  NOMBRE: string;
  IMAGEN: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
  COLOR: string | null;
  NOMBRE_ATRIBUTO: string | null;
  ATRIBUTO: string | null;
  ID_VARIANTE: number | null;
}

interface Compra {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string | null;
  METODO_PAGO: string | null;
  ESTADO_ENVIO: string | null;
  FECHA_ENTREGA: string | null;
  REEMBOLSO_ESTADOS: string | null;
  productos: Producto[];
}

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

export default function MisCompras() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [reComprandoId, setReComprandoId] = useState<number | null>(null);

  useEffect(() => {
    const fetchCompras = async () => {
      try {
        const res = await axios.get("/api/compras", { withCredentials: true });
        setCompras(res.data);
      } catch { console.error("Error al cargar compras");
      } finally { setLoading(false); }
    };
    fetchCompras();
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return compras.filter((c) => {
      if (q) {
        const enPedido = String(numeroPedido(c.ID_VENTA)).includes(q);
        const enProducto = c.productos.some((p) => p.NOMBRE.toLowerCase().includes(q));
        const enMetodo = (c.METODO_PAGO || "").toLowerCase().includes(q);
        if (!enPedido && !enProducto && !enMetodo) return false;
      }
      if (fechaDesde || fechaHasta) {
        const dia = new Date(c.FECHA_VENTA).toISOString().slice(0, 10);
        if (fechaDesde && dia < fechaDesde) return false;
        if (fechaHasta && dia > fechaHasta) return false;
      }
      return true;
    });
  }, [compras, busqueda, fechaDesde, fechaHasta]);

  const descargarFactura = async (id: number) => {
    try {
      const res = await axios.get(`/api/compras/${id}/factura`, { withCredentials: true, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO DESCARGAR",
        text: "No se pudo generar la factura de este pedido.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    }
  };

  const cancelarPedido = async (compra: Compra) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Cancelar pedido?",
      text: "Una vez cancelado no podrás revertir esta acción.",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar pedido",
      cancelButtonText: "No, conservar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    setCancelandoId(compra.ID_VENTA);
    try {
      await axios.post(`/api/compras/${compra.ID_VENTA}/cancelar`, {}, { withCredentials: true });
      const res = await axios.get("/api/compras", { withCredentials: true });
      setCompras(res.data);
      Swal.fire({
        icon: "success",
        title: "PEDIDO CANCELADO",
        text: `El pedido ${numeroPedido(compra.ID_VENTA)} fue cancelado correctamente.`,
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO CANCELAR",
        text: err.response?.data?.msg || "Error al cancelar el pedido.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setCancelandoId(null);
    }
  };

  const solicitarReembolso = async (compra: Compra) => {
    const result = await Swal.fire({
      icon: "info",
      title: "Solicitar reembolso",
      html: `Vas a solicitar el reembolso de <strong>${fmt(compra.TOTAL)}</strong> por el pedido ${numeroPedido(compra.ID_VENTA)}.<br/><br/>El dinero <strong>se reembolsará en un máximo de 7 días</strong> al método de pago con el que realizaste la compra.`,
      showCancelButton: true,
      confirmButtonText: "Sí, solicitar reembolso",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    try {
      await axios.post(`/api/compras/${compra.ID_VENTA}/reembolso`, {}, { withCredentials: true });
      const res = await axios.get("/api/compras", { withCredentials: true });
      setCompras(res.data);
      const resultado = await Swal.fire({
        icon: "success",
        title: "REEMBOLSO SOLICITADO",
        html: `Tu solicitud de reembolso por <strong>${fmt(compra.TOTAL)}</strong> fue registrada.<br/><br/>El dinero <strong>se reembolsará en un máximo de 7 días</strong>.`,
        showCancelButton: true,
        confirmButtonText: "Ver estado de reembolso",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#e63946",
        reverseButtons: true,
        background: "#1a1a1a",
        color: "#fff",
      });
      if (resultado.isConfirmed) navigate(`/perfil/devolucion/${compra.ID_VENTA}`);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO SOLICITAR",
        text: err.response?.data?.msg || "Error al solicitar el reembolso.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    }
  };

  const pedirReembolso = async (compra: Compra) => {
    const result = await Swal.fire({
      icon: "question",
      title: "¿Pedir reembolso?",
      html: `Vas a solicitar el reembolso de <strong>${fmt(compra.TOTAL)}</strong> del pedido ${numeroPedido(compra.ID_VENTA)}.` +
        (compra.ESTADO_ENVIO === "ENTREGADO"
          ? `<br/><br/>Recuerda que tienes <strong>${DIAS_DEVOLUCION} días</strong> desde la entrega para pedirlo.`
          : ""),
      showCancelButton: true,
      confirmButtonText: "Sí, pedir reembolso",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    navigate(`/perfil/devolver/${compra.ID_VENTA}`);
  };

  const volverAComprar = async (compra: Compra) => {
    const conVariante = compra.productos.filter((p) => p.ID_VARIANTE);
    if (conVariante.length === 0) {
      Swal.fire({
        icon: "info",
        title: "NO SE PUDO VOLVER A COMPRAR",
        text: "Este pedido no tiene productos con variante disponible para agregar al carrito.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
      return;
    }
    const result = await Swal.fire({
      icon: "question",
      title: "¿Volver a comprar?",
      html: `Se agregarán al carrito <strong>${conVariante.length} producto(s)</strong> del pedido ${numeroPedido(compra.ID_VENTA)}:<br/><br/>` +
        conVariante.map((p) => `<strong>${escapeHtml(p.NOMBRE)}</strong> ×${p.CANTIDAD}`).join("<br/>"),
      showCancelButton: true,
      confirmButtonText: "Sí, agregar al carrito",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    setReComprandoId(compra.ID_VENTA);
    try {
      await Promise.all(conVariante.map((p) => addToCart(p.ID, p.ID_VARIANTE!, p.CANTIDAD)));
      Swal.fire({
        icon: "success",
        title: "AGREGADO AL CARRITO",
        text: `${conVariante.length} producto(s) del pedido ${numeroPedido(compra.ID_VENTA)} fueron agregados.`,
        timer: 2200,
        showConfirmButton: false,
        background: "#1a1a1a",
        color: "#fff",
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO AGREGAR",
        text: "Verifica el stock disponible.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setReComprandoId(null);
    }
  };

  if (loading) return <div className="mc-page"><div className="mc-loading">Cargando tus compras...</div></div>;

  return (
    <div className="mc-page">
      <div className="mc-header">
        <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Compras" }]} />
        <div className="d-flex justify-content-between align-items-center w-100">
          <h1 className="m-0"><FaHistory /> Mis Compras</h1>
          <button className="mc-btn mc-btn-outline" onClick={() => navigate("/perfil")}>
            <FaWallet /> Volver al perfil
          </button>
        </div>
      </div>

      <div className="mc-toolbar">
        <div className="mc-search">
          <FaSearch />
          <input
            type="text"
            placeholder="Buscar por pedido, producto o método de pago..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <label className="mc-fecha">
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label className="mc-fecha">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        {(busqueda || fechaDesde || fechaHasta) && (
          <button className="mc-btn mc-btn-limpiar" onClick={() => { setBusqueda(""); setFechaDesde(""); setFechaHasta(""); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="mc-vacio">
          <FaBoxOpen style={{ fontSize: "2.4rem", color: "#94a3b8" }} />
          <h3>No encontramos compras</h3>
          <p>{compras.length === 0 ? "Aún no has realizado compras." : "Prueba con otros filtros o búsqueda."}</p>
          {compras.length === 0 && (
            <button className="mc-btn mc-btn-primario" onClick={() => navigate("/catalogo")}>
              Ir al catálogo
            </button>
          )}
        </div>
      ) : (
        <div className="mc-lista">
          {filtradas.map((compra) => {
            const ev = estadoVisible(compra);
            const primero = compra.productos[0];
            return (
              <div key={compra.ID_VENTA} className="mc-card">
                <div className="mc-card-main">
                  <div className="mc-imagen">
                    <img
                      src={primero?.IMAGEN || "https://placehold.co/96x96?text=JADDA"}
                      alt={primero?.NOMBRE || "Producto"}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = "https://placehold.co/96x96?text=JADDA"; }}
                    />
                    {compra.productos.length > 1 && <span className="mc-img-count">+{compra.productos.length - 1}</span>}
                  </div>

                  <div className="mc-info">
                    <div className="mc-info-top">
                      <strong>Pedido {numeroPedido(compra.ID_VENTA)}</strong>
                      <span className="mc-badge" style={{ background: ev.color }}>{ev.texto}</span>
                    </div>
                    <div className="mc-prod-nombres" title={compra.productos.map((p) => p.NOMBRE).join(" · ")}>
                      {compra.productos.slice(0, 2).map((p, i) => (
                        <span key={i}>{i > 0 && " · "}{p.NOMBRE}</span>
                      ))}
                      {compra.productos.length > 2 && <span> · +{compra.productos.length - 2} más</span>}
                    </div>
                    <div className="mc-info-meta">
                      {new Date(compra.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
                      {" · "}{compra.productos.length} artículo{compra.productos.length !== 1 ? "s" : ""}
                      {compra.METODO_PAGO ? ` · ${compra.METODO_PAGO}` : ""}
                      {" · "}<span className="mc-info-total">{fmt(compra.TOTAL)}</span>
                    </div>
                  </div>

                  <button className="mc-btn-ver" onClick={() => navigate(`/perfil/compra/${compra.ID_VENTA}`)}>
                    <FaHistory /> Ver mi compra
                  </button>
                </div>

                <div className="mc-card-acciones">
                  <div className="mc-acciones-izq">
                    {tieneDevolucionActiva(compra) ? (
                      <button className="mc-btn mc-btn-outline" onClick={() => navigate(`/perfil/devolucion/${compra.ID_VENTA}`)}>
                        <FaWallet /> Ver estado de reembolso
                      </button>
                    ) : compra.ESTADO === "CANCELADA" ? (
                      <button className="mc-btn mc-btn-outline" onClick={() => solicitarReembolso(compra)}>
                        <FaWallet /> Solicitar reembolso
                      </button>
                    ) : compra.ESTADO === "COMPLETADA" && puedeDevolver(compra) ? (
                      <button className="mc-btn mc-btn-primario" onClick={() => pedirReembolso(compra)}>
                        <FaUndoAlt /> Pedir reembolso
                      </button>
                    ) : compra.ESTADO === "COMPLETADA" && devolucionVencida(compra) ? (
                      <span className="mc-plazo-vencido">Plazo de {DIAS_DEVOLUCION} días para reembolso vencido</span>
                    ) : (compra.ESTADO === "COMPLETADA" || compra.ESTADO === "PENDIENTE") &&
                      (!compra.ESTADO_ENVIO || ["PENDIENTE", "POR_EMPAQUETAR", "EMPACADO"].includes(compra.ESTADO_ENVIO)) ? (
                      <button
                        className="mc-btn mc-btn-danger"
                        onClick={() => cancelarPedido(compra)}
                        disabled={cancelandoId === compra.ID_VENTA}
                      >
                        <FaBan /> {cancelandoId === compra.ID_VENTA ? "Cancelando..." : "Cancelar pedido"}
                      </button>
                    ) : null}
                    <button className="mc-btn mc-btn-ghost" onClick={() => descargarFactura(compra.ID_VENTA)}>
                      <FaFilePdf /> Factura
                    </button>
                  </div>
                  <button
                    className="mc-btn mc-btn-recomprar"
                    onClick={() => volverAComprar(compra)}
                    disabled={reComprandoId === compra.ID_VENTA}
                  >
                    <FaCartPlus /> {reComprandoId === compra.ID_VENTA ? "Agregando..." : "Volver a comprar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import "../css/MisCompras.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaBan, FaBoxOpen, FaCartPlus, FaCreditCard, FaFileAlt, FaFilePdf, FaHeadset, FaHistory, FaInfoCircle, FaMoneyBillWave, FaSearch, FaStar, FaSyncAlt, FaTruck, FaUndoAlt, FaWallet } from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import { escapeHtml } from "../utils/escapeHtml";
import { estadoVisible, tieneDevolucionActiva, puedeDevolver, devolucionVencida, DIAS_DEVOLUCION, esReembolso } from "../utils/estadoCompra";
import { prepararVentanaWompi, navegarVentanaWompi, cerrarVentanaWompi } from "../utils/wompiWindow";
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
  COSTO_ENVIO?: number | null;
  FECHA_ENTREGA: string | null;
  REEMBOLSO_ESTADOS: string | null;
  DEVOLUCION_TIPOS: string | null;
  CANCELADA_POR?: string | null;
  PAGO_CONFIRMADO?: boolean;
  productos: Producto[];
}

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

// El envío se reembolsa solo si el pedido se cancela antes de salir del almacén.
const envioReembolsable = (compra: Compra) =>
  !["EN_CAMINO", "ENTREGADO"].includes(compra.ESTADO_ENVIO || "");

const valorProductos = (compra: Compra) =>
  compra.productos.reduce(
    (acc, p) => acc + (p.SUBTOTAL != null && Number.isFinite(Number(p.SUBTOTAL))
      ? Number(p.SUBTOTAL)
      : Number(p.PRECIO_UNITARIO) * Number(p.CANTIDAD)),
    0
  );

const valorReembolsoCancelacion = (compra: Compra) =>
  valorProductos(compra) + (envioReembolsable(compra) ? Number(compra.COSTO_ENVIO || 0) : 0);

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
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const CHIPS_ESTADO: { id: string; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "PENDIENTE_PAGO", label: "Pendiente de pago" },
    { id: "PROCESANDO", label: "Procesando" },
    { id: "ENVIADO", label: "Enviado" },
    { id: "ENTREGADO", label: "Entregado" },
    { id: "CANCELADO", label: "Cancelados" },
  ];

  const coincideEstado = (c: Compra, id: string): boolean => {
    if (id === "todos") return true;
    if (id === "PENDIENTE_PAGO") return c.ESTADO === "PENDIENTE_PAGO";
    if (id === "CANCELADO") return c.ESTADO === "CANCELADA";
    const envio = c.ESTADO_ENVIO || "";
    if (id === "ENVIADO") return c.ESTADO !== "CANCELADA" && c.ESTADO !== "PENDIENTE_PAGO" && (envio === "EN_CAMINO" || envio === "ENVIADA");
    if (id === "ENTREGADO") return c.ESTADO !== "CANCELADA" && c.ESTADO !== "PENDIENTE_PAGO" && envio === "ENTREGADO";
    if (id === "PROCESANDO")
      return c.ESTADO !== "CANCELADA" && c.ESTADO !== "PENDIENTE_PAGO" && !["EN_CAMINO", "ENVIADA", "ENTREGADO", "CANCELADO"].includes(envio);
    return true;
  };

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
      return coincideEstado(c, filtroEstado);
    });
  }, [compras, busqueda, fechaDesde, fechaHasta, filtroEstado]);

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

  /** Pasarela de pagos (Fase 6): reabre el checkout de Wompi para una venta PENDIENTE_PAGO.
   *  Pestaña nueva + navegación a compra-exitosa aquí: si el pago falla en Wompi
   *  (sin botón de retorno en su pantalla) el usuario no queda estancado. */
  const pagarAhoraWompi = async (idVenta: number) => {
    // La pestaña se abre en el click (antes del await): el navegador no la
    // bloquea y no aparece el modal con el enlace.
    prepararVentanaWompi();
    try {
      const r = await axios.post("/api/pagos/pagar", { idVenta }, { withCredentials: true });
      if (r.data?.urlCheckout) {
        const abierta = navegarVentanaWompi(r.data.urlCheckout);
        navigate(
          `/compra-exitosa/${idVenta}`,
          abierta ? undefined : { state: { urlCheckout: r.data.urlCheckout } }
        );
      } else {
        cerrarVentanaWompi();
      }
    } catch (e: any) {
      cerrarVentanaWompi();
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO INICIAR EL PAGO",
        text: e?.response?.data?.message || "Intenta de nuevo en unos minutos.",
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
      const { data } = await axios.post(`/api/compras/${compra.ID_VENTA}/cancelar`, {}, { withCredentials: true });
      const res = await axios.get("/api/compras", { withCredentials: true });
      setCompras(res.data);
      if (data?.reembolso?.automatico && Number(data.reembolso.total) > 0) {
        const incluyeEnvio = Number(data.reembolso.costoEnvio) > 0;
        const resultado = await Swal.fire({
          icon: "success",
          title: "PEDIDO CANCELADO",
          html: `El pedido ${numeroPedido(compra.ID_VENTA)} fue cancelado.<br/><br/>Aprobamos automáticamente el reembolso de <strong>${fmt(Number(data.reembolso.total))}</strong> ${incluyeEnvio ? "por los productos y el costo de envío" : "por los productos"}. El dinero llegará a tu método de pago en un máximo de 7 días.`,
          showCancelButton: true,
          confirmButtonText: "Ver reembolso",
          cancelButtonText: "Cerrar",
          confirmButtonColor: "#e63946",
          reverseButtons: true,
          background: "#1a1a1a",
          color: "#fff",
        });
        if (resultado.isConfirmed) navigate(`/perfil/reembolso/${compra.ID_VENTA}`);
      } else {
        await Swal.fire({
          icon: "success",
          title: "PEDIDO CANCELADO",
          text: data?.pagoConfirmado === false
            ? `El pedido ${numeroPedido(compra.ID_VENTA)} fue cancelado. No se registró ningún cobro, así que no hay dinero que reembolsar.`
            : `El pedido ${numeroPedido(compra.ID_VENTA)} fue cancelado correctamente.`,
          background: "#1a1a1a",
          color: "#fff",
          confirmButtonColor: "#e63946",
        });
      }
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
    const incluyeEnvio = envioReembolsable(compra) && Number(compra.COSTO_ENVIO || 0) > 0;
    const monto = valorReembolsoCancelacion(compra);
    const detalleMonto = incluyeEnvio
      ? `por los productos y el costo de envío (${fmt(Number(compra.COSTO_ENVIO))})`
      : `por los productos${envioReembolsable(compra) ? "" : "; el costo de envío no se reembolsa porque ya había sido despachado"}`;
    const result = await Swal.fire({
      icon: "info",
      title: "Reembolso automático",
      html: `El pedido ${numeroPedido(compra.ID_VENTA)} fue cancelado. Aprobaremos automáticamente el reembolso de <strong>${fmt(monto)}</strong> ${detalleMonto}.<br/><br/>El dinero llegará a tu método de pago en un máximo de 7 días.`,
      showCancelButton: true,
      confirmButtonText: "Sí, reembolsar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    try {
      const { data } = await axios.post(`/api/compras/${compra.ID_VENTA}/reembolso`, {}, { withCredentials: true });
      const res = await axios.get("/api/compras", { withCredentials: true });
      setCompras(res.data);
      const monto = Number(data?.reembolso?.total ?? valorReembolsoCancelacion(compra));
      const incluyeEnvio = Number(data?.reembolso?.costoEnvio) > 0;
      const detalleMonto = incluyeEnvio
        ? "Incluye el valor de los productos y el costo de envío."
        : envioReembolsable(compra)
          ? "Corresponde al valor de los productos."
          : "El costo de envío no se reembolsa porque el pedido ya había sido despachado.";
      const resultado = await Swal.fire({
        icon: "success",
        title: "REEMBOLSO APROBADO",
        html: `El reembolso de <strong>${fmt(monto)}</strong> fue aprobado automáticamente por la cancelación del pedido. ${detalleMonto}<br/><br/>El dinero <strong>se abonará en un máximo de 7 días</strong> al método de pago con el que compraste.`,
        showCancelButton: true,
        confirmButtonText: "Ver reembolso",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#e63946",
        reverseButtons: true,
        background: "#1a1a1a",
        color: "#fff",
      });
      if (resultado.isConfirmed) navigate(`/perfil/reembolso/${compra.ID_VENTA}`);
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

  const pedirDevolucion = async (compra: Compra, tipo: "DEVOLUCION" | "REEMBOLSO") => {
    const esReembolsoSolicitud = tipo === "REEMBOLSO";
    const result = await Swal.fire({
      icon: "question",
      title: esReembolsoSolicitud ? "¿Pedir reembolso?" : "¿Devolver producto?",
      html: (esReembolsoSolicitud
        ? `Vas a solicitar el reembolso de <strong>${fmt(valorProductos(compra))}</strong> del pedido ${numeroPedido(compra.ID_VENTA)}. Este reembolso sin devolución aplica solo si el producto llegó defectuoso o no coincide con la descripción; <strong>el costo de envío no se reembolsa</strong>.`
        : `Vas a iniciar la devolución de los productos del pedido ${numeroPedido(compra.ID_VENTA)}. Te reembolsaremos solo el valor de los productos; <strong>el costo de envío no se reembolsa</strong>.`) +
        (compra.ESTADO_ENVIO === "ENTREGADO"
          ? `<br/><br/>Recuerda que tienes <strong>${DIAS_DEVOLUCION} días</strong> desde la entrega para pedirlo.`
          : ""),
      showCancelButton: true,
      confirmButtonText: esReembolsoSolicitud ? "Sí, pedir reembolso" : "Sí, iniciar devolución",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    navigate(`/perfil/devolver/${compra.ID_VENTA}?tipo=${tipo}`);
  };

  const verMotivoCancelacion = async (compra: Compra) => {
    const conPago = compra.PAGO_CONFIRMADO !== false;
    const estados = (compra.REEMBOLSO_ESTADOS || "").split(",").map((e) => e.trim()).filter(Boolean);
    const envioSalio = !envioReembolsable(compra);
    const motivo =
      compra.CANCELADA_POR === "CLIENTE"
        ? "Cancelaste este pedido antes del despacho. No se envió ningún producto."
        : compra.CANCELADA_POR === "TIENDA"
          ? envioSalio
            ? "La tienda canceló este pedido después de que salió del almacén."
            : "La tienda canceló este pedido antes del despacho. No se envió ningún producto."
          : compra.CANCELADA_POR === "SISTEMA"
            ? "El pago no se completó dentro del tiempo permitido, así que el pedido se canceló automáticamente."
            : envioSalio
              ? "El pedido fue cancelado después de que salió del almacén."
              : "El pedido fue cancelado antes del despacho. No se envió ningún producto.";
    const envioIncluido = envioReembolsable(compra) && Number(compra.COSTO_ENVIO || 0) > 0;
    const notaEnvio = envioIncluido
      ? " Incluye el costo de envío."
      : envioReembolsable(compra)
        ? ""
        : " El costo de envío no se reembolsa porque el pedido ya había sido despachado.";
    const estadoReembolso = estados.includes("APROBADA")
      ? `<p class="mb-0">El reembolso de ${envioIncluido ? "los productos y el envío" : "los productos"} fue aprobado automáticamente. Llegará a tu método de pago en un máximo de 7 días.${notaEnvio}</p>`
      : estados.some((e) => ["SOLICITADA", "MAS_PRUEBAS", "ESCALADA"].includes(e))
        ? "<p class=\"mb-0\">Tu solicitud de reembolso está en revisión.</p>"
        : estados.includes("RECHAZADA")
          ? "<p class=\"mb-0\">Tu solicitud de reembolso fue rechazada. Puedes revisar el detalle en el pedido.</p>"
          : !conPago
            ? "<p class=\"mb-0\">No se registró ningún cobro.</p>"
            : `<p class="mb-0">Puedes solicitar el reembolso de ${fmt(valorReembolsoCancelacion(compra))};${notaEnvio || " corresponde solo al valor de los productos."}</p>`;
    await Swal.fire({
      icon: "info",
      title: "Motivo de la cancelación",
      html: `<p>${motivo}</p>` + estadoReembolso,
      confirmButtonText: "Entendido",
      confirmButtonColor: "#e63946",
      background: "#1a1a1a",
      color: "#fff",
    });
  };

  const rastrearEnvio = async (compra: Compra) => {
    const estado = compra.ESTADO_ENVIO === "EN_CAMINO"
      ? "En camino"
      : compra.ESTADO === "ENVIADA"
        ? "Enviada"
        : "Registrado para despacho";
    const result = await Swal.fire({
      icon: "info",
      title: "Seguimiento del envío",
      html: `Pedido <strong>${numeroPedido(compra.ID_VENTA)}</strong><br/>Estado actual: <strong>${estado}</strong><br/><br/>` +
        `El número de guía se comparte cuando el pedido sale del almacén. Si ya está en camino y no lo tienes, contacta a soporte.`,
      showCancelButton: true,
      confirmButtonText: "Ver mi compra",
      cancelButtonText: "Cerrar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (result.isConfirmed) navigate(`/perfil/compra/${compra.ID_VENTA}`);
  };

  const verTransportadora = async () => {
    await Swal.fire({
      icon: "info",
      title: "Transportadora",
      html: "La transportadora se asigna al despachar el pedido. Si ya está en camino y necesitas el nombre exacto o la guía, contacta a soporte para que te los comparta.",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#e63946",
      background: "#1a1a1a",
      color: "#fff",
    });
  };

  const contactarSoporte = () => navigate("/chats?tipo=SOPORTE");

  const calificarCompra = async (compra: Compra) => {
    const unicos = Array.from(new Map(compra.productos.map((p) => [p.ID, p])).values());
    if (unicos.length === 0) return;
    if (unicos.length === 1) {
      navigate(`/producto/${unicos[0].ID}#opiniones`);
      return;
    }
    const result = await Swal.fire({
      title: "¿Qué producto quieres calificar?",
      input: "select",
      inputOptions: Object.fromEntries(unicos.map((p) => [String(p.ID), p.NOMBRE])),
      inputPlaceholder: "Selecciona un producto",
      showCancelButton: true,
      confirmButtonText: "Calificar",
      cancelButtonText: "Cancelar",
      inputValidator: (value) => (!value ? "Elige un producto" : undefined),
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (result.isConfirmed && result.value) navigate(`/producto/${result.value}#opiniones`);
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
        <h1 className="m-0"><FaHistory /> Mis Compras</h1>
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
        {(busqueda || fechaDesde || fechaHasta || filtroEstado !== "todos") && (
          <button className="mc-btn mc-btn-limpiar" onClick={() => { setBusqueda(""); setFechaDesde(""); setFechaHasta(""); setFiltroEstado("todos"); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="mc-chips">
        {CHIPS_ESTADO.map((chip) => (
          <button
            key={chip.id}
            className={`mc-chip${filtroEstado === chip.id ? " activo" : ""}`}
            onClick={() => setFiltroEstado(chip.id)}
          >
            {chip.label}
          </button>
        ))}
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
            const devEstados = (compra.REEMBOLSO_ESTADOS || "").split(",").map((e) => e.trim()).filter(Boolean);
            const devActiva = tieneDevolucionActiva(compra);
            const devAprobada = devEstados.includes("APROBADA");
            const devRechazada = !devAprobada && !devActiva && devEstados.includes("RECHAZADA");
            const reembolso = esReembolso(compra);
            const pagoConReferencia = !!compra.REFERENCIA_PAGO && !compra.REFERENCIA_PAGO.startsWith("SIM_");
            const sinCobro = compra.ESTADO === "CANCELADA" && compra.PAGO_CONFIRMADO === false;
            const cancelable =
              ["COMPLETADA", "PENDIENTE", "CONFIRMADA", "PENDIENTE_PAGO"].includes(compra.ESTADO) &&
              (!compra.ESTADO_ENVIO || ["PENDIENTE", "POR_EMPAQUETAR", "EMPACADO"].includes(compra.ESTADO_ENVIO));
            const mostrarRastreo = compra.ESTADO_ENVIO === "EN_CAMINO" || compra.ESTADO === "ENVIADA";
            const mostrarSeguimiento =
              compra.ESTADO !== "PENDIENTE_PAGO" &&
              compra.ESTADO !== "CANCELADA" &&
              ["PENDIENTE", "POR_EMPAQUETAR", "EMPACADO"].includes(compra.ESTADO_ENVIO || "");
            const puedePedirDevolucion =
              compra.ESTADO === "COMPLETADA" &&
              puedeDevolver(compra) &&
              !devActiva &&
              !devAprobada;
            const vencida = devolucionVencida(compra);
            const mostrarRecomprar =
              compra.ESTADO === "CANCELADA" ||
              (compra.ESTADO === "COMPLETADA" && (!devActiva || devAprobada));
            const textoCancelar = ["COMPLETADA", "PENDIENTE"].includes(compra.ESTADO)
              ? "Solicitar cancelación"
              : "Cancelar pedido";
            const botonCancelar = cancelable ? (
              <button
                className="mc-btn mc-btn-danger"
                onClick={() => cancelarPedido(compra)}
                disabled={cancelandoId === compra.ID_VENTA}
              >
                <FaBan /> {cancelandoId === compra.ID_VENTA ? "Cancelando..." : textoCancelar}
              </button>
            ) : null;
            const botonCalificar = compra.ESTADO === "COMPLETADA" ? (
              <button className="mc-btn mc-btn-ghost" onClick={() => calificarCompra(compra)}>
                <FaStar /> Calificar compra
              </button>
            ) : null;
            // Si ya hubo un rechazo, el botón principal reintenta el MISMO tipo
            // de solicitud y el secundario ofrece la otra vía; sin rechazo, el
            // principal es reembolso y el secundario devolución (2026-10-27).
            const tipoReintento: "DEVOLUCION" | "REEMBOLSO" =
              devRechazada && !reembolso ? "DEVOLUCION" : "REEMBOLSO";
            const etiquetaReintento = devRechazada
              ? reembolso
                ? "Volver a solicitar reembolso"
                : "Volver a solicitar devolución"
              : "Solicitar reembolso";
            const tipoAlternativo: "DEVOLUCION" | "REEMBOLSO" =
              tipoReintento === "REEMBOLSO" ? "DEVOLUCION" : "REEMBOLSO";
            const etiquetaAlternativa =
              tipoAlternativo === "REEMBOLSO" ? "Solicitar reembolso" : "Devolver producto";
            const botonSeguimiento = mostrarSeguimiento ? (
              <button className="mc-btn mc-btn-ghost" onClick={() => navigate(`/perfil/compra/${compra.ID_VENTA}`)}>
                <FaTruck /> Seguimiento
              </button>
            ) : null;
            const botonSoporte = (
              <button className="mc-btn mc-btn-ghost" onClick={contactarSoporte}>
                <FaHeadset /> Contactar soporte
              </button>
            );
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
                      {compra.productos.length > 1 ? (
                        <>
                          <span>{compra.productos[0].NOMBRE}</span>
                          <span className="mc-prod-otros"> y otros {compra.productos.length - 1} producto{compra.productos.length - 1 > 1 ? "s" : ""}</span>
                        </>
                      ) : (
                        <span>{compra.productos[0].NOMBRE}</span>
                      )}
                    </div>
                    <div className="mc-info-meta">
                      {new Date(compra.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
                      {" · "}{compra.productos.length} artículo{compra.productos.length !== 1 ? "s" : ""}
                      {compra.METODO_PAGO ? ` · ${compra.METODO_PAGO}` : ""}
                      {" · "}<span className="mc-info-total">{fmt(compra.TOTAL)}</span>
                    </div>
                    {compra.ESTADO === "PENDIENTE_PAGO" && (
                      <div className="mc-pago-nota">
                        <FaInfoCircle />{" "}
                        {pagoConReferencia
                          ? "Pago en proceso. Si Wompi lo rechazó, reintenta o cambia de método."
                          : "Completa el pago para que podamos preparar tu pedido."}
                      </div>
                    )}
                  </div>

                  <button className="mc-btn-ver" onClick={() => navigate(`/perfil/compra/${compra.ID_VENTA}`)}>
                    <FaHistory /> Ver mi compra
                  </button>
                </div>

                <div className="mc-card-acciones">
                  <div className="mc-acciones-izq">
                    {compra.ESTADO === "PENDIENTE_PAGO" ? (
                      <>
                        <button className="mc-btn mc-btn-primario" onClick={() => pagarAhoraWompi(compra.ID_VENTA)}>
                          <FaCreditCard /> {pagoConReferencia ? "Reintentar pago" : "Pagar ahora"}
                        </button>
                        {pagoConReferencia && (
                          <button className="mc-btn mc-btn-outline" onClick={() => navigate(`/compra-exitosa/${compra.ID_VENTA}`)}>
                            <FaSearch /> Ver estado del pago
                          </button>
                        )}
                        <button
                          className="mc-btn mc-btn-ghost"
                          onClick={() => pagarAhoraWompi(compra.ID_VENTA)}
                          title="El método de pago se elige dentro del checkout de Wompi"
                        >
                          <FaSyncAlt /> Cambiar método
                        </button>
                        {botonCancelar}
                      </>
                    ) : devAprobada ? (
                      <>
                        <button
                          className="mc-btn mc-btn-outline"
                          onClick={() => navigate(reembolso ? `/perfil/reembolso/${compra.ID_VENTA}` : `/perfil/devolucion/${compra.ID_VENTA}`)}
                        >
                          {reembolso ? <FaMoneyBillWave /> : <FaUndoAlt />}{" "}
                          {reembolso ? "Ver comprobante de reembolso" : "Ver detalles de devolución"}
                        </button>
                        {!reembolso && (
                          <button className="mc-btn mc-btn-ghost" onClick={() => navigate(`/perfil/reembolso/${compra.ID_VENTA}`)}>
                            <FaWallet /> Estado del reembolso
                          </button>
                        )}
                        {compra.ESTADO === "CANCELADA" && (
                          <button className="mc-btn mc-btn-ghost" onClick={() => verMotivoCancelacion(compra)}>
                            <FaInfoCircle /> Ver motivo de cancelación
                          </button>
                        )}
                        {botonSoporte}
                      </>
                    ) : devActiva ? (
                      <>
                        <button
                          className="mc-btn mc-btn-outline"
                          onClick={() => navigate(`/perfil/devolucion/${compra.ID_VENTA}`)}
                        >
                          {reembolso ? <FaMoneyBillWave /> : <FaUndoAlt />}{" "}
                          {reembolso ? "Ver estado del reembolso" : "Ver estado de devolución"}
                        </button>
                        {devEstados.includes("MAS_PRUEBAS") && (
                          <button className="mc-btn mc-btn-primario" onClick={() => navigate(`/perfil/devolucion/${compra.ID_VENTA}`)}>
                            <FaUndoAlt /> Adjuntar evidencias
                          </button>
                        )}
                        {botonSoporte}
                        {compra.ESTADO === "CANCELADA" && (
                          <button className="mc-btn mc-btn-ghost" onClick={() => verMotivoCancelacion(compra)}>
                            <FaInfoCircle /> Ver motivo de cancelación
                          </button>
                        )}
                      </>
                    ) : compra.ESTADO === "CANCELADA" ? (
                      <>
                        <button className="mc-btn mc-btn-outline" onClick={() => verMotivoCancelacion(compra)}>
                          <FaInfoCircle /> Ver motivo de cancelación
                        </button>
                        {devRechazada && (
                          <button className="mc-btn mc-btn-outline" onClick={() => navigate(`/perfil/devolucion/${compra.ID_VENTA}`)}>
                            <FaUndoAlt /> Ver solicitud rechazada
                          </button>
                        )}
                        {!devRechazada && devEstados.length > 0 ? (
                          <button className="mc-btn mc-btn-outline" onClick={() => navigate(`/perfil/reembolso/${compra.ID_VENTA}`)}>
                            <FaMoneyBillWave /> Consultar reembolso
                          </button>
                        ) : sinCobro ? (
                          <span className="mc-devolucion-nota">No se registró ningún cobro en este pedido.</span>
                        ) : (
                          <button className="mc-btn mc-btn-primario" onClick={() => solicitarReembolso(compra)}>
                            <FaWallet /> {devRechazada ? "Volver a solicitar reembolso" : "Solicitar reembolso"}
                          </button>
                        )}
                        {botonSoporte}
                      </>
                    ) : mostrarRastreo ? (
                      <>
                        <button className="mc-btn mc-btn-outline" onClick={() => rastrearEnvio(compra)}>
                          <FaTruck /> Rastrear envío
                        </button>
                        <button className="mc-btn mc-btn-ghost" onClick={verTransportadora}>
                          <FaTruck /> Ver transportadora
                        </button>
                        <span className="mc-devolucion-nota">
                          Podrás solicitar reembolso o devolución cuando recibas el pedido.
                        </span>
                        {botonSoporte}
                      </>
                    ) : puedePedirDevolucion ? (
                      <>
                        {devRechazada && (
                          <button
                            className="mc-btn mc-btn-outline"
                            onClick={() => navigate(`/perfil/devolucion/${compra.ID_VENTA}`)}
                          >
                            <FaFileAlt /> Ver solicitud rechazada
                          </button>
                        )}
                        <button className="mc-btn mc-btn-primario" onClick={() => pedirDevolucion(compra, tipoReintento)}>
                          {tipoReintento === "REEMBOLSO" ? <FaMoneyBillWave /> : <FaUndoAlt />} {etiquetaReintento}
                        </button>
                        <button className="mc-btn mc-btn-outline" onClick={() => pedirDevolucion(compra, tipoAlternativo)}>
                          {tipoAlternativo === "REEMBOLSO" ? <FaMoneyBillWave /> : <FaUndoAlt />} {etiquetaAlternativa}
                        </button>
                        {botonCalificar}
                        {botonCancelar}
                      </>
                    ) : vencida ? (
                      <>
                        <span className="mc-plazo-vencido">Plazo de {DIAS_DEVOLUCION} días para reembolso vencido</span>
                        {botonCalificar}
                      </>
                    ) : (
                      <>
                        {botonCancelar}
                        {botonCalificar}
                      </>
                    )}
                    {botonSeguimiento}
                    <button className="mc-btn mc-btn-ghost" onClick={() => descargarFactura(compra.ID_VENTA)}>
                      <FaFilePdf /> Factura
                    </button>
                  </div>
                  {mostrarRecomprar && (
                    <button
                      className="mc-btn mc-btn-recomprar"
                      onClick={() => volverAComprar(compra)}
                      disabled={reComprandoId === compra.ID_VENTA}
                    >
                      <FaCartPlus /> {reComprandoId === compra.ID_VENTA ? "Agregando..." : "Volver a comprar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
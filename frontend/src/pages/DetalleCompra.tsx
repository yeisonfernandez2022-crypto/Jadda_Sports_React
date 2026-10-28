import "../css/ReembolsoDetalle.css";
import "../css/DetalleCompra.css";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaArrowLeft, FaBoxOpen, FaCreditCard, FaEdit, FaFilePdf, FaHistory,
  FaMapMarkerAlt, FaPalette, FaSave, FaStar, FaTag, FaTruck, FaUndoAlt, FaWallet,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import { estadoVisible, estadoEnvioTexto, tieneDevolucionActiva, puedeDevolver, devolucionVencida, mensajeDevolucionNoDisponible, esReembolso, DIAS_DEVOLUCION } from "../utils/estadoCompra";
import { prepararVentanaWompi, navegarVentanaWompi, cerrarVentanaWompi } from "../utils/wompiWindow";
import Breadcrumb from "../components/Breadcrumb";

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

// El envío se reembolsa solo si el pedido se cancela antes de salir del almacén.
const envioReembolsable = (compra: CompraDetalle) =>
  !["EN_CAMINO", "ENTREGADO"].includes(compra.ESTADO_ENVIO || "");

const valorProductos = (compra: CompraDetalle) =>
  compra.productos.reduce(
    (acc, p) => acc + (p.SUBTOTAL != null && Number.isFinite(Number(p.SUBTOTAL))
      ? Number(p.SUBTOTAL)
      : Number(p.PRECIO_UNITARIO) * Number(p.CANTIDAD)),
    0
  );

const valorReembolsoCancelacion = (compra: CompraDetalle) =>
  valorProductos(compra) + (envioReembolsable(compra) ? Number(compra.COSTO_ENVIO || 0) : 0);

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
}

interface CompraDetalle {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string | null;
  DATOS_PAGO: string | null;
  METODO_PAGO: string | null;
  ESTADO_ENVIO: string | null;
  COSTO_ENVIO: number;
  FECHA_ENTREGA: string | null;
  REEMBOLSO_ESTADOS: string | null;
  DEVOLUCION_TIPOS?: string | null;
  CANCELADA_POR?: string | null;
  PAGO_CONFIRMADO?: boolean;
  DIRECCION_ENVIO: string | null;
  CIUDAD: string | null;
  BARRIO: string | null;
  DEPARTAMENTO: string | null;
  CODIGO_POSTAL: string | null;
  TELEFONO_CONTACTO: string | null;
  OBSERVACIONES: string | null;
  productos: Producto[];
}

const PASOS_ENVIO = [
  { clave: "PENDIENTE", etiqueta: "Pendiente" },
  { clave: "POR_EMPAQUETAR", etiqueta: "Por empaquetar" },
  { clave: "EMPACADO", etiqueta: "Empacado" },
  { clave: "EN_CAMINO", etiqueta: "En camino" },
  { clave: "ENTREGADO", etiqueta: "Entregado" },
];

export default function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [compra, setCompra] = useState<CompraDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editandoDir, setEditandoDir] = useState(false);
  const [dir, setDir] = useState({ DIRECCION_ENVIO: "", CIUDAD: "", BARRIO: "", DEPARTAMENTO: "", CODIGO_POSTAL: "", TELEFONO_CONTACTO: "", OBSERVACIONES: "" });
  const [guardandoDir, setGuardandoDir] = useState(false);

  useEffect(() => {
    axios.get(`/api/compras/${id}`, { withCredentials: true })
      .then((res) => {
        setCompra(res.data);
        setDir({
          DIRECCION_ENVIO: res.data.DIRECCION_ENVIO || "",
          CIUDAD: res.data.CIUDAD || "",
          BARRIO: res.data.BARRIO || "",
          DEPARTAMENTO: res.data.DEPARTAMENTO || "",
          CODIGO_POSTAL: res.data.CODIGO_POSTAL || "",
          TELEFONO_CONTACTO: res.data.TELEFONO_CONTACTO || "",
          OBSERVACIONES: res.data.OBSERVACIONES || "",
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rr-page"><div className="rr-loading">Cargando tu compra...</div></div>;

  if (error || !compra) {
    return (
      <div className="rr-page">
        <div className="rr-error">
          <FaBoxOpen style={{ fontSize: "2.2rem", color: "#e63946" }} />
          <h3>No encontramos esta compra</h3>
          <p>Verifica que tengas sesión iniciada y que el pedido te pertenezca.</p>
          <button className="rr-btn rr-btn-primario" onClick={() => navigate("/perfil/compras")}>
            Volver a mis compras
          </button>
        </div>
      </div>
    );
  }

  const ev = estadoVisible(compra);
  const idxEnvio = compra.ESTADO_ENVIO ? PASOS_ENVIO.findIndex((p) => p.clave === compra.ESTADO_ENVIO) : -1;
  const envioCompleto = compra.ESTADO_ENVIO === "ENTREGADO";
  const puedeEditarDir = !compra.ESTADO_ENVIO || ["PENDIENTE", "POR_EMPAQUETAR", "EMPACADO"].includes(compra.ESTADO_ENVIO);
  const subtotal = compra.productos.reduce((sum, p) => sum + Number(p.SUBTOTAL), 0);
  const datosPago: any = (() => { try { return compra.DATOS_PAGO ? JSON.parse(compra.DATOS_PAGO) : null; } catch { return null; } })();
  const devEstados = (compra.REEMBOLSO_ESTADOS || "").split(",").map((e) => e.trim()).filter(Boolean);
  const devAprobada = devEstados.includes("APROBADA");
  const reembolso = esReembolso(compra);
  const sinCobro = compra.ESTADO === "CANCELADA" && compra.PAGO_CONFIRMADO === false;
  const envioIncluido = envioReembolsable(compra) && Number(compra.COSTO_ENVIO || 0) > 0;

  const pedirDevolucion = async (tipo: "DEVOLUCION" | "REEMBOLSO") => {
    const esReembolso = tipo === "REEMBOLSO";
    const result = await Swal.fire({
      icon: "question",
      title: esReembolso ? "¿Pedir reembolso?" : "¿Devolver producto?",
      html: (esReembolso
        ? `Vas a solicitar el reembolso de <strong>${fmt(valorProductos(compra))}</strong> del pedido ${numeroPedido(compra.ID_VENTA)}. Este reembolso sin devolución aplica solo si el producto llegó defectuoso o no coincide con la descripción; <strong>el costo de envío no se reembolsa</strong>.`
        : `Vas a iniciar la devolución de los productos del pedido ${numeroPedido(compra.ID_VENTA)}. Te reembolsaremos solo el valor de los productos; <strong>el costo de envío no se reembolsa</strong>.`) +
        (compra.ESTADO_ENVIO === "ENTREGADO"
          ? `<br/><br/>Recuerda que tienes <strong>${DIAS_DEVOLUCION} días</strong> desde la entrega para pedirlo.`
          : ""),
      showCancelButton: true,
      confirmButtonText: esReembolso ? "Sí, pedir reembolso" : "Sí, iniciar devolución",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    navigate(`/perfil/devolver/${compra.ID_VENTA}?tipo=${tipo}`);
  };

  const solicitarReembolsoCancelada = async () => {
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
      const monto = Number(data?.reembolso?.total ?? valorReembolsoCancelacion(compra));
      const incluyeEnvio = Number(data?.reembolso?.costoEnvio) > 0;
      const detalleMonto = incluyeEnvio
        ? "Incluye el valor de los productos y el costo de envío."
        : envioReembolsable(compra)
          ? "Corresponde al valor de los productos."
          : "El costo de envío no se reembolsa porque el pedido ya había sido despachado.";
      Swal.fire({
        icon: "success",
        title: "REEMBOLSO APROBADO",
        text: `El reembolso de ${fmt(monto)} fue aprobado automáticamente por la cancelación del pedido. ${detalleMonto} Se abonará en un máximo de 7 días.`,
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      }).then(() => navigate(`/perfil/reembolso/${compra.ID_VENTA}`));
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

  const guardarDireccion = async () => {
    setGuardandoDir(true);
    try {
      await axios.put(`/api/compras/${compra.ID_VENTA}/direccion`, {
        direccion: dir.DIRECCION_ENVIO,
        ciudad: dir.CIUDAD,
        barrio: dir.BARRIO,
        departamento: dir.DEPARTAMENTO,
        codigoPostal: dir.CODIGO_POSTAL,
        telefono: dir.TELEFONO_CONTACTO,
      }, { withCredentials: true });
      const res = await axios.get(`/api/compras/${compra.ID_VENTA}`, { withCredentials: true });
      setCompra(res.data);
      setEditandoDir(false);
      Swal.fire({
        icon: "success",
        title: "DIRECCIÓN ACTUALIZADA",
        timer: 1800,
        showConfirmButton: false,
        background: "#1a1a1a",
        color: "#fff",
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO GUARDAR",
        text: err.response?.data?.msg || "Error al guardar la dirección.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setGuardandoDir(false);
    }
  };

  return (
    <div className="rr-page">
      <div className="rr-card">
        <div className="rr-header">
          <button className="rr-volver" onClick={() => navigate("/perfil/compras")}>
            <FaArrowLeft /> Mis compras
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Compras", to: "/perfil/compras" }, { label: `Pedido ${numeroPedido(compra.ID_VENTA)}` }]} />
          <h1 className="rr-header-titulo"><FaHistory /> Pedido {numeroPedido(compra.ID_VENTA)}</h1>
          <span className="mc-badge" style={{ background: ev.color, marginLeft: "auto" }}>{ev.texto}</span>
        </div>

        <div className="rr-hero dc-hero">
          <div className="dc-hero-fecha">
            {new Date(compra.FECHA_VENTA).toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {compra.FECHA_ENTREGA && <span className="dc-hero-entrega"> · Entregado el {new Date(compra.FECHA_ENTREGA).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</span>}
          </div>
          <div className="rr-monto">
            {fmt(compra.TOTAL)}
            <small>TOTAL PAGADO</small>
          </div>
          {compra.METODO_PAGO && (
            <div className="dc-hero-metodo"><FaCreditCard /> Pagado con {compra.METODO_PAGO}</div>
          )}
        </div>

        {compra.ESTADO_ENVIO && compra.ESTADO_ENVIO !== "CANCELADO" && (
          <div className="rr-seccion">
            <h3 className="rr-seccion-titulo"><FaTruck /> Estado del envío</h3>
            <div className="rr-timeline">
              {PASOS_ENVIO.map((paso, i) => {
                const hecho = envioCompleto || idxEnvio > i;
                const activo = !envioCompleto && idxEnvio === i;
                return (
                  <div key={paso.clave} className={`rr-timeline-paso ${hecho || activo ? "hecho" : ""} ${activo ? "activo" : ""}`}>
                    <div className="rr-timeline-circulo">{hecho ? "✓" : i + 1}</div>
                    <div className="rr-timeline-label">{paso.etiqueta}</div>
                  </div>
                );
              })}
            </div>
            <p className="dc-envio-texto">{estadoEnvioTexto[compra.ESTADO_ENVIO] || compra.ESTADO_ENVIO}</p>
          </div>
        )}

        <div className="rr-seccion">
          <h3 className="rr-seccion-titulo"><FaMapMarkerAlt /> Dirección de envío</h3>
          {editandoDir ? (
            <div className="dc-dir-form">
              {[
                { campo: "DIRECCION_ENVIO", label: "Dirección" },
                { campo: "CIUDAD", label: "Ciudad" },
                { campo: "BARRIO", label: "Barrio" },
                { campo: "DEPARTAMENTO", label: "Departamento" },
                { campo: "CODIGO_POSTAL", label: "Código postal" },
                { campo: "TELEFONO_CONTACTO", label: "Teléfono" },
              ].map(({ campo, label }) => (
                <label key={campo} className="dc-dir-campo">
                  <span>{label}</span>
                  <input type="text" value={(dir as any)[campo] || ""} onChange={(e) => setDir((d) => ({ ...d, [campo]: e.target.value }))} />
                </label>
              ))}
              <label className="dc-dir-campo dc-dir-campo-full">
                <span>Observaciones</span>
                <textarea rows={2} value={dir.OBSERVACIONES || ""} onChange={(e) => setDir((d) => ({ ...d, OBSERVACIONES: e.target.value }))} />
              </label>
              <div className="dc-dir-acciones">
                <button className="rr-btn rr-btn-primario" onClick={guardarDireccion} disabled={guardandoDir}>
                  <FaSave /> {guardandoDir ? "Guardando..." : "Guardar"}
                </button>
                <button className="rr-btn rr-btn-secundario" onClick={() => setEditandoDir(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="dc-dir-info">
                <p><strong>Dirección:</strong> {compra.DIRECCION_ENVIO || "—"}</p>
                <p><strong>Ciudad:</strong> {compra.CIUDAD || "—"}{compra.BARRIO ? ` (${compra.BARRIO})` : ""}</p>
                <p><strong>Departamento:</strong> {compra.DEPARTAMENTO || "—"}</p>
                <p><strong>Teléfono:</strong> {compra.TELEFONO_CONTACTO || "—"}</p>
                {compra.OBSERVACIONES && <p><strong>Obs.:</strong> {compra.OBSERVACIONES}</p>}
              </div>
              {puedeEditarDir ? (
                <button className="rr-btn rr-btn-secundario" onClick={() => setEditandoDir(true)}>
                  <FaEdit /> Editar dirección
                </button>
              ) : (compra.ESTADO_ENVIO === "EN_CAMINO" || compra.ESTADO_ENVIO === "ENTREGADO") && (
                <p className="dc-dir-bloqueada">La dirección no puede modificarse porque el pedido ya salió del almacén.</p>
              )}
            </>
          )}
        </div>

        <div className="rr-seccion">
          <h3 className="rr-seccion-titulo"><FaBoxOpen /> Productos ({compra.productos.length})</h3>
          {compra.productos.map((p, i) => (
            <div key={i} className="dc-producto">
              <img src={p.IMAGEN || "https://placehold.co/64x64?text=JADDA"} alt={p.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = "https://placehold.co/64x64?text=JADDA"; }} />
              <div className="dc-prod-info">
                <h4>{p.NOMBRE}</h4>
                {(p.COLOR || p.ATRIBUTO) && (
                  <div className="dc-prod-variante">
                    {p.COLOR && <span className="dc-var-chip"><FaPalette /> {p.COLOR}</span>}
                    {p.ATRIBUTO && p.NOMBRE_ATRIBUTO && <span className="dc-var-chip"><FaTag /> {p.NOMBRE_ATRIBUTO}: {p.ATRIBUTO}</span>}
                  </div>
                )}
                <span className="dc-prod-unit">{fmt(p.PRECIO_UNITARIO)} c/u · x{p.CANTIDAD}</span>
              </div>
              <div className="dc-prod-acciones">
                <span className="dc-prod-subtotal">{fmt(p.SUBTOTAL)}</span>
                <button className="dc-btn-opinar" onClick={() => navigate(`/producto/${p.ID}`)}>
                  <FaStar /> Opinar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rr-seccion">
          <h3 className="rr-seccion-titulo"><FaWallet /> Totales</h3>
          <div className="dc-totales">
            <div className="dc-total-fila"><span>Subtotal ({compra.productos.length} art.)</span><strong>{fmt(subtotal)}</strong></div>
            <div className="dc-total-fila"><span>Envío{compra.COSTO_ENVIO === 0 ? " (gratis)" : ""}</span><strong>{fmt(compra.COSTO_ENVIO || 0)}</strong></div>
          </div>
          <div className="rr-total-refund">
            <span>TOTAL</span>
            <strong>{fmt(compra.TOTAL)}</strong>
          </div>
        </div>

        <div className="rr-seccion">
          <h3 className="rr-seccion-titulo"><FaCreditCard /> Pago</h3>
          <div className="rr-datos">
            <div className="rr-dato"><span>Método</span><strong>{compra.METODO_PAGO || "—"}</strong></div>
            {compra.REFERENCIA_PAGO && <div className="rr-dato"><span>Referencia</span><strong>{compra.REFERENCIA_PAGO}</strong></div>}
            {datosPago && (
              <div className="rr-dato dc-dato-full"><span>Datos de pago</span><strong>{Object.entries(datosPago).map(([k, v]) => `${k}: ${v}`).join(" · ")}</strong></div>
            )}
          </div>
        </div>

        <div className="rr-seccion">
          <h3 className="rr-seccion-titulo"><FaUndoAlt /> Devolución y reembolso</h3>
          {devAprobada ? (
            <>
              <p className="dc-reembolso-texto">
                {reembolso
                  ? compra.ESTADO === "CANCELADA"
                    ? `El reembolso de ${envioIncluido ? "los productos y el costo de envío" : "los productos"} fue aprobado automáticamente por la cancelación del pedido.${envioReembolsable(compra) ? "" : " El costo de envío no se reembolsa porque el pedido ya había sido despachado."} El dinero llegará a tu método de pago en un máximo de 7 días.`
                    : "El reembolso de los productos de este pedido fue aprobado. El costo de envío no se reembolsa; el dinero llegará a tu método de pago en un máximo de 7 días."
                  : "Tu devolución fue aprobada. El reembolso corresponde solo al valor de los productos; el costo de envío no se reembolsa."}
              </p>
              <button
                className="rr-btn rr-btn-primario"
                onClick={() => navigate(reembolso ? `/perfil/reembolso/${compra.ID_VENTA}` : `/perfil/devolucion/${compra.ID_VENTA}`)}
              >
                {reembolso ? <FaWallet /> : <FaUndoAlt />}{" "}
                {reembolso ? "Ver comprobante de reembolso" : "Ver estado de la devolución"}
              </button>
            </>
          ) : tieneDevolucionActiva(compra) ? (
            <>
              <p className="dc-reembolso-texto">Ya enviaste una solicitud de devolución o reembolso para este pedido. Puedes seguir su estado aquí:</p>
              <button
                className="rr-btn rr-btn-primario"
                onClick={() => navigate(reembolso ? `/perfil/reembolso/${compra.ID_VENTA}` : `/perfil/devolucion/${compra.ID_VENTA}`)}
              >
                <FaWallet /> {reembolso ? "Ver estado del reembolso" : "Ver estado de la devolución"}
              </button>
            </>
          ) : compra.ESTADO === "CANCELADA" ? (
            <>
              <p className="dc-reembolso-texto">
                {sinCobro
                  ? "Este pedido se canceló antes del despacho y no se registró ningún cobro, así que no hay un reembolso pendiente."
                  : `${envioReembolsable(compra) ? "Este pedido se canceló antes del despacho." : "Este pedido fue cancelado después de que salió del almacén."} El reembolso de ${envioIncluido ? `${fmt(valorReembolsoCancelacion(compra))} (productos y envío)` : "los productos"} se aprueba automáticamente${envioReembolsable(compra) ? "" : "; el costo de envío no se reembolsa porque ya había sido despachado"}.`}
              </p>
              {!sinCobro && (
                <button className="rr-btn rr-btn-primario" onClick={solicitarReembolsoCancelada}>
                  <FaWallet /> Solicitar reembolso
                </button>
              )}
            </>
          ) : compra.ESTADO === "COMPLETADA" && puedeDevolver(compra) ? (
            <>
              <p className="dc-reembolso-texto">
                Tienes {DIAS_DEVOLUCION} días desde la entrega para elegir una opción: reembolso sin devolver el producto (solo si llegó defectuoso o no coincide con la descripción) o devolución del producto (cambio de opinión o de talla).
              </p>
              <div className="dc-reembolso-acciones">
                <button className="rr-btn rr-btn-primario" onClick={() => pedirDevolucion("REEMBOLSO")}>
                  <FaWallet /> Solicitar reembolso
                </button>
                <button className="rr-btn rr-btn-secundario" onClick={() => pedirDevolucion("DEVOLUCION")}>
                  <FaUndoAlt /> Devolver producto
                </button>
              </div>
              <p className="dc-reembolso-nota">Solo se reembolsa el valor de los productos; el costo de envío no se reembolsa.</p>
            </>
          ) : compra.ESTADO === "COMPLETADA" && devolucionVencida(compra) ? (
            <p className="dc-reembolso-texto dc-plazo-vencido">
              El plazo de {DIAS_DEVOLUCION} días para pedir devolución o reembolso ya venció (la entrega fue el {new Date((compra.FECHA_ENTREGA || compra.FECHA_VENTA)!).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}).
            </p>
          ) : (
            <p className="dc-reembolso-texto">
              {mensajeDevolucionNoDisponible(compra) || "Podrás pedir devolución o reembolso cuando el pedido esté completado."}
            </p>
          )}
        </div>

        <div className="rr-acciones">
          <button className="rr-btn rr-btn-secundario" onClick={() => navigate("/perfil/compras")}>
            <FaArrowLeft /> Volver a mis compras
          </button>
          {compra.ESTADO === "PENDIENTE_PAGO" && (
            <button
              className="rr-btn rr-btn-primario"
              onClick={async () => {
                // Pestaña preparada en el click (antes del await) para que el
                // navegador no la bloquee; esta pestaña va a la espera.
                prepararVentanaWompi();
                try {
                  const r = await axios.post("/api/pagos/pagar", { idVenta: compra.ID_VENTA }, { withCredentials: true });
                  if (r.data?.urlCheckout) {
                    const abierta = navegarVentanaWompi(r.data.urlCheckout);
                    navigate(
                      `/compra-exitosa/${compra.ID_VENTA}`,
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
              }}
            >
              <FaCreditCard /> Pagar ahora
            </button>
          )}
          <button
            className="rr-btn rr-btn-primario"
            onClick={async () => {
              try {
                const res = await axios.get(`/api/compras/${compra.ID_VENTA}/factura`, { withCredentials: true, responseType: "blob" });
                const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `factura-${compra.ID_VENTA}.pdf`;
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
            }}
          >
            <FaFilePdf /> Factura PDF
          </button>
        </div>
      </div>
    </div>
  );
}
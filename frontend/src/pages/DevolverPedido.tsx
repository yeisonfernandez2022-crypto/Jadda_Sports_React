import "../css/DevolverPedido.css";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { volverAtras } from "../utils/volverAtras";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaArrowLeft, FaBoxOpen, FaWallet, FaUndoAlt, FaPlus, FaMinus,
  FaPaperclip, FaTimes, FaCheckCircle, FaImage, FaVideo,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
import { DIAS_DEVOLUCION, mensajeDevolucionNoDisponible } from "../utils/estadoCompra";
import Breadcrumb from "../components/Breadcrumb";

interface Producto {
  ID: number;
  ID_DETALLE: number;
  NOMBRE: string;
  IMAGEN: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
  COLOR: string | null;
  NOMBRE_ATRIBUTO: string | null;
  ATRIBUTO: string | null;
}

interface Venta {
  ID_VENTA: number;
  FECHA_VENTA: string;
  FECHA_ENTREGA?: string | null;
  TOTAL: number;
  COSTO_ENVIO?: number | null;
  ESTADO: string;
  METODO_PAGO: string | null;
  ESTADO_ENVIO: string | null;
  REEMBOLSO_ESTADOS?: string | null;
  DEVOLUCION_TIPOS?: string | null;
  productos: Producto[];
}

// Reembolso sin retorno: solo por defecto/fabricación o porque lo recibido no
// coincide con lo descrito. Cambio de opinión o talla equivocada → DEVOLUCIÓN.
const MOTIVOS_REEMBOLSO = [
  "Producto llegó dañado o defectuoso",
  "Producto no coincide con la descripción",
];

const MOTIVOS_DEVOLUCION = [
  "Producto llegó dañado o defectuoso",
  "Producto no coincide con la descripción",
  "Talla, color o modelo equivocado",
  "No me sirvió el producto",
  "Llegó tarde y ya no lo necesito",
  "Otro motivo",
];

const MAX_EVIDENCIAS = 5;
const MAX_MB_POR_ARCHIVO = 25;

export default function DevolverPedido() {
  const { idVenta } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoInicial = searchParams.get("tipo") === "REEMBOLSO" ? "REEMBOLSO" : "DEVOLUCION";

  const [venta, setVenta] = useState<Venta | null>(null);
  const [loading, setLoading] = useState(true);
  const [bloqueo, setBloqueo] = useState<string | null>(null);

  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [tipo, setTipo] = useState<"DEVOLUCION" | "REEMBOLSO">(tipoInicial);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const motivosDisponibles = tipo === "REEMBOLSO" ? MOTIVOS_REEMBOLSO : MOTIVOS_DEVOLUCION;

  useEffect(() => {
    const permitidos = tipo === "REEMBOLSO" ? MOTIVOS_REEMBOLSO : MOTIVOS_DEVOLUCION;
    setMotivo((prev) => (prev && !permitidos.includes(prev) ? "" : prev));
  }, [tipo]);

  useEffect(() => {
    const fetchVenta = async () => {
      try {
        const res = await axios.get(`/api/compras/${idVenta}`, { withCredentials: true });
        setVenta(res.data);
        setBloqueo(mensajeDevolucionNoDisponible(res.data));
        const sel: Record<number, number> = {};
        for (const p of res.data.productos || []) sel[p.ID_DETALLE] = p.CANTIDAD;
        setSeleccion(sel);
      } catch {
        Swal.fire({
          icon: "error",
          title: "NO SE PUDO CARGAR EL PEDIDO",
          background: "#1a1a1a",
          color: "#fff",
          confirmButtonColor: "#e63946",
        });
        navigate("/perfil/compras");
      } finally {
        setLoading(false);
      }
    };
    fetchVenta();
  }, [idVenta, navigate]);

  const totalSeleccionado = venta?.productos.reduce(
    (acc, p) => acc + (seleccion[p.ID_DETALLE] || 0), 0
  ) || 0;

  const valorSeleccionado = venta?.productos.reduce((acc, p) => {
    const cantidad = Number(p.CANTIDAD) || 0;
    const linea = p.SUBTOTAL != null && Number.isFinite(Number(p.SUBTOTAL))
      ? Number(p.SUBTOTAL)
      : Number(p.PRECIO_UNITARIO) * cantidad;
    return acc + (cantidad > 0 ? (linea / cantidad) * (seleccion[p.ID_DETALLE] || 0) : 0);
  }, 0) || 0;

  const subirArchivos = async (files: FileList | File[]) => {
    if (!files.length) return;
    if (evidencias.length + files.length > MAX_EVIDENCIAS) {
      Swal.fire({ icon: "warning", title: `Máximo ${MAX_EVIDENCIAS} evidencias`, background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      return;
    }
    setSubiendo(true);
    try {
      const form = new FormData();
      Array.from(files).forEach(f => form.append("evidencias", f));
      const res = await axios.post("/api/devoluciones/evidencias", form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvidencias(prev => [...prev, ...res.data.urls].slice(0, MAX_EVIDENCIAS));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO SUBIR",
        text: err.response?.data?.msg || "Revisa el tamaño (máx 25 MB por archivo).",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    if (!venta || totalSeleccionado === 0) {
      Swal.fire({ icon: "warning", title: "Selecciona al menos un producto", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      return;
    }
    if (!motivo.trim()) {
      Swal.fire({ icon: "warning", title: "Elige el motivo", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946" });
      return;
    }
    if (tipo === "REEMBOLSO" && !MOTIVOS_REEMBOLSO.includes(motivo)) {
      Swal.fire({
        icon: "warning",
        title: "Motivo no válido para reembolso",
        text: "El reembolso sin devolución aplica solo si el producto llegó defectuoso o no coincide con la descripción. Si cambiaste de opinión, selecciona Devolver los productos.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
      return;
    }
    setEnviando(true);
    try {
      const porProducto = new Map<number, number>();
      for (const p of venta.productos) {
        const cant = seleccion[p.ID_DETALLE] || 0;
        if (cant > 0) porProducto.set(p.ID, (porProducto.get(p.ID) || 0) + cant);
      }
      const items = [...porProducto].map(([idProducto, cantidad]) => ({
        id_producto: idProducto,
        cantidad,
      }));
      const res = await axios.post(
        "/api/devoluciones",
        {
          id_venta: venta.ID_VENTA,
          items,
          tipo,
          motivo: motivo.trim(),
          descripcion: descripcion.trim() || null,
          evidencias,
        },
        { withCredentials: true }
      );
      await Swal.fire({
        icon: "success",
        title: "SOLICITUD ENVIADA",
        text: res.data.msg || "Nuestro equipo revisará tu solicitud en un máximo de 48 horas.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
      // Al enviar el formulario se va al DETALLE de la devolución,
      // donde aparece el chat con el vendedor si el producto es suyo
      navigate(`/perfil/devolucion/${venta.ID_VENTA}`);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO ENVIAR",
        text: err.response?.data?.msg || "Error al enviar la solicitud.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="devolver-page">
      <div className="devolver-card">
        <div className="devolver-header">
          <button className="devolver-volver" onClick={() => volverAtras(navigate, "/perfil/compras")}>
            <FaArrowLeft /> Volver
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Compras", to: "/perfil/compras" }, { label: "Devolver o pedir reembolso" }]} />
          <h1><FaUndoAlt className="devolver-icon-title" /> Devolver o pedir reembolso</h1>
          {venta && <p className="devolver-pedido">Pedido {numeroPedido(venta.ID_VENTA)} · {new Date(venta.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>}
          <p className="devolver-politica">
            Solicita dentro de los {DIAS_DEVOLUCION} días posteriores a la entrega. El reembolso sin devolución aplica solo si el producto llegó defectuoso o no coincide con la descripción. El costo de envío no se reembolsa.
          </p>
        </div>

        {loading ? (
          <div className="devolver-loading">Cargando pedido...</div>
        ) : !venta ? null : bloqueo ? (
          <div className="devolver-bloqueo">
            <FaBoxOpen />
            <h3>Devolución no disponible</h3>
            <p>{bloqueo}</p>
            <div className="devolver-bloqueo-acciones">
              <button className="devolver-bloqueo-secundario" onClick={() => navigate(`/perfil/compra/${venta.ID_VENTA}`)}>
                Ver mi compra
              </button>
              <button className="devolver-bloqueo-principal" onClick={() => navigate("/perfil/compras")}>
                Ir a mis compras
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="devolver-seccion">
              <h3>1. ¿Qué productos?</h3>
              <div className="devolver-productos">
                {venta.productos.map(p => (
                  <div key={p.ID_DETALLE} className={`devolver-producto ${(seleccion[p.ID_DETALLE] || 0) > 0 ? "seleccionado" : ""}`}>
                    <img src={p.IMAGEN || "https://placehold.co/400x400?text=JADDA"} alt={p.NOMBRE} onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400?text=JADDA"; }} />
                    <div className="devolver-prod-info">
                      <h4>{p.NOMBRE}</h4>
                      {p.COLOR && <span className="devolver-chip">{p.COLOR}</span>}
                      {p.ATRIBUTO && p.NOMBRE_ATRIBUTO && <span className="devolver-chip">{p.NOMBRE_ATRIBUTO}: {p.ATRIBUTO}</span>}
                      <small>${((p.SUBTOTAL != null && Number(p.CANTIDAD) > 0 ? Number(p.SUBTOTAL) / Number(p.CANTIDAD) : Number(p.PRECIO_UNITARIO))).toLocaleString("es-CO")} c/u</small>
                    </div>
                    <div className="devolver-stepper">
                      <button onClick={() => setSeleccion(prev => ({ ...prev, [p.ID_DETALLE]: Math.max(0, (prev[p.ID_DETALLE] || 0) - 1) }))}>
                        <FaMinus />
                      </button>
                      <span>{seleccion[p.ID_DETALLE] || 0}</span>
                      <button onClick={() => setSeleccion(prev => ({ ...prev, [p.ID_DETALLE]: Math.min(p.CANTIDAD, (prev[p.ID_DETALLE] || 0) + 1) }))}>
                        <FaPlus />
                      </button>
                    </div>
                    <small className="devolver-max">máx {p.CANTIDAD}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="devolver-seccion">
              <h3>2. ¿Qué prefieres?</h3>
              <div className="devolver-tipos">
                <button className={`devolver-tipo ${tipo === "DEVOLUCION" ? "activo" : ""}`} onClick={() => setTipo("DEVOLUCION")}>
                  <FaBoxOpen />
                  <strong>Devolver los productos</strong>
                  <small>Recibimos el producto de vuelta y te reembolsamos el valor de los productos. El envío no se reembolsa.</small>
                </button>
                <button className={`devolver-tipo ${tipo === "REEMBOLSO" ? "activo" : ""}`} onClick={() => setTipo("REEMBOLSO")}>
                  <FaWallet />
                  <strong>Solo reembolso</strong>
                  <small>Para productos defectuosos o que no coinciden con lo descrito. Conservas el producto; el envío no se reembolsa.</small>
                </button>
              </div>
              <p className="devolver-hint">
                El reembolso sin devolución aplica únicamente si el producto llegó defectuoso o no coincide con la descripción. El costo de envío no se reembolsa en ninguno de los dos casos.
              </p>
            </div>

            <div className="devolver-seccion">
              <h3>3. ¿Por qué?</h3>
              {tipo === "REEMBOLSO" && (
                <p className="devolver-hint">
                  Solo puedes pedir reembolso sin devolver el producto por defecto de fábrica o porque lo recibido no coincide con lo descrito.
                </p>
              )}
              <select className="devolver-select" value={motivo} onChange={e => setMotivo(e.target.value)}>
                <option value="">Selecciona un motivo...</option>
                {motivosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <textarea
                className="devolver-textarea"
                rows={4}
                maxLength={2000}
                placeholder="Cuéntanos con más detalle qué pasó (opcional, máx 2000 caracteres)"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
              />
            </div>

            <div className="devolver-seccion">
              <h3>4. Evidencias (fotos o videos)</h3>
              <p className="devolver-hint">Ayudan a resolver tu solicitud más rápido. Máximo {MAX_EVIDENCIAS} archivos de hasta {MAX_MB_POR_ARCHIVO} MB.</p>
              <label className="devolver-dropzone">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.mov"
                  onChange={e => { if (e.target.files) subirArchivos(e.target.files); e.target.value = ""; }}
                />
                <FaPaperclip />
                {subiendo ? "Subiendo..." : "Adjuntar fotos o videos"}
              </label>
              {evidencias.length > 0 && (
                <div className="devolver-evidencias">
                  {evidencias.map((url, i) => {
                    const esVideo = /\.(mp4|webm|mov)$/i.test(url);
                    return (
                      <div key={url + i} className="devolver-evidencia">
                        {esVideo ? (
                          <video src={url} preload="metadata" />
                        ) : (
                          <img src={url} alt={`Evidencia ${i + 1}`} />
                        )}
                        <span className="devolver-evidencia-tipo">{esVideo ? <FaVideo /> : <FaImage />}</span>
                        <button
                          className="devolver-evidencia-x"
                          title="Quitar"
                          onClick={() => setEvidencias(prev => prev.filter(u => u !== url))}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="devolver-footer">
              <div className="devolver-resumen">
                <span>{totalSeleccionado} artículo{totalSeleccionado !== 1 ? "s" : ""} · valor de productos</span>
                <strong>${valorSeleccionado.toLocaleString("es-CO")}</strong>
                <small className="devolver-resumen-nota">No incluye el costo de envío.</small>
              </div>
              <button className="devolver-enviar" onClick={enviar} disabled={enviando || subiendo}>
                {enviando ? "Enviando..." : <><FaCheckCircle /> Enviar solicitud</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
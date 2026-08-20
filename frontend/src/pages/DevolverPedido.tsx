import "../css/DevolverPedido.css";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaArrowLeft, FaBoxOpen, FaWallet, FaUndoAlt, FaPlus, FaMinus,
  FaPaperclip, FaTimes, FaCheckCircle, FaImage, FaVideo,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";
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
}

interface Venta {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  METODO_PAGO: string | null;
  ESTADO_ENVIO: string | null;
  productos: Producto[];
}

const MOTIVOS = [
  "Producto llegó dañado o defectuoso",
  "Producto no coincide con la descripción",
  "Talla, color o modelo equivocado",
  "No me sirvió el producto",
  "Llegó tarde y ya no lo necesito",
  "Otro motivo",
];

const MAX_EVIDENCIAS = 8;
const MAX_MB_POR_ARCHIVO = 100;

export default function DevolverPedido() {
  const { idVenta } = useParams();
  const navigate = useNavigate();

  const [venta, setVenta] = useState<Venta | null>(null);
  const [loading, setLoading] = useState(true);

  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [tipo, setTipo] = useState<"DEVOLUCION" | "REEMBOLSO">("DEVOLUCION");
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const fetchVenta = async () => {
      try {
        const res = await axios.get(`/api/compras/${idVenta}`, { withCredentials: true });
        setVenta(res.data);
        const sel: Record<number, number> = {};
        for (const p of res.data.productos || []) sel[p.ID] = p.CANTIDAD;
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
    (acc, p) => acc + (seleccion[p.ID] || 0), 0
  ) || 0;

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
        text: err.response?.data?.msg || "Revisa el tamaño (máx 100 MB por archivo).",
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
    setEnviando(true);
    try {
      const items = Object.entries(seleccion)
        .filter(([, cant]) => (cant || 0) > 0)
        .map(([id, cant]) => ({ id_producto: Number(id), cantidad: cant }));
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
      navigate("/perfil/compras");
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
          <button className="devolver-volver" onClick={() => navigate("/perfil/compras")}>
            <FaArrowLeft /> Volver
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Compras", to: "/perfil/compras" }, { label: "Devolver o pedir reembolso" }]} />
          <h1><FaUndoAlt className="devolver-icon-title" /> Devolver o pedir reembolso</h1>
          {venta && <p className="devolver-pedido">Pedido {numeroPedido(venta.ID_VENTA)} · {new Date(venta.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>}
        </div>

        {loading ? (
          <div className="devolver-loading">Cargando pedido...</div>
        ) : !venta ? null : (
          <>
            <div className="devolver-seccion">
              <h3>1. ¿Qué productos?</h3>
              <div className="devolver-productos">
                {venta.productos.map(p => (
                  <div key={p.ID} className={`devolver-producto ${(seleccion[p.ID] || 0) > 0 ? "seleccionado" : ""}`}>
                    <img src={p.IMAGEN || "https://placehold.co/400x400?text=JADDA"} alt={p.NOMBRE} onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400?text=JADDA"; }} />
                    <div className="devolver-prod-info">
                      <h4>{p.NOMBRE}</h4>
                      {p.COLOR && <span className="devolver-chip">{p.COLOR}</span>}
                      {p.ATRIBUTO && p.NOMBRE_ATRIBUTO && <span className="devolver-chip">{p.NOMBRE_ATRIBUTO}: {p.ATRIBUTO}</span>}
                      <small>${p.PRECIO_UNITARIO.toLocaleString("es-CO")} c/u</small>
                    </div>
                    <div className="devolver-stepper">
                      <button onClick={() => setSeleccion(prev => ({ ...prev, [p.ID]: Math.max(0, (prev[p.ID] || 0) - 1) }))}>
                        <FaMinus />
                      </button>
                      <span>{seleccion[p.ID] || 0}</span>
                      <button onClick={() => setSeleccion(prev => ({ ...prev, [p.ID]: Math.min(p.CANTIDAD, (prev[p.ID] || 0) + 1) }))}>
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
                  <small>Recogemos o recibimos el producto de vuelta y te reembolsamos</small>
                </button>
                <button className={`devolver-tipo ${tipo === "REEMBOLSO" ? "activo" : ""}`} onClick={() => setTipo("REEMBOLSO")}>
                  <FaWallet />
                  <strong>Solo reembolso</strong>
                  <small>Te devolvemos el dinero sin necesidad de enviar el producto</small>
                </button>
              </div>
            </div>

            <div className="devolver-seccion">
              <h3>3. ¿Por qué?</h3>
              <select className="devolver-select" value={motivo} onChange={e => setMotivo(e.target.value)}>
                <option value="">Selecciona un motivo...</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
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
                <span>{totalSeleccionado} artículo{totalSeleccionado !== 1 ? "s" : ""}</span>
                <strong>${venta.TOTAL.toLocaleString("es-CO")}</strong>
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
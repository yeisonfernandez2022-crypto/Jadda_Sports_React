import Swal from "sweetalert2";
import { FaBoxOpen } from "react-icons/fa";

/** Fecha de hoy en formato ISO (YYYY-MM-DD). */
export const fechaHoy = () => new Date().toISOString().slice(0, 10);

/** Fecha de hace N días en formato ISO (YYYY-MM-DD). */
export const fechaHaceDias = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

/** Formato corto es-CO según la granularidad del día recibido. */
export const formatearFecha = (iso: string) => {
  if (/^\d{4}$/.test(iso)) return iso;
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const d = new Date(iso + "-01T00:00:00");
    if (Number.isNaN(d.getTime())) return iso.slice(5);
    return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
  }
  const soloFecha = iso.includes("T") ? iso.slice(0, 10) : iso;
  const d = new Date(soloFecha + "T00:00:00");
  if (Number.isNaN(d.getTime())) return soloFecha.slice(5);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

/** Muestreo para no amontonar: máximo 12 barras visibles, con intervalo en diario. */
export const muestrear = <T,>(arr: T[], max = 12): T[] => {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
};

/** Fila de "más vendidos" (GET .../mas-vendidos). */
export interface MasVendido {
  ID: number;
  NOMBRE: string;
  IMAGEN: string;
  unidades: number;
  ingresos: number;
  stock: number;
}

/** Descarga blob del reporte en Excel o PDF con un rango dado (Admin y Vendedor
 *  compartían el mismo flujo char por char, solo cambiaba URL y prefijo). */
export const descargarReporte = async ({
  formato,
  url,
  desde,
  hasta,
  prefijoArchivo,
  setDescargando,
}: {
  formato: "excel" | "pdf";
  url: string;
  desde: string;
  hasta: string;
  prefijoArchivo: string;
  setDescargando: (v: "excel" | "pdf" | null) => void;
}) => {
  setDescargando(formato);
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = `${prefijoArchivo}_${desde}_a_${hasta}.${formato === "excel" ? "xlsx" : "pdf"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(urlObj);
    void Swal.fire({ icon: "success", title: formato === "excel" ? "Excel descargado" : "PDF descargado", text: `Reporte del ${desde} al ${hasta}`, timer: 1800, showConfirmButton: false });
  } catch {
    void Swal.fire({ icon: "error", title: "No se pudo descargar", text: "Intenta de nuevo en unos segundos." });
  } finally {
    setDescargando(null);
  }
};

/**
 * Tarjeta "Productos más vendidos" (ap-tabla con ranking, clic para editar).
 * Compartida por AdminReportes y VendedorReportes: el CSS ap-/tb- ya lo
 * importan las páginas consumidores (adminDashboard.css).
 */
export const TarjetaMasVendidos = ({ titulo, items, onAbrirEdicion, anchos }: {
  titulo: string;
  items: MasVendido[];
  onAbrirEdicion: (id: number) => void;
  /** Anchos de columna: # / Producto / Unidades / Ingresos / Stock. */
  anchos: string[];
}) => (
  <div className="bg-white rounded shadow-sm border">
    <div className="p-3 border-bottom">
      <h5 className="fw-bold m-0"><FaBoxOpen className="me-2 text-danger" />{titulo}</h5>
      <small className="text-muted">Ranking por unidades facturadas (excluye pedidos cancelados)</small>
    </div>
    <div>
      <table className="ap-tabla">
        <thead>
          <tr>
            <th style={{ width: anchos[0] }}>#</th>
            <th style={{ width: anchos[1] }}>Producto</th>
            <th style={{ width: anchos[2], textAlign: "center" }}>Unidades</th>
            <th style={{ width: anchos[3], textAlign: "right" }}>Ingresos</th>
            <th style={{ width: anchos[4], textAlign: "center" }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={5} className="text-center text-muted py-4">Sin ventas en el rango seleccionado</td></tr>
          ) : (
            items.map((p, i) => (
              <tr key={p.ID} style={{ cursor: "pointer" }} onClick={() => onAbrirEdicion(p.ID)}>
                <td><span className="ap-id">{i + 1}</span></td>
                <td>
                  <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                    <img
                      src={p.IMAGEN || "https://placehold.co/400x400?text=JADDA"}
                      alt={p.NOMBRE}
                      className="ap-img"
                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                    />
                    <span className="tb-ellip tb-strong" title={p.NOMBRE}>{p.NOMBRE}</span>
                  </div>
                </td>
                <td className="text-center tb-strong">{p.unidades}</td>
                <td className="text-end tb-strong">${p.ingresos.toLocaleString("es-CO")}</td>
                <td className="text-center">
                  {p.stock === 0 ? (
                    <span className="ap-stock agotado">Agotado</span>
                  ) : p.stock <= 10 ? (
                    <span className="ap-stock bajo">¡Solo quedan {p.stock}!</span>
                  ) : (
                    <span className="ap-stock ok">{p.stock} uds</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

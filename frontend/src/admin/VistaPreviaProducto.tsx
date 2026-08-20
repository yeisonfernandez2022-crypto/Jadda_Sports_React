import { FaPalette, FaTag } from "react-icons/fa";

export interface VariantePreview {
  COLOR?: string;
  NOMBRE_ATRIBUTO?: string;
  ATRIBUTO?: string;
  STOCK?: number;
}

interface Props {
  imagen?: string;
  nombre: string;
  marca: string;
  precio: number;
  descuentoPorcentaje?: number | null;
  categoria?: string;
  variantes?: VariantePreview[];
  stockTotal?: number;
  descripcion?: string;
  vertical?: boolean;
}

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const colorCategoria = (nombre: string) => {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${hash}, 65%, 45%)`;
};

const VistaPreviaProducto = ({
  imagen, nombre, marca, precio, descuentoPorcentaje, categoria,
  variantes = [], stockTotal = 0, descripcion, vertical = false,
}: Props) => {
  const pct = Number(descuentoPorcentaje) || 0;
  const precioFinal = pct > 0 ? precio - (precio * pct / 100) : precio;
  const variantesValidas = variantes.filter(v => (v.COLOR || "").trim() && (v.ATRIBUTO || "").trim());

  return (
    <div className={`ap-preview-card ${vertical ? "vertical" : ""}`}>
      <img
        className="ap-preview-img"
        src={imagen || PLACEHOLDER_IMG}
        alt={nombre || "Producto"}
        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
      />
      <div className="ap-preview-info">
        {categoria && (
          <span className="ap-chip ap-preview-chip" style={{ background: `${colorCategoria(categoria)}18`, color: colorCategoria(categoria) }}>
            {categoria}
          </span>
        )}
        <span className="ap-preview-marca">{marca || "Marca Genérica"}</span>
        <strong className="ap-preview-nombre">{nombre || "Nombre del producto"}</strong>
        <div className="ap-preview-precios">
          {pct > 0 && (
            <span className="ap-preview-precio-orig">${Math.round(precio).toLocaleString("es-CO")}</span>
          )}
          <span className="ap-preview-precio">${Math.round(precioFinal).toLocaleString("es-CO")}</span>
          {pct > 0 && <span className="ap-preview-badge">-{pct}%</span>}
        </div>
        {variantesValidas.length > 0 && (
          <div className="ap-preview-variantes">
            {variantesValidas.slice(0, 4).map((v, i) => (
              <span key={i} className="ap-preview-variante">
                {v.COLOR && <><FaPalette /> {v.COLOR} </>}
                {v.ATRIBUTO && <><FaTag /> {v.NOMBRE_ATRIBUTO}: {v.ATRIBUTO}</>}
              </span>
            ))}
            {variantesValidas.length > 4 && <span className="ap-preview-variante">+{variantesValidas.length - 4}</span>}
          </div>
        )}
        {stockTotal > 0 && <span className="ap-preview-stock">{stockTotal} unidades</span>}
        {descripcion && <p className="ap-preview-desc">{descripcion}</p>}
      </div>
    </div>
  );
};

export default VistaPreviaProducto;
import { useAuth } from "../context/AuthContext";

interface ProductoCard {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA?: string;
  IMAGEN: string;
  ID_DESCUENTO?: number | null;
  STOCK?: number;
  RATING?: number | null;
  RESENA_COUNT?: number;
}

interface ProductCardProps {
  producto: ProductoCard;
  descuentoPorcentaje?: number;
  onVerDetalle: (id: number) => void;
  onAgregarCarrito?: (id: number) => void;
  onToggleFavorito?: (id: number) => void;
  esFavorito?: boolean;
}

const STOCK_MAXIMO_SIN_AVISO = 10;

function ProductCard({ producto, descuentoPorcentaje, onVerDetalle, onAgregarCarrito, onToggleFavorito, esFavorito }: ProductCardProps) {
  const { esAdmin, esVendedor } = useAuth();
  const precioOriginal = Number(producto.PRECIO);
  const precioConDescuento = descuentoPorcentaje
    ? precioOriginal - (precioOriginal * descuentoPorcentaje / 100)
    : null;

  const stock = Number(producto.STOCK);
  const agotado = !Number.isNaN(stock) && stock <= 0;
  const stockBajo = !Number.isNaN(stock) && stock > 0 && stock <= STOCK_MAXIMO_SIN_AVISO;
  const rating = Number(producto.RATING) || 0;
  const tieneRating = (Number(producto.RESENA_COUNT) || 0) > 0;

  return (
    <div className="card h-100 shadow-sm border-0 overflow-hidden product-card">
      <div className="position-relative">
        {descuentoPorcentaje && (
          <span className="badge bg-danger position-absolute top-0 start-0 m-2 fs-6 z-1">
            -{descuentoPorcentaje}%
          </span>
        )}
        {agotado && (
          <span className="badge bg-secondary position-absolute top-0 start-0 m-2 fs-6 z-1">
            AGOTADO
          </span>
        )}
        {stockBajo && (
          <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2 fs-6 z-1">
            ¡Solo quedan {stock}!
          </span>
        )}
        {onToggleFavorito && !esAdmin && (
          <button
            className="btn position-absolute top-0 end-0 m-2"
            style={{ zIndex: 2, background: "white", borderRadius: "50%", width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { e.stopPropagation(); onToggleFavorito(producto.ID); }}
          >
            <i
              className={`fa${esFavorito ? "s" : "r"} fa-heart`}
              style={{ color: esFavorito ? "red" : "#999", fontSize: "0.9rem" }}
            ></i>
          </button>
        )}
        <div
          className="img-container-custom"
          style={{ opacity: agotado ? 0.55 : 1, cursor: "pointer" }}
          onClick={() => onVerDetalle(producto.ID)}
          title={`Ver detalles de ${producto.NOMBRE}`}
        >
          <img
            src={producto.IMAGEN}
            className="img-fluid w-100 h-100"
            style={{ objectFit: "cover" }}
            alt={producto.NOMBRE}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
          />
        </div>
      </div>
      <div className="card-body text-center p-2 d-flex flex-column">
        <small className="text-muted text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "1px" }}>
          {producto.MARCA}
        </small>
        <h6 className="card-title fw-bold text-uppercase mt-1 mb-2" style={{ fontSize: "0.9rem", lineHeight: 1.3 }}>
          {producto.NOMBRE}
        </h6>
        {tieneRating && (
          <div className="mb-1" style={{ fontSize: "0.8rem", lineHeight: 1 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <i
                key={star}
                className={`fa${star <= Math.round(rating) ? "s" : "r"} fa-star`}
                style={{ color: star <= Math.round(rating) ? "#f5b301" : "#ccc", marginRight: 1 }}
              ></i>
            ))}
            <span className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>
              {rating.toLocaleString("es-CO")} ({producto.RESENA_COUNT})
            </span>
          </div>
        )}
        {precioConDescuento ? (
          <>
            <p className="text-muted mb-0" style={{ fontSize: "0.85rem", textDecoration: "line-through" }}>
              ${precioOriginal.toLocaleString("es-CO")}
            </p>
            <p className="text-danger fs-5 fw-bold mb-3">
              ${precioConDescuento.toLocaleString("es-CO")}
            </p>
          </>
        ) : (
          <p className="text-danger fs-5 fw-bold mb-3">
            ${precioOriginal.toLocaleString("es-CO")}
          </p>
        )}
        <div className="d-flex gap-2 mt-auto">
          <button
            className="btn btn-dark flex-grow-1 fw-bold py-2"
            style={{ fontSize: "0.78rem", borderRadius: "30px" }}
            onClick={() => onVerDetalle(producto.ID)}
          >
            VER DETALLES
          </button>
          {onAgregarCarrito && !esAdmin && (
            <button
              className="btn btn-outline-danger fw-bold py-2"
              style={{ borderRadius: "30px", opacity: agotado || esVendedor ? 0.5 : 1, cursor: esVendedor ? "not-allowed" : undefined }}
              onClick={() => onAgregarCarrito(producto.ID)}
              disabled={agotado}
              title={agotado ? "Producto agotado" : esVendedor ? "Los vendedores no pueden comprar en la tienda" : "Agregar al carrito"}
            >
              <i className="fas fa-shopping-cart"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;

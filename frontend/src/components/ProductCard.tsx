interface ProductoCard {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA: string;
  IMAGEN: string;
  ID_DESCUENTO: number | null;
}

interface ProductCardProps {
  producto: ProductoCard;
  descuentoPorcentaje?: number;
  onVerDetalle: (id: number) => void;
  onAgregarCarrito?: (id: number) => void;
  onToggleFavorito?: (id: number) => void;
  esFavorito?: boolean;
}

function ProductCard({ producto, descuentoPorcentaje, onVerDetalle, onAgregarCarrito, onToggleFavorito, esFavorito }: ProductCardProps) {
  const precioOriginal = Number(producto.PRECIO);
  const precioConDescuento = descuentoPorcentaje
    ? precioOriginal - (precioOriginal * descuentoPorcentaje / 100)
    : null;

  return (
    <div className="card h-100 shadow-sm border-0 overflow-hidden product-card">
      <div className="position-relative">
        {descuentoPorcentaje && (
          <span className="badge bg-danger position-absolute top-0 start-0 m-2 fs-6 z-1">
            -{descuentoPorcentaje}%
          </span>
        )}
        {onToggleFavorito && (
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
        <div className="img-container-custom">
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
      <div className="card-body text-center p-3 d-flex flex-column">
        <small className="text-muted text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "1px" }}>
          {producto.MARCA}
        </small>
        <h6 className="card-title fw-bold text-uppercase mt-1 mb-2" style={{ fontSize: "0.9rem", lineHeight: 1.3 }}>
          {producto.NOMBRE}
        </h6>
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
          {onAgregarCarrito && (
            <button
              className="btn btn-outline-danger fw-bold py-2"
              style={{ borderRadius: "30px" }}
              onClick={() => onAgregarCarrito(producto.ID)}
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

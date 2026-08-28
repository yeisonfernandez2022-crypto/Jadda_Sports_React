import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

interface ProductoModal {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  ID_VARIANTE_POR_DEFECTO?: number;
}

interface Variante {
  ID_VARIANTE: number;
  ID_PRODUCTO: number;
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

interface SelectorVarianteModalProps {
  producto: ProductoModal;
  esAdmin?: boolean;
  onCerrar: () => void;
  onAgregar: (idVariante: number, cantidad: number) => void;
}

/**
 * Modal de selección de variante (color + atributo/talla + cantidad).
 * Se usa tanto en el catálogo como en la página principal.
 */
function SelectorVarianteModal({ producto, esAdmin, onCerrar, onAgregar }: SelectorVarianteModalProps) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [color, setColor] = useState("");
  const [atributo, setAtributo] = useState("");
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    let activo = true;
    fetch(`/api/productos/${producto.ID}/variantes`)
      .then((res) => res.json())
      .then((data) => {
        if (!activo) return;
        setVariantes(data);
      })
      .catch(() => {
        if (activo) setVariantes([]);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [producto.ID]);

  const colores = useMemo(() => [...new Set(variantes.map((v) => v.COLOR))], [variantes]);
  const nombreAtributo = variantes[0]?.NOMBRE_ATRIBUTO || "Atributo";
  const atributosDisponibles = useMemo(
    () =>
      color
        ? [...new Set(variantes.filter((v) => v.COLOR === color).map((v) => v.ATRIBUTO))]
        : [...new Set(variantes.map((v) => v.ATRIBUTO))],
    [variantes, color]
  );
  const varianteSeleccionada = variantes.find((v) => v.COLOR === color && v.ATRIBUTO === atributo);
  const stock = varianteSeleccionada?.STOCK || 0;
  const cantidadDeshabilitada = !varianteSeleccionada;

  useEffect(() => {
    if (stock > 0 && cantidad > stock) setCantidad(stock);
    if (cantidad < 1) setCantidad(1);
  }, [stock]);

  useEffect(() => {
    setCantidad(1);
  }, [color, atributo]);

  const confirmar = () => {
    if (!varianteSeleccionada) return;
    if (cantidad > stock) {
      Swal.fire({
        icon: "warning",
        title: "Stock limitado",
        text: `Solo hay ${stock} unidades disponibles.`,
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
      setCantidad(stock);
      return;
    }
    onAgregar(varianteSeleccionada.ID_VARIANTE, cantidad);
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="d-flex gap-3 mb-3">
          <img
            src={producto.IMAGEN}
            className="rounded border"
            style={{ width: "80px", height: "80px", objectFit: "cover", flexShrink: 0 }}
            alt={producto.NOMBRE}
            onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80?text=JADDA'; }}
          />
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-start">
              <h5 className="fw-bold mb-0">{producto.NOMBRE}</h5>
              <button className="btn-close" onClick={onCerrar}></button>
            </div>
            <p className="text-danger fw-bold mb-0 mt-1">${Number(producto.PRECIO).toLocaleString("es-CO")}</p>
          </div>
        </div>

        {cargando ? (
          <div className="text-center py-4">
            <div className="spinner-border text-danger" role="status"></div>
          </div>
        ) : variantes.length === 0 ? (
          <div className="text-center py-4">
            <p className="mb-0">Este producto no tiene variantes disponibles.</p>
            {!esAdmin && !!producto.ID_VARIANTE_POR_DEFECTO && (
              <button
                className="btn btn-danger mt-2"
                onClick={() => onAgregar(producto.ID_VARIANTE_POR_DEFECTO!, 1)}
              >
                Agregar igualmente
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3">
              <span className="fw-bold d-block mb-2">Color:</span>
              <div className="d-flex gap-2 flex-wrap">
                {colores.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (c === color) {
                        setColor("");
                      } else {
                        setColor(c);
                        const atributosDelNuevoColor = [...new Set(variantes.filter((v) => v.COLOR === c).map((v) => v.ATRIBUTO))];
                        if (!atributosDelNuevoColor.includes(atributo)) {
                          setAtributo("");
                        }
                      }
                    }}
                    className={`btn btn-sm ${color === c ? "btn-danger" : "btn-outline-dark"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <span className="fw-bold d-block mb-2">{nombreAtributo}:</span>
              <div className="d-flex gap-2 flex-wrap">
                {atributosDisponibles.map((opcion) => (
                  <button
                    key={opcion}
                    onClick={() => setAtributo(atributo === opcion ? "" : opcion)}
                    className={`btn btn-sm ${atributo === opcion ? "btn-danger" : "btn-outline-dark"}`}
                    style={{ minWidth: "50px" }}
                  >
                    {opcion}
                  </button>
                ))}
              </div>
            </div>

            {color && atributo && (
              <div className="mb-3">
                {stock > 0 ? (
                  <span className="text-success fw-bold">Stock disponible: {stock} unidades</span>
                ) : (
                  <span className="text-danger fw-bold">Agotado por el momento</span>
                )}
              </div>
            )}

            <div className="mb-3">
              <span className="fw-bold d-block mb-2">Cantidad:</span>
              <div
                className="d-flex align-items-center border rounded overflow-hidden"
                style={{ width: "150px", opacity: cantidadDeshabilitada ? 0.6 : 1 }}
                title={cantidadDeshabilitada ? `Selecciona ${nombreAtributo.toLowerCase()} y color primero` : undefined}
              >
                <button
                  className="btn btn-light"
                  type="button"
                  disabled={cantidadDeshabilitada}
                  onClick={() => {
                    if (cantidadDeshabilitada) {
                      Swal.fire({
                        icon: "info",
                        title: "Selecciona las opciones",
                        text: `Elige un color y ${nombreAtributo.toLowerCase()} primero.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                      return;
                    }
                    if (cantidad > 1) setCantidad(cantidad - 1);
                  }}
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={stock || 99}
                  value={cantidad}
                  disabled={cantidadDeshabilitada}
                  onFocus={() => {
                    if (cantidadDeshabilitada) {
                      Swal.fire({
                        icon: "info",
                        title: "Selecciona las opciones",
                        text: `Elige un color y ${nombreAtributo.toLowerCase()} primero.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                    }
                  }}
                  onChange={(e) => {
                    if (cantidadDeshabilitada) {
                      Swal.fire({
                        icon: "info",
                        title: "Selecciona las opciones",
                        text: `Elige un color y ${nombreAtributo.toLowerCase()} primero.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                      return;
                    }
                    const raw = e.target.value;
                    if (raw === "") { setCantidad(1); return; }
                    const val = parseInt(raw, 10);
                    if (isNaN(val) || val < 1) { setCantidad(1); return; }
                    if (stock > 0 && val > stock) {
                      Swal.fire({
                        icon: "warning",
                        title: "Stock limitado",
                        text: `Solo hay ${stock} unidades disponibles.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                      setCantidad(stock);
                      return;
                    }
                    setCantidad(val);
                  }}
                  onBlur={(e) => {
                    if (cantidadDeshabilitada) return;
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    if (isNaN(val) || val < 1) setCantidad(1);
                    else if (stock > 0 && val > stock) setCantidad(stock);
                  }}
                  className="form-control text-center border-0 fw-bold p-0"
                  style={{ width: "60px", boxShadow: "none", backgroundColor: cantidadDeshabilitada ? "#f1f5f9" : "#fff", cursor: cantidadDeshabilitada ? "not-allowed" : "text" }}
                />
                <button
                  className="btn btn-light"
                  type="button"
                  disabled={cantidadDeshabilitada}
                  onClick={() => {
                    if (cantidadDeshabilitada) {
                      Swal.fire({
                        icon: "info",
                        title: "Selecciona las opciones",
                        text: `Elige un color y ${nombreAtributo.toLowerCase()} primero.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                      return;
                    }
                    if (cantidad >= stock) {
                      Swal.fire({
                        icon: "warning",
                        title: "Stock limitado",
                        text: `No hay más unidades disponibles. Solo quedan ${stock}.`,
                        background: "#1a1a1a",
                        color: "#fff",
                        confirmButtonColor: "#e63946",
                      });
                      return;
                    }
                    setCantidad(cantidad + 1);
                  }}
                >
                  +
                </button>
              </div>
              {cantidadDeshabilitada ? (
                <small className="text-muted d-block mt-1" style={{ fontStyle: "italic" }}>
                  Selecciona {nombreAtributo.toLowerCase()} y color para elegir cantidad
                </small>
              ) : stock > 0 ? (
                <small className="text-muted d-block mt-1">Stock disponible: {stock} unidades</small>
              ) : null}
            </div>

            {!esAdmin && (
              <button
                className="btn btn-danger w-100 py-2 fw-bold"
                onClick={confirmar}
                disabled={!color || !atributo || stock <= 0}
              >
                <i className="fas fa-shopping-cart me-2"></i>Agregar al carrito
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SelectorVarianteModal;
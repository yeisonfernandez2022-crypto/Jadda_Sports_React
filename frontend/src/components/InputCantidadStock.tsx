import Swal from "sweetalert2";

/**
 * Input de cantidad con límite de stock — fuente única (MiniCartMenu y
 * ResumenCompra compartían el mismo onChange/onBlur char por char).
 * Los botones +/- quedan en cada consumidor (llevan clases CSS propias).
 */
const InputCantidadStock = ({
  idCarrito,
  stock,
  cantidad,
  nombre,
  onActualizar,
  fontSize = "14px",
}: {
  idCarrito: number;
  stock: number;
  cantidad: number;
  nombre: string;
  onActualizar: (id: number, val: number) => void;
  /** Tamaño de letra del input (MiniCart 14px, ResumenCompra 13px). */
  fontSize?: string;
}) => {
  const aplicar = (val: number): void => {
    onActualizar(idCarrito, val);
  };

  return (
    <input
      type="number"
      min={1}
      max={stock}
      value={cantidad}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return;
        const val = Number.parseInt(raw, 10);
        if (Number.isNaN(val)) return;
        if (val < 1) {
          aplicar(1);
          return;
        }
        if (val > stock) {
          void Swal.fire({
            icon: "warning",
            title: "Stock limitado",
            text: `Solo hay ${stock} unidades disponibles de "${nombre}".`,
            background: "#1a1a1a",
            color: "#fff",
            confirmButtonColor: "#e63946",
          });
          aplicar(stock);
          return;
        }
        aplicar(val);
      }}
      onBlur={(e) => {
        const val = Number.parseInt((e.target as HTMLInputElement).value, 10);
        if (Number.isNaN(val) || val < 1) aplicar(1);
        else if (val > stock) aplicar(stock);
      }}
      style={{ width: "44px", height: "28px", border: "1px solid #ccc", borderRadius: "6px", textAlign: "center", fontWeight: 600, fontSize }}
    />
  );
};

export default InputCantidadStock;

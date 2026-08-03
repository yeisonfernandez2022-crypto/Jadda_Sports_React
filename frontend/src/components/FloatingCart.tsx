import { memo } from "react";
import { useCart } from "../context/CartContext";
import { FaShoppingCart } from "react-icons/fa";

export const FloatingCart = memo(function FloatingCart() {
  const { totalProductos, setIsOpen, isOpen } = useCart();
  const margenX = 25;
  const margenY = 25;

  return (
    <button
      id="flotante-carrito"
      onClick={() => setIsOpen(!isOpen)}
      style={{
        position: "fixed",
        right: `${margenX}px`,
        bottom: `${margenY}px`,
        width: "65px",
        height: "65px",
        borderRadius: "50%",
        backgroundColor: isOpen ? "#c1121f" : "#e63946",
        color: "white",
        border: "none",
        zIndex: 9995,
        cursor: "pointer",
        boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 0.2s, box-shadow 0.2s",
        userSelect: "none",
      }}
    >
      <FaShoppingCart size={24} />

      {totalProductos > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-5px",
            right: "-5px",
            backgroundColor: "black",
            color: "white",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            fontSize: "12px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {totalProductos}
        </span>
      )}
    </button>
  );
});

import { useCart } from "../context/CartContext";
import { FaShoppingCart } from "react-icons/fa";

export const FloatingCart = () => {

  const {
    totalProductos,
    setIsOpen,
    isOpen,
  } = useCart();

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      style={{
        position: "fixed",
        bottom: "25px",
        left: "25px",
        width: "65px",
        height: "65px",
        borderRadius: "50%",
        backgroundColor: "#e63946",
        color: "white",
        border: "none",
        zIndex: 99999,
        cursor: "pointer",
        boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
};
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { FaTrash, FaTimes } from "react-icons/fa";

export const MiniCartMenu = () => {

  const navigate = useNavigate();

  const {
  isOpen,
  setIsOpen,
  cart,
  removeFromCart,
  decreaseQuantity,
} = useCart();

  if (!isOpen) return null;

  const subtotal = cart.reduce(
    (acc, item) =>
      acc + item.PRECIO * item.CANTIDAD,
    0
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: "100px",
        left: "25px",
        width: "340px",
        maxHeight: "500px",
        backgroundColor: "white",
        borderRadius: "18px",
        overflow: "hidden",
        zIndex: 999999,
        boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
        border: "1px solid #e5e5e5",
      }}
    >

      {/* HEADER */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#fafafa",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "bold",
          }}
        >
          Tu Carrito
        </h3>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: "18px",
            color: "#555",
          }}
        >
          <FaTimes />
        </button>
      </div>

      {/* PRODUCTOS */}
      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >

        {cart.length === 0 ? (

          <div style={{ padding: "20px" }}>
            <p
              style={{
                margin: 0,
                color: "#777",
                textAlign: "center",
              }}
            >
              El carrito está vacío
            </p>
          </div>

        ) : (

          cart.map((item) => (
            <div
              key={item.ID_CARRITO}
              style={{
                display: "flex",
                gap: "12px",
                padding: "16px",
                borderBottom: "1px solid #f0f0f0",
                alignItems: "center",
              }}
            >

              {/* IMAGEN */}
              <img
                src={item.IMAGEN}
                alt={item.NOMBRE}
                style={{
                  width: "65px",
                  height: "65px",
                  objectFit: "cover",
                  borderRadius: "10px",
                }}
                onError={(e) => {
                  e.currentTarget.src =
                    "https://placehold.co/100x100?text=JADDA";
                }}
              />

              {/* INFO */}
              <div style={{ flex: 1 }}>

                <h4
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  {item.NOMBRE}
                </h4>

                <p
                  style={{
                    margin: "6px 0",
                    color: "#e63946",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  $
                  {Number(item.PRECIO).toLocaleString("es-CO")}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#777",
                  }}
                >
                  Cantidad: {item.CANTIDAD}
                </p>

              </div>

              {/* ELIMINAR */}
              <button
                onClick={() =>
  decreaseQuantity(
    item.ID_CARRITO,
    item.CANTIDAD
  )
}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#dc3545",
                  fontSize: "16px",
                }}
              >
                <FaTrash />
              </button>

            </div>
          ))
        )}
      </div>

      {/* FOOTER */}
      {cart.length > 0 && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "#fafafa",
          }}
        >

          {/* SUBTOTAL */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontWeight: "600",
              }}
            >
              Subtotal:
            </span>

            <span
              style={{
                color: "#e63946",
                fontWeight: "bold",
              }}
            >
              $
              {subtotal.toLocaleString("es-CO")}
            </span>
          </div>

          {/* BOTONES */}
          <div
            style={{
              display: "flex",
              gap: "10px",
            }}
          >

            <button
              onClick={() => setIsOpen(false)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                backgroundColor: "white",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Cerrar
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/carrito");
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#e63946",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Ver carrito
            </button>

          </div>
        </div>
      )}
    </div>
  );
};
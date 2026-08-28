import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BarraEnvioGratis from "./BarraEnvioGratis";
import { useCart } from "../context/CartContext";
import { FaTrash, FaTimes } from "react-icons/fa";
import Swal from "sweetalert2";

export const MiniCartMenu = () => {
  const navigate = useNavigate();
  const { isOpen, setIsOpen, cart, removeFromCart, decreaseQuantity, increaseQuantity, updateQuantity } = useCart();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((acc, item) => acc + item.PRECIO * item.CANTIDAD, 0);
  const menuWidth = 340;
  const menuHeight = Math.min(500, cart.length * 100 + 150);
  const margen = 25;
  const botonX = window.innerWidth - 65 - margen;
  const botonY = window.innerHeight - 65 - margen;
  let left = botonX - menuWidth + 65;
  let top = botonY - menuHeight - 10;

  if (top < 10) {
    top = botonY + 75;
  }
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (left < 10) left = 10;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        maxHeight: "500px",
        backgroundColor: "white",
        borderRadius: "18px",
        overflow: "hidden",
        zIndex: 9996,
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
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>Tu Carrito</h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "#555" }}
        >
          <FaTimes />
        </button>
      </div>

      {/* PRODUCTOS */}
      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {cart.length === 0 ? (
          <div style={{ padding: "20px" }}>
            <p style={{ margin: 0, color: "#777", textAlign: "center" }}>El carrito está vacío</p>
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
              <img
                src={item.IMAGEN}
                alt={item.NOMBRE}
                loading="lazy"
                style={{ width: "65px", height: "65px", objectFit: "cover", borderRadius: "10px" }}
                onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100?text=JADDA"; }}
              />

              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>{item.NOMBRE}</h4>
                <p style={{ margin: "6px 0", color: "#e63946", fontWeight: "bold", fontSize: "14px" }}>
                  ${Number(item.PRECIO).toLocaleString("es-CO")}
                </p>
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0" }}>
                  {item.COLOR && `Color: ${item.COLOR}`}
                  {item.ATRIBUTO && ` | ${item.ATRIBUTO}`}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    onClick={() => {
                      if (item.CANTIDAD > 1) {
                        decreaseQuantity(item.ID_CARRITO);
                      } else {
                        Swal.fire({
                          title: "Eliminar producto",
                          text: "Este es el último producto. ¿Deseas eliminarlo del carrito?",
                          icon: "warning",
                          showCancelButton: true,
                          confirmButtonText: "Sí, eliminar",
                          cancelButtonText: "Cancelar",
                          background: "#1a1a1a",
                          color: "#fff",
                          confirmButtonColor: "#e63946",
                        }).then((result) => {
                          if (result.isConfirmed) {
                            removeFromCart(item.ID_CARRITO);
                          }
                        });
                      }
                    }}
                    style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontWeight: "bold" }}
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={item.STOCK}
                    value={item.CANTIDAD}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const val = parseInt(raw, 10);
                      if (isNaN(val)) return;
                      if (val < 1) {
                        updateQuantity(item.ID_CARRITO, 1);
                        return;
                      }
                      if (val > item.STOCK) {
                        Swal.fire({
                          icon: "warning",
                          title: "Stock limitado",
                          text: `Solo hay ${item.STOCK} unidades disponibles de "${item.NOMBRE}".`,
                          background: "#1a1a1a",
                          color: "#fff",
                          confirmButtonColor: "#e63946",
                        });
                        updateQuantity(item.ID_CARRITO, item.STOCK);
                        return;
                      }
                      updateQuantity(item.ID_CARRITO, val);
                    }}
                    onBlur={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (isNaN(val) || val < 1) updateQuantity(item.ID_CARRITO, 1);
                      else if (val > item.STOCK) updateQuantity(item.ID_CARRITO, item.STOCK);
                    }}
                    style={{ width: "44px", height: "28px", border: "1px solid #ccc", borderRadius: "6px", textAlign: "center", fontWeight: "600", fontSize: "14px" }}
                  />

                  <button
                    onClick={() => increaseQuantity(item.ID_CARRITO)}
                    style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontWeight: "bold" }}
                  >
                    +
                  </button>
                </div>
                {item.STOCK > 0 && item.STOCK <= 10 && (
                  <small style={{ color: "#b45309", fontWeight: 600, fontSize: "11px", display: "block", marginTop: "4px" }}>
                    Solo quedan {item.STOCK} disponibles
                  </small>
                )}
              </div>

              <button
                onClick={() => {
                  Swal.fire({
                    title: "Eliminar producto",
                    text: `Tienes ${item.CANTIDAD} unidades. ¿Deseas eliminar todo este producto del carrito?`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, eliminar todo",
                    cancelButtonText: "Cancelar",
                    background: "#1a1a1a",
                    color: "#fff",
                    confirmButtonColor: "#e63946",
                    cancelButtonColor: "#555",
                  }).then((result) => {
                    if (result.isConfirmed) {
                      removeFromCart(item.ID_CARRITO);
                    }
                  });
                }}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#dc3545", fontSize: "16px" }}
              >
                <FaTrash />
              </button>
            </div>
          ))
        )}
      </div>

      {/* FOOTER */}
      {cart.length > 0 && (
        <div style={{ padding: "16px", backgroundColor: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
             <span style={{ fontWeight: "600" }}>Subtotal:</span>
            <span style={{ color: "#e63946", fontWeight: "bold" }}>${subtotal.toLocaleString("es-CO")}</span>
          </div>
          <BarraEnvioGratis subtotal={subtotal} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #ccc", backgroundColor: "white", cursor: "pointer", fontWeight: "600" }}
            >
              Cerrar
            </button>
            <button
              onClick={() => { setIsOpen(false); navigate("/resumencompra"); }}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: "#e63946", color: "white", cursor: "pointer", fontWeight: "bold" }}
            >
              Comprar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

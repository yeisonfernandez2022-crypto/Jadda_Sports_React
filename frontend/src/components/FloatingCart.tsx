import { memo, useState, useRef, useCallback, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { FaShoppingCart } from "react-icons/fa";

export const FloatingCart = memo(function FloatingCart() {
  const { totalProductos, setIsOpen, isOpen, setCartButtonPos } = useCart();
  const navbarHeight = 80;
  const margen = 5;
  const [pos, setPos] = useState({ x: 25, y: navbarHeight + 25 });

  useEffect(() => {
    setCartButtonPos(pos.x, pos.y);
  }, [pos, setCartButtonPos]);
  const [arrastrando, setArrastrando] = useState(false);
  const [desde, setDesde] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  const iniciarArrastre = useCallback((clienteX: number, clienteY: number) => {
    const rect = document.getElementById("flotante-carrito")?.getBoundingClientRect();
    if (!rect) return;
    offsetRef.current = { x: clienteX - rect.left, y: clienteY - rect.top };
    setDesde({ x: clienteX, y: clienteY });
    setArrastrando(true);
    draggingRef.current = false;
  }, []);

  const mover = useCallback((clienteX: number, clienteY: number) => {
    if (!arrastrando) return;
    const dx = Math.abs(clienteX - desde.x);
    const dy = Math.abs(clienteY - desde.y);
    if (dx > 5 || dy > 5) draggingRef.current = true;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = 65;
    const h = 65;
    let nx = clienteX - offsetRef.current.x;
    let ny = clienteY - offsetRef.current.y;
    nx = Math.max(margen, Math.min(nx, vw - w - margen));
    ny = Math.max(navbarHeight, Math.min(ny, vh - h - margen));
    setPos({ x: nx, y: ny });
  }, [arrastrando, desde]);

  const terminarArrastre = useCallback(() => {
    setArrastrando(false);
  }, []);

  useEffect(() => {
    if (!arrastrando) return;
    const onMouseMove = (e: MouseEvent) => mover(e.clientX, e.clientY);
    const onMouseUp = () => terminarArrastre();
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      mover(t.clientX, t.clientY);
    };
    const onTouchEnd = () => terminarArrastre();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [arrastrando, mover, terminarArrastre]);

  const handleClick = () => {
    if (draggingRef.current) return;
    setIsOpen(!isOpen);
  };

  return (
    <button
      ref={btnRef}
      id="flotante-carrito"
      onClick={handleClick}
      onMouseDown={(e) => iniciarArrastre(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        iniciarArrastre(t.clientX, t.clientY);
      }}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: "65px",
        height: "65px",
        borderRadius: "50%",
        backgroundColor: "#e63946",
        color: "white",
        border: "none",
        zIndex: 9995,
        cursor: arrastrando ? "grabbing" : "grab",
        boxShadow: arrastrando
          ? "0 12px 35px rgba(0,0,0,0.4)"
          : "0 8px 25px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: arrastrando ? "none" : "box-shadow 0.2s",
        userSelect: "none",
        touchAction: "none",
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

import { memo, useEffect, useState } from "react";
import { FaComments } from "react-icons/fa";
import { useChatWidget } from "../context/ChatWidgetContext";
import { useAuth } from "../context/AuthContext";

export const FloatingChat = memo(function FloatingChat() {
  const { isOpen, setIsOpen } = useChatWidget();
  const { usuarioLogueado } = useAuth();
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);

  useEffect(() => {
    if (!usuarioLogueado) {
      setTotalNoLeidos(0);
      return;
    }
    const fetchNoLeidos = async () => {
      try {
        const res = await fetch("/api/chat/no-leidos", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setTotalNoLeidos(Number(data.total) || 0);
      } catch {}
    };
    fetchNoLeidos();
    const t = setInterval(fetchNoLeidos, 12000);
    return () => clearInterval(t);
  }, [usuarioLogueado]);

  // Solo para usuarios logueados que no son admin en páginas de tienda, pero lo mostramos siempre que esté logueado
  // El AppLayout decide cuándo ocultar, aquí solo no mostramos badge si no logueado
  if (!usuarioLogueado) return null;

  return (
    <button
      id="flotante-chat"
      onClick={() => setIsOpen(!isOpen)}
      title="Chats"
      style={{
        position: "fixed",
        right: "100px",
        bottom: "25px",
        width: "65px",
        height: "65px",
        borderRadius: "50%",
        backgroundColor: isOpen ? "#1e3a5f" : "#002244",
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
      <FaComments size={24} />
      {totalNoLeidos > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-5px",
            right: "-5px",
            backgroundColor: "#e63946",
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
          {totalNoLeidos > 99 ? "99+" : totalNoLeidos}
        </span>
      )}
    </button>
  );
});

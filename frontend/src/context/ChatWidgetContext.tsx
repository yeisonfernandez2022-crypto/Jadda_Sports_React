import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface ChatWidgetContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeChatId: number | null;
  setActiveChatId: (id: number | null) => void;
  pendingProductId: number | null;
  setPendingProductId: (id: number | null) => void;
  abrirChatProducto: (idProducto: number) => Promise<void>;
  abrirChatDevolucion: (idDevolucion: number) => Promise<void>;
}

const ChatWidgetContext = createContext<ChatWidgetContextType | undefined>(undefined);

export const ChatWidgetProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);

  const abrirChatProducto = useCallback(async (idProducto: number) => {
    try {
      const res = await fetch("/api/chat/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tipo: "VENDEDOR", id_producto: idProducto }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.id_chat) {
        setActiveChatId(data.id_chat);
        setIsOpen(true);
        setPendingProductId(null);
      } else if (data.msg) {
        // Mostrar mensaje si es producto de JADDA o no logueado
        const { default: Swal } = await import("sweetalert2");
        Swal.fire({ icon: "info", title: "Chat", text: data.msg, background: "#121212", color: "#fff", confirmButtonColor: "#e73737" });
      }
    } catch (e) {
      console.error("Error al abrir chat producto:", e);
    }
  }, []);

  const abrirChatDevolucion = useCallback(async (idDevolucion: number) => {
    try {
      const res = await fetch("/api/chat/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tipo: "DEVOLUCION", id_devolucion: idDevolucion }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.id_chat) {
        setActiveChatId(data.id_chat);
        setIsOpen(true);
      }
    } catch (e) {
      console.error("Error al abrir chat devolucion:", e);
    }
  }, []);

  return (
    <ChatWidgetContext.Provider value={{ isOpen, setIsOpen, activeChatId, setActiveChatId, pendingProductId, setPendingProductId, abrirChatProducto, abrirChatDevolucion }}>
      {children}
    </ChatWidgetContext.Provider>
  );
};

export const useChatWidget = () => {
  const ctx = useContext(ChatWidgetContext);
  if (!ctx) throw new Error("useChatWidget debe usarse dentro de ChatWidgetProvider");
  return ctx;
};

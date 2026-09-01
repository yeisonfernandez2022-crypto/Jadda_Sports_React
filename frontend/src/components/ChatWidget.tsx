import { useCallback, useEffect, useRef, useState } from "react";
import { FaComments, FaPaperPlane, FaTimes, FaStore, FaUndoAlt, FaHeadset } from "react-icons/fa";
import { useChatWidget } from "../context/ChatWidgetContext";
import { useAuth } from "../context/AuthContext";

interface Conversacion {
  ID_CHAT: number;
  TIPO: "SOPORTE" | "VENDEDOR" | "DEVOLUCION";
  ESTADO: string;
  ID_CLIENTE: number | null;
  CLIENTE_NOMBRE: string | null;
  VENDEDOR_EMPRESA: string | null;
  PRODUCTO_NOMBRE: string | null;
  PRODUCTO_IMAGEN: string | null;
  PRODUCTO_ID_DIRECTO?: number | null;
  ID_DEVOLUCION?: number | null;
  PARTE?: string | null;
  DEVOLUCION_ESTADO: string | null;
  ULTIMO_MENSAJE: string | null;
  NO_LEIDOS: number;
  ULTIMA_ACTIVIDAD: string;
}

interface MensajeChat {
  ID_MENSAJE: number;
  ROL_AUTOR: "CLIENTE" | "VENDEDOR" | "ADMIN" | "SISTEMA";
  AUTOR_NOMBRE: string | null;
  MENSAJE: string;
  FECHA: string;
}

const horaCorta = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const ChatWidget = () => {
  const { isOpen, setIsOpen, activeChatId, setActiveChatId } = useChatWidget();
  const { usuario, esVendedor } = useAuth();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [miRol, setMiRol] = useState<string>("CLIENTE");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [chatActual, setChatActual] = useState<any>(null);
  const finRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cargarConversaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversaciones", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      // Widget flotante solo por producto: VENDEDOR y DEVOLUCION (cada uno con su chat aparte)
      let lista: Conversacion[] = data;
      lista = lista.filter((c) => c.TIPO === "VENDEDOR" || c.TIPO === "DEVOLUCION");
      setConversaciones(lista);
    } catch {}
  }, [usuario]);

  const cargarMensajes = useCallback(async (idChat: number) => {
    try {
      const res = await fetch(`/api/chat/${idChat}/mensajes`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setMensajes(data.mensajes || []);
      setChatActual(data.chat);
      setMiRol(data.mi_rol);
      setConversaciones((prev) => prev.map((c) => (c.ID_CHAT === idChat ? { ...c, NO_LEIDOS: 0 } : c)));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    cargarConversaciones();
  }, [isOpen, cargarConversaciones]);

  useEffect(() => {
    if (!activeChatId) return;
    cargarMensajes(activeChatId);
    const t = setInterval(() => cargarMensajes(activeChatId), 4000);
    return () => clearInterval(t);
  }, [activeChatId, cargarMensajes]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => cargarConversaciones(), 12000);
    return () => clearInterval(t);
  }, [isOpen, cargarConversaciones]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const chatBtn = document.getElementById("flotante-chat");
        const cartBtn = document.getElementById("flotante-carrito");
        if (chatBtn && chatBtn.contains(e.target as Node)) return;
        if (cartBtn && cartBtn.contains(e.target as Node)) return;
        // No cerrar automáticamente si está en hilo activo? Dejamos que el usuario cierre con X
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || !activeChatId || enviando) return;
    if (chatActual?.ESTADO === "CERRADA") return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/chat/${activeChatId}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mensaje: msg }),
      });
      if (res.ok) {
        setTexto("");
        cargarMensajes(activeChatId);
        cargarConversaciones();
      }
    } finally {
      setEnviando(false);
    }
  };

  const tituloDe = (c: any) => {
    const producto = c.PRODUCTO_NOMBRE || c.PRODUCTO?.NOMBRE || `producto #${c.ID_PRODUCTO || c.ID_DEVOLUCION || ""}`;
    if (c.TIPO === "VENDEDOR") {
      // chat {producto} - {usuario} o {vendedor} (JADDA si no hay vendedor)
      const otro = esVendedor ? c.CLIENTE_NOMBRE : (c.VENDEDOR_EMPRESA || "JADDA SPORTS");
      return `chat ${producto} - ${otro || (esVendedor ? "cliente" : "vendedor")}`;
    }
    if (c.TIPO === "DEVOLUCION") {
      const otro = esVendedor ? c.CLIENTE_NOMBRE : (c.VENDEDOR_EMPRESA || "JADDA SPORTS");
      // chat devolucion {producto principal} - {usuario} o {vendedor}
      return `chat devolucion ${producto} - ${otro || (esVendedor ? "cliente" : "vendedor")}`;
    }
    if (c.TIPO === "SOPORTE") return "Soporte JADDA";
    return producto || "Chat";
  };

  if (!isOpen) return null;

  const menuWidth = 380;
  const menuHeight = 520;
  const margen = 25;
  // Posicionar a la izquierda del carrito (carrito en right 25, chat en right 100)
  // El panel del chat se abre arriba del botón de chat
  const botonX = window.innerWidth - 100 - 65;
  const botonY = window.innerHeight - 65 - margen;
  let left = botonX - menuWidth + 65;
  let top = botonY - menuHeight - 10;
  if (top < 10) top = botonY + 75;
  if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
  if (left < 10) left = 10;

  const vistaLista = activeChatId === null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        height: `${menuHeight}px`,
        backgroundColor: "white",
        borderRadius: "18px",
        overflow: "hidden",
        zIndex: 9996,
        boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
        border: "1px solid #e5e5e5",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#002244",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          {!vistaLista && (
            <button
              onClick={() => setActiveChatId(null)}
              style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "16px", padding: "4px" }}
            >
              ←
            </button>
          )}
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vistaLista ? "Chats" : chatActual ? tituloDe({ ...chatActual, PRODUCTO_NOMBRE: chatActual.PRODUCTO?.NOMBRE || chatActual.PRODUCTO_NOMBRE }) : "Chat"}
          </h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "white" }}
        >
          <FaTimes />
        </button>
      </div>

      {vistaLista ? (
        <>
          {/* LISTA DE CHATS */}
          <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#fafafa" }}>
            {conversaciones.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#777" }}>
                <FaComments size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>no hay conversacion</p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#999" }}>
                  Inicia un chat desde el detalle de un producto con "Enviar mensaje"
                </p>
              </div>
            ) : (
              conversaciones.map((c) => (
                <button
                  key={c.ID_CHAT}
                  onClick={() => setActiveChatId(c.ID_CHAT)}
                  style={{
                    width: "100%",
                    display: "flex",
                    gap: "12px",
                    padding: "12px 16px",
                    border: "none",
                    borderBottom: "1px solid #f0f0f0",
                    backgroundColor: "white",
                    cursor: "pointer",
                    textAlign: "left",
                    alignItems: "center",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {c.PRODUCTO_IMAGEN ? (
                      <img
                        src={c.PRODUCTO_IMAGEN}
                        alt={c.PRODUCTO_NOMBRE || ""}
                        style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px", border: "1px solid #eee" }}
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100?text=JADDA"; }}
                      />
                    ) : (
                      <div style={{ width: "48px", height: "48px", borderRadius: "8px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {c.TIPO === "VENDEDOR" ? <FaStore color="#64748b" /> : c.TIPO === "DEVOLUCION" ? <FaUndoAlt color="#64748b" /> : <FaHeadset color="#64748b" />}
                      </div>
                    )}
                    {c.NO_LEIDOS > 0 && (
                      <span style={{ position: "absolute", top: "-6px", right: "-6px", backgroundColor: "#e63946", color: "white", fontSize: "10px", fontWeight: "bold", width: "18px", height: "18px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {c.NO_LEIDOS}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.TIPO === "VENDEDOR" ? `chat ${c.PRODUCTO_NOMBRE || "producto"} - ${esVendedor ? c.CLIENTE_NOMBRE : c.VENDEDOR_EMPRESA}` : c.TIPO === "DEVOLUCION" ? `chat devolucion ${c.PRODUCTO_NOMBRE || "producto"} - ${esVendedor ? c.CLIENTE_NOMBRE : c.VENDEDOR_EMPRESA}` : c.PRODUCTO_NOMBRE || "Chat"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                      {c.ULTIMO_MENSAJE || "Sin mensajes"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      {new Date(c.ULTIMA_ACTIVIDAD).toLocaleDateString("es-CO", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })} • {c.ESTADO}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* HILO DE MENSAJES */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Cabecera con producto */}
            {chatActual?.PRODUCTO && (
              <div style={{ display: "flex", gap: "10px", padding: "10px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", alignItems: "center", marginBottom: "4px" }}>
                <img src={chatActual.PRODUCTO.IMAGEN} alt={chatActual.PRODUCTO.NOMBRE} style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px" }} onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100?text=JADDA"; }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chatActual.PRODUCTO.NOMBRE}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{chatActual.VENDEDOR_EMPRESA || "JADDA SPORTS"}</div>
                </div>
              </div>
            )}
            {mensajes.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", padding: "20px" }}>Sin mensajes todavía. ¡Escribe el primero!</div>}
            {mensajes.map((m) =>
              m.ROL_AUTOR === "SISTEMA" ? (
                <div key={m.ID_MENSAJE} style={{ textAlign: "center", fontSize: "11px", color: "#64748b", backgroundColor: "#f1f5f9", padding: "6px 10px", borderRadius: "12px", margin: "4px 20px" }}>
                  {m.MENSAJE}
                </div>
              ) : (
                <div key={m.ID_MENSAJE} style={{ display: "flex", justifyContent: m.ROL_AUTOR === miRol ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "75%", backgroundColor: m.ROL_AUTOR === miRol ? "#002244" : "white", color: m.ROL_AUTOR === miRol ? "white" : "#0f172a", padding: "10px 12px", borderRadius: m.ROL_AUTOR === miRol ? "16px 16px 4px 16px" : "16px 16px 16px 4px", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", border: m.ROL_AUTOR === miRol ? "none" : "1px solid #e2e8f0" }}>
                    {m.ROL_AUTOR !== miRol && <div style={{ fontSize: "11px", fontWeight: 700, color: m.ROL_AUTOR === "ADMIN" ? "#e63946" : "#64748b", marginBottom: "2px" }}>{m.ROL_AUTOR === "ADMIN" ? "Equipo JADDA" : m.AUTOR_NOMBRE || m.ROL_AUTOR}</div>}
                    <div style={{ fontSize: "13px", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.MENSAJE}</div>
                    <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "4px", textAlign: "right" }}>{horaCorta(m.FECHA)}</div>
                  </div>
                </div>
              )
            )}
            <div ref={finRef} />
          </div>

          {/* INPUT */}
          <div style={{ padding: "10px", borderTop: "1px solid #e2e8f0", backgroundColor: "white", display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea
              placeholder={chatActual?.ESTADO === "CERRADA" ? "Conversación cerrada" : "Escribe un mensaje..."}
              value={texto}
              disabled={chatActual?.ESTADO === "CERRADA"}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={1}
              style={{ flex: 1, resize: "none", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "10px 14px", fontSize: "13px", outline: "none", maxHeight: "80px", backgroundColor: chatActual?.ESTADO === "CERRADA" ? "#f1f5f9" : "white" }}
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando || chatActual?.ESTADO === "CERRADA"}
              style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", backgroundColor: !texto.trim() || enviando || chatActual?.ESTADO === "CERRADA" ? "#cbd5e1" : "#e63946", color: "white", cursor: !texto.trim() || enviando || chatActual?.ESTADO === "CERRADA" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <FaPaperPlane size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

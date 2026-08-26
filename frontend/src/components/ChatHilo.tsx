import { useCallback, useEffect, useRef, useState } from "react";
import { FaPaperPlane } from "react-icons/fa";

interface MensajeChat {
  ID_MENSAJE: number;
  ROL_AUTOR: "CLIENTE" | "VENDEDOR" | "ADMIN" | "SISTEMA";
  AUTOR_NOMBRE: string | null;
  MENSAJE: string;
  FECHA: string;
}

interface ChatHiloProps {
  idChat: number;
  /** Altura del área de mensajes (px). Default 340 */
  altura?: number;
}

const horaCorta = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Chat embebible: hilo de una conversación con polling, para usar dentro de
 *  la página de una devolución (cada devolución con SU chat, sin mezclar). */
function ChatHilo({ idChat, altura = 340 }: ChatHiloProps) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [miRol, setMiRol] = useState<string>("CLIENTE");
  const [estadoChat, setEstadoChat] = useState<string>("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${idChat}/mensajes`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setMensajes(data.mensajes || []);
      setMiRol(data.mi_rol);
      setEstadoChat(data.chat?.ESTADO || "");
    } catch { /* silencio en polling */ }
  }, [idChat]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || enviando || estadoChat === "CERRADA") return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/chat/${idChat}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mensaje: msg }),
      });
      if (res.ok) {
        setTexto("");
        cargar();
      }
    } finally {
      setEnviando(false);
    }
  };

  const cerrada = estadoChat === "CERRADA";

  return (
    <div className="chat-inline">
      <div className="chats-mensajes chat-inline-mensajes" style={{ height: altura }}>
        {mensajes.length === 0 && <div className="msg-sistema">Sin mensajes todavía</div>}
        {mensajes.map((m) =>
          m.ROL_AUTOR === "SISTEMA" ? (
            <div key={m.ID_MENSAJE} className="msg-sistema">{m.MENSAJE}</div>
          ) : (
            <div key={m.ID_MENSAJE} className={`msg ${m.ROL_AUTOR === miRol ? "mio" : "otro"}`}>
              <div className="msg-burbuja">
                {m.ROL_AUTOR !== miRol && (
                  <span className="msg-autor">
                    {m.ROL_AUTOR === "ADMIN" ? "Equipo JADDA" : m.AUTOR_NOMBRE || m.ROL_AUTOR}
                  </span>
                )}
                <p>{m.MENSAJE}</p>
                <span className="msg-hora">{horaCorta(m.FECHA)}</span>
              </div>
            </div>
          )
        )}
        <div ref={finRef} />
      </div>

      <footer className="chats-input">
        <textarea
          placeholder={cerrada ? "Conversación cerrada" : "Escribe un mensaje…"}
          value={texto}
          disabled={cerrada}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
        />
        <button onClick={enviar} disabled={!texto.trim() || enviando || cerrada}>
          <FaPaperPlane />
        </button>
      </footer>
    </div>
  );
}

export default ChatHilo;

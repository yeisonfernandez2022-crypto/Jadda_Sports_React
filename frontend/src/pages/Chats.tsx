import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import {
  FaComments, FaPaperPlane, FaBalanceScale, FaArrowLeft,
  FaHeadset, FaStore, FaUndoAlt, FaLock,
} from "react-icons/fa";
import AdminNavbar from "../admin/AdminNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import VendedorNavbar from "../vendedor/VendedorNavbar";
import "../css/chats.css";

interface Conversacion {
  ID_CHAT: number;
  TIPO: "SOPORTE" | "VENDEDOR" | "DEVOLUCION";
  ESTADO: string;
  ID_CLIENTE: number | null;
  CLIENTE_NOMBRE: string | null;
  VENDEDOR_EMPRESA: string | null;
  PRODUCTO_NOMBRE: string | null;
  ID_DEVOLUCION?: number | null;
  PARTE?: string | null;
  DEVOLUCION_ESTADO: string | null;
  DEVOLUCION_TIPO: string | null;
  ULTIMO_MENSAJE: string | null;
  ULTIMO_ROL: string | null;
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

const etiquetaTipo: Record<string, string> = {
  SOPORTE: "Soporte",
  VENDEDOR: "Vendedor",
  DEVOLUCION: "Devolución",
};

const horaCorta = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const Chats = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, esAdmin, esVendedor, loadingAuth } = useAuth();

  const modoAdmin = location.pathname.startsWith("/admin");
  const modoVendedor = location.pathname.startsWith("/vendedor");

  // El admin nunca usa /chats público: si aterriza ahí (p. ej. por una
  // notificación vieja), lo llevamos a su panel conservando el chat abierto.
  useEffect(() => {
    if (esAdmin && !modoAdmin && !loadingAuth) {
      navigate(`/admin/chats${location.search}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, modoAdmin, loadingAuth]);

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [activa, setActiva] = useState<number | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [chatActual, setChatActual] = useState<any>(null);
  const [miRol, setMiRol] = useState<string>("CLIENTE");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [soloEscaladas, setSoloEscaladas] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);

  const cargarConversaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversaciones", { credentials: "include" });
      if (!res.ok) return;
      setConversaciones(await res.json());
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const cargarMensajes = useCallback(async (idChat: number) => {
    try {
      const res = await fetch(`/api/chat/${idChat}/mensajes`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setMensajes(data.mensajes || []);
      setChatActual(data.chat);
      setMiRol(data.mi_rol);
      setConversaciones((prev) => prev.map((c) => (c.ID_CHAT === idChat ? { ...c, NO_LEIDOS: 0 } : c)));
    } catch { /* silencio en polling */ }
  }, []);

  // Inicio por query params: ?chat=ID o ?tipo=SOPORTE|VENDEDOR&producto=ID / ?devolucion=ID
  useEffect(() => {
    const abrir = async () => {
      const q = new URLSearchParams(location.search);
      const idChat = q.get("chat");
      const tipo = q.get("tipo");
      const producto = q.get("producto");
      const devolucion = q.get("devolucion");
      if (idChat) {
        setActiva(Number(idChat));
        return;
      }
      if (tipo) {
        const body: any = { tipo };
        if (producto) body.id_producto = Number(producto);
        if (devolucion) body.id_devolucion = Number(devolucion);
        const res = await fetch("/api/chat/iniciar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok && data.id_chat) {
          setActiva(data.id_chat);
          cargarConversaciones();
          navigate(modoAdmin ? "/admin/chats" : "/chats", { replace: true });
        } else if (data.msg) {
          Swal.fire({ icon: "info", title: "Chat", text: data.msg });
          navigate("/chats", { replace: true });
        }
      }
    };
    if (usuario) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  useEffect(() => {
    if (usuario) cargarConversaciones();
  }, [usuario, cargarConversaciones]);

  // Encuesta: hilo activo cada 4s, lista cada 12s
  useEffect(() => {
    if (!activa) return;
    cargarMensajes(activa);
    const t = setInterval(() => cargarMensajes(activa), 4000);
    return () => clearInterval(t);
  }, [activa, cargarMensajes]);

  useEffect(() => {
    const t = setInterval(() => usuario && cargarConversaciones(), 12000);
    return () => clearInterval(t);
  }, [usuario, cargarConversaciones]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || !activa || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/chat/${activa}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mensaje: msg }),
      });
      if (res.ok) {
        setTexto("");
        cargarMensajes(activa);
        cargarConversaciones();
      }
    } finally {
      setEnviando(false);
    }
  };

  const escalar = async () => {
    if (!activa || !chatActual) return;
    const r = await Swal.fire({
      icon: "question",
      title: "¿Escalar al equipo JADDA?",
      text: "Un asesor de JADDA SPORTS revisará las evidencias y decidirá el resultado de la solicitud.",
      showCancelButton: true,
      confirmButtonText: "Sí, escalar",
      cancelButtonText: "Seguir conversando",
      confirmButtonColor: "#7c3aed",
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    const res = await fetch(`/api/chat/${activa}/escalar`, { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    Swal.fire({
      icon: data.ok ? "success" : "warning",
      title: data.ok ? "Solicitud escalada" : "No se pudo escalar",
      text: data.msg || "",
    });
    if (data.ok) cargarMensajes(activa);
  };

  const tituloDe = (c: any) => {
    if (c.TIPO === "SOPORTE") return esAdmin ? `${c.CLIENTE_NOMBRE || "Usuario"} · Soporte` : "Soporte JADDA SPORTS";
    if (c.TIPO === "VENDEDOR") return esAdmin ? `${c.CLIENTE_NOMBRE} ↔ ${c.VENDEDOR_EMPRESA}` : c.VENDEDOR_EMPRESA || "Vendedor";
    // DEVOLUCIÓN: acuerdo entre partes o hilos separados con JADDA tras escalar
    const ref = c.PRODUCTO_NOMBRE || `solicitud #${c.ID_DEVOLUCION}`;
    if (c.PARTE === "CLIENTE") return esAdmin ? `Dev #${c.ID_DEVOLUCION} · comprador` : `Soporte JADDA · ${ref}`;
    if (c.PARTE === "VENDEDOR") return esAdmin ? `Dev #${c.ID_DEVOLUCION} · vendedor` : `Soporte JADDA · Dev #${c.ID_DEVOLUCION}`;
    return `Devolución · ${ref}`;
  };

  const puedeEscalar =
    chatActual?.TIPO === "DEVOLUCION" &&
    !chatActual?.PARTE &&
    chatActual.ESTADO === "ACTIVA" &&
    (miRol === "CLIENTE" || miRol === "VENDEDOR");

  // Los chats de DEVOLUCIÓN no se mezclan en la lista general: cada uno vive
  // dentro de su solicitud (detalle de devolución o panel del vendedor).
  let lista = soloEscaladas && esAdmin
    ? conversaciones.filter((c) => c.ESTADO === "ESCALADA" || c.DEVOLUCION_ESTADO === "ESCALADA")
    : conversaciones;
  if (!esAdmin) lista = lista.filter((c) => c.TIPO !== "DEVOLUCION");

  const cuerpo = (
    <div className={`chats-page ${modoAdmin ? "admin-content-chats" : ""}`}>
      <div className="chats-layout">
        {/* ===== LISTA DE CONVERSACIONES ===== */}
        <aside className="chats-lista">
          <div className="chats-lista-head">
            <h2><FaComments /> Conversaciones</h2>
            {!esAdmin && (
              <button className="chats-btn-soporte" onClick={() => navigate("/chats?tipo=SOPORTE")} title="Hablar con soporte JADDA">
                <FaHeadset /> Nuevo soporte
              </button>
            )}
          </div>
          {modoAdmin && (
            <label className="chats-filtro-escaladas">
              <input type="checkbox" checked={soloEscaladas} onChange={(e) => setSoloEscaladas(e.target.checked)} />
              Mostrar solo escaladas ⚖️
            </label>
          )}
          {cargandoLista ? (
            <div className="chats-vacio">Cargando conversaciones…</div>
          ) : lista.length === 0 ? (
            <div className="chats-vacio">
              <FaComments />
              <div>No tienes conversaciones todavía.<br />Puedes escribirle al vendedor desde un producto o abrir soporte.</div>
            </div>
          ) : (
            lista.map((c) => (
              <button
                key={c.ID_CHAT}
                className={`chat-item ${activa === c.ID_CHAT ? "activa" : ""}`}
                onClick={() => setActiva(c.ID_CHAT)}
              >
                <div className="chat-item-avatar">
                  {c.TIPO === "SOPORTE" ? <FaHeadset /> : c.TIPO === "VENDEDOR" ? <FaStore /> : <FaUndoAlt />}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-titulo">{tituloDe(c)}</span>
                    <span className="chat-item-hora">{horaCorta(c.ULTIMA_ACTIVIDAD)}</span>
                  </div>
                  <div className="chat-item-preview">
                    {(c.ULTIMO_ROL === "CLIENTE" || c.ULTIMO_ROL === "VENDEDOR" || c.ULTIMO_ROL === "ADMIN") && (
                      <strong>{c.ULTIMO_ROL === miRol && activa !== c.ID_CHAT ? "Tú: " : ""}</strong>
                    )}
                    {c.ULTIMO_MENSAJE || "Sin mensajes"}
                  </div>
                  <div className="chat-item-tags">
                    <span className={`chip-tipo t-${c.TIPO.toLowerCase()}`}>{etiquetaTipo[c.TIPO]}</span>
                    {c.TIPO === "DEVOLUCION" && (
                      <span className={`chip-estado e-${(c.DEVOLUCION_ESTADO || "").toLowerCase()}`}>{c.DEVOLUCION_ESTADO}</span>
                    )}
                    {c.NO_LEIDOS > 0 && <span className="chip-noleidos">{c.NO_LEIDOS}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </aside>

        {/* ===== HILO DE MENSAJES ===== */}
        <section className="chats-hilo">
          {!activa ? (
            <div className="chats-hilo-vacio">
              <FaComments />
              <p>Selecciona una conversación para ver los mensajes</p>
              {!esAdmin && !esVendedor && (
                <p className="sub">Los chats sirven para resolver dudas de envío, detalles del producto y acuerdos de devolución con el vendedor.</p>
              )}
            </div>
          ) : (
            <>
              <header className="chats-hilo-head">
                <button className="chats-volver-movil" onClick={() => setActiva(null)}><FaArrowLeft /></button>
                <div className="chats-hilo-titulo">
                  <h3>{chatActual ? tituloDe(chatActual as any) : "..."}</h3>
                  <span className="chips-linea">
                    {chatActual?.TIPO === "DEVOLUCION" && (
                      <span className={`chip-estado e-${(chatActual.ESTADO || "").toLowerCase()}`}>Solicitud: {chatActual.ESTADO}</span>
                    )}
                    {chatActual?.ESTADO === "CERRADA" && <span className="chip-cerrada"><FaLock /> Cerrada</span>}
                  </span>
                </div>
                {puedeEscalar && (
                  <button className="btn-escalar" onClick={escalar}>
                    <FaBalanceScale /> Escalar a JADDA
                  </button>
                )}
              </header>

              <div className="chats-mensajes">
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
                  placeholder={chatActual?.ESTADO === "CERRADA" ? "Esta conversación está cerrada" : "Escribe un mensaje…"}
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
                />
                <button onClick={enviar} disabled={!texto.trim() || enviando || chatActual?.ESTADO === "CERRADA"}>
                  <FaPaperPlane />
                </button>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );

  if (modoVendedor) {
    return (
      <div className="admin-page">
        <VendedorNavbar />
        <div className="admin-content">
          <div className="container" style={{ maxWidth: "1280px" }}>
            <div className="au-header-col">
              <button className="admin-volver" onClick={() => navigate("/vendedor")}>← Volver al Dashboard</button>
              <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Chats" }]} />
              <div className="au-titulos">
                <h1>Chats</h1>
                <p>Conversaciones con tus clientes sobre envíos, productos y devoluciones</p>
              </div>
            </div>
            {cuerpo}
          </div>
          <AdminFooter />
        </div>
      </div>
    );
  }

  if (modoAdmin) {
    return (
      <div className="admin-page">
        <AdminNavbar />
        <div className="admin-content">
          <div className="container" style={{ maxWidth: "1280px" }}>
            <div className="au-header-col">
              <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Chats" }]} />
              <div className="au-titulos">
                <h1>Chats de la plataforma</h1>
                <p>Soporte a clientes, conversaciones con vendedores y disputas escaladas</p>
              </div>
            </div>
            {cuerpo}
          </div>
          <AdminFooter />
        </div>
      </div>
    );
  }

  return <div className="chats-wrapper">{cuerpo}</div>;
};

export default Chats;

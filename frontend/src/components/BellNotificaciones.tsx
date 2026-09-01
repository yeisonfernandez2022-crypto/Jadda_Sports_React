import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheckDouble, FaTrash } from "react-icons/fa";

interface Notificacion {
  ID_NOTIFICACION: number;
  TIPO: string;
  TITULO: string;
  MENSAJE: string | null;
  RUTA: string | null;
  LEIDA: number;
  FECHA: string;
}

interface Props {
  tema?: "claro" | "oscuro";
}

function BellNotificaciones({ tema = "claro" }: Props) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cargando = useRef(false);
  const [pendiente, setPendiente] = useState<{ n: Notificacion; idx: number; segundos: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = async (soloConteo = false) => {
    if (cargando.current) return;
    cargando.current = true;
    try {
      const [lista, conteo] = await Promise.all([
        fetch("/api/notificaciones", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/notificaciones/no-leidas", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (!soloConteo) setNotifs(Array.isArray(lista) ? lista : []);
      setNoLeidas(conteo?.total ?? 0);
    } catch {
      /* sin sesión o error de red */
    } finally {
      cargando.current = false;
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => cargar(true), 30000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => {
      if (!prev) cargar();
      return !prev;
    });
  };

  const alClic = async (n: Notificacion) => {
    setOpen(false);
    if (!n.LEIDA) {
      fetch(`/api/notificaciones/${n.ID_NOTIFICACION}/leida`, { method: "POST", credentials: "include" }).catch(() => {});
      setNoLeidas((prev) => Math.max(0, prev - 1));
      setNotifs((prev) => prev.map((x) => (x.ID_NOTIFICACION === n.ID_NOTIFICACION ? { ...x, LEIDA: 1 } : x)));
    }
    if (n.RUTA) navigate(n.RUTA);
  };

  const ejecutarBorrado = async (n: Notificacion) => {
    try {
      await fetch(`/api/notificaciones/${n.ID_NOTIFICACION}`, { method: "DELETE", credentials: "include" });
    } catch { /* ignore */ }
  };

  const deshacer = () => {
    if (!pendiente) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const { n, idx } = pendiente;
    setNotifs((prev) => {
      const next = [...prev];
      next.splice(idx, 0, n);
      return next;
    });
    if (!n.LEIDA) setNoLeidas((prev) => prev + 1);
    setPendiente(null);
  };

  const eliminar = (e: React.MouseEvent, n: Notificacion) => {
    e.stopPropagation();
    // Si había un borrado pendiente, confirmarlo inmediatamente
    if (pendiente) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      ejecutarBorrado(pendiente.n);
      setPendiente(null);
    }
    const idx = notifs.findIndex((x) => x.ID_NOTIFICACION === n.ID_NOTIFICACION);
    setNotifs((prev) => prev.filter((x) => x.ID_NOTIFICACION !== n.ID_NOTIFICACION));
    if (!n.LEIDA) setNoLeidas((prev) => Math.max(0, prev - 1));
    setPendiente({ n, idx: idx >= 0 ? idx : 0, segundos: 5 });
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setPendiente((prev) => {
        if (!prev) return null;
        if (prev.segundos <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return { ...prev, segundos: 0 };
        }
        return { ...prev, segundos: prev.segundos - 1 };
      });
    }, 1000);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPendiente(null);
      ejecutarBorrado(n);
    }, 5000);
  };

  const marcarTodas = async () => {
    try {
      await fetch("/api/notificaciones/leer-todas", { method: "POST", credentials: "include" });
      setNoLeidas(0);
      setNotifs((prev) => prev.map((x) => ({ ...x, LEIDA: 1 })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`bell-container ${tema}`} ref={ref}>
      <button className="bell-btn" onClick={abrir} title="Notificaciones" aria-label="Notificaciones">
        <FaBell />
        {noLeidas > 0 && <span className="bell-badge">{noLeidas > 99 ? "99+" : noLeidas}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-panel-header">
            <span className="bell-panel-titulo">Notificaciones</span>
            <button
              className="bell-marcar-todas"
              onClick={(e) => { e.stopPropagation(); if (noLeidas > 0) marcarTodas(); }}
              disabled={noLeidas === 0}
              style={{ opacity: noLeidas === 0 ? 0.45 : 1, cursor: noLeidas === 0 ? "default" : "pointer" }}
              title={noLeidas === 0 ? "No hay notificaciones sin leer" : "Marcar todas como leídas"}
            >
              <FaCheckDouble className="me-1" /> Marcar todas
            </button>
          </div>
          <div className="bell-panel-body">
            {notifs.length === 0 ? (
              <div className="bell-vacio">No tienes notificaciones</div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.ID_NOTIFICACION}
                  className={`bell-item ${n.LEIDA ? "leida" : "no-leida"}`}
                  onClick={() => alClic(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") alClic(n); }}
                >
                  <span className="bell-item-dot" />
                  <span className="bell-item-texto">
                    <span className="bell-item-titulo">{n.TITULO}</span>
                    <span className="bell-item-mensaje">{n.MENSAJE}</span>
                    <span className="bell-item-fecha">
                      {new Date(n.FECHA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <button
                    className="bell-delete"
                    onClick={(e) => eliminar(e, n)}
                    title="Eliminar notificación"
                    aria-label="Eliminar notificación"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            )}
          </div>
          {pendiente && (
            <div className="bell-undo">
              <span className="bell-undo-text">Notificación eliminada</span>
              <button className="bell-undo-btn" onClick={(e) => { e.stopPropagation(); deshacer(); }}>
                Deshacer {pendiente.segundos > 0 ? `(${pendiente.segundos}s)` : ""}
              </button>
            </div>
          )}
        </div>
      )}
      {pendiente && !open && (
        <div className="bell-undo bell-undo-flotante">
          <span className="bell-undo-text">Notificación eliminada</span>
          <button className="bell-undo-btn" onClick={deshacer}>
            Deshacer {pendiente.segundos > 0 ? `(${pendiente.segundos}s)` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

export default BellNotificaciones;

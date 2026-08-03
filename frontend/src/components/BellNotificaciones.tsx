import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheckDouble } from "react-icons/fa";

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

  const abrir = () => {
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
            {noLeidas > 0 && (
              <button className="bell-marcar-todas" onClick={marcarTodas}>
                <FaCheckDouble className="me-1" /> Marcar todas
              </button>
            )}
          </div>
          <div className="bell-panel-body">
            {notifs.length === 0 ? (
              <div className="bell-vacio">No tienes notificaciones</div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.ID_NOTIFICACION}
                  className={`bell-item ${n.LEIDA ? "leida" : "no-leida"}`}
                  onClick={() => alClic(n)}
                >
                  <span className="bell-item-dot" />
                  <span className="bell-item-texto">
                    <span className="bell-item-titulo">{n.TITULO}</span>
                    <span className="bell-item-mensaje">{n.MENSAJE}</span>
                    <span className="bell-item-fecha">
                      {new Date(n.FECHA).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BellNotificaciones;

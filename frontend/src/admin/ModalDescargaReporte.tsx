import { useCallback, useEffect, useRef, useState } from "react";
import { FaFileExcel, FaFilePdf } from "react-icons/fa";
import EncabezadoDetalle from "./EncabezadoDetalle";
import { descargarReporte } from "../utils/reportes";

/**
 * Modal previo a la descarga de reportes del panel (Excel/PDF).
 *
 * Permite confirmar el rango y elegir el alcance —todo el catálogo, solo JADDA
 * o una tienda— mostrando un resumen con la misma regla de negocio que el
 * archivo. El modal solo se cierra si la descarga termina con éxito y bloquea
 * Escape, overlay y botones mientras genera el archivo.
 */

interface Tienda {
  ID_VENDEDOR: number;
  NOMBRE_EMPRESA: string;
  ESTADO: string | null;
}

interface Resumen {
  ordenes: number;
  unidades: number;
  importe: number;
}

type Alcance = "todo" | "jadda" | "tienda";

interface Props {
  formato: "excel" | "pdf";
  desdeInicial: string;
  hastaInicial: string;
  onCerrar: () => void;
}

const ModalDescargaReporte = ({ formato, desdeInicial, hastaInicial, onCerrar }: Props) => {
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [alcance, setAlcance] = useState<Alcance>("todo");
  const [tienda, setTienda] = useState("");
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState("");
  const [descargando, setDescargando] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const rangoValido = Boolean(desde && hasta && desde <= hasta);

  // Tiendas disponibles para el alcance por tienda (activas primero).
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/reportes/tiendas", { credentials: "include" });
        if (!res.ok) throw new Error("Error al cargar las tiendas");
        const data = await res.json();
        if (!activo) return;
        const lista: Tienda[] = Array.isArray(data) ? data : [];
        setTiendas(lista);
        const inicial = lista.find((t) => t.ESTADO === "ACTIVO") ?? lista[0];
        if (inicial) setTienda(String(inicial.ID_VENDEDOR));
      } catch {
        if (activo) setTiendas([]);
      }
    })();
    return () => { activo = false; };
  }, []);

  // Foco inicial en el diálogo.
  useEffect(() => { modalRef.current?.focus(); }, []);

  const cerrarSiSePuede = useCallback(() => {
    if (!descargando) onCerrar();
  }, [descargando, onCerrar]);

  // Escape cierra salvo que la descarga esté en curso.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarSiSePuede();
      }
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [cerrarSiSePuede]);

  // Resumen con debounce; aborta la petición anterior y descarta respuestas viejas.
  useEffect(() => {
    if (alcance === "tienda" && !tienda) {
      setResumen(null);
      setCargandoResumen(false);
      setErrorResumen("");
      return;
    }
    if (!desde || !hasta) {
      setResumen(null);
      setCargandoResumen(false);
      setErrorResumen("Selecciona ambas fechas para ver el resumen.");
      return;
    }
    if (desde > hasta) {
      setResumen(null);
      setCargandoResumen(false);
      setErrorResumen("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    const controlador = new AbortController();
    setCargandoResumen(true);
    setErrorResumen("");
    const temporizador = setTimeout(async () => {
      const params = new URLSearchParams({ desde, hasta, alcance });
      if (alcance === "tienda") params.set("tienda", tienda);
      try {
        const res = await fetch(`/api/admin/reportes/resumen?${params.toString()}`, {
          credentials: "include",
          signal: controlador.signal,
        });
        if (!res.ok) throw new Error("Error al calcular el resumen");
        const data = await res.json();
        if (controlador.signal.aborted) return;
        setResumen({
          ordenes: Number(data.ordenes) || 0,
          unidades: Number(data.unidades) || 0,
          importe: Number(data.importe) || 0,
        });
      } catch (err) {
        if (controlador.signal.aborted || (err as Error)?.name === "AbortError") return;
        setResumen(null);
        setErrorResumen("No se pudo calcular el resumen. Intenta de nuevo.");
      } finally {
        if (!controlador.signal.aborted) setCargandoResumen(false);
      }
    }, 250);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [desde, hasta, alcance, tienda]);

  const tiendaSeleccionada = tiendas.find((t) => String(t.ID_VENDEDOR) === tienda) ?? null;
  const nombreTienda = tiendaSeleccionada?.NOMBRE_EMPRESA || (tienda ? `Tienda #${tienda}` : "");
  const sufijo = alcance === "todo" ? "todo" : alcance === "jadda" ? "jadda" : `tienda-${tienda}`;
  const detalle = alcance === "todo"
    ? "Todo el catálogo"
    : alcance === "jadda"
      ? "Solo JADDA"
      : `Tienda: ${nombreTienda}`;

  const descargar = async () => {
    if (!rangoValido || (alcance === "tienda" && !tienda)) return;
    const params = new URLSearchParams({ desde, hasta, alcance });
    if (alcance === "tienda") params.set("tienda", tienda);
    const ok = await descargarReporte({
      formato,
      url: `/api/admin/reportes/${formato}?${params.toString()}`,
      desde,
      hasta,
      prefijoArchivo: "reporte-jadda",
      setDescargando: (v) => setDescargando(v !== null),
      sufijo,
      detalle,
    });
    if (ok) onCerrar();
  };

  const titulo = formato === "excel" ? "Descargar reporte en Excel" : "Descargar reporte en PDF";
  const Icono = formato === "excel" ? FaFileExcel : FaFilePdf;
  const sinTiendas = tiendas.length === 0;
  const elegirTienda = alcance === "tienda";
  const puedeDescargar = rangoValido && !descargando && (!elegirTienda || Boolean(tienda));

  return (
    <div className="evidencia-overlay" data-testid="modal-overlay" onClick={cerrarSiSePuede}>
      <div
        ref={modalRef}
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="btn-close"
          aria-label="Cerrar"
          onClick={cerrarSiSePuede}
          disabled={descargando}
          style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}
        />

        <div className="adp-modal-head" style={{ paddingRight: 52 }}>
          <EncabezadoDetalle
            compacto
            icono={<Icono />}
            titulo={titulo}
            subtitulo="Elige el alcance y confirma el rango de fechas"
          />
        </div>

        <div className="au-modal-body" style={{ textAlign: "left" }}>
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label htmlFor="mdr-desde" className="form-label small text-muted fw-bold mb-1">Desde</label>
              <input
                id="mdr-desde"
                type="date"
                className="form-control form-control-sm"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label htmlFor="mdr-hasta" className="form-label small text-muted fw-bold mb-1">Hasta</label>
              <input
                id="mdr-hasta"
                type="date"
                className="form-control form-control-sm"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="mb-3">
            <legend className="form-label small text-muted fw-bold mb-2" style={{ fontSize: "0.82rem" }}>Alcance</legend>
            {([
              { valor: "todo", etiqueta: "Todo el catálogo" },
              { valor: "jadda", etiqueta: "Solo JADDA" },
              { valor: "tienda", etiqueta: "Una tienda" },
            ] as const).map((opcion) => (
              <div className="form-check" key={opcion.valor}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="mdr-alcance"
                  id={`mdr-alcance-${opcion.valor}`}
                  value={opcion.valor}
                  checked={alcance === opcion.valor}
                  onChange={() => setAlcance(opcion.valor)}
                />
                <label className="form-check-label" htmlFor={`mdr-alcance-${opcion.valor}`}>
                  {opcion.etiqueta}
                </label>
              </div>
            ))}
          </fieldset>

          <div className="mb-3">
            <label htmlFor="mdr-tienda" className="form-label small text-muted fw-bold mb-1">Tienda</label>
            <select
              id="mdr-tienda"
              className="form-select form-select-sm"
              value={tienda}
              onChange={(e) => setTienda(e.target.value)}
              disabled={sinTiendas}
            >
              {sinTiendas && <option value="">Sin tiendas disponibles</option>}
              {tiendas.map((t) => (
                <option key={t.ID_VENDEDOR} value={String(t.ID_VENDEDOR)}>
                  {`${t.NOMBRE_EMPRESA}${t.ESTADO ? ` (${t.ESTADO})` : ""}`}
                </option>
              ))}
            </select>
            {sinTiendas && <div className="form-text">No hay tiendas disponibles para filtrar.</div>}
          </div>

          <div className="mb-3">
            {errorResumen ? (
              <div className="alert alert-warning mb-0" role="alert">{errorResumen}</div>
            ) : cargandoResumen ? (
              <div className="text-muted small" role="status">Calculando el resumen...</div>
            ) : resumen ? (
              <div className="alert alert-light border mb-0" role="status">
                Se incluirán: {resumen.ordenes} órdenes · {resumen.unidades} unidades · ${resumen.importe.toLocaleString("es-CO")}
              </div>
            ) : elegirTienda && !tienda ? (
              <div className="text-muted small">Selecciona una tienda para ver el resumen.</div>
            ) : null}
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={cerrarSiSePuede}
              disabled={descargando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`btn btn-sm fw-bold ${formato === "excel" ? "btn-success" : "btn-danger"}`}
              onClick={() => { void descargar(); }}
              disabled={!puedeDescargar}
            >
              <Icono className="me-1" /> {descargando ? "Generando..." : `Descargar ${formato === "excel" ? "Excel" : "PDF"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalDescargaReporte;

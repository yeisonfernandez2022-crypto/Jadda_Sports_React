import { FaCheckCircle, FaClock, FaTimesCircle, FaImage, FaEye, FaChevronRight } from "react-icons/fa";
import { esMetaAcumulable } from "../utils/retosAvances.tsx";
import { montoMinimoSegunPorcentaje } from "../utils/reglasCupon";

interface Props {
  reto: any;
  esAdmin: boolean;
  onVerAvances: (reto: any) => void;
  onReportar: (reto: any, restante: number) => void;
}

export default function MisRetoCard({ reto: r, esAdmin, onVerAvances, onReportar }: Props) {
  const pct = Math.round((Number(r.PROGRESO) / Number(r.META_VALOR)) * 100);
  const pendientes = Number(r.EVIDENCIAS_PENDIENTES) || 0;
  const rechazadas = Number(r.EVIDENCIAS_RECHAZADAS) || 0;
  // Restante para la meta: se resta lo ya aprobado (PROGRESO) + la SUMA de cantidad de
  // avances pendientes (el backend expone PENDIENTE_CANTIDAD); fallback al count legado.
  const pendCant = r.PENDIENTE_CANTIDAD != null ? Number(r.PENDIENTE_CANTIDAD) : pendientes;
  const restante = Math.max(0, Number(r.META_VALOR) - Number(r.PROGRESO) - pendCant);
  const acumulable = esMetaAcumulable(r.META_TIPO);
  const avancesHoy = Number(r.AVANCES_HOY) || 0;
  const diaReportado = !acumulable && avancesHoy > 0;
  // COMPLETADO llega como número (0/1) de MySQL: JSX renderizaría el 0 como texto.
  const completado = Number(r.COMPLETADO) === 1;

  return (
    <div className={`mis-card ${completado ? "completado" : ""}`}>
      <div className="mis-card-head">
        <div>
          <h6 className="mis-card-titulo">{r.TITULO}</h6>
          <p className="mis-card-desc">{r.DESCRIPCION}</p>
        </div>
        {completado ? (
          <span className="mis-badge completado"><FaCheckCircle className="me-1" /> Completado</span>
        ) : (
          <span className="mis-badge en-progreso">En progreso</span>
        )}
      </div>
      <div className="mis-progress">
        <div className="mis-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="mis-progress-info">
        <span>{r.PROGRESO}/{r.META_VALOR} {r.META_TIPO}</span>
        <strong>{pct}%</strong>
      </div>
      {pendientes > 0 && (
        <div className="mis-alerta revision" onClick={() => onVerAvances(r)}>
          <FaClock className="me-1" /> {pendientes === 1 ? "Ver avance en revisión" : `Ver ${pendientes} avances en revisión`}
          <FaChevronRight className="mis-alerta-flecha" />
        </div>
      )}
      {rechazadas > 0 && !completado && (
        <div className="mis-alerta rechazada" onClick={() => onVerAvances(r)}>
          <FaTimesCircle className="me-1" /> {rechazadas === 1 ? "Ver avance rechazado" : `Ver ${rechazadas} avances rechazados`}
          <FaChevronRight className="mis-alerta-flecha" />
        </div>
      )}
      {completado && r.CUPON_GENERADO && (
        <div className="mis-cupon">
          Cupón: <strong>{r.CUPON_GENERADO}</strong> — {r.RECOMPENSA_PORCENTAJE}% descuento en toda tu compra, un solo uso
          {montoMinimoSegunPorcentaje(r.RECOMPENSA_PORCENTAJE) > 0 && (
            <> · compra mínima ${montoMinimoSegunPorcentaje(r.RECOMPENSA_PORCENTAJE).toLocaleString("es-CO")}</>
          )}
        </div>
      )}
      {completado && (
        <button className="mis-ver-avances" onClick={() => onVerAvances(r)}>
          Ver avances enviados
        </button>
      )}
      {!completado && !esAdmin && (
        <>
          {diaReportado && (
            <div className="mis-dia-hecho">
              <FaCheckCircle className="me-1" /> Avance de hoy ya reportado — vuelve mañana
            </div>
          )}
          <button
            className="mis-btn-reportar"
            onClick={() => onReportar(r, restante)}
            disabled={restante <= 0 || diaReportado}
          >
            {diaReportado ? <FaClock /> : <FaImage />}{" "}
            {restante <= 0
              ? "Meta pendiente por aprobar"
              : diaReportado
                ? "Vuelve mañana"
                : "Reportar avance"}
          </button>
        </>
      )}
      {esAdmin && !completado && (
        <div className="mis-visual">
          <FaEye className="me-1" /> Solo visualización
        </div>
      )}
    </div>
  );
}

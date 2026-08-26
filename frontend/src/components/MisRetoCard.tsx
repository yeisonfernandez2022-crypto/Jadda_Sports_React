import { FaCheckCircle, FaClock, FaTimesCircle, FaImage, FaEye } from "react-icons/fa";
import { tipoDe } from "../utils/retosAvances.tsx";
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
  const restante = Math.max(0, Number(r.META_VALOR) - Number(r.PROGRESO) - pendientes);
  const tipo = tipoDe(r.META_TIPO);

  return (
    <div className={`mis-card ${r.COMPLETADO ? "completado" : ""}`}>
      <div className="mis-card-head">
        <div>
          <h6 className="mis-card-titulo"><span className={`mis-card-icono ${tipo.clase}`}>{tipo.icono}</span>{r.TITULO}</h6>
          <p className="mis-card-desc">{r.DESCRIPCION}</p>
        </div>
        {r.COMPLETADO ? (
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
          <FaClock className="me-1" /> {pendientes} avance{pendientes !== 1 ? "s" : ""} en revisión — ver avances
        </div>
      )}
      {rechazadas > 0 && !r.COMPLETADO && (
        <div className="mis-alerta rechazada" onClick={() => onVerAvances(r)}>
          <FaTimesCircle className="me-1" /> {rechazadas} avance{rechazadas !== 1 ? "s" : ""} rechazado{rechazadas !== 1 ? "s" : ""} — ver avances
        </div>
      )}
      {r.COMPLETADO && r.CUPON_GENERADO && (
        <div className="mis-cupon">
          Cupón: <strong>{r.CUPON_GENERADO}</strong> — {r.RECOMPENSA_PORCENTAJE}% descuento en toda tu compra, un solo uso
          {montoMinimoSegunPorcentaje(r.RECOMPENSA_PORCENTAJE) > 0 && (
            <> · compra mínima ${montoMinimoSegunPorcentaje(r.RECOMPENSA_PORCENTAJE).toLocaleString("es-CO")}</>
          )}
        </div>
      )}
      {r.COMPLETADO && (
        <button className="mis-ver-avances" onClick={() => onVerAvances(r)}>
          Ver avances enviados
        </button>
      )}
      {!r.COMPLETADO && !esAdmin && (
        <button
          className="mis-btn-reportar"
          onClick={() => onReportar(r, restante)}
          disabled={restante <= 0}
        >
          <FaImage /> Reportar avance {restante > 0 ? `(máx. ${restante})` : ""}
        </button>
      )}
      {esAdmin && !r.COMPLETADO && (
        <div className="mis-visual">
          <FaEye className="me-1" /> Solo visualización
        </div>
      )}
    </div>
  );
}
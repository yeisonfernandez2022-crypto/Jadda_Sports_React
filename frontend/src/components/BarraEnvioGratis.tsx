/** Barra de progreso hacia el envío gratis (umbral real del backend: $800.000).
 *  Se usa en MiniCartMenu y en ResumenCompra. */
const ENVIO_GRATIS_DESDE = 800000;

function BarraEnvioGratis({ subtotal }: { subtotal: number }) {
  const s = Number(subtotal) || 0;
  if (s <= 0) return null;
  const faltan = Math.max(ENVIO_GRATIS_DESDE - s, 0);
  const pct = Math.min(Math.round((s / ENVIO_GRATIS_DESDE) * 100), 100);
  return (
    <div className="barra-envio">
      {faltan > 0 ? (
        <small>
          🚚 Te faltan <strong>${faltan.toLocaleString("es-CO")}</strong> para el <strong>envío gratis</strong>
        </small>
      ) : (
        <small className="barra-envio-logrado">✅ ¡Tienes <strong>envío gratis</strong>!</small>
      )}
      <div className="barra-envio-track">
        <div
          className="barra-envio-fill"
          style={{ width: `${Math.max(pct, 3)}%`, background: faltan > 0 ? "#e63946" : "#16a34a" }}
        />
      </div>
    </div>
  );
}

export default BarraEnvioGratis;

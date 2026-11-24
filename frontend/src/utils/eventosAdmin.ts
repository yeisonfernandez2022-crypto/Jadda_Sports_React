/**
 * Evento global para refrescar las insignias del sidebar admin en cuanto una
 * acción del panel cambia los pendientes (aprobar/rechazar productos, retos,
 * vendedores o devoluciones), sin esperar al sondeo periódico.
 */
export const PENDIENTES_ACTUALIZADOS = "jadda:pendientes-actualizados";

export function notificarPendientesActualizados() {
  window.dispatchEvent(new Event(PENDIENTES_ACTUALIZADOS));
}

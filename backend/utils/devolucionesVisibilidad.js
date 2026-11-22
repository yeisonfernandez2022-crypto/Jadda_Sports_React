/**
 * Regla única de visibilidad de devoluciones para el administrador.
 *
 * - Las devoluciones de JADDA (producto sin vendedor) siempre son visibles.
 * - Las devoluciones de tienda las gestiona primero el vendedor; el admin solo
 *   las ve cuando se escalan o cuando ya están cerradas (solo lectura).
 */
const ESTADOS_CERRADOS = ['APROBADA', 'RECHAZADA'];
const ESTADOS_VISIBLES_TIENDA = ['ESCALADA', ...ESTADOS_CERRADOS];

const SQL_DEVOLUCION_VISIBLE_ADMIN =
  "(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))";

function esVisibleParaAdmin({ idVendedor, estado }) {
  return idVendedor == null || ESTADOS_VISIBLES_TIENDA.includes(estado);
}

module.exports = { ESTADOS_CERRADOS, SQL_DEVOLUCION_VISIBLE_ADMIN, esVisibleParaAdmin };

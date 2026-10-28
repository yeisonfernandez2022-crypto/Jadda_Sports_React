const MOTIVO_REEMBOLSO_CANCELACION = 'Reembolso por cancelación del pedido';
const ESTADOS_PAGO_FALLIDO = ['DECLINADA', 'DECLINED', 'ERROR', 'VOIDED', 'CANCELADA', 'REJECTED'];
const fmtCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

const pagoConfirmadoEnVenta = (datosPago) => {
  if (!datosPago) return false;
  let datos = datosPago;
  if (Buffer.isBuffer(datos)) datos = datos.toString('utf8');
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos); } catch { return false; }
  }
  if (!datos || typeof datos !== 'object') return false;
  const estado = String(datos.estado || datos.status || '').toUpperCase();
  if (ESTADOS_PAGO_FALLIDO.includes(estado)) return false;
  if (estado === 'APPROVED' || estado === 'CONFIRMADA') return true;
  return Boolean(
    datos.transaccion_id ||
    datos.fecha_confirmacion ||
    datos.token ||
    datos.last4 ||
    datos.medio ||
    datos.pasarela
  );
};

const ventaPagada = (estado, datosPago) =>
  ['COMPLETADA', 'CONFIRMADA'].includes(estado) ||
  (estado !== 'PENDIENTE_PAGO' && pagoConfirmadoEnVenta(datosPago));

const aprobarReembolsosCancelacion = async (connection, { idUsuario, idVenta, detalles, costoEnvio = 0 }) => {
  const productos = new Map();
  for (const det of detalles) {
    const idProducto = Number(det.ID_PRODUCTO);
    const cantidad = Number(det.CANTIDAD || 0);
    if (!idProducto || cantidad <= 0) continue;
    const subtotalDetalle = det.SUBTOTAL != null ? Number(det.SUBTOTAL) : NaN;
    const acumulado = productos.get(idProducto) || { cantidad: 0, subtotal: 0 };
    acumulado.cantidad += cantidad;
    acumulado.subtotal += Number.isFinite(subtotalDetalle)
      ? subtotalDetalle
      : Number(det.PRECIO_UNITARIO || 0) * cantidad;
    productos.set(idProducto, acumulado);
  }

  let totalProductos = 0;
  let filas = 0;
  for (const [idProducto, prod] of productos) {
    totalProductos += prod.subtotal;

    const [actualizadas] = await connection.query(
      `UPDATE DEVOLUCIONES
       SET ESTADO = 'APROBADA', MOTIVO = ?, CANTIDAD = ?, FECHA_PROCESADA = NOW()
       WHERE ID_VENTA = ? AND ID_USUARIO = ? AND ID_PRODUCTO = ?
         AND TIPO = 'REEMBOLSO' AND ESTADO IN ('SOLICITADA', 'MAS_PRUEBAS')`,
      [MOTIVO_REEMBOLSO_CANCELACION, prod.cantidad, idVenta, idUsuario, idProducto]
    );
    if (actualizadas.affectedRows > 0) {
      filas += actualizadas.affectedRows;
      continue;
    }

    const [[existente]] = await connection.query(
      `SELECT COUNT(*) AS total FROM DEVOLUCIONES
       WHERE ID_VENTA = ? AND ID_USUARIO = ? AND ID_PRODUCTO = ?
         AND TIPO = 'REEMBOLSO' AND ESTADO = 'APROBADA'`,
      [idVenta, idUsuario, idProducto]
    );
    if (Number(existente.total) > 0) continue;

    await connection.query(
      `INSERT INTO DEVOLUCIONES
         (ID_USUARIO, ID_VENTA, ID_PRODUCTO, CANTIDAD, MOTIVO, TIPO, ESTADO, FECHA_PROCESADA)
       VALUES (?, ?, ?, ?, ?, 'REEMBOLSO', 'APROBADA', NOW())`,
      [idUsuario, idVenta, idProducto, prod.cantidad, MOTIVO_REEMBOLSO_CANCELACION]
    );
    filas += 1;
  }

  const envio = Number(costoEnvio);
  const costoEnvioReembolsado = Number.isFinite(envio) && envio > 0 ? envio : 0;
  return {
    automatico: true,
    totalProductos,
    costoEnvio: costoEnvioReembolsado,
    total: totalProductos + costoEnvioReembolsado,
    filas,
  };
};

const notificarReembolsoAutomatico = async (idUsuario, idVenta, total, costoEnvio = 0) => {
  try {
    const { crearNotificacion } = require('../controllers/notificacionController');
    const incluyeEnvio = Number(costoEnvio) > 0;
    await crearNotificacion({
      idUsuario,
      tipo: 'devolucion',
      titulo: '💸 Reembolso aprobado automáticamente',
      mensaje: `Pedido #${idVenta}: aprobamos el reembolso de ${fmtCOP(total)} por la cancelación${incluyeEnvio ? ' (productos + envío)' : ' de los productos'}. El dinero llegará a tu método de pago en un máximo de 7 días.`,
      ruta: `/perfil/reembolso/${idVenta}`,
    });
  } catch (e) { console.error('Error noti reembolso automático:', e.message); }
};

module.exports = {
  MOTIVO_REEMBOLSO_CANCELACION,
  ESTADOS_PAGO_FALLIDO,
  fmtCOP,
  pagoConfirmadoEnVenta,
  ventaPagada,
  aprobarReembolsosCancelacion,
  notificarReembolsoAutomatico,
};

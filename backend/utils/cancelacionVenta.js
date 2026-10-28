const db = require('../config/db');
const {
  aprobarReembolsosCancelacion,
  notificarReembolsoAutomatico,
  ventaPagada,
} = require('./reembolsosCancelacion');

const cancelarVentaYReembolsar = async ({ idVenta, canceladaPor }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      `SELECT ID_VENTA, ID_CLIENTE, ESTADO, DATOS_PAGO
       FROM VENTAS WHERE ID_VENTA = ? FOR UPDATE`,
      [idVenta]
    );
    if (ventas.length === 0) {
      await connection.rollback();
      return { encontrada: false };
    }

    const venta = ventas[0];
    if (venta.ESTADO === 'CANCELADA') {
      await connection.rollback();
      return { encontrada: true, sinCambios: true, reembolso: null };
    }

    const [envios] = await connection.query(
      `SELECT ESTADO_ENVIO, COSTO_ENVIO FROM ENVIOS WHERE ID_VENTA = ?`,
      [idVenta]
    );
    const envioSalido = ['EN_CAMINO', 'ENTREGADO'].includes(envios[0]?.ESTADO_ENVIO);
    const costoEnvio = envioSalido ? 0 : Number(envios[0]?.COSTO_ENVIO || 0);
    const pagoConfirmado = ventaPagada(venta.ESTADO, venta.DATOS_PAGO);

    const [detalles] = await connection.query(
      `SELECT ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL
       FROM DETALLE_VENTAS WHERE ID_VENTA = ?`,
      [idVenta]
    );

    await connection.query(
      `UPDATE VENTAS SET ESTADO = 'CANCELADA', CANCELADA_POR = ? WHERE ID_VENTA = ?`,
      [canceladaPor, idVenta]
    );

    const reembolso = pagoConfirmado && !envioSalido && detalles.length > 0
      ? await aprobarReembolsosCancelacion(connection, {
          idUsuario: venta.ID_CLIENTE,
          idVenta,
          detalles,
          costoEnvio,
        })
      : null;

    await connection.commit();

    if (reembolso && reembolso.total > 0) {
      await notificarReembolsoAutomatico(
        venta.ID_CLIENTE,
        idVenta,
        reembolso.total,
        reembolso.costoEnvio
      );
    }

    return {
      encontrada: true,
      sinCambios: false,
      pagoConfirmado,
      envioSalido,
      reembolso: reembolso && reembolso.total > 0 ? reembolso : null,
    };
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = { cancelarVentaYReembolsar };

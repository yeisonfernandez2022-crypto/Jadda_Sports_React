/**
 * util: registrarMovimientoStock — registra entradas/salidas en MOVIMIENTOS_STOCK
 * (RF-029 "Actualizar el inventario de manera detallada").
 * Tabla: MOVIMIENTOS_STOCK (ID_MOVIMIENTO, ID_PRODUCTO, TIPO_MOVIMIENTO,
 * CANTIDAD, FECHA) — creada en setup.js, sin cambios de esquema.
 */

const db = require('../config/db');

/**
 * Inserta un movimiento de inventario. Puede correr dentro de una transacción
 * (pasando `conn`) o directo contra el pool.
 * NUNCA lanza: si falla el registro, la operación principal (checkout,
 * edición de variante, devolución) sigue adelante.
 */
const registrarMovimientoStock = async ({ conn = null, idProducto, tipo, cantidad }) => {
  const n = Number(cantidad);
  if (!idProducto || !tipo || !n || n <= 0) return;
  const ejecutor = conn || db;
  try {
    await ejecutor.query(
      `INSERT INTO MOVIMIENTOS_STOCK (ID_PRODUCTO, TIPO_MOVIMIENTO, CANTIDAD, FECHA)
       VALUES (?, ?, ?, CURDATE())`,
      [idProducto, String(tipo).toUpperCase(), n]
    );
  } catch (err) {
    console.error('Error al registrar movimiento de stock:', err.message);
  }
};

module.exports = { registrarMovimientoStock };
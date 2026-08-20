/**
 * Número de pedido público: estable y pseudoaleatorio por venta.
 * Determinista (la misma venta siempre muestra el mismo número) y sin
 * cambios de esquema. Hash multiplicativo de Knuth → 8 dígitos.
 * @param {number} idVenta
 * @returns {number} Número de 8 dígitos (10.000.000 – 99.999.999)
 */
function numeroPedido(idVenta) {
  const n = Number(idVenta) || 0;
  const x = (n * 2654435761) >>> 0;
  return 10000000 + (x % 90000000);
}

module.exports = { numeroPedido };

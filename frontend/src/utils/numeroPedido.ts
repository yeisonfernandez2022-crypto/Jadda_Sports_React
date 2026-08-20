/**
 * Número de pedido público: estable y pseudoaleatorio por venta.
 * Misma implementación que backend/utils/numeroPedido.js para que web,
 * móvil y correos muestren SIEMPRE el mismo número.
 */
export function numeroPedido(idVenta: number): number {
  const n = Number(idVenta) || 0;
  const x = (n * 2654435761) >>> 0;
  return 10000000 + (x % 90000000);
}

/**
 * Validación de URLs de imágenes de producto EN EL ORIGEN (crear/editar
 * producto en productoController).
 *
 * Solo se aceptan:
 * - URLs de Cloudinary en https (el único host absoluto legítimo del
 *   catálogo — restringirlo evita SSRF cuando el resolutor de la factura
 *   descarga la imagen desde el servidor).
 * - Rutas relativas del catálogo local: /images/productos/...
 *
 * Se rechaza traversal (../), backslashes, esquemas peligrosos (data:, file:,
 * ftp:, http inseguro), query/anchor y rutas fuera del catálogo — evita que
 * queden almacenadas URLs que luego el servidor resuelva a rutas de disco
 * ajenas o descargue desde hosts internos.
 */
function urlImagenProductoValida(url) {
  if (typeof url !== 'string') return false;
  const limpia = url.trim();
  if (!limpia) return false;
  if (limpia.includes('\\') || limpia.includes('..')) return false;
  if (limpia.startsWith('https://res.cloudinary.com/')) return true;
  if (limpia.includes('?') || limpia.includes('#')) return false;
  return limpia.startsWith('/images/productos/');
}

module.exports = { urlImagenProductoValida };

/**
 * Helpers compartidos para el envío de correos electrónicos.
 */

/**
 * Convierte rutas locales (/images/...) en URLs absolutas para el correo
 * (los clientes de email no resuelven rutas relativas).
 */
const imagenParaCorreo = (url) => {
  if (!url) return 'https://placehold.co/48x48/eee/999?text=No+img';
  if (url.startsWith('/')) {
    return (process.env.FRONTEND_URL || 'http://localhost:5173') + url;
  }
  return url;
};

module.exports = { imagenParaCorreo };

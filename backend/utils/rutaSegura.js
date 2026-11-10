const path = require('path');

/**
 * Resuelve `rutaPedida` contra `baseDir` y devuelve la ruta absoluta
 * normalizada SOLO si queda contenida dentro de `baseDir`.
 *
 * Devuelve null cuando la ruta escapa de la base (traversal con ../, ruta
 * absoluta ajena, backslashes) o cuando la entrada es inválida — el
 * consumidor debe tratar null como "archivo no disponible" y NO intentar
 * leer/borrar nada.
 *
 * Reglas:
 * - Rechaza '\' siempre: en Windows es separador (permitiría escapar) y en
 *   Linux un nombre de archivo sospechoso que no deberíamos tocar.
 * - Rechaza el resultado que resuelve a la propia base (es un directorio, no
 *   un archivo).
 *
 * Consumidores: correo.js (imágenes embebidas en correos), facturaPdf.js,
 * retoController y devolucionController (unlink de evidencias).
 */
function rutaSegura(baseDir, rutaPedida) {
  if (typeof baseDir !== 'string' || !baseDir) return null;
  if (typeof rutaPedida !== 'string' || !rutaPedida) return null;
  if (rutaPedida.includes('\\')) return null;
  const base = path.resolve(baseDir);
  const resuelta = path.resolve(base, rutaPedida);
  if (resuelta === base) return null;
  if (!resuelta.startsWith(base + path.sep)) return null;
  return resuelta;
}

module.exports = { rutaSegura };

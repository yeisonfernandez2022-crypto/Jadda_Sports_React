/**
 * Helpers compartidos para el envío de correos electrónicos.
 */

const fs = require("fs");
const path = require("path");

/**
 * Directorio local de imágenes subidas. En Docker, `/app/uploads` está montado
 * desde `./frontend/public/images/productos` (docker-compose.yml).
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

// Caché simple de data URIs para no re-leer los mismos archivos en un envío
const cacheDataUri = new Map();

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

/**
 * Resuelve una URL de imagen de producto (/images/productos/...) a la ruta
 * local del archivo en el directorio de subidas. Retorna null si no aplica.
 */
const rutaLocalImagen = (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("/images/productos/")) return null;
  return path.join(UPLOADS_DIR, url.replace("/images/productos/", ""));
};

/**
 * Devuelve la imagen como data URI (base64) incrustada en el correo.
 * Así las imágenes de producto se ven en CUALQUIER cliente de email
 * (Gmail, Outlook, móvil), sin depender de que alcancen la URL del servidor.
 * Si el archivo no existe localmente (dev fuera de Docker), cae a la URL absoluta.
 */
const imagenComoDataUri = (url) => {
  const ruta = rutaLocalImagen(url);
  if (ruta && fs.existsSync(ruta)) {
    if (cacheDataUri.has(ruta)) return cacheDataUri.get(ruta);
    const ext = path.extname(ruta).slice(1) || "png";
    const uri = `data:image/${ext};base64,${fs.readFileSync(ruta).toString("base64")}`;
    if (cacheDataUri.size < 200) cacheDataUri.set(ruta, uri);
    return uri;
  }
  return imagenParaCorreo(url);
};

/**
 * Devuelve los datos para adjuntar la imagen INLINE en el correo vía `cid:`.
 * Los adjuntos inline (Content-ID) se renderizan en TODOS los clientes de
 * email (Gmail, Outlook web/escritorio, iOS/Android). Devuelve:
 *  - { usarCid: true, cid, ruta }: el archivo existe localmente → adjuntar.
 *  - { usarCid: false, url }: no existe (dev fuera de Docker) → URL absoluta.
 */
const datosAdjuntoImagen = (url, cid) => {
  const ruta = rutaLocalImagen(url);
  if (ruta && fs.existsSync(ruta)) return { usarCid: true, cid, ruta };
  return { usarCid: false, url: imagenParaCorreo(url) };
};

/**
 * Resolución ROBUSTA de la imagen local a partir de su URL:
 *  1. Ruta exacta (URL → /app/uploads/...).
 *  2. Si el archivo no existe, busca en la misma carpeta el archivo con el
 *     MISMO nombre base y cualquier extensión (img_1.jpg vs img_1.png).
 *  3. Si aun no, cualquier imagen (img_* o imagen) de la carpeta del producto.
 * Evita que una extensión mal guardada en BD rompa la miniatura del PDF.
 */
const resolverRutaImagenLocal = (url) => {
  const ruta = rutaLocalImagen(url);
  if (!ruta) return null;
  try {
    if (fs.existsSync(ruta) && fs.statSync(ruta).isFile()) return ruta;
    const dir = path.dirname(ruta);
    const base = path.basename(ruta, path.extname(ruta));
    const archivos = fs.readdirSync(dir);
    let match = archivos.find((f) => f.startsWith(base + ".") && fs.statSync(path.join(dir, f)).isFile());
    if (!match) {
      match = archivos.find((f) => /^img_\d+/i.test(f) && /\.(jpe?g|png|webp|gif)$/i.test(f));
    }
    return match ? path.join(dir, match) : null;
  } catch (err) {
    return null;
  }
};

/**
 * Plantilla base profesional para todos los correos de JADDA SPORTS
 * (checkout, avisos de stock, notificaciones de estado, devoluciones, retos).
 * Uso: plantillaCorreo({ emoji, titulo, subtitulo, saludo, contenido, botonTexto, botonEnlace, notas })
 */
const plantillaCorreo = ({ emoji = "📦", titulo, subtitulo = "", saludo = "", contenido = "", botonTexto = null, botonEnlace = null, notas = [] }) => {
  const boton =
    botonTexto && botonEnlace
      ? `<tr><td align="center" style="padding:16px 28px 4px">
          <a href="${botonEnlace}" style="background:#e63946;color:#ffffff;font-size:15px;font-weight:700;padding:12px 34px;border-radius:12px;text-decoration:none;display:inline-block;letter-spacing:0.3px">${botonTexto}</a>
        </td></tr>`
      : "";
  const notasHtml =
    notas.length > 0
      ? `<tr><td style="padding:4px 28px 22px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:12.5px;color:#475569;line-height:1.5">
            ${notas.map((n) => `<p style="margin:2px 0">${n}</p>`).join("")}
          </div>
        </td></tr>`
      : "";
  return `
    <div style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
        <tr><td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.10)">
            <tr>
              <td style="background:#0f172a;padding:20px 26px">
                <span style="font-size:21px;font-weight:800;color:#ffffff">JADDA <span style="color:#e63946">SPORTS</span></span>
                <span style="display:block;font-size:10.5px;color:#94a3b8;letter-spacing:1.5px;margin-top:2px">LO MEJOR EN DEPORTES</span>
              </td>
            </tr>
            <tr><td style="padding:28px 28px 6px">
              <div style="font-size:36px;line-height:1">${emoji}</div>
              <h1 style="font-size:21px;color:#0f172a;margin:12px 0 4px">${titulo}</h1>
              ${subtitulo ? `<p style="font-size:13px;color:#64748b;margin:0 0 12px">${subtitulo}</p>` : ""}
              ${saludo ? `<p style="font-size:14px;color:#334155;margin:0 0 8px">${saludo}</p>` : ""}
            </td></tr>
            <tr><td style="padding:2px 28px 6px;font-size:14px;color:#334155;line-height:1.6">${contenido}</td></tr>
            ${boton}
            ${notasHtml}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:16px 12px;font-size:12px;color:#94a3b8;line-height:1.5">
          © ${new Date().getFullYear()} JADDA SPORTS · Todos los derechos reservados<br>Ventas: ventas@jaddasports.com · Bogotá D.C., Colombia
        </td></tr>
      </table>
    </div>`;
};

module.exports = {
  imagenParaCorreo,
  imagenComoDataUri,
  datosAdjuntoImagen,
  rutaLocalImagen,
  resolverRutaImagenLocal,
  plantillaCorreo,
};
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const CARPETA_RAIZ = "jadda";
const URL_CLOUDINARY = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//;
const DATA_URI = /^data:([^;]+);base64,([\s\S]+)$/;

let configurado = false;

// Timeout por llamada al API de Cloudinary (ms). Las subidas de evidencias
// pueden pesar 25 MB, así que 60 s da margen; los llamadores ya aplican
// fallback a disco si la subida falla. Ajustable con CLOUDINARY_TIMEOUT_MS.
const TIMEOUT_MS = Number(process.env.CLOUDINARY_TIMEOUT_MS) || 60000;

function aplicarConfiguracion() {
  const url = process.env.CLOUDINARY_URL;
  const match = url && url.match(/^cloudinary:\/\/([^:]+):(.+)@([^@]+)$/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
      secure: true,
      timeout: TIMEOUT_MS,
    });
    configurado = true;
    return;
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
      timeout: TIMEOUT_MS,
    });
    configurado = true;
  }
}

aplicarConfiguracion();

function estaConfigurado() {
  if (!configurado) aplicarConfiguracion();
  return configurado;
}

/*
 * Aviso de producción (punto 3 de cierre-produccion-2): si el sistema corre
 * en producción SIN credenciales de Cloudinary, las subidas nuevas caen en
 * los bind-mounts locales del host — datos que un contenedor/host sin
 * respaldo puede perder. La función es pura (dadas la bandera y el estado de
 * configuración devuelve el texto o null) para poder probarla sin arrancar
 * el servidor; server.js solo la llama y registra el resultado (no bloquea).
 */
function avisoCloudinarySiFalta(estaEnProduccion) {
  if (!estaEnProduccion || estaConfigurado()) return null;
  return [
    '⚠️  CLOUDINARY NO ESTÁ CONFIGURADO EN PRODUCCIÓN',
    '   Las imágenes y evidencias nuevas se guardarán SOLO en los montajes',
    '   locales del host (frontend/public/images/*) y NO subrán a la nube.',
    '   Sin un respaldo de esos volúmenes (scripts/backup.ps1) se pierden',
    '   con el servidor. Configura CLOUDINARY_URL en backend/.env o acepta',
    '   explícitamente el riesgo documentado en docs/implantacion/04 §3.6.',
  ].join('\n');
}

function carpetaSegura(...partes) {
  return [CARPETA_RAIZ, ...partes.flat()]
    .map((parte) => {
      let limpio = String(parte ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "_");
      // Recorte de "._-" en bordes sin regex alternante (S8786)
      while (limpio.length > 0 && "._-".includes(limpio[0])) limpio = limpio.slice(1);
      while (limpio.length > 0 && "._-".includes(limpio[limpio.length - 1])) limpio = limpio.slice(0, -1);
      return limpio;
    })
    .filter(Boolean)
    .join("/");
}

function tipoRecurso(mimetype = "") {
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("image/")) return "image";
  return "auto";
}

function subirBuffer(buffer, opciones = {}) {
  if (!estaConfigurado()) {
    return Promise.reject(new Error("Cloudinary no está configurado"));
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", overwrite: false, ...opciones },
      (error, resultado) => (error ? reject(Object.assign(new Error(error.message || "Upload falló"), { name: "CloudinaryError" })) : resolve(resultado))
    );
    stream.end(buffer);
  });
}

async function subirArchivoLocal(ruta, opciones = {}) {
  if (!estaConfigurado()) {
    throw new Error("Cloudinary no está configurado");
  }
  if (!ruta || !fs.existsSync(ruta)) {
    throw new Error(`No existe el archivo a subir: ${ruta}`);
  }
  return cloudinary.uploader.upload(ruta, { resource_type: "auto", overwrite: false, ...opciones });
}

async function subirDataUri(dataUri, opciones = {}) {
  const match = typeof dataUri === "string" && dataUri.match(DATA_URI);
  if (!match) {
    throw new Error("El archivo no tiene un formato base64 válido");
  }
  const mimetype = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return subirBuffer(buffer, {
    resource_type: tipoRecurso(mimetype),
    ...opciones,
  });
}

function esUrlCloudinary(url) {
  return typeof url === "string" && URL_CLOUDINARY.test(url);
}

function tipoRecursoDesdeUrl(url) {
  const match = typeof url === "string" && url.match(URL_CLOUDINARY);
  return match ? match[1] : "image";
}

function publicIdDesdeUrl(url) {
  if (!esUrlCloudinary(url)) return null;
  const sinQuery = url.split("?")[0];
  const match = sinQuery.match(/\/upload\/(.+)$/);
  if (!match) return null;

  const partes = match[1].split("/");
  const version = partes.findIndex((parte) => /^v\d+$/.test(parte));
  const desde = version >= 0 ? version + 1 : 0;
  const ruta = partes.slice(desde).join("/");
  if (!ruta) return null;

  if (tipoRecursoDesdeUrl(url) === "raw") return decodeURIComponent(ruta);
  return decodeURIComponent(ruta.replace(/\.[a-z0-9]+$/i, ""));
}

async function eliminarPorUrl(url) {
  if (!estaConfigurado() || !esUrlCloudinary(url)) return false;
  const publicId = publicIdDesdeUrl(url);
  if (!publicId) return false;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: tipoRecursoDesdeUrl(url),
      invalidate: true,
    });
    return true;
  } catch (error) {
    console.error(`Cloudinary: no se pudo eliminar ${publicId}:`, error.message);
    return false;
  }
}

/*
 * ¿La URL de FOTO_URL corresponde a una foto SUBIDA por el usuario? Dos formas:
 * ruta local de la app (/images/...) o asset de Cloudinary (las subidas van
 * con `carpetaSegura` desde 2026-10-20). El login social NO debe pisarla con
 * la foto del proveedor: el guard antiguo solo cubría `/images/%`, así que al
 * migrar los medios a Cloudinary la foto subida pasó a ser una URL
 * https://res.cloudinary.com/... y cada re-login con Google la reemplazaba
 * por el avatar de la cuenta (bug: «la foto de perfil desaparecía al volver
 * a entrar»). Las URLs externas (avatar de Google/Facebook) NO son propias:
 * sí se refrescan en cada login social, igual que para quien nunca subió foto.
 */
function esFotoPropia(url) {
  if (typeof url !== "string" || !url) return false;
  if (url.startsWith("/images/")) return true;
  return esUrlCloudinary(url);
}

/*
 * Misma regla que esFotoPropia() expresada como SQL, para acompañarla en los
 * UPDATE de login social (defensa en profundidad: el guard de JS ya impidió
 * llegar aquí con una foto propia, la consulta lo re-verifica por sí sola).
 */
const GUARD_SQL_FOTO_PROPIA =
  "(FOTO_URL IS NULL OR (FOTO_URL NOT LIKE '/images/%' AND FOTO_URL NOT LIKE '%res.cloudinary.com/%'))";

module.exports = {
  cloudinary,
  estaConfigurado,
  avisoCloudinarySiFalta,
  carpetaSegura,
  subirBuffer,
  subirArchivoLocal,
  subirDataUri,
  esUrlCloudinary,
  publicIdDesdeUrl,
  eliminarPorUrl,
  esFotoPropia,
  GUARD_SQL_FOTO_PROPIA,
};

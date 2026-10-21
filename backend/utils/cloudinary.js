const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const CARPETA_RAIZ = "jadda";
const URL_CLOUDINARY = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//;
const DATA_URI = /^data:([^;]+);base64,([\s\S]+)$/;

let configurado = false;

function aplicarConfiguracion() {
  const url = process.env.CLOUDINARY_URL;
  const match = url && url.match(/^cloudinary:\/\/([^:]+):(.+)@([^@]+)$/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
      secure: true,
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
    });
    configurado = true;
  }
}

aplicarConfiguracion();

function estaConfigurado() {
  if (!configurado) aplicarConfiguracion();
  return configurado;
}

function carpetaSegura(...partes) {
  return [CARPETA_RAIZ, ...partes.flat()]
    .map((parte) =>
      String(parte ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "_")
        .replace(/^[._-]+|[._-]+$/g, "")
    )
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
      (error, resultado) => (error ? reject(error) : resolve(resultado))
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

module.exports = {
  cloudinary,
  estaConfigurado,
  carpetaSegura,
  subirBuffer,
  subirArchivoLocal,
  subirDataUri,
  esUrlCloudinary,
  publicIdDesdeUrl,
  eliminarPorUrl,
};

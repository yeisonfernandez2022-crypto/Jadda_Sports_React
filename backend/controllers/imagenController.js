/**
 * Subida de imágenes desde el panel admin.
 * Recibe base64 (data URLs) vía JSON: { imagenes: [{ nombre, data }] }
 * - Con idProducto: guarda en la carpeta del producto (uploads/Producto_NN/img_N.ext),
 *   continuando la numeración existente — las imágenes viven con las del producto.
 * - Sin idProducto: guarda en uploads/subidas/ (productos nuevos, sin ID aún).
 * La carpeta uploads es bind-mount de frontend/public/images/productos.
 */
const fs = require("fs");
const path = require("path");
const {
    estaConfigurado,
    subirBuffer,
    carpetaSegura,
} = require("../utils/cloudinary");
const { detectarFormato } = require("../utils/formatoImagen");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "subidas");
// Tope por ARCHIVO decodificado (el JSON global ya tiene su propio límite).
const MAX_BYTES_POR_ARCHIVO = 6 * 1024 * 1024;

const subirImagenes = async (req, res) => {
    const { imagenes, idProducto } = req.body || {};

    if (!imagenes || !Array.isArray(imagenes) || imagenes.length === 0) {
        return res.status(400).json({ error: "No se enviaron imágenes" });
    }
    if (imagenes.length > 8) {
        return res.status(400).json({ error: "Máximo 8 imágenes por solicitud" });
    }
    // Validar tamaño base64 aproximado (10MB ≈ 13.3MB base64)
    const MAX_BASE64 = 14 * 1024 * 1024;
    let totalBase64 = 0;
    for (const img of imagenes) {
        if (img.data && typeof img.data === 'string') {
            totalBase64 += img.data.length;
        }
    }
    if (totalBase64 > MAX_BASE64) {
        return res.status(400).json({ error: "El total de imágenes supera el límite permitido (10 MB)" });
    }

    try {
        let dir = UPLOAD_DIR;
        let prefijo = "subidas";
        let siguienteOrden = 1;

        if (idProducto) {
            const carpeta = `Producto_${String(idProducto).padStart(2, "0")}`;
            dir = path.join(UPLOAD_DIR, "..", carpeta);
            prefijo = carpeta;
            fs.mkdirSync(dir, { recursive: true });
            const existentes = fs.readdirSync(dir).filter(f => /^img_\d+\.[a-zA-Z0-9]+$/.test(f));
            let max = 0;
            for (const f of existentes) {
                const n = parseInt(f.match(/^img_(\d+)/)[1], 10);
                if (!Number.isNaN(n) && n > max) max = n;
            }
            siguienteOrden = max + 1;
        } else {
            fs.mkdirSync(dir, { recursive: true });
        }

        const urls = [];
        const carpetaCloud = carpetaSegura("productos", idProducto ? `producto-${idProducto}` : "nuevos");

        for (let i = 0; i < imagenes.length; i++) {
            const img = imagenes[i];
            const match = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(img.data || "");
            if (!match) continue;

            const buffer = Buffer.from(match[3], "base64");

            // Tope por archivo: un PNG decodificado de 6 MB ya es una imagen enorme
            if (buffer.length > MAX_BYTES_POR_ARCHIVO) {
                return res.status(400).json({ error: `El archivo ${img.nombre || `#${i + 1}`} supera el límite de 6 MB por imagen` });
            }

            // MAGIC BYTES: el formato REAL del contenido manda (el MIME declarado
            // lo escribe el cliente y es invisible para el servidor). Se rechaza
            // lo que no sea una imagen reconocible y lo que declare otro tipo.
            const formato = detectarFormato(buffer);
            if (!formato) {
                return res.status(400).json({ error: `El archivo ${img.nombre || `#${i + 1}`} no es una imagen válida (bytes no reconocidos)` });
            }
            if (formato.mime !== match[1]) {
                return res.status(400).json({ error: `El archivo ${img.nombre || `#${i + 1}`} declara ${match[1]} pero su contenido es otro` });
            }

            if (estaConfigurado()) {
                try {
                    const subida = await subirBuffer(buffer, {
                        folder: carpetaCloud,
                        resource_type: "image",
                    });
                    urls.push(subida.secure_url);
                    continue;
                } catch (cloudErr) {
                    console.error("Cloudinary (producto): no se pudo subir, se guarda en local:", cloudErr.message);
                }
            }

            const ext = formato.ext;
            const nombre = idProducto
                ? `img_${siguienteOrden + i}.${ext}`
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const ruta = path.join(dir, nombre);
            fs.writeFileSync(ruta, buffer);

            urls.push(`/images/productos/${prefijo}/${nombre}`);
        }

        if (urls.length === 0) {
            return res.status(400).json({ error: "Ningún archivo tenía un formato de imagen válido (jpg, png, webp, gif)" });
        }

        res.json({ urls });
    } catch (err) {
        console.error("Error subiendo imágenes:", err);
        res.status(500).json({ error: "Error al guardar las imágenes en el servidor" });
    }
};

module.exports = { subirImagenes };

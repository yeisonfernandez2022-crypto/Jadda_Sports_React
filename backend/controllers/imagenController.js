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

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "subidas");

const subirImagenes = async (req, res) => {
    const { imagenes, idProducto } = req.body || {};

    if (!imagenes || !Array.isArray(imagenes) || imagenes.length === 0) {
        return res.status(400).json({ error: "No se enviaron imágenes" });
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
        for (let i = 0; i < imagenes.slice(0, 8).length; i++) {
            const img = imagenes[i];
            const match = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(img.data || "");
            if (!match) continue;

            const ext = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
            const nombre = idProducto
                ? `img_${siguienteOrden + i}.${ext}`
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const ruta = path.join(dir, nombre);
            fs.writeFileSync(ruta, Buffer.from(match[3], "base64"));

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

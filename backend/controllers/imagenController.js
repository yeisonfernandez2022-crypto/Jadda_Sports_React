/**
 * Subida de imágenes desde el panel admin.
 * Recibe base64 (data URLs) vía JSON: { imagenes: [{ nombre, data }] }
 * Guarda los archivos en el directorio compartido con el frontend
 * (frontend/public/images/productos/subidas/) para que Vite las sirva
 * en /images/productos/subidas/...
 */
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "subidas");

const subirImagenes = async (req, res) => {
    const { imagenes } = req.body || {};

    if (!imagenes || !Array.isArray(imagenes) || imagenes.length === 0) {
        return res.status(400).json({ error: "No se enviaron imágenes" });
    }

    try {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });

        const urls = [];
        for (const img of imagenes.slice(0, 8)) {
            const match = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(img.data || "");
            if (!match) continue;

            const ext = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
            const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const ruta = path.join(UPLOAD_DIR, nombre);
            fs.writeFileSync(ruta, Buffer.from(match[3], "base64"));

            urls.push(`/images/productos/subidas/${nombre}`);
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

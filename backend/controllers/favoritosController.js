const db = require('../config/db');

const obtenerFavoritos = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  try {
    const [rows] = await db.query(
      `SELECT f.ID_FAVORITO, f.FECHA_AGREGADO,
              p.ID, p.NOMBRE, p.PRECIO, p.MARCA,
              COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
       FROM FAVORITOS f
       INNER JOIN PRODUCTOS p ON f.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE f.ID_USUARIO = ?
       ORDER BY f.FECHA_AGREGADO DESC`,
      [id_usuario]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener favoritos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener favoritos" });
  }
};

const agregarFavorito = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { id_producto } = req.body;

  if (!id_producto) {
    return res.status(400).json({ ok: false, msg: "ID del producto es obligatorio" });
  }

  try {
    const [existe] = await db.query(
      "SELECT ID_FAVORITO FROM FAVORITOS WHERE ID_USUARIO = ? AND ID_PRODUCTO = ?",
      [id_usuario, id_producto]
    );

    if (existe.length > 0) {
      return res.status(400).json({ ok: false, msg: "El producto ya está en favoritos" });
    }

    await db.query(
      "INSERT INTO FAVORITOS (ID_USUARIO, ID_PRODUCTO) VALUES (?, ?)",
      [id_usuario, id_producto]
    );

    res.status(201).json({ ok: true, msg: "Producto agregado a favoritos" });
  } catch (err) {
    console.error("Error al agregar favorito:", err);
    res.status(500).json({ ok: false, msg: "Error al agregar favorito" });
  }
};

const eliminarFavorito = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { id_favorito } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM FAVORITOS WHERE ID_FAVORITO = ? AND ID_USUARIO = ?",
      [id_favorito, id_usuario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Favorito no encontrado" });
    }

    res.json({ ok: true, msg: "Favorito eliminado" });
  } catch (err) {
    console.error("Error al eliminar favorito:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar favorito" });
  }
};

module.exports = { obtenerFavoritos, agregarFavorito, eliminarFavorito };

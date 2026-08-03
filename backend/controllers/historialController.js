const db = require('../config/db');

/** Obtiene los últimos 30 productos visitados por el usuario autenticado.
 *  Hace JOIN con PRODUCTOS y trae la primera imagen de cada producto.
 *  Ordena por FECHA_VISTO descendente. */
const obtenerHistorial = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  try {
    const [rows] = await db.query(
      `SELECT h.ID_HISTORIAL, h.FECHA_VISTO,
              p.ID, p.NOMBRE, p.PRECIO, p.MARCA, p.ID_DESCUENTO,
              COALESCE((SELECT SUM(pv.STOCK) FROM PRODUCTO_VARIANTES pv WHERE pv.ID_PRODUCTO = p.ID), 0) AS STOCK,
              (SELECT MIN(pv2.ID_VARIANTE) FROM PRODUCTO_VARIANTES pv2 WHERE pv2.ID_PRODUCTO = p.ID) AS ID_VARIANTE_POR_DEFECTO,
              COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
       FROM HISTORIAL h
       INNER JOIN PRODUCTOS p ON h.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE h.ID_USUARIO = ?
       ORDER BY h.FECHA_VISTO DESC
       LIMIT 30`,
      [id_usuario]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener historial:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener historial" });
  }
};

/** Guarda o actualiza el historial de navegación del usuario (upsert).
 *  Si el producto ya fue visitado antes, actualiza FECHA_VISTO a la fecha actual.
 *  Si es nuevo, inserta un registro. Luego verifica que no haya más de 30 registros y elimina los sobrantes. */
const guardarHistorial = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { id_producto } = req.body;

  if (!id_producto) {
    return res.status(400).json({ ok: false, msg: "ID del producto es obligatorio" });
  }

  try {
    const [existe] = await db.query(
      "SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? AND ID_PRODUCTO = ?",
      [id_usuario, id_producto]
    );

    if (existe.length > 0) {
      await db.query(
        "UPDATE HISTORIAL SET FECHA_VISTO = NOW() WHERE ID_HISTORIAL = ?",
        [existe[0].ID_HISTORIAL]
      );
    } else {
      await db.query(
        "INSERT INTO HISTORIAL (ID_USUARIO, ID_PRODUCTO, FECHA_VISTO) VALUES (?, ?, NOW())",
        [id_usuario, id_producto]
      );
    }

    const [rows] = await db.query(
      "SELECT ID_HISTORIAL FROM HISTORIAL WHERE ID_USUARIO = ? ORDER BY FECHA_VISTO DESC",
      [id_usuario]
    );
    if (rows.length > 30) {
      const idsToDelete = rows.slice(30).map(r => r.ID_HISTORIAL);
      await db.query(
        `DELETE FROM HISTORIAL WHERE ID_HISTORIAL IN (${idsToDelete.map(() => '?').join(',')})`,
        idsToDelete
      );
    }

    res.status(201).json({ ok: true, msg: "Historial guardado" });
  } catch (err) {
    console.error("Error al guardar historial:", err);
    res.status(500).json({ ok: false, msg: "Error al guardar historial" });
  }
};

module.exports = { obtenerHistorial, guardarHistorial };

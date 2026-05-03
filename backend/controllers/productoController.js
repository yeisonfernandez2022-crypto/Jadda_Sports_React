const db = require('../config/db');

exports.obtenerProductos = async (req, res) => {
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM PRODUCTOS";
    let params = [];

    // Solo entramos si el usuario escribió algo real en el buscador
    if (search && search.trim() !== "" && search !== "undefined") {
      const term = `%${search.trim()}%`;
      
      // USAMOS LAS COLUMNAS QUE SÍ EXISTEN EN TU TABLA:
      // NOMBRE, MARCA y DESCRIPCION
      sql += " WHERE NOMBRE LIKE ? OR MARCA LIKE ? OR DESCRIPCION LIKE ?";
      params = [term, term, term]; 
    }

    const [results] = await db.query(sql, params);
    res.json(results);

  } catch (err) {
    // Esto te dirá exactamente qué falla en la consola de Node
    console.error("Error detallado en MySQL:", err.sqlMessage);
    res.status(500).send("Error al obtener productos");
  }
};
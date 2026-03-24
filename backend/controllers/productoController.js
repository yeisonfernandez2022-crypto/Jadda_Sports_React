const db = require('../config/db');

exports.obtenerProductos = async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM PRODUCTOS");
    res.json(results);
  } catch (err) {
    res.status(500).send("Error al obtener productos");
  }
};
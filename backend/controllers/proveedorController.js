const db = require('../config/db'); 

const obtenerProveedores = async (req, res) => {
  try {
    // Hacemos el SELECT simple a tu tabla
    const [rows] = await db.query('SELECT ID_PROVEEDOR, NOMBRE_PROVEEDOR FROM PROVEEDORES');
    
    // Devolvemos los proveedores al frontend en formato JSON
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener los proveedores de la base de datos' });
  }
};

module.exports = {
  obtenerProveedores
};
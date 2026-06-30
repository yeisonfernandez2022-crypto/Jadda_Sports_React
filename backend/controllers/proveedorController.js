const db = require('../config/db'); 

/** Obtiene todos los proveedores registrados (SELECT básico de ID y nombre).
 *  No requiere autenticación ni parámetros. */
const obtenerProveedores = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT ID_PROVEEDOR, NOMBRE_PROVEEDOR FROM PROVEEDORES');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener los proveedores de la base de datos' });
  }
};

module.exports = {
  obtenerProveedores
};
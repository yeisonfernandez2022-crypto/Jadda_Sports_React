const logger = require('../utils/logger.js');
const dbReal = require('../config/db');
const { correoValido } = require('../utils/validarCorreo');
// (P7/P10) Inyección de BD para tests unitarios
let db = dbReal;
const _useDb = (reemplazo) => { db = reemplazo; };

/** Obtiene todos los proveedores registrados (SELECT básico de ID y nombre).
 *  No requiere autenticación ni parámetros: la lista alimenta el <select>
 *  del formulario de publicación de productos. */
const obtenerProveedores = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT ID_PROVEEDOR, NOMBRE_PROVEEDOR FROM PROVEEDORES');
    res.json(rows);
  } catch (error) {
    logger.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener los proveedores de la base de datos' });
  }
};

/**
 * Crea un proveedor desde el panel admin (botón "crear proveedor" del
 * formulario de publicación).
 * - Nombre obligatorio (3-200). Teléfono ≤ 15, email con formato básico y
 *   ≤ 100, contacto ≤ 100: son las longitudes reales de PROVEEDORES, así que
 *   un valor más largo reventaría la INSERT a medio flujo.
 * - El nombre actúa como llave lógica: duplicado exacto se rechaza con 400
 *   (misma UX que crearCategoria), en cascada por si la tabla gana UNIQUE.
 */
const crearProveedor = async (req, res) => {
  const { NOMBRE_PROVEEDOR, TELEFONO_PROVEEDOR, EMAIL_PROVEEDOR, CONTACTO_PROVEEDOR } = req.body || {};
  const nombre = typeof NOMBRE_PROVEEDOR === 'string' ? NOMBRE_PROVEEDOR.trim() : '';
  if (nombre.length < 3 || nombre.length > 200) {
    return res.status(400).json({ ok: false, msg: 'El nombre del proveedor debe tener entre 3 y 200 caracteres' });
  }
  const telefono = typeof TELEFONO_PROVEEDOR === 'string' ? TELEFONO_PROVEEDOR.trim() : '';
  if (telefono.length > 15) {
    return res.status(400).json({ ok: false, msg: 'El teléfono no puede superar 15 caracteres' });
  }
  const email = typeof EMAIL_PROVEEDOR === 'string' ? EMAIL_PROVEEDOR.trim() : '';
  if (email) {
    if (email.length > 100) {
      return res.status(400).json({ ok: false, msg: 'El email no puede superar 100 caracteres' });
    }
    if (!correoValido(email)) {
      return res.status(400).json({ ok: false, msg: 'El email no tiene un formato válido' });
    }
  }
  const contacto = typeof CONTACTO_PROVEEDOR === 'string' ? CONTACTO_PROVEEDOR.trim() : '';
  if (contacto.length > 100) {
    return res.status(400).json({ ok: false, msg: 'El contacto no puede superar 100 caracteres' });
  }
  try {
    const [existe] = await db.query('SELECT ID_PROVEEDOR FROM PROVEEDORES WHERE NOMBRE_PROVEEDOR = ?', [nombre]);
    if (existe.length > 0) {
      return res.status(400).json({ ok: false, msg: 'Ya existe un proveedor con ese nombre' });
    }
    const [result] = await db.query(
      'INSERT INTO PROVEEDORES (NOMBRE_PROVEEDOR, TELEFONO_PROVEEDOR, EMAIL_PROVEEDOR, CONTACTO_PROVEEDOR) VALUES (?, ?, ?, ?)',
      [nombre, telefono || null, email || null, contacto || null]
    );
    res.status(201).json({ ok: true, msg: 'Proveedor creado', ID_PROVEEDOR: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, msg: 'Ya existe un proveedor con ese nombre' });
    }
    logger.error('Error al crear proveedor:', error);
    res.status(500).json({ ok: false, msg: 'Error al crear el proveedor' });
  }
};

module.exports = {
  obtenerProveedores,
  crearProveedor,
  _useDb
};

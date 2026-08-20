// Middleware: solo usuarios con rol de vendedor (ID_ROL = 6) y cuenta activa en VENDEDORES.
const db = require('../config/db');

const esVendedor = async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
    }
    const usuario = req.user;
    if (!usuario || Number(usuario.ID_ROL) !== 6) {
      return res.status(403).json({ ok: false, msg: 'Solo los vendedores pueden realizar esta acción' });
    }
    const [rows] = await db.query(
      `SELECT ID_VENDEDOR, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR,
              TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS,
              ESTADO, FECHA_REGISTRO
       FROM VENDEDORES
       WHERE ID_USUARIO = ? AND (ESTADO IS NULL OR ESTADO = 'ACTIVO')`,
      [usuario.ID_USUARIO]
    );
    if (!rows || rows.length === 0) {
      return res.status(403).json({ ok: false, msg: 'Tu cuenta de vendedor no está activa' });
    }
    req.vendedor = rows[0];
    next();
  } catch (err) {
    console.error('Error en esVendedor:', err);
    res.status(500).json({ ok: false, msg: 'Error de servidor' });
  }
};

module.exports = esVendedor;
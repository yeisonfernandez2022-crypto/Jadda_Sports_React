const db = require('../config/db');

/** Crea una nueva PQR (Petición, Queja o Reclamo) para el usuario autenticado.
 *  Valida que tipo, asunto y descripción estén presentes.
 *  Inserta con ESTADO = 'PENDIENTE' y FECHA = NOW(). */
const crearPqr = async (req, res) => {
  try {
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });

    const { tipo, asunto, descripcion, numeroPedido } = req.body;

    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ error: "Tipo, asunto y descripción son obligatorios" });
    }

    await db.query(
      `INSERT INTO PQR (ID_USUARIO, TIPO, ASUNTO, DESCRIPCION, NUMERO_PEDIDO, FECHA, ESTADO)
       VALUES (?, ?, ?, ?, ?, NOW(), 'PENDIENTE')`,
      [idUsuario, tipo, asunto, descripcion, numeroPedido || null]
    );

    res.json({ ok: true, msg: "PQR creada exitosamente" });
  } catch (err) {
    console.error("Error al crear PQR:", err);
    res.status(500).json({ error: "Error al crear PQR" });
  }
};

module.exports = { crearPqr };

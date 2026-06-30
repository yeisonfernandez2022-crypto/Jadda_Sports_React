const db = require('../config/db');

/** Obtiene los métodos de pago guardados por el usuario autenticado.
 *  Hace JOIN con METODOS_PAGO para traer nombre y descripción.
 *  Ordena por ES_PRINCIPAL DESC para mostrar el principal primero. */
exports.obtenerMetodos = async (req, res) => {
  const idUsuario = req.user.ID_USUARIO;
  try {
    const [rows] = await db.query(
      `SELECT um.*, mp.NOMBRE_METODO, mp.DESCRIPCION
       FROM USUARIOS_METODOS_PAGO um
       JOIN METODOS_PAGO mp ON um.ID_METODO = mp.ID_METODO
       WHERE um.ID_USUARIO = ?
       ORDER BY um.ES_PRINCIPAL DESC, um.FECHA_CREADO DESC`,
      [idUsuario]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener métodos de pago:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener métodos de pago" });
  }
};

/** Guarda un método de pago para el usuario autenticado.
 *  Solo almacena datos no sensibles: titular, teléfono, banco y tipo.
 *  Requiere el ID_METODO que referencia la tabla METODOS_PAGO. */
exports.guardarMetodo = async (req, res) => {
  const idUsuario = req.user.ID_USUARIO;
  const { id_metodo, titular, telefono, banco, tipo } = req.body;

  if (!id_metodo) {
    return res.status(400).json({ ok: false, msg: "ID del método de pago es obligatorio" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO USUARIOS_METODOS_PAGO (ID_USUARIO, ID_METODO, TITULAR, TELEFONO, BANCO, TIPO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idUsuario, id_metodo, titular || null, telefono || null, banco || null, tipo || null]
    );
    res.status(201).json({ ok: true, msg: "Método de pago guardado", id: result.insertId });
  } catch (err) {
    console.error("Error al guardar método de pago:", err);
    res.status(500).json({ ok: false, msg: "Error al guardar método de pago" });
  }
};

/** Elimina un método de pago verificando que pertenezca al usuario autenticado.
 *  Retorna 404 si no se encuentra o no pertenece al usuario. */
exports.eliminarMetodo = async (req, res) => {
  const idUsuario = req.user.ID_USUARIO;
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `DELETE FROM USUARIOS_METODOS_PAGO WHERE ID = ? AND ID_USUARIO = ?`,
      [id, idUsuario]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Método de pago no encontrado" });
    }
    res.json({ ok: true, msg: "Método de pago eliminado" });
  } catch (err) {
    console.error("Error al eliminar método de pago:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar método de pago" });
  }
};

/** Establece un método de pago como principal para el usuario autenticado.
 *  Primero desmarca todos los métodos del usuario (ES_PRINCIPAL = 0)
 *  y luego marca el seleccionado (ES_PRINCIPAL = 1). */
exports.establecerPrincipal = async (req, res) => {
  const idUsuario = req.user.ID_USUARIO;
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 0 WHERE ID_USUARIO = ?`,
      [idUsuario]
    );
    const [result] = await db.query(
      `UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 1 WHERE ID = ? AND ID_USUARIO = ?`,
      [id, idUsuario]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Método de pago no encontrado" });
    }
    res.json({ ok: true, msg: "Método principal actualizado" });
  } catch (err) {
    console.error("Error al establecer método principal:", err);
    res.status(500).json({ ok: false, msg: "Error al establecer método principal" });
  }
};

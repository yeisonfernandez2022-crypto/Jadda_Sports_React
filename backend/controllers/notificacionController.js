const db = require("../config/db");

/**
 * Crea una notificación.
 * - idUsuario = null → notificación dirigida al ADMIN (todos los admin).
 * - idUsuario = N → notificación dirigida a ese usuario.
 */
async function crearNotificacion({ idUsuario = null, tipo, titulo, mensaje, ruta }) {
  try {
    await db.query(
      `INSERT INTO NOTIFICACIONES (ID_USUARIO, TIPO, TITULO, MENSAJE, RUTA) VALUES (?, ?, ?, ?, ?)`,
      [idUsuario, tipo, titulo, mensaje || null, ruta || null]
    );
  } catch (err) {
    console.error("Error al crear notificación:", err);
  }
}

/** Devuelve el filtro según el rol: admin ve las globales (ID_USUARIO IS NULL) + las suyas, el usuario ve las suyas.
 *  El where va ENTRE PARÉNTESIS para que cualquier AND posterior (LEIDA, ID_NOTIFICACION) no se rompa
 *  por la precedencia de operadores (el bug hizo que marcar 1 notificación marcara todas las del admin). */
function filtroUsuario(req) {
  const esAdmin = Number(req.user.ID_ROL) === 1;
  const idUsuario = req.user.ID_USUARIO || req.user.id;
  return {
    esAdmin,
    where: esAdmin ? "(ID_USUARIO IS NULL OR ID_USUARIO = ?)" : "(ID_USUARIO = ?)",
    params: [idUsuario],
  };
}

/** (Admin o usuario) Lista sus notificaciones: no leídas primero, luego por fecha. */
exports.misNotificaciones = async (req, res) => {
  try {
    const { where, params } = filtroUsuario(req);
    const [rows] = await db.query(
      `SELECT * FROM NOTIFICACIONES WHERE ${where} ORDER BY LEIDA ASC, FECHA DESC, ID_NOTIFICACION DESC LIMIT 50`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener notificaciones:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener notificaciones" });
  }
};

/** (Admin o usuario) Cantidad de notificaciones sin leer. */
exports.noLeidas = async (req, res) => {
  try {
    const { where, params } = filtroUsuario(req);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM NOTIFICACIONES WHERE ${where} AND LEIDA = 0`,
      params
    );
    res.json({ total });
  } catch (err) {
    console.error("Error al contar notificaciones:", err);
    res.status(500).json({ ok: false, msg: "Error al contar notificaciones" });
  }
};

/** Marca una notificación como leída (solo si es de su alcance). */
exports.marcarLeida = async (req, res) => {
  try {
    const { where, params } = filtroUsuario(req);
    await db.query(
      `UPDATE NOTIFICACIONES SET LEIDA = 1 WHERE ID_NOTIFICACION = ? AND ${where}`,
      [req.params.id, ...params]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al marcar notificación:", err);
    res.status(500).json({ ok: false, msg: "Error al marcar notificación" });
  }
};

/** Marca todas las notificaciones del usuario/admin como leídas. */
exports.marcarTodasLeidas = async (req, res) => {
  try {
    const { where, params } = filtroUsuario(req);
    await db.query(`UPDATE NOTIFICACIONES SET LEIDA = 1 WHERE ${where}`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al marcar notificaciones:", err);
    res.status(500).json({ ok: false, msg: "Error al marcar notificaciones" });
  }
};

exports.crearNotificacion = crearNotificacion;

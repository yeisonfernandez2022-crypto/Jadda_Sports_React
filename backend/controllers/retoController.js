const db = require("../config/db");

/** Obtiene todos los retos activos cuya fecha actual esté entre FECHA_INICIO y FECHA_FIN.
 *  Solo retorna retos con ACTIVO = 1, ordenados por fecha de fin ascendente. */
exports.obtenerRetos = async (req, res) => {
  try {
    const [retos] = await db.query(
      `SELECT * FROM RETOS WHERE ACTIVO = 1 AND FECHA_INICIO <= CURDATE() AND FECHA_FIN >= CURDATE() ORDER BY FECHA_FIN ASC`
    );
    res.json(retos);
  } catch (err) {
    console.error("Error al obtener retos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener retos" });
  }
};

/** Inscribe al usuario autenticado en un reto específico.
 *  Verifica que no esté ya inscrito y que el reto exista y esté activo.
 *  Inserta un registro en RETOS_USUARIOS con PROGRESO = 0 y COMPLETADO = 0. */
exports.unirseReto = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto } = req.params;

    const [existe] = await db.query(
      `SELECT * FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO = ?`,
      [id_reto, idUsuario]
    );
    if (existe.length > 0) {
      return res.status(400).json({ ok: false, msg: "Ya estás inscrito en este reto" });
    }

    const [reto] = await db.query(`SELECT * FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1`, [id_reto]);
    if (reto.length === 0) {
      return res.status(404).json({ ok: false, msg: "Reto no encontrado o no disponible" });
    }

    await db.query(
      `INSERT INTO RETOS_USUARIOS (ID_RETO, ID_USUARIO, PROGRESO, COMPLETADO) VALUES (?, ?, 0, 0)`,
      [id_reto, idUsuario]
    );

    res.json({ ok: true, msg: "Te has inscrito al reto exitosamente" });
  } catch (err) {
    console.error("Error al unirse al reto:", err);
    res.status(500).json({ ok: false, msg: "Error al unirse al reto" });
  }
};

/** Reporta progreso para un reto del usuario autenticado.
 *  Incrementa el progreso (sin superar la meta) y si se alcanza la meta, marca COMPLETADO = 1
 *  y llama a generarCupon para crear el cupón de recompensa. */
exports.reportarProgreso = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto_usuario } = req.params;
    const { cantidad } = req.body;

    const [rows] = await db.query(
      `SELECT ru.*, r.META_VALOR, r.META_TIPO FROM RETOS_USUARIOS ru JOIN RETOS r ON ru.ID_RETO = r.ID_RETO WHERE ru.ID_RETO_USUARIO = ? AND ru.ID_USUARIO = ?`,
      [id_reto_usuario, idUsuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "No estás inscrito en este reto" });
    }

    const ru = rows[0];
    if (ru.COMPLETADO) {
      return res.status(400).json({ ok: false, msg: "Este reto ya fue completado" });
    }

    const nuevoProgreso = Math.min(ru.PROGRESO + (cantidad || 1), ru.META_VALOR);
    const completado = nuevoProgreso >= ru.META_VALOR ? 1 : 0;

    await db.query(
      `UPDATE RETOS_USUARIOS SET PROGRESO = ?, COMPLETADO = ? WHERE ID_RETO_USUARIO = ?`,
      [nuevoProgreso, completado, id_reto_usuario]
    );

    if (completado) {
      await generarCupon(ru.ID_RETO, idUsuario, id_reto_usuario);
    }

    res.json({ ok: true, progreso: nuevoProgreso, meta: ru.META_VALOR, completado: !!completado });
  } catch (err) {
    console.error("Error al reportar progreso:", err);
    res.status(500).json({ ok: false, msg: "Error al reportar progreso" });
  }
};

/** Marca un reto como completado manualmente si el progreso alcanzó la meta.
 *  Valida que el progreso sea >= META_VALOR y genera el cupón de recompensa.
 *  Si ya estaba completado, retorna el cupón existente. */
exports.completarReto = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto_usuario } = req.params;

    const [rows] = await db.query(
      `SELECT ru.*, r.META_VALOR, r.RECOMPENSA_PORCENTAJE FROM RETOS_USUARIOS ru JOIN RETOS r ON ru.ID_RETO = r.ID_RETO WHERE ru.ID_RETO_USUARIO = ? AND ru.ID_USUARIO = ?`,
      [id_reto_usuario, idUsuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Reto no encontrado" });
    }

    const ru = rows[0];
    if (ru.COMPLETADO) {
      return res.json({ ok: true, msg: "Ya completaste este reto", cupon: ru.CUPON_GENERADO });
    }

    if (ru.PROGRESO < ru.META_VALOR) {
      return res.status(400).json({ ok: false, msg: `Aún no completas la meta (${ru.PROGRESO}/${ru.META_VALOR})` });
    }

    await db.query(`UPDATE RETOS_USUARIOS SET COMPLETADO = 1 WHERE ID_RETO_USUARIO = ?`, [id_reto_usuario]);
    const cupon = await generarCupon(ru.ID_RETO, idUsuario, id_reto_usuario);

    res.json({ ok: true, msg: "Reto completado", cupon });
  } catch (err) {
    console.error("Error al completar reto:", err);
    res.status(500).json({ ok: false, msg: "Error al completar reto" });
  }
};

/** Obtiene todos los retos del usuario autenticado con su progreso y metadatos.
 *  Hace JOIN con RETOS para incluir título, descripción, meta y recompensa.
 *  Ordena primero los no completados, luego por ID descendente. */
exports.misRetos = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;

    const [retos] = await db.query(
      `SELECT ru.*, r.TITULO, r.DESCRIPCION, r.META_TIPO, r.META_VALOR, r.RECOMPENSA_PORCENTAJE, r.FECHA_INICIO, r.FECHA_FIN
       FROM RETOS_USUARIOS ru
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE ru.ID_USUARIO = ?
       ORDER BY ru.COMPLETADO ASC, ru.ID_RETO_USUARIO DESC`,
      [idUsuario]
    );

    res.json(retos);
  } catch (err) {
    console.error("Error al obtener mis retos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener mis retos" });
  }
};

/** Función interna que genera un cupón de descuento al completar un reto.
 *  Crea un código con formato RETO{ID}-{USER}-{RANDOM4}, usa el porcentaje de recompensa del reto,
 *  establece vigencia de 30 días y guarda el código en RETOS_USUARIOS.CUPON_GENERADO. */
async function generarCupon(idReto, idUsuario, idRetoUsuario) {
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const codigo = `RETO${idReto}-${idUsuario}-${suffix}`;

  const [reto] = await db.query(`SELECT RECOMPENSA_PORCENTAJE FROM RETOS WHERE ID_RETO = ?`, [idReto]);
  if (reto.length === 0) return null;

  const porcentaje = reto[0].RECOMPENSA_PORCENTAJE;
  const hoy = new Date();
  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + 30);

  await db.query(
    `INSERT INTO DESCUENTOS (DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES (?, ?, ?, ?)`,
    [codigo, porcentaje, hoy.toISOString().split("T")[0], fin.toISOString().split("T")[0]]
  );

  await db.query(`UPDATE RETOS_USUARIOS SET CUPON_GENERADO = ? WHERE ID_RETO_USUARIO = ?`, [codigo, idRetoUsuario]);

  return codigo;
}

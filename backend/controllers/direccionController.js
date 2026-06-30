const db = require('../config/db');

/** Obtiene todas las direcciones del usuario autenticado.
 *  Ordena por ES_PRINCIPAL DESC para que la dirección principal aparezca primero.
 *  Retorna un arreglo de objetos dirección. */
const obtenerDirecciones = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  try {
    const [rows] = await db.query(
      `SELECT ID_DIRECCION, DIRECCION, BARRIO, CIUDAD, DEPARTAMENTO,
              CODIGO_POSTAL, TELEFONO_CONTACTO, ES_PRINCIPAL, ETIQUETA
       FROM DIRECCIONES
       WHERE ID_USUARIO = ?
       ORDER BY ES_PRINCIPAL DESC, ID_DIRECCION DESC`,
      [id_usuario]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener direcciones:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener direcciones" });
  }
};

/** Crea una nueva dirección para el usuario autenticado.
 *  Valida que dirección, ciudad y departamento estén presentes.
 *  Si es_principal es true, desmarca cualquier otra dirección principal del usuario antes de insertar. */
const crearDireccion = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { direccion, barrio, ciudad, departamento, codigo_postal, telefono_contacto, es_principal, etiqueta } = req.body;

  if (!direccion || !ciudad || !departamento) {
    return res.status(400).json({ ok: false, msg: "Dirección, ciudad y departamento son obligatorios" });
  }

  try {
    if (es_principal) {
      await db.query(
        `UPDATE DIRECCIONES SET ES_PRINCIPAL = 0 WHERE ID_USUARIO = ?`,
        [id_usuario]
      );
    }

    const [result] = await db.query(
      `INSERT INTO DIRECCIONES (ID_USUARIO, DIRECCION, BARRIO, CIUDAD, DEPARTAMENTO, CODIGO_POSTAL, TELEFONO_CONTACTO, ES_PRINCIPAL, ETIQUETA)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, direccion, barrio || null, ciudad, departamento, codigo_postal || null, telefono_contacto || null, es_principal ? 1 : 0, etiqueta || null]
    );

    res.status(201).json({ ok: true, msg: "Dirección creada", id: result.insertId });
  } catch (err) {
    console.error("Error al crear dirección:", err);
    res.status(500).json({ ok: false, msg: "Error al crear dirección" });
  }
};

/** Actualiza una dirección existente verificando que pertenezca al usuario autenticado.
 *  Si es_principal es true, desmarca las demás direcciones del usuario antes de actualizar. */
const actualizarDireccion = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { id_direccion } = req.params;
  const { direccion, barrio, ciudad, departamento, codigo_postal, telefono_contacto, es_principal, etiqueta } = req.body;

  try {
    const [exist] = await db.query(
      `SELECT ID_DIRECCION FROM DIRECCIONES WHERE ID_DIRECCION = ? AND ID_USUARIO = ?`,
      [id_direccion, id_usuario]
    );
    if (exist.length === 0) {
      return res.status(404).json({ ok: false, msg: "Dirección no encontrada" });
    }

    if (es_principal) {
      await db.query(
        `UPDATE DIRECCIONES SET ES_PRINCIPAL = 0 WHERE ID_USUARIO = ? AND ID_DIRECCION != ?`,
        [id_usuario, id_direccion]
      );
    }

    await db.query(
      `UPDATE DIRECCIONES SET DIRECCION = ?, BARRIO = ?, CIUDAD = ?, DEPARTAMENTO = ?,
       CODIGO_POSTAL = ?, TELEFONO_CONTACTO = ?, ES_PRINCIPAL = ?, ETIQUETA = ?
       WHERE ID_DIRECCION = ? AND ID_USUARIO = ?`,
      [direccion, barrio || null, ciudad, departamento, codigo_postal || null, telefono_contacto || null, es_principal ? 1 : 0, etiqueta || null, id_direccion, id_usuario]
    );

    res.json({ ok: true, msg: "Dirección actualizada" });
  } catch (err) {
    console.error("Error al actualizar dirección:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar dirección" });
  }
};

/** Elimina una dirección verificando que pertenezca al usuario autenticado.
 *  Retorna 404 si la dirección no existe o no pertenece al usuario. */
const eliminarDireccion = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { id_direccion } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM DIRECCIONES WHERE ID_DIRECCION = ? AND ID_USUARIO = ?`,
      [id_direccion, id_usuario]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Dirección no encontrada" });
    }
    res.json({ ok: true, msg: "Dirección eliminada" });
  } catch (err) {
    console.error("Error al eliminar dirección:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar dirección" });
  }
};

module.exports = {
  obtenerDirecciones,
  crearDireccion,
  actualizarDireccion,
  eliminarDireccion,
};

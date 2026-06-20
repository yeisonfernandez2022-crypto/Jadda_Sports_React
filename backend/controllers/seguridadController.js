const db = require('../config/db');
const bcrypt = require('bcryptjs');

const cambiarPassword = async (req, res) => {
  const id_usuario = req.user.ID_USUARIO;
  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) {
    return res.status(400).json({ ok: false, msg: "Ambas contraseñas son obligatorias" });
  }

  if (password_nueva.length < 8) {
    return res.status(400).json({ ok: false, msg: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  try {
    const [rows] = await db.query("SELECT CONTRASENA FROM USUARIOS WHERE ID_USUARIO = ?", [id_usuario]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }

    const match = await bcrypt.compare(password_actual, rows[0].CONTRASENA);
    if (!match) {
      return res.status(400).json({ ok: false, msg: "La contraseña actual no es correcta" });
    }

    const hashed = await bcrypt.hash(password_nueva, 10);
    await db.query("UPDATE USUARIOS SET CONTRASENA = ? WHERE ID_USUARIO = ?", [hashed, id_usuario]);

    res.json({ ok: true, msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("Error al cambiar password:", err);
    res.status(500).json({ ok: false, msg: "Error al cambiar la contraseña" });
  }
};

module.exports = { cambiarPassword };

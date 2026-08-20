/**
 * Estructura de carpetas por usuario:
 *   uploads/usuarios/{USUARIO}/perfil/  → foto de perfil
 *   uploads/usuarios/{USUARIO}/retos/r{ID_RETO_USUARIO}/ → evidencias de retos
 *
 * La clave de carpeta es el nombre de usuario (columna USUARIO) en minúsculas,
 * saneado a [a-z0-9._-]; si no hay nombre de usuario, fallback u{ID_USUARIO}.
 * Aplica por igual a web y móvil (ambos comparten este backend).
 */
const path = require("path");

const USUARIOS_DIR = path.join(__dirname, "..", "uploads", "usuarios");

function claveDeUsuario(usuario, idUsuario) {
  const bruto = String(usuario || "").trim();
  if (bruto) {
    const limpio = bruto
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "");
    if (limpio && limpio.length >= 2) return limpio;
  }
  return `u${idUsuario || "x"}`;
}

function claveDeReq(req) {
  return claveDeUsuario(req.user?.USUARIO, req.user?.ID_USUARIO);
}

module.exports = { USUARIOS_DIR, claveDeUsuario, claveDeReq };

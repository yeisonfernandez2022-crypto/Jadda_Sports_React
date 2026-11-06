// (Sonar S8786) Validación de correo SIN regex superpuesta — equivalente a
// /^[^\s@]+@[^\s@]+\.[^\s@]+$/ : un @ con algo antes, sin espacios y un
// punto después del @ con al menos un carácter de cada lado del punto.
// Fuente única en backend: la usan vendedorController y pagosController
// (cada controller tenía su copia con estilo distinto pero semántica idéntica).

const correoValido = (v) => {
  const s = String(v ?? "");
  const at = s.indexOf("@");
  const dot = s.lastIndexOf(".");
  return s.length > 0 && !/\s/.test(s) && at > 0 && s.indexOf("@", at + 1) === -1 && dot > at + 1 && dot < s.length - 1;
};

module.exports = { correoValido };

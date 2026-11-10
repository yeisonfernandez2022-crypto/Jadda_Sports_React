/**
 * A08 (2026-11-09): anti "CSV/formula injection" en los reportes .xlsx.
 * ExcelJS promueve a FÓRMULA cualquier valor de texto que empiece por '='
 * (y Excel interpreta prefijos +/ -/@/tab como DDE/hyperlink al abrir el
 * archivo). Un usuario registrado con NOMBRE_USUARIO "=HYPERLINK(...)" o un
 * producto de vendedor que empiece por '=' aparecía tal cual en la hoja del
 * reporte que abre el ADMIN — el prefijo ' los convierte en texto plano.
 * Solo aplica a celdas de DATOS del usuario: los literales/fórmulas del
 * generador no pasan por aquí.
 */
const textoCeldaExcel = (v) => {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
};

module.exports = { textoCeldaExcel };

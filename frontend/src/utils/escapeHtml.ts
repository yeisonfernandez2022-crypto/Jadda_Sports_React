/**
 * Escapa caracteres HTML para interpolar texto del servidor dentro de
 * opciones `html` de SweetAlert2 (los campos title/html de Swal se
 * interpretan como HTML). Evita XSS almacenado vía datos de la BD
 * (nombres de producto/categoría, motivos, etc.).
 */
export const escapeHtml = (valor: unknown): string =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );

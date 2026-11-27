/*
 * Lectura única de errores del API (ARQ-5).
 *
 * El backend histórico responde `{ error }` (checkout/middlewares),
 * `{ msg }` (mayoría de controladores) o `{ message }` (auth/pagos). En vez
 * de repetir `data.error || data.msg || data.message` en cada pantalla, el
 * SPA centraliza aquí el orden de prioridad. El contrato canónico para
 * código nuevo es `{ ok: false, msg }` (backend/utils/respuestaApi.js).
 */
const CLAVES = ["error", "msg", "message"] as const;

export function mensajeDeError(data: unknown, porDefecto = "Ocurrió un error"): string {
  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const registro = data as Record<string, unknown>;
    for (const clave of CLAVES) {
      const valor = registro[clave];
      if (typeof valor === "string" && valor.trim()) return valor;
    }
  }

  return porDefecto;
}

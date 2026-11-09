/*
 * Contrato del resultado OAuth entre el popup (/oauth-popup-callback) y el
 * AuthModal de la ventana madre.
 *
 * Canal primario: postMessage al opener.
 * Canal de respaldo: localStorage — si el navegador cortó la relación opener
 * durante el salto por accounts.google.com (COOP), el postMessage muere con
 * opener nulo; popup y madre comparten el MISMO origen (la SPA resuelve el
 * callback en ambos entornos: dev 5173, prod dominio del SPA) y la madre lee
 * el evento 'storage'. El popup limpia la clave al consumirse la madre.
 */

export interface ExitoOauth {
  type: "oauth-success";
  user: string;
  photo: string | null;
}

export interface FalloOauth {
  type: "oauth-error";
  motivo: string;
}

export type MensajeOauth = ExitoOauth | FalloOauth;

/** Clave única del canal localStorage compartido popup→madre. */
export const CLAVE_RESULTADO_OAUTH = "jadda_oauth_result";

/** Type guard del payload (postMessage y storage traen JSON sin tipar). */
export function esMensajeOauth(datos: unknown): MensajeOauth | null {
  if (!datos || typeof datos !== "object") return null;
  const d = datos as Record<string, unknown>;
  if (d.type === "oauth-success" && typeof d.user === "string") {
    return { type: "oauth-success", user: d.user, photo: typeof d.photo === "string" ? d.photo : null };
  }
  if (d.type === "oauth-error" && typeof d.motivo === "string") {
    return { type: "oauth-error", motivo: d.motivo };
  }
  return null;
}

/* Tokens de estilo "weblike" — alinean las subpáginas de perfil del móvil con
   la paleta y las formas del sitio web JADDA (fondo gris suave, tarjetas
   blancas radius 16 con sombra suave, inputs radius 10, navy/rojo de marca).
   SOLO visual: las páginas consumen estos tokens en sus StyleSheet. */

export const COLORES = {
  navy: "#002244",
  dark: "#0f172a",
  rojo: "#e63946",
  rojoOscuro: "#c1121f",
  fondo: "#f4f5f7",
  borde: "#e2e8f0",
  texto: "#0f172a",
  sub: "#64748b",
  blanco: "#ffffff",
  verde: "#16a34a",
  ambar: "#f59e0b",
} as const;

export const RADIO = {
  card: 16,
  input: 10,
} as const;

export const SOMBRA = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

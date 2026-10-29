import type { NavigateFunction } from "react-router-dom";

/** Saber si hay historial real detrás de esta vista.
 *  window.history.length NO sirve (cuenta todas las pestañas nuevas);
 *  react-router expone el índice de la entrada actual en history.state.idx. */
export const puedeRetroceder = (): boolean => {
  const estado = window.history.state as { idx?: number } | null;
  return typeof estado?.idx === "number" && estado.idx > 0;
};

/** Botón "Volver": retrocede 1 si hay historial; si no, cae a rutaPorDefecto.
 *  `permitir` recibe la decisión y devuelve true para continuar (módulos con
 *  guardia de cambios sin guardar la usan para abortar el regreso). */
export const volverAtras = (
  navigate: NavigateFunction,
  rutaPorDefecto: string,
  permitir?: (puede: boolean) => boolean
): void => {
  const puede = puedeRetroceder();
  if (permitir && !permitir(puede)) return;
  if (puede) navigate(-1);
  else navigate(rutaPorDefecto);
};

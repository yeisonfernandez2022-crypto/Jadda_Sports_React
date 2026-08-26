/** Reglas de cupones RETO- (espejo de backend/utils/reglasCupones.js).
 *  Descuento sobre toda la compra con mínimo escalado según el porcentaje. */
export const montoMinimoSegunPorcentaje = (porcentaje: number | string | null | undefined): number => {
  const p = Number(porcentaje) || 0;
  if (p >= 10) return 200000;
  if (p >= 7) return 150000;
  if (p >= 5) return 100000;
  return 50000;
};

export const esCuponReto = (descripcion: string | null | undefined): boolean =>
  /^RETO-/.test(String(descripcion || "").trim());

/** Condiciones legibles del cupón para mostrar en la UI. */
export const textoCondicionesCupon = (
  descripcion: string | null | undefined,
  porcentaje: number | string,
  montoMinimo?: number | string | null,
  fechaFin?: string | null
): string => {
  const partes = [`${Number(porcentaje)}% de descuento`];
  if (montoMinimo != null && Number(montoMinimo) > 0) {
    partes.push(`compra mínima $${Number(montoMinimo).toLocaleString("es-CO")}`);
  }
  if (esCuponReto(descripcion)) partes.push("un solo uso");
  if (fechaFin) {
    const f = String(fechaFin);
    const d = new Date(f.length === 10 ? f + "T00:00:00" : f);
    partes.push(`vence ${isNaN(d.getTime()) ? "próximamente" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`);
  } else {
    partes.push("vigente hasta agotar promoción");
  }
  return partes.join(" · ");
};

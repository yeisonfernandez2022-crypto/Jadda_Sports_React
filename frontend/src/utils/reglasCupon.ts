/** Espejo frontend de `backend/utils/reglasCupones.js` — mantener sincronizado si cambia la tabla de mínimos. */
export const TABLA_MINIMOS = [
  { desde: 10, minimo: 200000 }, // 10% o más
  { desde: 7, minimo: 150000 }, // 7% - 9%
  { desde: 5, minimo: 100000 }, // 5% - 6%
  { desde: 0, minimo: 50000 }, // 3% - 4%
] as const;

export function montoMinimoSegunPorcentaje(porcentaje: number | string | null | undefined): number {
  const p = Number(porcentaje) || 0;
  const tramo = TABLA_MINIMOS.find((t) => p >= t.desde);
  return tramo?.minimo ?? 50000;
}

export function esCuponReto(descripcion: string | null | undefined): boolean {
  return /^RETO-/.test(String(descripcion || "").trim());
}

export function textoCondicionesCupon(
  descripcion: string | null | undefined,
  porcentaje: number | string,
  montoMinimo?: number | string | null,
  fechaFin?: string | null
): string {
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
}

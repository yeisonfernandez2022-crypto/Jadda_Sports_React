const TABLA_MINIMOS = [
  { desde: 10, minimo: 200000 },
  { desde: 7, minimo: 150000 },
  { desde: 5, minimo: 100000 },
  { desde: 0, minimo: 50000 },
];

function montoMinimoSegunPorcentaje(porcentaje) {
  const p = Number(porcentaje) || 0;
  const tramo = TABLA_MINIMOS.find((t) => p >= t.desde);
  return tramo ? tramo.minimo : 50000;
}

function esCuponReto(descripcion) {
  return /^RETO-/.test(String(descripcion || "").trim());
}

function textoCondiciones(descripcion, porcentaje, montoMinimo, fechaFin) {
  const partes = [`${Number(porcentaje)}% de descuento`];
  if (montoMinimo != null && Number(montoMinimo) > 0) {
    partes.push(`compra mínima $${Number(montoMinimo).toLocaleString("es-CO")}`);
  }
  if (esCuponReto(descripcion)) partes.push("un solo uso");
  if (fechaFin) {
    const f = String(fechaFin);
    const d = new Date(f.length === 10 ? `${f}T00:00:00` : f);
    partes.push(`vence ${Number.isNaN(d.getTime()) ? "próximamente" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`);
  } else {
    partes.push("vigente hasta agotar promoción");
  }
  return partes.join(" · ");
}

module.exports = { TABLA_MINIMOS, montoMinimoSegunPorcentaje, esCuponReto, textoCondiciones };

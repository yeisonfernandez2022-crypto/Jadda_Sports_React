export const DIAS_DEVOLUCION = 3;

export const DEVOLUCION_ACTIVA = /SOLICITADA|APROBADA|MAS_PRUEBAS|ESCALADA/;

export interface CompraBase {
  ID_VENTA: number;
  ESTADO: string;
  ESTADO_ENVIO: string | null;
  REEMBOLSO_ESTADOS?: string | null;
  FECHA_ENTREGA?: string | null;
  FECHA_VENTA?: string;
}

export const tieneDevolucionActiva = (compra: CompraBase) =>
  !!compra.REEMBOLSO_ESTADOS && DEVOLUCION_ACTIVA.test(compra.REEMBOLSO_ESTADOS);

export const estadoVisible = (compra: CompraBase): { texto: string; color: string } => {
  const dev = compra.REEMBOLSO_ESTADOS || "";
  if (dev.includes("APROBADA")) return { texto: "Devolución aprobada", color: "#16a34a" };
  if (dev.includes("ESCALADA")) return { texto: "En decisión de JADDA", color: "#7c3aed" };
  if (DEVOLUCION_ACTIVA.test(dev)) return { texto: "En proceso de devolución", color: "#3b82f6" };
  switch (compra.ESTADO_ENVIO) {
    case "ENTREGADO": return { texto: "Entregada", color: "#16a34a" };
    case "EN_CAMINO": return { texto: "En camino", color: "#3b82f6" };
    case "EMPACADO": return { texto: "Empacado", color: "#8b5cf6" };
    case "POR_EMPAQUETAR": return { texto: "Por empaquetar", color: "#f59e0b" };
    case "PENDIENTE": return { texto: "Pendiente de envío", color: "#f59e0b" };
    case "CANCELADO": return { texto: "Envío cancelado", color: "#ef4444" };
  }
  switch (compra.ESTADO) {
    case "COMPLETADA": return { texto: "Completada", color: "#22c55e" };
    case "PENDIENTE": return { texto: "Pendiente", color: "#f59e0b" };
    case "CANCELADA": return { texto: "Cancelada", color: "#ef4444" };
    case "ENVIADA": return { texto: "Enviada", color: "#3b82f6" };
    case "CONFIRMADA": return { texto: "Confirmada", color: "#3b82f6" };
    default: return { texto: compra.ESTADO, color: "#94a3b8" };
  }
};

export const estadoEnvioTexto: Record<string, string> = {
  PENDIENTE: "🛒 Pendiente de envío",
  POR_EMPAQUETAR: "📦 Por empaquetar",
  EMPACADO: "📦 Empacado",
  EN_CAMINO: "🚚 En camino",
  ENTREGADO: "✅ Entregado",
  CANCELADO: "❌ Envío cancelado",
};

export const puedeDevolver = (compra: CompraBase): boolean => {
  if (compra.ESTADO !== "COMPLETADA") return false;
  if (compra.ESTADO_ENVIO !== "ENTREGADO") return true;
  const base = compra.FECHA_ENTREGA || compra.FECHA_VENTA;
  if (!base) return true;
  return Date.now() - new Date(base).getTime() <= DIAS_DEVOLUCION * 24 * 3600 * 1000;
};

export const devolucionVencida = (compra: CompraBase): boolean =>
  compra.ESTADO === "COMPLETADA" && compra.ESTADO_ENVIO === "ENTREGADO" && !puedeDevolver(compra);
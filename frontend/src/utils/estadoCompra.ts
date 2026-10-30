export const DIAS_DEVOLUCION = 3;

export const DEVOLUCION_ACTIVA = /SOLICITADA|APROBADA|MAS_PRUEBAS|ESCALADA/;

export interface CompraBase {
  ID_VENTA: number;
  ESTADO: string;
  ESTADO_ENVIO: string | null;
  REEMBOLSO_ESTADOS?: string | null;
  /** Tipos de solicitud de la venta (GROUP_CONCAT de DEVOLUCIONES.TIPO):
   *  DEVOLUCION, REEMBOLSO o ambos separados por coma. */
  DEVOLUCION_TIPOS?: string | null;
  FECHA_ENTREGA?: string | null;
  FECHA_VENTA?: string;
  /** Quién canceló la venta (NULL en ventas previas a la columna): CLIENTE,
   *  TIENDA o SISTEMA (ventana de pago vencida / pago rechazado). */
  CANCELADA_POR?: string | null;
  /** El servidor confirmó el cobro (VENTAS.DATOS_PAGO con evidencia de pago). */
  PAGO_CONFIRMADO?: boolean;
}

export const tieneDevolucionActiva = (compra: CompraBase) =>
  !!compra.REEMBOLSO_ESTADOS && DEVOLUCION_ACTIVA.test(compra.REEMBOLSO_ESTADOS);

export const tiposDevolucion = (compra: CompraBase): string[] =>
  (compra.DEVOLUCION_TIPOS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** true solo cuando la solicitud es de reembolso (no una devolución de producto). */
export const esReembolso = (compra: CompraBase): boolean => {
  const tipos = tiposDevolucion(compra);
  return tipos.includes("REEMBOLSO") && !tipos.includes("DEVOLUCION");
};

const textoCancelacion = (compra: CompraBase): string => {
  const por = compra.CANCELADA_POR;
  if (por === "CLIENTE") return "Cancelada por ti";
  if (por === "TIENDA") return "Cancelada por la tienda";
  if (por === "SISTEMA") return "Pago no completado";
  return "Cancelada";
};

export const estadoVisible = (compra: CompraBase): { texto: string; color: string } => {
  const dev = compra.REEMBOLSO_ESTADOS || "";
  if (dev.includes("APROBADA")) {
    const aprobada = esReembolso(compra) ? "Reembolso aprobado" : "Devolución aprobada";
    // En una cancelación el reembolso es automático: conservar quién canceló
    // en el badge (el cliente lo pidió explícitamente) y añadir el estado del
    // dinero en la misma etiqueta.
    return {
      texto: compra.ESTADO === "CANCELADA" ? `${textoCancelacion(compra)} · ${aprobada}` : aprobada,
      color: "#16a34a",
    };
  }
  if (dev.includes("ESCALADA")) return { texto: "En decisión de JADDA", color: "#7c3aed" };
  if (dev.includes("MAS_PRUEBAS")) return { texto: "Pide más pruebas", color: "#0ea5e9" };
  if (DEVOLUCION_ACTIVA.test(dev)) return { texto: "En proceso de devolución", color: "#3b82f6" };
  if (dev.includes("RECHAZADA")) {
    return {
      texto: esReembolso(compra) ? "Reembolso rechazado" : "Devolución rechazada",
      color: "#ef4444",
    };
  }
  // PENDIENTE_PAGO va ANTES del estado del envío: la venta nace con envío
  // PENDIENTE, pero hasta que Wompi confirme el pago el pedido no se despacha
  // — mostrar "Pendiente de envío" confundía al cliente (2026-10-26).
  if (compra.ESTADO === "PENDIENTE_PAGO") return { texto: "Pendiente de pago", color: "#8b5cf6" };
  // CANCELADA también va antes del envío: cancelar la venta pone el envío en
  // CANCELADO como EFECTO SECUNDARIO, y el badge debe decir QUIÉN canceló.
  // ("Envío cancelado" solo aplica cuando la venta sigue viva y la tienda
  // canceló únicamente el despacho.)
  if (compra.ESTADO === "CANCELADA") {
    return { texto: textoCancelacion(compra), color: "#ef4444" };
  }
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

/**
 * El paquete fue entregado (con fila ENVIOS el estado del envío manda:
 * una venta ENVIADA que la tienda marcó entregada = entregada) o es una
 * venta histórica COMPLETADA sin fila ENVIOS (equivale a entregada).
 */
export const ventanaEntregada = (compra: CompraBase): boolean => {
  if (compra.ESTADO === "CANCELADA" || compra.ESTADO === "PENDIENTE_PAGO") return false;
  if (compra.ESTADO_ENVIO) return compra.ESTADO_ENVIO === "ENTREGADO";
  return compra.ESTADO === "COMPLETADA";
};

export const puedeDevolver = (compra: CompraBase): boolean => {
  if (!ventanaEntregada(compra)) return false;
  const base = compra.FECHA_ENTREGA || compra.FECHA_VENTA;
  if (!base) return true;
  return Date.now() - new Date(base).getTime() <= DIAS_DEVOLUCION * 24 * 3600 * 1000;
};

export const devolucionVencida = (compra: CompraBase): boolean =>
  ventanaEntregada(compra) && !puedeDevolver(compra);

/**
 * Mensaje para explicar por qué un pedido aún no permite devolución/reembolso.
 * Devuelve null cuando la solicitud SÍ está disponible.
 * Se usa en MisCompras, DetalleCompra y DevolverPedido para que el cliente no
 * llegue a un callejón sin salida al abrir el formulario por URL directa.
 */
export const mensajeDevolucionNoDisponible = (compra: CompraBase): string | null => {
  if (compra.ESTADO === "CANCELADA") {
    return "Este pedido fue cancelado. Si el pago se confirmó, el reembolso de los productos (y el costo de envío si no había sido despachado) se procesa automáticamente.";
  }

  const estadoEnvio = compra.ESTADO_ENVIO || (compra.ESTADO === "ENVIADA" ? "ENVIADA" : null);
  if (estadoEnvio && estadoEnvio !== "ENTREGADO") {
    if (["EN_CAMINO", "ENVIADA"].includes(estadoEnvio)) {
      return "Tu pedido está en camino. Cuando lo recibas tendrás 3 días para solicitar el reembolso o la devolución.";
    }
    return "Tu pedido todavía no ha sido entregado. Cuando lo recibas tendrás 3 días para solicitar el reembolso o la devolución.";
  }

  // Con fila ENVIOS el estado del envío manda; sin fila (legacy) COMPLETADA
  // equivale a entregada histórica.
  if (!estadoEnvio && compra.ESTADO !== "COMPLETADA") {
    return "Tu pedido todavía no ha sido entregado. Cuando lo recibas tendrás 3 días para solicitar el reembolso o la devolución.";
  }

  if (devolucionVencida(compra)) {
    return `El plazo de ${DIAS_DEVOLUCION} días para solicitar reembolso o devolución ya venció.`;
  }
  return null;
};
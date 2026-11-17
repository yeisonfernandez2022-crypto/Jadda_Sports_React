import { describe, it, expect, vi } from "vitest";
import {
  DIAS_DEVOLUCION,
  PALETA_ESTADO,
  estadoEnvioTexto,
  estadoVisible,
  esReembolso,
  tieneDevolucionActiva,
  tiposDevolucion,
  ventanaEntregada,
  puedeDevolver,
  devolucionVencida,
  mensajeDevolucionNoDisponible,
  type CompraBase,
} from "../../../frontend/src/utils/estadoCompra.ts";

/**
 * estadoCompra.extra: la matriz completa de estadoVisible (estados de
 * reembolso, cancelaciones por actor, switches de envío/venta), los helpers
 * tiposDevolucion/tieneDevolucionActiva/esReembolso y las ventanas de
 * devolución. La suite base cubre el flujo de fechas; aquí el resto.
 */

const compra = (over: Partial<CompraBase> = {}): CompraBase => ({
  ID_VENTA: 1,
  ESTADO: "COMPLETADA",
  ESTADO_ENVIO: null,
  ...over,
});

describe("estadoCompra.extra — helpers de tipos de solicitud", () => {
  it("tiposDevolucion: null → [], una sola, varias con espacios y vacía", () => {
    expect(tiposDevolucion(compra({ DEVOLUCION_TIPOS: null }))).toEqual([]);
    expect(tiposDevolucion(compra({ DEVOLUCION_TIPOS: "DEVOLUCION" }))).toEqual(["DEVOLUCION"]);
    expect(tiposDevolucion(compra({ DEVOLUCION_TIPOS: "DEVOLUCION, REEMBOLSO" }))).toEqual(["DEVOLUCION", "REEMBOLSO"]);
    expect(tiposDevolucion(compra({ DEVOLUCION_TIPOS: "" }))).toEqual([]);
  });

  it("tieneDevolucionActiva: null y estados no activos → false; SOLICITADA/APROBADA → true", () => {
    expect(tieneDevolucionActiva(compra({ REEMBOLSO_ESTADOS: null }))).toBe(false);
    expect(tieneDevolucionActiva(compra({ REEMBOLSO_ESTADOS: "RECHAZADA" }))).toBe(false);
    expect(tieneDevolucionActiva(compra({ REEMBOLSO_ESTADOS: "SOLICITADA" }))).toBe(true);
    expect(tieneDevolucionActiva(compra({ REEMBOLSO_ESTADOS: "MAS_PRUEBAS" }))).toBe(true);
    expect(tieneDevolucionActiva(compra({ REEMBOLSO_ESTADOS: "ESCALADA" }))).toBe(true);
  });

  it("esReembolso: solo REEMBOLSO → true; solo DEVOLUCION o ambos → false", () => {
    expect(esReembolso(compra({ DEVOLUCION_TIPOS: "REEMBOLSO" }))).toBe(true);
    expect(esReembolso(compra({ DEVOLUCION_TIPOS: "DEVOLUCION" }))).toBe(false);
    expect(esReembolso(compra({ DEVOLUCION_TIPOS: "DEVOLUCION, REEMBOLSO" }))).toBe(false);
    expect(esReembolso(compra({ DEVOLUCION_TIPOS: null }))).toBe(false);
  });
});

describe("estadoCompra.extra — estadoVisible con reembolso en curso", () => {
  it("APROBADA de DEVOLUCION (no reembolso) → 'Devolución aprobada'", () => {
    const r = estadoVisible(compra({ REEMBOLSO_ESTADOS: "APROBADA", DEVOLUCION_TIPOS: "DEVOLUCION" }));
    expect(r.texto).toBe("Devolución aprobada");
    expect(r.color).toBe(PALETA_ESTADO.ok);
  });

  it("APROBADA + cancelada por la TIENDA conserva el actor en el badge", () => {
    const r = estadoVisible(compra({
      ESTADO: "CANCELADA", ESTADO_ENVIO: "CANCELADO", REEMBOLSO_ESTADOS: "APROBADA",
      DEVOLUCION_TIPOS: "REEMBOLSO", CANCELADA_POR: "TIENDA",
    }));
    expect(r.texto).toBe("Cancelada por la tienda · Reembolso aprobado");
  });

  it("APROBADA + cancelada por el SISTEMA (ventana de pago vencida)", () => {
    const r = estadoVisible(compra({
      ESTADO: "CANCELADA", REEMBOLSO_ESTADOS: "APROBADA",
      DEVOLUCION_TIPOS: "REEMBOLSO", CANCELADA_POR: "SISTEMA",
    }));
    expect(r.texto).toBe("Pago no completado · Reembolso aprobado");
  });

  it("APROBADA + cancelada sin actor conocido → 'Cancelada' genérico", () => {
    const r = estadoVisible(compra({
      ESTADO: "CANCELADA", REEMBOLSO_ESTADOS: "APROBADA",
      DEVOLUCION_TIPOS: "REEMBOLSO", CANCELADA_POR: null,
    }));
    expect(r.texto).toBe("Cancelada · Reembolso aprobado");
  });

  it("ESCALADA → 'En decisión de JADDA'", () => {
    expect(estadoVisible(compra({ REEMBOLSO_ESTADOS: "ESCALADA" })).texto).toBe("En decisión de JADDA");
  });

  it("MAS_PRUEBAS → 'Pide más pruebas'", () => {
    expect(estadoVisible(compra({ REEMBOLSO_ESTADOS: "MAS_PRUEBAS" })).texto).toBe("Pide más pruebas");
  });

  it("SOLICITADA → 'En proceso de devolución'", () => {
    expect(estadoVisible(compra({ REEMBOLSO_ESTADOS: "SOLICITADA" })).texto).toBe("En proceso de devolución");
  });

  it("RECHAZADA de reembolso y de devolución van en rojo", () => {
    const r1 = estadoVisible(compra({ REEMBOLSO_ESTADOS: "RECHAZADA", DEVOLUCION_TIPOS: "REEMBOLSO" }));
    expect(r1.texto).toBe("Reembolso rechazado");
    expect(r1.color).toBe(PALETA_ESTADO.error);

    const r2 = estadoVisible(compra({ REEMBOLSO_ESTADOS: "RECHAZADA", DEVOLUCION_TIPOS: "DEVOLUCION" }));
    expect(r2.texto).toBe("Devolución rechazada");
    expect(r2.color).toBe(PALETA_ESTADO.error);
  });

  it("PENDIENTE_PAGO va antes del estado del envío", () => {
    const r = estadoVisible(compra({ ESTADO: "PENDIENTE_PAGO", ESTADO_ENVIO: "PENDIENTE" }));
    expect(r.texto).toBe("Pendiente de pago");
    expect(r.color).toBe(PALETA_ESTADO.ok);
  });

  it("CANCELADA sin devolución usa el actor: CLIENTE / TIENDA / SISTEMA / default", () => {
    expect(estadoVisible(compra({ ESTADO: "CANCELADA", CANCELADA_POR: "CLIENTE" })).texto).toBe("Cancelada por ti");
    expect(estadoVisible(compra({ ESTADO: "CANCELADA", CANCELADA_POR: "TIENDA" })).texto).toBe("Cancelada por la tienda");
    expect(estadoVisible(compra({ ESTADO: "CANCELADA", CANCELADA_POR: "SISTEMA" })).texto).toBe("Pago no completado");
    expect(estadoVisible(compra({ ESTADO: "CANCELADA", CANCELADA_POR: null })).texto).toBe("Cancelada");
  });

  it("todos los casos del switch de ESTADO_ENVIO", () => {
    expect(estadoVisible(compra({ ESTADO_ENVIO: "ENTREGADO" })).texto).toBe("Entregada");
    expect(estadoVisible(compra({ ESTADO_ENVIO: "EN_CAMINO" })).texto).toBe("En camino");
    expect(estadoVisible(compra({ ESTADO_ENVIO: "EMPACADO" })).texto).toBe("Empacado");
    expect(estadoVisible(compra({ ESTADO_ENVIO: "POR_EMPAQUETAR" })).texto).toBe("Por empaquetar");
    expect(estadoVisible(compra({ ESTADO_ENVIO: "PENDIENTE" })).texto).toBe("Pendiente de envío");
    const cancelado = estadoVisible(compra({ ESTADO_ENVIO: "CANCELADO" }));
    expect(cancelado.texto).toBe("Envío cancelado");
    expect(cancelado.color).toBe(PALETA_ESTADO.error);
  });

  it("todos los casos del switch de ESTADO (venta sin fila ENVIOS)", () => {
    expect(estadoVisible(compra({ ESTADO: "COMPLETADA" })).texto).toBe("Completada");
    expect(estadoVisible(compra({ ESTADO: "PENDIENTE" })).texto).toBe("Pendiente");
    expect(estadoVisible(compra({ ESTADO: "ENVIADA" })).texto).toBe("Enviada");
    expect(estadoVisible(compra({ ESTADO: "CONFIRMADA" })).texto).toBe("Confirmada");
    expect(estadoVisible(compra({ ESTADO: "RARA" })).texto).toBe("RARA");
  });
});

describe("estadoCompra.extra — ventanaEntregada / puedeDevolver", () => {
  it("CANCELADA y PENDIENTE_PAGO nunca cuentan como entregadas", () => {
    expect(ventanaEntregada(compra({ ESTADO: "CANCELADA", ESTADO_ENVIO: "ENTREGADO" }))).toBe(false);
    expect(ventanaEntregada(compra({ ESTADO: "PENDIENTE_PAGO" }))).toBe(false);
  });

  it("con fila ENVIOS el estado manda: ENVIADA sin entregado → false", () => {
    expect(ventanaEntregada(compra({ ESTADO: "ENVIADA", ESTADO_ENVIO: "EN_CAMINO" }))).toBe(false);
  });

  it("legacy sin envío: COMPLETADA equivale a entregada", () => {
    expect(ventanaEntregada(compra({ ESTADO: "COMPLETADA" }))).toBe(true);
    expect(ventanaEntregada(compra({ ESTADO: "ENVIADA" }))).toBe(false);
  });

  it("puedeDevolver sin fecha base (entregada sin datos) → true", () => {
    expect(puedeDevolver(compra({ FECHA_ENTREGA: null }))).toBe(true);
    expect(devolucionVencida(compra({ FECHA_ENTREGA: null }))).toBe(false);
  });

  it("DIAS_DEVOLUCION y estadoEnvioTexto conservan su contenido", () => {
    expect(DIAS_DEVOLUCION).toBe(3);
    expect(estadoEnvioTexto["PENDIENTE"]).toBe("🛒 Pendiente de envío");
    expect(estadoEnvioTexto["POR_EMPAQUETAR"]).toBe("📦 Por empaquetar");
    expect(estadoEnvioTexto["EMPACADO"]).toBe("📦 Empacado");
    expect(estadoEnvioTexto["EN_CAMINO"]).toBe("🚚 En camino");
    expect(estadoEnvioTexto["ENTREGADO"]).toBe("✅ Entregado");
    expect(estadoEnvioTexto["CANCELADO"]).toBe("❌ Envío cancelado");
  });
});

describe("estadoCompra.extra — mensajeDevolucionNoDisponible (ramas restantes)", () => {
  it("venta legacy sin envío y NO completada → aviso de no entregado", () => {
    const msg = mensajeDevolucionNoDisponible(compra({ ESTADO: "PENDIENTE", ESTADO_ENVIO: null }));
    expect(msg).toContain("todavía no ha sido entregado");
  });

  it("envío ENVIADA (sin fila ENVIOS) cuenta como en camino", () => {
    const msg = mensajeDevolucionNoDisponible(compra({ ESTADO: "ENVIADA", ESTADO_ENVIO: null }));
    expect(msg).toContain("en camino");
  });
});

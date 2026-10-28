import { describe, it, expect } from "vitest";
import {
  estadoVisible,
  mensajeDevolucionNoDisponible,
  puedeDevolver,
  devolucionVencida,
  type CompraBase,
} from "./estadoCompra.ts";

const diasAtras = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

const base = (overrides: Partial<CompraBase> = {}): CompraBase => ({
  ID_VENTA: 1,
  ESTADO: "COMPLETADA",
  ESTADO_ENVIO: "ENTREGADO",
  FECHA_ENTREGA: diasAtras(1),
  FECHA_VENTA: diasAtras(5),
  ...overrides,
});

describe("mensajeDevolucionNoDisponible", () => {
  it("bloquea el reembolso/devolución de un pedido cancelado", () => {
    const msg = mensajeDevolucionNoDisponible(
      base({ ESTADO: "CANCELADA", ESTADO_ENVIO: "CANCELADO", FECHA_ENTREGA: null })
    );
    expect(msg).toContain("cancelado");
    expect(msg).toContain("reembolso");
    expect(msg).not.toContain("Solicitar reembolso");
  });

  it("no permite solicitar mientras el pedido está en camino", () => {
    const msg = mensajeDevolucionNoDisponible(
      base({ ESTADO_ENVIO: "EN_CAMINO", FECHA_ENTREGA: null })
    );
    expect(msg).toContain("en camino");
    expect(msg).toContain("3 días");
  });

  it("trata ESTADO ENVIADA sin fila de envío como pedido en camino", () => {
    const msg = mensajeDevolucionNoDisponible(
      base({ ESTADO: "ENVIADA", ESTADO_ENVIO: null, FECHA_ENTREGA: null })
    );
    expect(msg).toContain("en camino");
  });

  it("no permite solicitar antes de la entrega", () => {
    const msg = mensajeDevolucionNoDisponible(
      base({ ESTADO_ENVIO: "EMPACADO", FECHA_ENTREGA: null })
    );
    expect(msg).toContain("todavía no ha sido entregado");
  });

  it("permite solicitar dentro de los 3 días posteriores a la entrega", () => {
    expect(mensajeDevolucionNoDisponible(base({ FECHA_ENTREGA: diasAtras(2) }))).toBeNull();
  });

  it("bloquea cuando venció el plazo de 3 días desde la entrega", () => {
    const msg = mensajeDevolucionNoDisponible(base({ FECHA_ENTREGA: diasAtras(4) }));
    expect(msg).toContain("plazo de 3 días");
    expect(msg).toContain("venció");
  });

  it("usa FECHA_VENTA como referencia en ventas legacy sin envío", () => {
    const msg = mensajeDevolucionNoDisponible(
      base({ ESTADO_ENVIO: null, FECHA_ENTREGA: null, FECHA_VENTA: diasAtras(4) })
    );
    expect(msg).toContain("venció");
  });
});

describe("puedeDevolver / devolucionVencida", () => {
  it("no habilita devolución antes de la entrega", () => {
    const compra = base({ ESTADO_ENVIO: "EN_CAMINO", FECHA_ENTREGA: null });
    expect(puedeDevolver(compra)).toBe(false);
    expect(devolucionVencida(compra)).toBe(false);
  });

  it("marca vencida una venta entregada hace más de 3 días", () => {
    const compra = base({ FECHA_ENTREGA: diasAtras(4) });
    expect(puedeDevolver(compra)).toBe(false);
    expect(devolucionVencida(compra)).toBe(true);
  });
});

describe("estadoVisible", () => {
  it("conserva la atribución de cancelación junto al reembolso automático", () => {
    const compra = base({
      ESTADO: "CANCELADA",
      ESTADO_ENVIO: "CANCELADO",
      FECHA_ENTREGA: null,
      REEMBOLSO_ESTADOS: "APROBADA",
      DEVOLUCION_TIPOS: "REEMBOLSO",
      CANCELADA_POR: "CLIENTE",
    });
    expect(estadoVisible(compra).texto).toBe("Cancelada por ti · Reembolso aprobado");
  });

  it("mantiene el badge de reembolso en ventas no canceladas", () => {
    const compra = base({
      REEMBOLSO_ESTADOS: "APROBADA",
      DEVOLUCION_TIPOS: "REEMBOLSO",
    });
    expect(estadoVisible(compra).texto).toBe("Reembolso aprobado");
  });
});

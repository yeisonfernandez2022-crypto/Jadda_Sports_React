import { describe, it, expect } from "vitest";
import { numeroPedido } from "../../../frontend/src/utils/numeroPedido.ts";
import backend from "../../../backend/utils/numeroPedido.js";

describe("numeroPedido (paridad web ↔ backend)", () => {
  it("devuelve el MISMO número que el backend para la misma venta", () => {
    for (const id of [1, 7, 15, 92, 30022]) {
      expect(numeroPedido(id)).toBe(backend.numeroPedido(id));
    }
  });

  it("está en el rango público de 8 dígitos (10000000..99999999)", () => {
    for (const id of [0, 1, 999, 123456, 9999999]) {
      const n = numeroPedido(id);
      expect(n).toBeGreaterThanOrEqual(10000000);
      expect(n).toBeLessThanOrEqual(99999999);
    }
  });

  it("es estable para el mismo id (el cliente siempre ve el mismo pedido)", () => {
    expect(numeroPedido(42)).toBe(numeroPedido(42));
  });
});

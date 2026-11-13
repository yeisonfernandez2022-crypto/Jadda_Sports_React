import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setGuardiaNavegacion,
  puedeNavegar,
  navegarConGuardia,
} from "../../../frontend/src/utils/navigationGuard.ts";

describe("guardia de navegación (cambios sin guardar)", () => {
  beforeEach(() => {
    setGuardiaNavegacion(null);
  });

  it("sin guardia registrada siempre se puede navegar", async () => {
    expect(await puedeNavegar()).toBe(true);
  });

  it("la guardia que rechaza bloquea la navegación", async () => {
    setGuardiaNavegacion(async () => false);
    const navigate = vi.fn();
    await navegarConGuardia("/admin/productos", navigate);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("la guardia que aprueba deja pasar", async () => {
    setGuardiaNavegacion(async () => true);
    const navigate = vi.fn();
    await navegarConGuardia("/admin/productos", navigate);
    expect(navigate).toHaveBeenCalledWith("/admin/productos");
  });

  it("quitar la guardia (null) restaura el paso libre", async () => {
    setGuardiaNavegacion(async () => false);
    setGuardiaNavegacion(null);
    expect(await puedeNavegar()).toBe(true);
  });
});

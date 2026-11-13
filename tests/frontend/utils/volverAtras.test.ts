import { describe, it, expect, beforeEach, vi } from "vitest";
import { puedeRetroceder, volverAtras } from "../../../frontend/src/utils/volverAtras.ts";

const navigate = vi.fn();

describe("puedeRetroceder", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("true cuando history.state.idx > 0", () => {
    window.history.replaceState({ idx: 2 }, "");
    expect(puedeRetroceder()).toBe(true);
  });

  it("false cuando idx es 0 (primera entrada)", () => {
    window.history.replaceState({ idx: 0 }, "");
    expect(puedeRetroceder()).toBe(false);
  });

  it("false cuando no hay state (entrada nueva)", () => {
    window.history.replaceState(null, "");
    expect(puedeRetroceder()).toBe(false);
  });
});

describe("volverAtras", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("retrocede 1 cuando hay historial", () => {
    window.history.replaceState({ idx: 3 }, "");
    volverAtras(navigate, "/");
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("cae a la ruta por defecto cuando no hay historial", () => {
    window.history.replaceState({ idx: 0 }, "");
    volverAtras(navigate, "/catalogo");
    expect(navigate).toHaveBeenCalledWith("/catalogo");
  });

  it("permite abortar el regreso con la guardia de cambios sin guardar", () => {
    window.history.replaceState({ idx: 5 }, "");
    volverAtras(navigate, "/", () => false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("la guardia que aprueba no bloquea", () => {
    window.history.replaceState({ idx: 5 }, "");
    volverAtras(navigate, "/", () => true);
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});

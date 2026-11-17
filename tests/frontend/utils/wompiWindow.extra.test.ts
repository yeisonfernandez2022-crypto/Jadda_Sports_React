import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  prepararVentanaWompi,
  navegarVentanaWompi,
  cerrarVentanaWompi,
} from "../../../frontend/src/utils/wompiWindow.ts";

/**
 * wompiWindow.extra: la pestaña cuyo location.href lanza excepción al navegar
 * (simulación de origen cruzado) — el utilitario debe cerrarla y devolver
 * false para que la pantalla de espera ofrezca el enlace en línea.
 */

beforeEach(() => {
  cerrarVentanaWompi();
  vi.restoreAllMocks();
});

describe("wompiWindow.extra", () => {
  it("navegarVentanaWompi devuelve false y cierra la pestaña si location lanza", () => {
    const doble = {
      closed: false,
      get location() {
        throw new Error("cross-origin");
      },
      close: vi.fn(),
    };
    vi.stubGlobal("open", vi.fn(() => doble as unknown as Window));
    prepararVentanaWompi();

    expect(navegarVentanaWompi("https://checkout.wompi.co/p/?x=1")).toBe(false);
    expect(doble.close).toHaveBeenCalled();
    // La referencia quedó olvidada: navegar de nuevo tampoco funciona.
    expect(navegarVentanaWompi("https://checkout.wompi.co/p/?x=1")).toBe(false);
  });
});

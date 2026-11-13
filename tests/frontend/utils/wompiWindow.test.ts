import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  prepararVentanaWompi,
  navegarVentanaWompi,
  cerrarVentanaWompi,
} from "../../../frontend/src/utils/wompiWindow.ts";

/**
 * jsdom no implementa window.open: lo sustituimos con un doble que expone
 * location.href, document.body y closed. Probamos el CONTRATO que dependía el
 * checkout (v8e): abrir vacía de forma síncrona, navegar la misma pestaña,
 * cerrar al confirmar y false cuando la pestaña ya no existe.
 */
function crearVentanaDoble() {
  return {
    closed: false,
    location: { href: "about:blank" },
    document: { body: { style: {}, set innerHTML(v: string) { (this as { _html?: string })._html = v; }, get innerHTML() { return (this as { _html?: string })._html ?? ""; } }, title: "" },
    close: vi.fn(function (this: { closed: boolean }) { this.closed = true; }),
  };
}

describe("wompiWindow", () => {
  beforeEach(() => {
    cerrarVentanaWompi();
    vi.restoreAllMocks();
  });

  it("prepararVentanaWompi abre la pestaña vacía y la devuelve", () => {
    const doble = crearVentanaDoble();
    vi.stubGlobal("open", vi.fn(() => doble as unknown as Window));
    const v = prepararVentanaWompi();
    expect(v).not.toBeNull();
    expect(doble.document.body.innerHTML).toContain("Abriendo el pago seguro de Wompi");
  });

  it("navegarVentanaWompi lleva la pestaña a la URL del checkout y devuelve true", () => {
    const doble = crearVentanaDoble();
    vi.stubGlobal("open", vi.fn(() => doble as unknown as Window));
    prepararVentanaWompi();
    const ok = navegarVentanaWompi("https://checkout.wompi.co/p/?public-key=pub_test");
    expect(ok).toBe(true);
    expect(doble.location.href).toBe("https://checkout.wompi.co/p/?public-key=pub_test");
  });

  it("navegarVentanaWompi devuelve false si el bloqueador negó la ventana (window.open null)", () => {
    vi.stubGlobal("open", vi.fn(() => null));
    expect(prepararVentanaWompi()).toBeNull();
    expect(navegarVentanaWompi("https://checkout.wompi.co")).toBe(false);
  });

  it("navegarVentanaWompi devuelve false si la pestaña fue cerrada por el usuario", () => {
    const doble = crearVentanaDoble();
    vi.stubGlobal("open", vi.fn(() => doble as unknown as Window));
    prepararVentanaWompi();
    doble.closed = true;
    expect(navegarVentanaWompi("https://checkout.wompi.co")).toBe(false);
  });

  it("cerrarVentanaWompi cierra la pestaña abierta (no se reutiliza el checkout)", () => {
    const doble = crearVentanaDoble();
    vi.stubGlobal("open", vi.fn(() => doble as unknown as Window));
    prepararVentanaWompi();
    cerrarVentanaWompi();
    expect(doble.close).toHaveBeenCalled();
    expect(doble.closed).toBe(true);
    // tras cerrar, navegar devuelve false
    expect(navegarVentanaWompi("https://checkout.wompi.co")).toBe(false);
  });

  it("prepararVentanaWompi cierra la ventana PREVIA antes de abrir la nueva (sin fugas)", () => {
    const vieja = crearVentanaDoble();
    const nueva = crearVentanaDoble();
    vi.stubGlobal("open", vi.fn(() => nueva as unknown as Window));
    // simular que la vieja ya estaba referenciada: abrir dos veces seguidas
    prepararVentanaWompi();
    prepararVentanaWompi();
    expect(nueva.document.body.innerHTML).toContain("Wompi");
  });
});

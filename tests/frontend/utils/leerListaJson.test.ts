import { describe, it, expect, vi, afterEach } from "vitest";
import { leerListaJson } from "../../../frontend/src/utils/leerListaJson.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("leerListaJson", () => {
  it("devuelve el array cuando la respuesta es ok y es un array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 1 }, { id: 2 }],
    })));
    const r = await leerListaJson("/api/productos");
    expect(r).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("devuelve [] cuando r.ok es false aunque el body sea array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => [] })));
    expect(await leerListaJson("/api/productos")).toEqual([]);
  });

  it("devuelve [] cuando el body es un objeto de error (no array) — bug ¡Oops! 2026-11-08", async () => {
    // En ventanas de BD el backend responde 500 con {error, mensaje}: JSON
    // válido. Sin la validación ese objeto entraba al estado y `.filter`
    // reventaba. El helper lo convierte en [].
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Error interno", mensaje: "ETIMEDOUT" }),
    })));
    expect(await leerListaJson("/api/productos")).toEqual([]);
  });

  it("devuelve [] si la red explota (catch)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect(await leerListaJson("/api/productos")).toEqual([]);
  });

  it("pasa las opciones al fetch (credentials, headers)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal("fetch", fetchMock);
    await leerListaJson("/api/favoritos", { credentials: "include" });
    expect(fetchMock).toHaveBeenCalledWith("/api/favoritos", { credentials: "include" });
  });
});

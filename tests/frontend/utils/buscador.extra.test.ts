import { describe, it, expect } from "vitest";
import { filtrarProductos } from "../../../frontend/src/utils/buscador.ts";

/**
 * buscador.extra: las ramas de filtrado que quedaron fuera de la suite base
 * — consulta sin palabras, producto sin NOMBRE/CATEGORIA y el rechazo del
 * sufijo cuando la palabra no compone con el término.
 */

type Prod = { NOMBRE?: string; MARCA?: string | null; CATEGORIA?: string; NOMBRE_CATEGORIA?: string };

describe("buscador.extra — filtrarProductos", () => {
  it("consulta solo con signos no filtra nada (terminosDe vacío)", () => {
    const lista: Prod[] = [{ NOMBRE: "Balón Extra-Test" }, { NOMBRE: "Guante Extra-Test" }];
    expect(filtrarProductos(lista, "!!! ¿ ?")).toEqual(lista);
  });

  it("producto sin NOMBRE ni CATEGORIA usa cadenas vacías sin reventar", () => {
    const lista: Prod[] = [{ MARCA: null }, { NOMBRE: "Balón Extra-Test" }];
    const r = filtrarProductos(lista, "balon");
    expect(r).toHaveLength(1);
    expect(r[0].NOMBRE).toBe("Balón Extra-Test");
  });

  it("sin NOMBRE_CATEGORIA usa CATEGORIA; con ambos, CATEGORIA manda", () => {
    const lista: Prod[] = [
      { NOMBRE: "Camiseta Extra-Test", CATEGORIA: "Running" },
      { NOMBRE: "Otra cosa", NOMBRE_CATEGORIA: "Ropa deportiva" },
    ];
    // "running" matchea por CATEGORIA del primero.
    expect(filtrarProductos(lista, "running")).toHaveLength(1);
    // "ropa" matchea por NOMBRE_CATEGORIA del segundo.
    expect(filtrarProductos(lista, "ropa deportiva")).toHaveLength(1);
  });

  it("palabra que no compone con el término NO matchea (rechazo del sufijo)", () => {
    const lista: Prod[] = [{ NOMBRE: "Baloncesto Extra-Test" }, { NOMBRE: "Balón Extra-Test" }];
    const r = filtrarProductos(lista, "balon");
    // 'baloncesto' NO matchea 'balon': prefijo pero nunca sufijo.
    expect(r.map((p) => p.NOMBRE)).toEqual(["Balón Extra-Test"]);
  });

  it("término corto (<4) solo matchea por igualdad exacta, nunca por prefijo", () => {
    const lista: Prod[] = [{ NOMBRE: "Sol Extra-Test" }, { NOMBRE: "Soldado Extra-Test" }];
    const r = filtrarProductos(lista, "sol");
    // 'soldado' tiene 'sol' como prefijo, pero los términos cortos solo
    // matchean por igualdad de palabra.
    expect(r.map((p) => p.NOMBRE)).toEqual(["Sol Extra-Test"]);
  });
});

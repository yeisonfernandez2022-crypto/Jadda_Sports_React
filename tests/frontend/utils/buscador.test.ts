import { describe, it, expect } from "vitest";
import {
  normalizar,
  tokenizar,
  padron,
  terminosDe,
  filtrarProductos,
} from "../../../frontend/src/utils/buscador.ts";

interface Prod {
  NOMBRE?: string;
  MARCA?: string | null;
  CATEGORIA?: string;
  NOMBRE_CATEGORIA?: string;
  DESCRIPCION_CATEGORIA?: string;
}

const prod = (overrides: Prod): Prod => ({ ...overrides });

describe("normalizar", () => {
  it("minúsculas, sin tildes y recortado", () => {
    expect(normalizar("  Balón de FÚTBOL  ")).toBe("balon de futbol");
  });

  it("ñ pasa a n (comparación leal en ambos lados)", () => {
    expect(normalizar("Baño")).toBe("bano");
  });

  it("texto vacío o null devuelve cadena vacía", () => {
    expect(normalizar("")).toBe("");
    expect(normalizar(null as unknown as string)).toBe("");
  });
});

describe("tokenizar", () => {
  it("parte por signos y quita vacíos", () => {
    expect(tokenizar("Guayos, Predator: precisión!")).toEqual(["guayos", "predator", "precision"]);
  });
});

describe("padron", () => {
  it("quita -es final en palabras de 5+", () => {
    expect(padron("balones")).toBe("balon");
    expect(padron("guayos")).toBe("guayo");
  });

  it("no mutila palabras cortas", () => {
    expect(padron("mes")).toBe("mes");
    expect(padron("gym")).toBe("gym");
  });
});

describe("terminosDe", () => {
  it("devuelve vacío sin palabras", () => {
    expect(terminosDe("")).toEqual([]);
    expect(terminosDe("!!!")).toEqual([]);
  });

  it("incluye el padrón de cada palabra de la consulta", () => {
    const t = terminosDe("Balones");
    expect(t).toContain("balon");
  });

  it("expande sinónimos SOLO cuando la consulta es la clave exacta (por padrón)", () => {
    // "balon" es clave del diccionario → arrastra pelota
    expect(terminosDe("balon")).toContain("pelota");
    // "baloncesto" NO es la clave (solo comparte prefijo) → no arrastra nada de basket
    const t = terminosDe("baloncesto");
    expect(t).toContain("baloncesto");
    expect(t).not.toContain("pelota");
  });
});

describe("filtrarProductos", () => {
  const lista: Prod[] = [
    prod({ NOMBRE: "Balón de fútbol Al Rihla Pro", MARCA: "Adidas", CATEGORIA: "Fútbol" }),
    prod({ NOMBRE: "Aro de Baloncesto Portátil", MARCA: "Spalding", CATEGORIA: "Baloncesto" }),
    prod({ NOMBRE: "Tenis Lebron Witness", MARCA: "Nike", CATEGORIA: "Baloncesto" }),
    prod({ NOMBRE: "Malla porta balones", MARCA: null, CATEGORIA: "Accesorios" }),
    prod({ NOMBRE: "Guayos Predator Precisión", MARCA: "Adidas", CATEGORIA: "Fútbol" }),
  ];

  it("consulta vacía devuelve la lista completa", () => {
    expect(filtrarProductos(lista, "")).toHaveLength(5);
    expect(filtrarProductos(lista, null)).toHaveLength(5);
  });

  it("'balones' encuentra los balones por padrón, sin intrusos", () => {
    const r = filtrarProductos(lista, "balones");
    const nombres = r.map((p) => p.NOMBRE);
    expect(nombres).toContain("Balón de fútbol Al Rihla Pro");
    expect(nombres).toContain("Malla porta balones");
    expect(nombres).not.toContain("Aro de Baloncesto Portátil");
    expect(nombres).not.toContain("Tenis Lebron Witness");
  });

  it("'guayos' encuentra guayos aunque el producto diga 'Guayos' (ambos lados al padrón)", () => {
    const r = filtrarProductos(lista, "guayos");
    expect(r.map((p) => p.NOMBRE)).toContain("Guayos Predator Precisión");
  });

  it("matchea por sufijo compuesto: 'banda' ⊆ 'minibanda'", () => {
    const conMini = [...lista, prod({ NOMBRE: "Banda elástica minibanda", CATEGORIA: "Gimnasio" })];
    const r = filtrarProductos(conMini, "banda");
    expect(r.map((p) => p.NOMBRE)).toContain("Banda elástica minibanda");
  });

  it("prefijo incompleto del usuario con exactamente 1 letra de diferencia: 'guay' encuentra Guayos", () => {
    const r = filtrarProductos(lista, "guay");
    expect(r.map((p) => p.NOMBRE)).toContain("Guayos Predator Precisión");
  });

  it("ignora MARCA null sin reventar", () => {
    expect(() => filtrarProductos(lista, "spalding")).not.toThrow();
  });
});

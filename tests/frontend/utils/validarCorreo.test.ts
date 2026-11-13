import { describe, it, expect } from "vitest";
import { correoValido } from "../../../frontend/src/utils/validarCorreo.ts";

describe("correoValido", () => {
  it.each([
    ["a@b.co", true],
    ["usuario.nombre+tag@dominio.com", true],
    ["  a@b.co", false], // espacio
    ["a b@b.co", false], // espacio interno
    ["@b.co", false], // sin nada antes del @
    ["a@b", false], // sin punto después del @
    ["a@.co", false], // punto pegado al @ (nada entre @ y punto)
    ["a@b.co.", false], // punto final sin carácter después
    ["a@b..co", true], // el diseño no valida puntos consecutivos internos
    ["", false],
    ["sin-arroba.co", false],
    ["a@b@c.co", false], // dos arrobas
  ])("%s → %s", (entrada, esperado) => {
    expect(correoValido(entrada)).toBe(esperado);
  });

  it("null/undefined no revientan", () => {
    expect(correoValido(null as unknown as string)).toBe(false);
  });
});

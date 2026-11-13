import { describe, it, expect } from "vitest";
import { escapeHtml } from "../../../frontend/src/utils/escapeHtml.ts";

describe("escapeHtml", () => {
  it("escapa los 5 caracteres peligrosos", () => {
    expect(escapeHtml('<img src=x onerror="alert(\'a\')">&')).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;a&#39;)&quot;&gt;&amp;",
    );
  });

  it("convierte null/undefined en cadena vacía (no en 'null')", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("no muta texto limpio", () => {
    expect(escapeHtml("Balón Al Rihla Pro")).toBe("Balón Al Rihla Pro");
  });

  it("números se interpolan como texto", () => {
    expect(escapeHtml(123)).toBe("123");
  });
});

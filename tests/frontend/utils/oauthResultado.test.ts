import { describe, it, expect } from "vitest";
import { esMensajeOauth, CLAVE_RESULTADO_OAUTH } from "../../../frontend/src/utils/oauthResultado.ts";

describe("esMensajeOauth (type guard del canal popup→madre)", () => {
  it("acepta un mensaje de éxito con foto", () => {
    const m = esMensajeOauth({ type: "oauth-success", user: "Yeison", photo: "https://x/f.png" });
    expect(m).toEqual({ type: "oauth-success", user: "Yeison", photo: "https://x/f.png" });
  });

  it("éxito sin foto normaliza photo a null", () => {
    const m = esMensajeOauth({ type: "oauth-success", user: "Yeison" });
    expect(m).toEqual({ type: "oauth-success", user: "Yeison", photo: null });
  });

  it("éxito con photo no-string (otro tipo raro) normaliza a null", () => {
    const m = esMensajeOauth({ type: "oauth-success", user: "Yeison", photo: 42 });
    if (m?.type === "oauth-success") expect(m.photo).toBeNull();
  });

  it("acepta un mensaje de error con motivo", () => {
    const m = esMensajeOauth({ type: "oauth-error", motivo: "state no coincide" });
    expect(m).toEqual({ type: "oauth-error", motivo: "state no coincide" });
  });

  it("rechaza payloads basura: null, no-objeto, type desconocido, sin user", () => {
    expect(esMensajeOauth(null)).toBeNull();
    expect(esMensajeOauth("hola")).toBeNull();
    expect(esMensajeOauth({ type: "otro" })).toBeNull();
    expect(esMensajeOauth({ type: "oauth-success" })).toBeNull();
    expect(esMensajeOauth({ type: "oauth-error" })).toBeNull();
  });
});

describe("CLAVE_RESULTADO_OAUTH", () => {
  it("la clave del canal localStorage es estable (contrato entre popup y madre)", () => {
    expect(CLAVE_RESULTADO_OAUTH).toBe("jadda_oauth_result");
  });
});

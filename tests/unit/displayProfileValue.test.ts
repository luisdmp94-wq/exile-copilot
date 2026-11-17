import { afterEach, describe, expect, it } from "vitest";
import { displayProfileValue } from "../../src/lib/format.js";

function setPageLang(lang: "es" | "en"): void {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
}

describe("valores por defecto del personaje al enseñarlos", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("en inglés traduce «Nuevo personaje» y «Desconocida»", () => {
    setPageLang("en");
    expect(displayProfileValue("Nuevo personaje")).toBe("New character");
    expect(displayProfileValue("Desconocida")).toBe("Unknown");
    expect(displayProfileValue("Personaje importado desde PoB")).toBe("Character imported from PoB");
  });

  it("lo que escribió el jugador se queda tal cual", () => {
    setPageLang("en");
    expect(displayProfileValue("Likewow")).toBe("Likewow");
    expect(displayProfileValue("Witch")).toBe("Witch");
  });

  it("en español no cambia nada", () => {
    setPageLang("es");
    expect(displayProfileValue("Nuevo personaje")).toBe("Nuevo personaje");
    expect(displayProfileValue("Desconocida")).toBe("Desconocida");
  });
});

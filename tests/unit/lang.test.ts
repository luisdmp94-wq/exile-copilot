import { describe, expect, it } from "vitest";
import { detectLang, texts } from "../../src/i18n/lang.js";

describe("idioma al entrar", () => {
  it("?lang= manda sobre todo lo demás", () => {
    expect(detectLang("?lang=en", "es", ["es-ES"])).toBe("en");
    expect(detectLang("?ref=reddit&lang=ES", "en", ["en-US"])).toBe("es");
  });

  it("si no, lo que eligió la persona la otra vez", () => {
    expect(detectLang("", "en", ["es-ES"])).toBe("en");
  });

  it("si no, el idioma del navegador: español si alguno es español, inglés si no", () => {
    expect(detectLang("", null, ["es-MX", "en"])).toBe("es");
    expect(detectLang("", null, ["en-GB", "es"])).toBe("es");
    expect(detectLang("", null, ["en-US"])).toBe("en");
    expect(detectLang("", null, ["pt-BR", "de"])).toBe("en");
  });

  it("un valor raro no rompe nada", () => {
    expect(detectLang("?lang=fr", "xx", ["es"])).toBe("es");
  });
});

describe("textos por idioma", () => {
  it("devuelve los dos idiomas con las mismas claves", () => {
    const dictionary = texts({ hola: "Hola", nivel: (n: number) => `nivel ${n}` }, { hola: "Hi", nivel: (n: number) => `level ${n}` });
    expect(dictionary.en.hola).toBe("Hi");
    expect(dictionary.es.nivel(3)).toBe("nivel 3");
  });
});

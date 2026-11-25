import { describe, expect, it } from "vitest";
import { ASCENDANCY_SPANISH, ascendancyInSpanish, classInSpanish } from "../../shared/classNames.js";
import { ASCENDANCY_FROM_SPANISH } from "../../shared/pobBuild.js";

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

describe("clases y ascendencias en español", () => {
  it("un personaje importado de PoB2 se enseña con los nombres del juego en español", () => {
    expect(classInSpanish("Witch")).toBe("Bruja");
    expect(classInSpanish("warrior")).toBe("Guerrero");
    expect(ascendancyInSpanish("Lich")).toBe("Liche");
    expect(ascendancyInSpanish("Gemling Legionnaire")).toBe("Legionario gemita");
  });

  it("lo que ya está en español o no se conoce se deja como está", () => {
    expect(classInSpanish("Bruja")).toBe("Bruja");
    expect(classInSpanish("Templar")).toBe("Templar");
    expect(ascendancyInSpanish("Liche")).toBe("Liche");
    expect(ascendancyInSpanish("")).toBe("");
  });

  it("dice lo mismo que la tabla con la que la web lee las ascendencias en español", () => {
    for (const [english, spanish] of Object.entries(ASCENDANCY_SPANISH)) {
      expect(ASCENDANCY_FROM_SPANISH[plain(spanish)], spanish).toBe(english);
    }
    const known = new Set(Object.keys(ASCENDANCY_SPANISH));
    for (const english of new Set(Object.values(ASCENDANCY_FROM_SPANISH))) expect(known.has(english), english).toBe(true);
  });
});

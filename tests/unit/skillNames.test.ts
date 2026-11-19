import { describe, expect, it } from "vitest";
import { canonicalSkillName, isKnownSkillName, sameSkillName } from "../../src/lib/skillNames";

const EN = ["Killing Palm", "Tempest Flurry", "Essence Drain"];
const ES = ["Palma mortal", "Arrebato de tempestad", "Drenar esencia"];

describe("habilidades escritas a mano en el alta", () => {
  it("se guardan como las escribe el juego, aunque se tecleen en minúsculas o sin tildes", () => {
    expect(canonicalSkillName("killing palm", EN, ES)).toBe("Killing Palm");
    expect(canonicalSkillName("  TEMPEST   flurry ", EN, ES)).toBe("Tempest Flurry");
    expect(canonicalSkillName("drenar esencia", EN, ES)).toBe("Drenar esencia");
    expect(canonicalSkillName("arrebato de tempestad", ES, EN)).toBe("Arrebato de tempestad");
  });

  it("un nombre en el otro idioma se reconoce y se deja en ese idioma", () => {
    // Web en inglés, cliente del juego en español.
    expect(canonicalSkillName("palma mortal", EN, ES)).toBe("Palma mortal");
    expect(isKnownSkillName("palma mortal", EN, ES)).toBe(true);
  });

  it("lo que la web no conoce se deja tal cual, sin inventar", () => {
    expect(canonicalSkillName("  golpe  inventado ", EN, ES)).toBe("golpe inventado");
    expect(isKnownSkillName("golpe inventado", EN, ES)).toBe(false);
    expect(canonicalSkillName("   ", EN, ES)).toBe("");
  });

  it("sin listas cargadas no se avisa de nada", () => {
    expect(isKnownSkillName("lo que sea", [], [])).toBe(true);
    expect(canonicalSkillName("killing palm", [], [])).toBe("killing palm");
  });

  it("dos formas de escribir la misma habilidad cuentan como una", () => {
    expect(sameSkillName("Drenar esencia", "DRENAR  ESENCIA")).toBe(true);
    expect(sameSkillName("Maldición", "maldicion")).toBe(true);
    expect(sameSkillName("Contagio", "Drenar esencia")).toBe(false);
  });
});

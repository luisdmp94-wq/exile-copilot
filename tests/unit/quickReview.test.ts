import { describe, expect, it } from "vitest";
import {
  maxGemLevelFor,
  reviewCharacter,
  type QuickReviewInput,
} from "../../shared/quickReview.js";

function input(overrides: Partial<QuickReviewInput> = {}): QuickReviewInput {
  return {
    level: null,
    act: null,
    mainSkill: null,
    mainSkillGemLevel: null,
    weaponItemLevel: null,
    resistances: { fire: null, cold: null, lightning: null },
    ascendancyPoints: null,
    ascendancy: null,
    usesCurse: null,
    otherSkills: [],
    ...overrides,
  };
}

describe("nivel de gema según el nivel del personaje (tabla de poe2db)", () => {
  it.each([
    [1, 1],
    [30, 8],
    [31, 9],
    [34, 9],
    [36, 10],
    [70, 16],
    [90, 20],
  ])("a nivel %i se puede llevar la gema a %i", (level, gem) => {
    expect(maxGemLevelFor(level)).toBe(gem);
  });
});

describe("revisión rápida: la Liche de Luis antes de arreglarla (17-11-2026)", () => {
  const LICH_BEFORE = input({
    level: 32,
    act: 3,
    mainSkill: "Contagio",
    mainSkillGemLevel: 7,
    weaponItemLevel: 18,
    resistances: { fire: 28, cold: 23, lightning: 44 },
    ascendancyPoints: 2,
    ascendancy: "Liche",
    usesCurse: false,
    otherSkills: ["Descarga de caos", "Guerrero esqueleto"],
  });

  it("encuentra los problemas que vimos jugando y saca los 3 que más frenan", () => {
    const result = reviewCharacter(LICH_BEFORE);
    expect(result.top.map((finding) => finding.id)).toEqual(["weapon", "contagion", "gem"]);
    expect(result.total).toBeGreaterThanOrEqual(5);
    // Lo que no cabe en los 3 primeros también se puede ver.
    expect(result.rest).toHaveLength(result.total - 3);
    expect(result.top[0]?.title).toBe("Tu arma va 14 niveles por detrás de ti");
    expect(result.top[2]?.title).toBe("Tu gema principal está a nivel 7 y puedes llevarla a 9");
  });

  it("también ve la maldición que falta y las resistencias, aunque queden fuera del top 3", () => {
    const ids = reviewCharacter({ ...LICH_BEFORE, weaponItemLevel: null, mainSkillGemLevel: 9 }).top.map(
      (finding) => finding.id,
    );
    expect(ids).toContain("contagion");
    expect(ids).toContain("curse");
    expect(ids).toContain("res");
  });

  it("después de arreglarlo ya no hay nada grave", () => {
    const result = reviewCharacter({
      ...LICH_BEFORE,
      level: 35,
      mainSkillGemLevel: 9,
      weaponItemLevel: 32,
      resistances: { fire: 42, cold: 43, lightning: 32 },
      usesCurse: true,
      otherSkills: ["Drenar esencia", "Descarga de caos"],
    });
    expect(result.top.filter((finding) => finding.severity >= 50)).toHaveLength(0);
  });
});

describe("revisión rápida: reglas sueltas", () => {
  it("un único no se juzga por su nivel de objeto: sin dato, no hay aviso de arma", () => {
    const result = reviewCharacter(input({ level: 34, weaponItemLevel: null }));
    expect(result.top.find((finding) => finding.id === "weapon")).toBeUndefined();
    expect(result.missing).toContain("el nivel de objeto de tu arma");
  });

  it("10 niveles de diferencia ya es aviso; 9 no", () => {
    expect(reviewCharacter(input({ level: 30, weaponItemLevel: 20 })).top[0]?.id).toBe("weapon");
    expect(reviewCharacter(input({ level: 30, weaponItemLevel: 21 })).top).toHaveLength(0);
  });

  it("en mapas pide el 75 % de resistencias", () => {
    const result = reviewCharacter(input({ act: "maps", resistances: { fire: 60, cold: 75, lightning: 75 } }));
    expect(result.top[0]?.title).toBe("Resistencias bajas: fuego 60 % (conviene llegar al 75 %)");
  });

  it("sin puntos de ascendencia en el acto 3 es de lo más urgente", () => {
    expect(reviewCharacter(input({ act: 3, ascendancyPoints: 0 })).top[0]?.id).toBe("asc-first");
  });

  it("Contagio con Drenar esencia no da aviso", () => {
    const result = reviewCharacter(input({ mainSkill: "Contagio", otherSkills: ["Drenar esencia"] }));
    expect(result.top.find((finding) => finding.id === "contagion")).toBeUndefined();
  });

  it("la Liche que sí lleva maldición no recibe el aviso", () => {
    const result = reviewCharacter(input({ ascendancy: "Liche", usesCurse: true }));
    expect(result.top).toHaveLength(0);
  });

  it("en inglés", () => {
    const result = reviewCharacter(
      input({ level: 32, weaponItemLevel: 18, act: 3, resistances: { fire: 28, cold: 23, lightning: 44 } }),
      "en",
    );
    expect(result.top.map((finding) => finding.title)).toEqual([
      "Your weapon is 14 levels behind you",
      "Low resistances: cold 23% and fire 28% (aim for 30%)",
    ]);
  });
});

// Un visitante nuevo que solo dio nivel y habilidad recibía «no veo nada
// grave» y una lista de cinco cosas que faltaban (19-11-2026).
describe("revisión rápida — qué pedir cuando faltan datos", () => {
  const empty: import("../../shared/quickReview.js").QuickReviewInput = {
    level: null,
    act: null,
    mainSkill: null,
    mainSkillGemLevel: null,
    weaponItemLevel: null,
    resistances: { fire: null, cold: null, lightning: null },
    ascendancyPoints: null,
    ascendancy: null,
    usesCurse: null,
    otherSkills: [],
  };

  it("lo que falta sale ordenado por lo que más cambia el consejo", async () => {
    const { reviewCharacter } = await import("../../shared/quickReview.js");
    const result = reviewCharacter({ ...empty });
    expect(result.missingKeys).toEqual(["level", "res", "act", "gem", "weapon", "asc"]);
    expect(result.missing[0]).toBe("tu nivel");
    expect(result.missing).toHaveLength(result.missingKeys.length);
  });

  it("con solo nivel y habilidad pide resistencias y acto, no cinco cosas", async () => {
    const { reviewCharacter, firstGapsToAsk } = await import("../../shared/quickReview.js");
    const result = reviewCharacter({ ...empty, level: 22, mainSkill: "Arrebato de tempestad" });
    expect(result.top).toEqual([]);
    expect(firstGapsToAsk(result)).toEqual(["res", "act"]);
  });

  it("con lo clave rellenado ya no pide nada, aunque falten el arma y la ascendencia", async () => {
    const { reviewCharacter, firstGapsToAsk } = await import("../../shared/quickReview.js");
    const result = reviewCharacter({
      ...empty,
      level: 22,
      act: 2,
      mainSkill: "Arrebato de tempestad",
      mainSkillGemLevel: 7,
      resistances: { fire: 40, cold: 35, lightning: 30 },
    });
    expect(result.top).toEqual([]);
    expect(firstGapsToAsk(result)).toEqual([]);
    expect(result.missingKeys).toEqual(["weapon", "asc"]);
  });

  it("en inglés el orden es el mismo", async () => {
    const { reviewCharacter } = await import("../../shared/quickReview.js");
    const result = reviewCharacter({ ...empty, level: 22 }, "en");
    expect(result.missing.slice(0, 2)).toEqual(["your resistances", "your act"]);
  });
});

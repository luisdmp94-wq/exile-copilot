import { describe, expect, it } from "vitest";
import {
  assessCharacterReadiness,
  assessMentorReadiness,
  MIN_BROAD_ANALYSIS_EQUIPMENT,
} from "../../shared/characterReadiness.js";
import {
  CharacterProfileSchema,
  PLACEHOLDER_CHARACTER_LEVEL,
} from "../../shared/domain.js";

function profile(overrides: Record<string, unknown> = {}) {
  return CharacterProfileSchema.parse({
    id: "readiness-test",
    name: "Titan Warrior",
    characterClass: "Desconocida",
    level: PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: "placeholder",
    league: "Runes of Aldur",
    patch: "0.5.4f",
    importedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  });
}

describe("preparación del expediente para recomendaciones", () => {
  it("detecta los tres huecos de un .build usado como borrador", () => {
    const result = assessCharacterReadiness(profile());

    expect(result.ready).toBe(false);
    expect(result.analysisScope).toBe("blocked");
    expect(result.issues.map((issue) => issue.id)).toEqual([
      "class",
      "level",
      "equipment",
    ]);
  });

  it("no cuenta moneda ni elementos sueltos como equipo del personaje", () => {
    const result = assessCharacterReadiness(
      profile({
        characterClass: "Warrior",
        level: 90,
        levelSource: "observed",
        items: [
          {
            id: "currency",
            name: "Orbe",
            baseType: "Orbe",
            slot: "other",
            rarity: "currency",
          },
        ],
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toEqual(["equipment"]);
  });

  it("habilita solo un análisis parcial con identidad observada y una pieza equipada", () => {
    const result = assessCharacterReadiness(
      profile({
        characterClass: "Warrior",
        level: 90,
        levelSource: "observed",
        items: [
          {
            id: "weapon",
            name: "Hacha actual",
            baseType: "Hacha",
            slot: "weapon",
            rarity: "rare",
          },
        ],
      }),
    );

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.equippedItemCount).toBe(1);
    expect(result.analysisScope).toBe("partial");
  });

  it("bloquea una instantánea PoB2 cuyo árbol pertenece a otra familia de parche", () => {
    const result = assessCharacterReadiness(
      profile({
        characterClass: "Ranger",
        level: 90,
        levelSource: "observed",
        pobImport: { targetVersion: "0_1", passiveTreeVersion: "0_4" },
        items: [
          {
            id: "bow",
            name: "Arco actual",
            baseType: "Arco",
            slot: "weapon",
            rarity: "rare",
          },
        ],
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.analysisScope).toBe("blocked");
    expect(result.issues).toEqual([
      expect.objectContaining({ id: "version", label: "Versión de árbol" }),
    ]);
  });

  it("declara análisis amplio cuando observa al menos seis piezas equipadas", () => {
    const items = Array.from(
      { length: MIN_BROAD_ANALYSIS_EQUIPMENT },
      (_, index) => ({
        id: `item-${index}`,
        name: `Pieza ${index}`,
        baseType: "Armadura",
        slot: ["weapon", "helmet", "body", "gloves", "boots", "belt"][index],
        rarity: "rare",
      }),
    );
    const result = assessCharacterReadiness(
      profile({
        characterClass: "Warrior",
        level: 90,
        levelSource: "observed",
        items,
      }),
    );

    expect(result.ready).toBe(true);
    expect(result.analysisScope).toBe("broad");
  });

  it("permite al Mentor usar estadísticas observadas sin fingir que hay equipo importado", () => {
    const sparseProfile = profile({
      characterClass: "Warrior",
      level: 90,
      levelSource: "observed",
      life: 3_200,
      resistances: { fire: 75, cold: 75, lightning: 75, chaos: 20 },
    });

    expect(assessCharacterReadiness(sparseProfile).ready).toBe(false);
    expect(assessMentorReadiness(sparseProfile)).toMatchObject({
      ready: true,
      issues: [],
      equippedItemCount: 0,
      analysisScope: "partial",
    });
  });
});

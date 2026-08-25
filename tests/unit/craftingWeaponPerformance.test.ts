import { describe, expect, it } from "vitest";
import {
  calculateVisibleWeaponPerformance,
  evaluateCraftingWeaponPerformance,
} from "../../shared/craftingWeaponPerformance.js";
import { CharacterProfileSchema, ItemSchema, type Item } from "../../shared/domain.js";

function weapon(id: string, name: string, physical: [number, number], speed: number): Item {
  return ItemSchema.parse({
    id,
    name,
    baseType: "Maza de procesión",
    slot: "weapon",
    rarity: "rare",
    modifiers: [],
    weaponStats: {
      physical: { min: physical[0], max: physical[1] },
      attacksPerSecond: speed,
      criticalChance: 5,
    },
    sources: [],
  });
}

describe("rendimiento visible de armas", () => {
  it("calcula la ballesta real sin aplicar crítico ni recarga", () => {
    const item = ItemSchema.parse({
      ...weapon("ballesta", "Núcleo de fénix", [22, 65], 1.81),
      weaponStats: {
        physical: { min: 22, max: 65 },
        fire: { min: 4, max: 5 },
        lightning: { min: 1, max: 9 },
        attacksPerSecond: 1.81,
        criticalChance: 5,
        reloadTime: 0.71,
      },
    });

    expect(calculateVisibleWeaponPerformance(item)).toMatchObject({
      physicalDps: 78.7,
      elementalDps: 17.2,
      totalDps: 95.9,
      criticalChance: 5,
      reloadTime: 0.71,
    });
  });

  it("compara el objetivo físico contra el arma equipada, no solo contra etiquetas", () => {
    const equipped = weapon("equipada", "Maza equipada", [80, 120], 1.5);
    const looseBefore = weapon("candidata", "Maza candidata", [30, 60], 1.4);
    const result = weapon("candidata", "Maza candidata mejorada", [48, 93], 1.4);
    const profile = CharacterProfileSchema.parse({
      id: "perfil",
      name: "Mercenario",
      characterClass: "Mercenary",
      ascendancy: null,
      ascendancyId: null,
      level: 80,
      levelSource: "observed",
      archetype: null,
      league: "Prueba",
      patch: "Prueba",
      items: [equipped],
      skills: [],
      passives: { allocated: [] },
      attributes: { str: null, dex: null, int: null },
      resistances: { fire: null, cold: null, lightning: null, chaos: null },
      sources: [],
      importedAt: "2026-08-25T00:00:00.000Z",
    });

    const comparison = evaluateCraftingWeaponPerformance({
      originalItem: looseBefore,
      resultItem: result,
      profile,
      focus: "physical",
    });

    expect(comparison?.candidate.physicalDps).toBe(98.7);
    expect(comparison?.craftDelta.outcome).toBe("higher");
    expect(comparison?.baselineLabel).toBe("Maza equipada");
    expect(comparison?.focusComparison).toMatchObject({
      label: "DPS físico visible",
      before: 150,
      after: 98.7,
      outcome: "lower",
    });
  });
});

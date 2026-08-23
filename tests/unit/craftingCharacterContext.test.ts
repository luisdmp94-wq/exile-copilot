import { describe, expect, it } from "vitest";
import {
  evaluateCraftingCharacterContext,
} from "../../shared/craftingCharacterContext.js";
import type { CraftingComparison } from "../../shared/craftingComparison.js";
import { evaluateCraftingGoalSignal } from "../../shared/craftingGoal.js";
import {
  CharacterProfileSchema,
  ItemSchema,
  type Item,
  type Modifier,
} from "../../shared/domain.js";

function mod(id: string, tags: string[]): Modifier {
  return {
    id,
    text: `Modificador ${id}`,
    kind: "explicit",
    values: [],
    verified: true,
    tags,
  };
}

function item(overrides: Partial<Item> = {}): Item {
  return ItemSchema.parse({
    id: "weapon",
    name: "Arma de prueba",
    baseType: "Ballesta de prueba",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    requirements: { level: 70, dex: 100 },
    modifiers: [],
    sources: [],
    ...overrides,
  });
}

function comparison(overrides: Partial<CraftingComparison> = {}): CraftingComparison {
  return {
    status: "confirmed",
    title: "Cambio confirmado",
    summary: "Aparece un modificador.",
    identityMatches: true,
    itemLevelMatches: true,
    rarityMatches: true,
    addedModifiers: [mod("damage", ["Daño", "Ataque"])],
    removedModifiers: [],
    protectionStatus: "not-requested",
    protectedModifiers: [],
    lostProtectedModifiers: [],
    warnings: [],
    ...overrides,
  };
}

function profile(original: Item, overrides: Record<string, unknown> = {}) {
  return CharacterProfileSchema.parse({
    id: "character",
    name: "Personaje",
    characterClass: "Mercenary",
    ascendancy: null,
    ascendancyId: null,
    level: 90,
    archetype: null,
    league: "Liga",
    patch: "0.5.4f",
    items: [original],
    skills: [],
    passives: { allocated: [] },
    attributes: { str: 100, dex: 150, int: 80 },
    resistances: { fire: 75, cold: 60, lightning: 40, chaos: 0 },
    sources: [],
    importedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  });
}

describe("lectura contextual del resultado de crafting", () => {
  it("presenta como candidato un resultado directo y equipable sin llamarlo mejora", () => {
    const original = item();
    const result = item({ modifiers: [mod("damage", ["Daño", "Ataque"])] });
    const observed = comparison();
    const signal = evaluateCraftingGoalSignal("damage", observed.addedModifiers);
    const context = evaluateCraftingCharacterContext({
      profile: profile(original),
      profileGoal: "damage",
      originalItem: original,
      resultItem: result,
      comparison: observed,
      goalCategory: "damage",
      goalSignal: signal,
    });

    expect(context.verdict).toBe("candidate");
    expect(context.requirementStatus).toBe("met");
    expect(context.title).toContain("Candidato");
    expect(context.summary).not.toMatch(/es una mejora|mejora garantizada/i);
    expect(context.facts).toContain("La categoría elegida coincide con el objetivo general del personaje.");
  });

  it("ordena detenerse si desaparece un modificador protegido", () => {
    const original = item();
    const lost = mod("core", ["Daño"]);
    const observed = comparison({
      protectionStatus: "lost",
      protectedModifiers: [lost],
      lostProtectedModifiers: [lost],
      removedModifiers: [lost],
    });
    const context = evaluateCraftingCharacterContext({
      profile: profile(original),
      profileGoal: "damage",
      originalItem: original,
      resultItem: item(),
      comparison: observed,
      goalCategory: "damage",
      goalSignal: evaluateCraftingGoalSignal("damage", observed.addedModifiers),
    });

    expect(context.verdict).toBe("stop");
    expect(context.title).toContain("se perdió");
    expect(context.protectionLabel).toBe("Protección perdida");
  });

  it("muestra el déficit exacto cuando el resultado no es equipable", () => {
    const original = item();
    const context = evaluateCraftingCharacterContext({
      profile: profile(original, { attributes: { str: 100, dex: 80, int: 80 } }),
      profileGoal: "damage",
      originalItem: original,
      resultItem: item(),
      comparison: comparison(),
      goalCategory: "damage",
      goalSignal: evaluateCraftingGoalSignal("damage", comparison().addedModifiers),
    });

    expect(context.verdict).toBe("stop");
    expect(context.requirementStatus).toBe("unmet");
    expect(context.facts.join(" ")).toContain("destreza 80/100");
  });

  it("no reutiliza el total antiguo si el craft cambió atributos", () => {
    const original = item();
    const attributeMod = mod("dex", ["Atributo"]);
    const observed = comparison({ addedModifiers: [attributeMod] });
    const context = evaluateCraftingCharacterContext({
      profile: profile(original),
      profileGoal: "balanced",
      originalItem: original,
      resultItem: item({ modifiers: [attributeMod] }),
      comparison: observed,
      goalCategory: "attributes",
      goalSignal: evaluateCraftingGoalSignal("attributes", observed.addedModifiers),
    });

    expect(context.verdict).toBe("review");
    expect(context.requirementStatus).toBe("unknown");
    expect(context.limitations.join(" ")).toContain("total del expediente");
  });

  it("relaciona una resistencia nueva con huecos defensivos conocidos sin calcular su efecto", () => {
    const original = item();
    const resistanceMod = mod("res", ["Defensa", "Resistencias"]);
    const observed = comparison({ addedModifiers: [resistanceMod] });
    const context = evaluateCraftingCharacterContext({
      profile: profile(original),
      profileGoal: "survival",
      originalItem: original,
      resultItem: item({ modifiers: [resistanceMod] }),
      comparison: observed,
      goalCategory: "defence",
      goalSignal: evaluateCraftingGoalSignal("defence", observed.addedModifiers),
    });

    expect(context.verdict).toBe("candidate");
    expect(context.facts.join(" ")).toContain("frío 60%");
    expect(context.facts.join(" ")).toContain("rayo 40%");
  });
});

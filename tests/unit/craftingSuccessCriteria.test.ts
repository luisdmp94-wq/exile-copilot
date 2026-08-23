import { describe, expect, it } from "vitest";
import { CraftingExperimentSchema } from "../../shared/decisionSession.js";
import {
  evaluateCraftingSuccessCriteria,
  recommendCraftingSuccessCriterion,
} from "../../shared/craftingSuccessCriteria.js";
import { ItemSchema, type Item, type Modifier } from "../../shared/domain.js";

function modifier(id: string, tags?: string[]): Modifier {
  return {
    id,
    text: `Línea ${id}`,
    kind: "explicit",
    affix: id.startsWith("p") ? "prefix" : "suffix",
    values: [],
    verified: true,
    tags,
  };
}

function item(modifiers: Modifier[]): Item {
  return ItemSchema.parse({
    id: "tracked",
    name: "Pieza observada",
    itemClass: "Ballestas",
    baseType: "Ballesta barnizada",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    modifiers,
    sources: [],
  });
}

describe("condiciones observables de final de crafting", () => {
  it("propone una sola señal adicional del objetivo sin interpretar su valor", () => {
    const observed = item([
      modifier("p-physical", ["Daño", "Físico"]),
      modifier("p-cold", ["Daño", "Hielo"]),
      modifier("s-speed", ["Velocidad"]),
    ]);

    expect(recommendCraftingSuccessCriterion(observed, "damage")).toEqual({
      kind: "goal-affix-count",
      category: "damage",
      minimumCount: 3,
    });
    expect(recommendCraftingSuccessCriterion(observed, "other")).toBeNull();
  });

  it("declara el final solo cuando se cumplen todas las condiciones elegidas", () => {
    const result = evaluateCraftingSuccessCriteria({
      criteria: [
        { kind: "goal-affix-count", category: "damage", minimumCount: 2 },
        { kind: "exact-modifier-text", text: "Línea s-speed" },
        { kind: "explicit-count", minimumCount: 3 },
      ],
      resultItem: item([
        modifier("p-physical", ["Daño", "Físico"]),
        modifier("p-cold", ["Daño", "Hielo"]),
        modifier("s-speed", ["Velocidad"]),
      ]),
    });

    expect(result.status).toBe("fulfilled");
    expect(result.entries.map((entry) => entry.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
  });

  it("distingue una condición no observada de una condición imposible de comprobar", () => {
    const notSeen = evaluateCraftingSuccessCriteria({
      criteria: [{ kind: "goal-affix-count", category: "damage", minimumCount: 1 }],
      resultItem: item([modifier("s-speed", ["Velocidad"])]),
    });
    const unknown = evaluateCraftingSuccessCriteria({
      criteria: [{ kind: "goal-affix-count", category: "damage", minimumCount: 1 }],
      resultItem: item([modifier("s-unclassified")]),
    });

    expect(notSeen.status).toBe("not-fulfilled");
    expect(notSeen.entries[0]?.status).toBe("not-seen");
    expect(unknown.status).toBe("unknown");
    expect(unknown.entries[0]?.status).toBe("unknown");
  });

  it("una línea exacta ausente nunca cuenta como éxito", () => {
    const result = evaluateCraftingSuccessCriteria({
      criteria: [{ kind: "exact-modifier-text", text: "Línea p-missing" }],
      resultItem: item([modifier("p-one", ["Daño"])]),
    });

    expect(result.status).toBe("not-fulfilled");
    expect(result.entries[0]?.detail).toContain("no aparece");
  });

  it("acepta varios mods objetivo y comprueba grado X o mejor sin invertir la escala", () => {
    const result = evaluateCraftingSuccessCriteria({
      criteria: [
        { kind: "exact-modifier-text", text: "Línea p-physical", maximumTier: 3 },
        { kind: "exact-modifier-text", text: "Línea s-speed", maximumTier: 2 },
      ],
      resultItem: item([
        { ...modifier("p-physical", ["Daño"]), tier: 2 },
        { ...modifier("s-speed", ["Velocidad"]), tier: 3 },
      ]),
    });

    expect(result.status).toBe("not-fulfilled");
    expect(result.entries.map((entry) => entry.status)).toEqual(["fulfilled", "not-seen"]);
    expect(result.entries[0]?.detail).toContain("grado 2");
    expect(result.entries[1]?.detail).toContain("exige grado 2 o mejor");
  });

  it("no finge cumplir el grado si el tooltip no lo aporta", () => {
    const result = evaluateCraftingSuccessCriteria({
      criteria: [
        { kind: "exact-modifier-text", text: "Línea p-physical", maximumTier: 1 },
      ],
      resultItem: item([modifier("p-physical", ["Daño"])]),
    });
    // El helper de esta suite no fija grado salvo cuando el caso lo declara.
    expect(result.status).toBe("unknown");
    expect(result.entries[0]?.detail).toContain("no permite comprobar su grado");
  });

  it("las sesiones anteriores cargan con una lista vacía sin inventar un final", () => {
    const legacy = CraftingExperimentSchema.parse({
      actionId: "exalted",
      actionLabel: "Orbe exaltado",
      desiredOutcome: "Más daño",
      protectedModifierIds: [],
      originalItem: item([]),
    });

    expect(legacy.successCriteria).toEqual([]);
    expect(
      evaluateCraftingSuccessCriteria({
        criteria: legacy.successCriteria,
        resultItem: item([]),
      }).status,
    ).toBe("not-defined");
  });
});

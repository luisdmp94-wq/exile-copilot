import { describe, expect, it } from "vitest";
import {
  buildCraftingTargetEvidence,
  suggestObservedCraftingTargets,
} from "../../shared/craftingTargetEvidence.js";
import type { Item, Modifier } from "../../shared/domain.js";

const cleanState = { corrupted: false, mirrored: false, split: false, unidentified: false };

function mod(id: string, text: string, tags: string[], tier?: number): Modifier {
  return {
    id,
    text,
    tags,
    tier,
    kind: "explicit",
    affix: "prefix",
    values: [],
    verified: true,
  };
}

function bow(id: string, modifiers: Modifier[]): Item {
  return {
    id,
    name: `Arco ${id}`,
    itemClass: "Arcos",
    baseType: "Arco tribal",
    slot: "weapon",
    rarity: "magic",
    itemLevel: 81,
    modifiers,
    craftingState: cleanState,
    sources: [],
  };
}

describe("buildCraftingTargetEvidence", () => {
  it("detecta una condición exacta ya cumplida en la base actual", () => {
    const selected = bow("actual", [mod("cold", "Agrega de 79 a 117 de daño de hielo", ["Daño", "Hielo"], 1)]);
    const result = buildCraftingTargetEvidence({
      selectedItem: selected,
      items: [selected],
      goalCategory: "damage",
      successCriteria: [{ kind: "exact-modifier-text", text: "Agrega de 79 a 117 de daño de hielo", maximumTier: 2 }],
      modPoolCoverage: "unavailable",
    });

    expect(result.status).toBe("target-on-current");
    expect(result.fulfilledItemIds).toEqual(["actual"]);
    expect(result.observations[0]).toMatchObject({ relation: "exact", tier: 1 });
  });

  it("usa otra pieza de la misma clase como evidencia local, no como probabilidad", () => {
    const selected = bow("actual", [mod("speed", "Velocidad aumentada", ["Velocidad"], 5)]);
    const peer = bow("referencia", [mod("cold", "Agrega de 79 a 117 de daño de hielo", ["Daño", "Hielo"], 1)]);
    const result = buildCraftingTargetEvidence({
      selectedItem: selected,
      items: [selected, peer],
      goalCategory: "damage",
      successCriteria: [{ kind: "exact-modifier-text", text: "Agrega de 79 a 117 de daño de hielo", maximumTier: 2 }],
      modPoolCoverage: "unavailable",
    });

    expect(result.status).toBe("target-observed-locally");
    expect(result.fulfilledItemIds).toEqual(["referencia"]);
    expect(result.observations.some((entry) => entry.source === "peer")).toBe(true);
    expect(result.limitations.join(" ")).toContain("no demuestra el pool completo");
  });

  it("no mezcla clases distintas aunque compartan ranura", () => {
    const selected = bow("actual", []);
    const mace = { ...bow("maza", [mod("damage", "Daño físico aumentado", ["Daño"], 1)]), itemClass: "Mazas a una mano" };
    const result = buildCraftingTargetEvidence({
      selectedItem: selected,
      items: [selected, mace],
      goalCategory: "damage",
      successCriteria: [{ kind: "goal-affix-count", category: "damage", minimumCount: 1 }],
      modPoolCoverage: "unknown",
    });

    expect(result.comparableItemCount).toBe(1);
    expect(result.status).toBe("unobserved");
    expect(result.observations).toEqual([]);
  });

  it("separa una señal de categoría del contrato completo", () => {
    const selected = bow("actual", [mod("cold", "Agrega daño de hielo", ["Daño", "Hielo"], 8)]);
    const result = buildCraftingTargetEvidence({
      selectedItem: selected,
      items: [selected],
      goalCategory: "damage",
      successCriteria: [{ kind: "exact-modifier-text", text: "+2 al nivel de proyectiles", maximumTier: 2 }],
      modPoolCoverage: "available-partial",
    });

    expect(result.status).toBe("partial-local-evidence");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.relation).toBe("category");
    expect(result.limitations.join(" ")).toContain("pool disponible es parcial");
  });

  it("convierte líneas observadas en atajos literales sin duplicar objetivos", () => {
    const observations = [
      {
        itemId: "peer",
        itemName: "Arco referencia",
        baseType: "Arco tribal",
        itemLevel: 81,
        modifierText: "Agrega de 79 a 117 de daño de hielo",
        tier: 1,
        relation: "category" as const,
        source: "peer" as const,
      },
      {
        itemId: "current",
        itemName: "Arco actual",
        baseType: "Arco tribal",
        itemLevel: 80,
        modifierText: "Agrega de 79 a 117 de daño de hielo",
        tier: 2,
        relation: "category" as const,
        source: "current" as const,
      },
      {
        itemId: "peer",
        itemName: "Arco referencia",
        baseType: "Arco tribal",
        itemLevel: 81,
        modifierText: "Velocidad de ataque aumentada un 16%",
        tier: 1,
        relation: "category" as const,
        source: "peer" as const,
      },
    ];
    const suggestions = suggestObservedCraftingTargets({
      observations,
      criteria: [{ kind: "exact-modifier-text", text: "Velocidad de ataque aumentada un 16%" }],
    });

    expect(suggestions).toEqual([{
      text: "Agrega de 79 a 117 de daño de hielo",
      maximumTier: 1,
      itemName: "Arco referencia",
      itemLevel: 81,
      source: "peer",
    }]);
  });
});

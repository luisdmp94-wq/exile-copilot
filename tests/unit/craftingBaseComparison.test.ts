import { describe, expect, it } from "vitest";
import { compareCraftingBases } from "../../shared/craftingBaseComparison.js";
import type { CharacterProfile, Item, Modifier } from "../../shared/domain.js";

const cleanState = {
  corrupted: false,
  mirrored: false,
  split: false,
  unidentified: false,
};

function modifier(id: string, text: string, tags: string[], affix: "prefix" | "suffix"): Modifier {
  return { id, text, tags, affix, kind: "explicit", values: [], verified: true };
}

function item(id: string, patch: Partial<Item> = {}): Item {
  return {
    id,
    name: `Base ${id}`,
    itemClass: "Arcos",
    baseType: "Arco tribal",
    slot: "weapon",
    rarity: "magic",
    itemLevel: 70,
    modifiers: [modifier(`${id}-speed`, "Velocidad aumentada", ["Velocidad"], "suffix")],
    craftingState: cleanState,
    sources: [],
    ...patch,
  };
}

const profile: CharacterProfile = {
  id: "base-profile",
  name: "Arquera",
  characterClass: "Desconocida",
  ascendancy: null,
  ascendancyId: null,
  level: 80,
  levelSource: "observed",
  archetype: null,
  league: "Test",
  patch: "test",
  items: [],
  skills: [],
  passives: { allocated: [] },
  attributes: { str: 40, dex: 160, int: 30 },
  resistances: { fire: null, cold: null, lightning: null, chaos: null },
  sources: [],
  importedAt: "2026-08-26T00:00:00.000Z",
};

describe("compareCraftingBases", () => {
  it("compara solo piezas de la misma clase declarada", () => {
    const selected = item("selected");
    const bow = item("bow", {
      modifiers: [modifier("cold", "Agrega daño de hielo", ["Daño", "Hielo"], "prefix")],
    });
    const mace = item("mace", { itemClass: "Mazas a una mano" });
    const result = compareCraftingBases({
      selectedItem: selected,
      items: [selected, bow, mace],
      profile,
      goalCategory: "damage",
    });

    expect(result.comparableBy).toBe("item-class");
    expect(result.candidates.map((candidate) => candidate.item.id)).toEqual(["selected", "bow"]);
    expect(result.candidates.find((candidate) => candidate.item.id === "bow")?.directGoalModifierCount).toBe(1);
    expect(result.candidates.find((candidate) => candidate.item.id === "bow")?.hasMostDirectSignals).toBe(true);
  });

  it("separa requisitos incumplidos de una recomendación de inversión", () => {
    const selected = item("selected");
    const demanding = item("demanding", { requirements: { level: 90, dex: 200 } });
    const result = compareCraftingBases({
      selectedItem: selected,
      items: [selected, demanding],
      profile,
      goalCategory: "speed",
    });
    const candidate = result.candidates.find((entry) => entry.item.id === "demanding");

    expect(candidate?.requirementStatus).toBe("unmet");
    expect(candidate?.requirementLabel).toContain("nivel 80/90");
    expect(candidate?.requirementLabel).toContain("Des 160/200");
    expect(candidate?.status).toBe("hold");
  });

  it("no convierte la ausencia de una clase literal en una equivalencia inventada", () => {
    const selected = item("selected", { itemClass: undefined, slot: "ring1" });
    const sameSlot = item("same-slot", { itemClass: "Anillos", slot: "ring1" });
    const otherSlot = item("other-slot", { itemClass: undefined, slot: "ring2" });
    const result = compareCraftingBases({
      selectedItem: selected,
      items: [selected, sameSlot, otherSlot],
      profile: null,
      goalCategory: "other",
    });

    expect(result.comparableBy).toBe("slot");
    expect(result.candidates.map((candidate) => candidate.item.id)).toEqual(["selected", "same-slot"]);
    expect(result.candidates.every((candidate) => candidate.directGoalModifierCount === 0)).toBe(true);
  });
});

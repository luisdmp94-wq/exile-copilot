import { describe, expect, it } from "vitest";
import { evaluateCraftingProtection } from "../../shared/craftingProtection.js";
import type { Item, Modifier } from "../../shared/domain.js";

function explicit(id: string, text: string): Modifier {
  return { id, text, kind: "explicit", affix: "prefix", values: [], verified: true };
}

function item(modifiers: Modifier[]): Item {
  return {
    id: "item",
    name: "Objeto",
    baseType: "Base",
    slot: "weapon",
    rarity: "rare",
    modifiers,
    sources: [],
  };
}

describe("evaluateCraftingProtection", () => {
  it("declara seguro un paso que no retira modificadores", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("keep", "Conservar")]),
      protectedModifierIds: ["keep"],
      removedModifierCount: 0,
      removalSelection: "none",
    });
    expect(result).toMatchObject({ status: "safe", risk: "none" });
  });

  it("advierte cuando una retirada aleatoria puede tocar algo protegido", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("keep", "Conservar"), explicit("free", "Prescindible")]),
      protectedModifierIds: ["keep"],
      removedModifierCount: 1,
      removalSelection: "random",
    });
    expect(result).toMatchObject({ status: "warning", risk: "possible" });
  });

  it("bloquea cuando toda retirada posible destruye algo protegido", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("keep-a", "A"), explicit("keep-b", "B")]),
      protectedModifierIds: ["keep-a", "keep-b"],
      removedModifierCount: 1,
      removalSelection: "random",
    });
    expect(result).toMatchObject({ status: "blocked", risk: "certain" });
  });

  it("permite retirada elegida si existe una alternativa no protegida", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("keep", "Conservar"), explicit("free", "Prescindible")]),
      protectedModifierIds: ["keep"],
      removedModifierCount: 1,
      removalSelection: "player-selected",
    });
    expect(result).toMatchObject({ status: "safe", risk: "none" });
  });

  it("no promete protección si se desconoce cómo se elige la retirada", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("keep", "Conservar"), explicit("free", "Prescindible")]),
      protectedModifierIds: ["keep"],
      removedModifierCount: 1,
      removalSelection: "unspecified",
    });
    expect(result).toMatchObject({ status: "needs-data", risk: "unknown" });
  });

  it("detecta selecciones obsoletas en lugar de ignorarlas", () => {
    const result = evaluateCraftingProtection({
      item: item([explicit("current", "Actual")]),
      protectedModifierIds: ["old-id"],
      removedModifierCount: 1,
      removalSelection: "random",
    });
    expect(result).toMatchObject({
      status: "needs-data",
      risk: "unknown",
      unknownModifierIds: ["old-id"],
    });
  });
});

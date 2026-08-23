import { describe, expect, it } from "vitest";
import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
} from "../../shared/craftingActions.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { buildCraftingRoute } from "../../shared/craftingRoute.js";
import type { Item, Modifier } from "../../shared/domain.js";

function explicit(id: string, affix: "prefix" | "suffix"): Modifier {
  return {
    id,
    text: `${affix} ${id}`,
    kind: "explicit",
    affix,
    values: [],
    verified: false,
  };
}

function item(patch: Partial<Item>): Item {
  return {
    id: "route-item",
    name: "Pieza de ruta",
    baseType: "Ballesta",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    modifiers: [explicit("p1", "prefix")],
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    sources: [],
    ...patch,
  };
}

function route(current: Item) {
  const diagnosis = diagnoseCraftingItem(current);
  return buildCraftingRoute(
    current,
    diagnosis,
    evaluateObservedCraftingActions(current, OBSERVED_CRAFTING_ACTIONS),
  );
}

describe("buildCraftingRoute", () => {
  it("lleva una base normal directamente a la única Transmutación legal", () => {
    const result = route(item({ rarity: "normal", modifiers: [] }));
    expect(result.state).toBe("single-currency");
    expect(result.currencyActions).toEqual([
      { id: "transmutation", label: "Orbe de transmutación" },
    ]);
  });

  it("muestra las dos rutas de un mágico con un afijo sin fingir un ranking", () => {
    const result = route(item({ rarity: "magic" }));
    expect(result.state).toBe("currency-choice");
    expect(result.currencyActions.map((entry) => entry.id)).toEqual([
      "augmentation",
      "regal",
    ]);
    expect(result.summary).toContain("no los ordena");
  });

  it("lleva una pieza rara llena a herramientas de reemplazo", () => {
    const fullRare = item({
      modifiers: [
        explicit("p1", "prefix"),
        explicit("p2", "prefix"),
        explicit("p3", "prefix"),
        explicit("s1", "suffix"),
        explicit("s2", "suffix"),
        explicit("s3", "suffix"),
      ],
    });
    const result = route(fullRare);
    expect(result.state).toBe("replacement-tools");
    expect(result.toolSuggestions).toEqual(["essence", "alloy"]);
    expect(result.headline).toContain("reemplazar");
  });

  it("frena si la pieza carece de estados especiales verificables", () => {
    const incomplete = item({ craftingState: undefined });
    const result = route(incomplete);
    expect(result.state).toBe("needs-data");
    expect(result.currencyActions).toEqual([]);
    expect(result.eyebrow).toBe("No gastes todavía");
  });
});

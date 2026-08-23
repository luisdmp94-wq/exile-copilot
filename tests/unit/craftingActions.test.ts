import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OBSERVED_CRAFTING_ACTIONS,
  craftingCurrencyLabel,
  evaluateObservedCraftingActions,
} from "../../shared/craftingActions.js";
import type { Item } from "../../shared/domain.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";

const crossbowText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/phoenixCoreCrossbowAdvanced.es.txt", import.meta.url)),
  "utf8",
);
const bowText = readFileSync(
  fileURLToPath(
    new URL("../../docs/evidence/crafting/2026-08-22/soul-branch-advanced.es.txt", import.meta.url),
  ),
  "utf8",
);

function evaluation(item: Item, id: string) {
  const found = evaluateObservedCraftingActions(item).find((entry) => entry.action.id === id);
  if (!found) throw new Error(`Acción no encontrada: ${id}`);
  return found;
}

describe("evaluateObservedCraftingActions", () => {
  it("considera estructuralmente compatible el exaltado de la ballesta con cinco afijos", () => {
    const item = parseItemText(crossbowText).item;
    expect(item.craftingState).toEqual({
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    });
    expect(evaluation(item, "exalted").status).toBe("compatible");
    expect(evaluation(item, "augmentation").status).toBe("blocked");
    expect(evaluation(item, "regal").status).toBe("blocked");
    expect(evaluation(item, "transmutation").status).toBe("blocked");
  });

  it("bloquea exaltado si el objeto raro ya tiene seis afijos", () => {
    const item = parseItemText(bowText).item;
    const exalted = evaluation(item, "exalted");
    expect(exalted.status).toBe("blocked");
    expect(exalted.reason).toContain("límite total observado es 6");
  });

  it("permite estructuralmente aumento y regio en un mágico con un afijo", () => {
    const item: Item = {
      id: "magic",
      name: "Mágico",
      baseType: "Ballesta",
      slot: "weapon",
      rarity: "magic",
      itemLevel: 40,
      modifiers: [
        {
          id: "prefix",
          text: "+10 de daño",
          kind: "explicit",
          affix: "prefix",
          values: [10],
          verified: false,
        },
      ],
      craftingState: {
        corrupted: false,
        mirrored: false,
        split: false,
        unidentified: false,
      },
      sources: [],
    };
    expect(evaluation(item, "augmentation").status).toBe("compatible");
    expect(evaluation(item, "regal").status).toBe("compatible");
  });

  it("no declara compatibilidad si faltan estados especiales", () => {
    const item = parseItemText(crossbowText).item;
    delete item.craftingState;
    expect(evaluation(item, "exalted")).toMatchObject({ status: "needs-data" });
  });

  it("bloquea la moneda compatible con la rareza si el objeto está corrupto", () => {
    const item = parseItemText(crossbowText).item;
    if (!item.craftingState) throw new Error("El fixture debe declarar estados");
    item.craftingState.corrupted = true;
    expect(evaluation(item, "exalted")).toMatchObject({ status: "blocked" });
  });

  it.each([
    ["sanctified", "santificado"],
    ["unmodifiable", "no puede modificarse"],
    ["unmodifiableExceptChaos", "acción de caos"],
  ] as const)("bloquea acciones básicas cuando el estado %s lo impide", (field, reason) => {
    const item = parseItemText(crossbowText).item;
    if (!item.craftingState) throw new Error("El fixture debe declarar estados");
    item.craftingState[field] = true;

    expect(evaluation(item, "exalted")).toMatchObject({ status: "blocked" });
    expect(evaluation(item, "exalted").reason).toContain(reason);
  });

  it.each(["mutated", "desecrated"] as const)(
    "pide verificación en vez de improvisar para un objeto %s",
    (field) => {
      const item = parseItemText(crossbowText).item;
      if (!item.craftingState) throw new Error("El fixture debe declarar estados");
      item.craftingState[field] = true;

      expect(evaluation(item, "exalted")).toMatchObject({ status: "needs-data" });
    },
  );

  it("no inventa variantes perfectas de regio o exaltado", () => {
    const regal = OBSERVED_CRAFTING_ACTIONS.find((action) => action.id === "regal");
    const exalted = OBSERVED_CRAFTING_ACTIONS.find((action) => action.id === "exalted");
    expect(regal?.variants.map((variant) => variant.id)).toEqual(["base", "greater"]);
    expect(exalted?.variants.map((variant) => variant.id)).toEqual(["base", "greater"]);
  });

  it("nombra de forma inequívoca la variante exacta elegida", () => {
    const exalted = OBSERVED_CRAFTING_ACTIONS.find((action) => action.id === "exalted");
    if (!exalted) throw new Error("Falta la acción exaltada observada");
    expect(craftingCurrencyLabel(exalted, exalted.variants[0]!)).toBe("Orbe exaltado");
    expect(craftingCurrencyLabel(exalted, exalted.variants[1]!)).toBe(
      "Orbe exaltado superior",
    );
  });
});

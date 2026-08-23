import { describe, expect, it } from "vitest";
import {
  ESSENCE_MECHANIC_SOURCE,
  evaluateEssencePlan,
  type EssencePlanInput,
} from "../../shared/craftingEssences.js";
import type { Item, Modifier } from "../../shared/domain.js";

function modifier(text: string): Modifier {
  return {
    id: text,
    text,
    kind: "explicit",
    affix: "prefix",
    values: [],
    verified: false,
  };
}

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "essence-target",
    name: "Objeto de prueba",
    baseType: "Ballesta de prueba",
    slot: "weapon",
    rarity: "magic",
    itemLevel: 80,
    modifiers: [modifier("Modificador actual")],
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

function plan(patch: Partial<EssencePlanInput> = {}): EssencePlanInput {
  return {
    tier: "normal",
    essenceName: "Essence observada",
    guaranteedModifierText: "Efecto exacto copiado del tooltip",
    ...patch,
  };
}

describe("evaluateEssencePlan", () => {
  it("acepta Menor, Normal y Superior solo sobre un objeto mágico", () => {
    for (const tier of ["lesser", "normal", "greater"] as const) {
      expect(evaluateEssencePlan(item(), plan({ tier }))).toMatchObject({
        status: "compatible",
        operation: "magic-to-rare",
        targetRarity: "magic",
        resultRarity: "rare",
        randomRemoval: false,
      });
    }
    expect(evaluateEssencePlan(item({ rarity: "rare" }), plan())).toMatchObject({
      status: "blocked",
    });
  });

  it("modela Perfecta y corrupción como reemplazo aleatorio sobre un raro", () => {
    for (const tier of ["perfect", "corrupted"] as const) {
      expect(evaluateEssencePlan(item({ rarity: "rare" }), plan({ tier }))).toMatchObject({
        status: "compatible",
        operation: "replace-random-rare-modifier",
        randomRemoval: true,
        irreversible: true,
      });
    }
    expect(evaluateEssencePlan(item(), plan({ tier: "perfect" }))).toMatchObject({
      status: "blocked",
    });
  });

  it("no deduce el efecto por el nombre y exige el tooltip exacto", () => {
    const evaluation = evaluateEssencePlan(
      item(),
      plan({ guaranteedModifierText: "" }),
    );
    expect(evaluation.status).toBe("needs-data");
    expect(evaluation.reason).toContain("tooltip");
  });

  it("bloquea estados ilegales y pide datos para interacciones especiales", () => {
    expect(
      evaluateEssencePlan(
        item({ craftingState: { corrupted: true, mirrored: false, split: false, unidentified: false } }),
        plan(),
      ).status,
    ).toBe("blocked");
    expect(
      evaluateEssencePlan(
        item({ craftingState: { corrupted: false, mirrored: false, split: false, unidentified: false, desecrated: true } }),
        plan(),
      ).status,
    ).toBe("needs-data");
  });

  it("mantiene la regla vinculada a una fuente oficial y una versión", () => {
    expect(ESSENCE_MECHANIC_SOURCE.url).toMatch(/^https:\/\/www\.pathofexile\.com\//);
    expect(ESSENCE_MECHANIC_SOURCE.appliesFrom).toBe("0.3.0");
  });
});

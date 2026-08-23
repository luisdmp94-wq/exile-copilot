import { describe, expect, it } from "vitest";
import {
  ALLOY_CLASS_RESTRICTION_SOURCES,
  ALLOY_MECHANIC_SOURCE,
  evaluateAlloyPlan,
  type AlloyPlanInput,
} from "../../shared/craftingAlloys.js";
import type { Item, Modifier } from "../../shared/domain.js";

function modifier(text: string, patch: Partial<Modifier> = {}): Modifier {
  return {
    id: text,
    text,
    kind: "explicit",
    affix: "prefix",
    values: [],
    verified: false,
    ...patch,
  };
}

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "alloy-target",
    name: "Objeto de prueba",
    baseType: "Ballesta de prueba",
    slot: "weapon",
    rarity: "rare",
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

function plan(patch: Partial<AlloyPlanInput> = {}): AlloyPlanInput {
  return {
    alloyName: "Alloy observado",
    fullTooltipText: "Texto completo observado que reemplaza un modificador.",
    guaranteedModifierText: "Modificador fabricado exacto",
    declaredItemClasses: ["Ballestas"],
    playerConfirmedClassApplies: true,
    removalSelection: "unspecified",
    ...patch,
  };
}

describe("evaluateAlloyPlan", () => {
  it("autoriza con tooltip completo y conserva desconocido el criterio de reemplazo", () => {
    expect(evaluateAlloyPlan(item(), plan())).toMatchObject({
      status: "compatible",
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
      irreversible: true,
    });
    expect(evaluateAlloyPlan(item(), plan({ removalSelection: "unspecified" })).status)
      .toBe("compatible");
    expect(evaluateAlloyPlan(item(), plan({ guaranteedModifierText: "" })).status)
      .toBe("needs-data");
  });

  it("no asume rareza rara y conserva la rareza del objeto", () => {
    expect(evaluateAlloyPlan(item({ rarity: "magic" }), plan())).toMatchObject({
      status: "compatible",
      resultRarity: "magic",
    });
  });

  it("exige clases declaradas y confirmación expresa del jugador", () => {
    expect(evaluateAlloyPlan(item(), plan({ declaredItemClasses: [] })).status)
      .toBe("needs-data");
    expect(evaluateAlloyPlan(item(), plan({ playerConfirmedClassApplies: false })).status)
      .toBe("needs-data");
  });

  it("exige clasificación avanzada de los modificadores", () => {
    expect(evaluateAlloyPlan(item({
      modifiers: [modifier("Sin clasificación", { affix: undefined })],
    }), plan()).status).toBe("needs-data");
  });

  it("no autoriza un segundo modificador fabricado", () => {
    const evaluation = evaluateAlloyPlan(
      item({ modifiers: [modifier("Fabricado actual", { crafted: true })] }),
      plan(),
    );
    expect(evaluation.status).toBe("blocked");
    expect(evaluation.reason).toContain("ya contiene un crafted modifier");
  });

  it("bloquea corrupción y pide evidencia para estados especiales", () => {
    expect(evaluateAlloyPlan(item({
      craftingState: { corrupted: true, mirrored: false, split: false, unidentified: false },
    }), plan()).status).toBe("blocked");
    expect(evaluateAlloyPlan(item({
      modifiers: [modifier("Mod especial", { desecrated: true })],
    }), plan()).status).toBe("needs-data");
  });

  it("vincula la regla global a las notas oficiales 0.5.0", () => {
    expect(ALLOY_MECHANIC_SOURCE.url).toMatch(/^https:\/\/www\.pathofexile\.com\//);
    expect(ALLOY_MECHANIC_SOURCE.patch).toBe("0.5.0");
    expect(ALLOY_MECHANIC_SOURCE.declaredTotalCount).toBe(13);
    expect(ALLOY_MECHANIC_SOURCE.leagueScope).toBe("Runes of Aldur");
    expect(ALLOY_CLASS_RESTRICTION_SOURCES.map((source) => source.patch)).toEqual([
      "0.5.2",
      "0.5.3",
    ]);
  });
});

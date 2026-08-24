import { describe, expect, it } from "vitest";
import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
} from "../../shared/craftingActions.js";
import { buildExpertCraftingBlueprint } from "../../shared/craftingBlueprint.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { buildCraftingRoute } from "../../shared/craftingRoute.js";
import type { CraftingSuccessCriterion } from "../../shared/craftingSuccessCriteria.js";
import type { Item, Modifier } from "../../shared/domain.js";

function explicit(id: string, affix: "prefix" | "suffix", text = `${affix} ${id}`): Modifier {
  return {
    id,
    text,
    kind: "explicit",
    affix,
    values: [],
    verified: false,
  };
}

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "blueprint-item",
    name: "Pieza del plano",
    baseType: "Ballesta",
    slot: "weapon",
    rarity: "magic",
    itemLevel: 80,
    modifiers: [explicit("p1", "prefix", "+20 de daño físico")],
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

const stop: CraftingSuccessCriterion[] = [
  { kind: "exact-modifier-text", text: "+2 al nivel de proyectiles", maximumTier: 2 },
];

function blueprint(current: Item, overrides: {
  objective?: string;
  protectedModifierIds?: string[];
  successCriteria?: CraftingSuccessCriterion[];
} = {}) {
  const diagnosis = diagnoseCraftingItem(current);
  const evaluations = evaluateObservedCraftingActions(current, OBSERVED_CRAFTING_ACTIONS);
  const route = buildCraftingRoute(current, diagnosis, evaluations);
  return buildExpertCraftingBlueprint({
    item: current,
    diagnosis,
    evaluations,
    route,
    objective: overrides.objective ?? "Arma final de proyectiles",
    protectedModifierIds: overrides.protectedModifierIds ?? ["p1"],
    successCriteria: overrides.successCriteria ?? stop,
  });
}

describe("buildExpertCraftingBlueprint", () => {
  it("propone Aumento antes de Regio porque conserva una opción futura", () => {
    const result = blueprint(item());
    expect(result.status).toBe("ready");
    expect(result.recommendedRouteId).toBe("augmentation");
    expect(result.headline).toBe("Orbe de aumento");
    expect(result.nextAction).toContain("Regio seguirá disponible");
    expect(result.routes.map((route) => route.id)).toEqual(["augmentation", "regal"]);
    expect(result.routes.find((route) => route.id === "regal")?.consequence).toContain(
      "ya no podrás usar Aumento",
    );
  });

  it("conserva en el contrato el objetivo, las líneas protegidas y la parada", () => {
    const result = blueprint(item());
    expect(result.objective).toBe("Arma final de proyectiles");
    expect(result.protectedLines).toEqual(["+20 de daño físico"]);
    expect(result.stopConditions).toEqual([
      "Que aparezca: +2 al nivel de proyectiles (grado 2 o mejor)",
    ]);
  });

  it("no habilita el plan sin una condición observable de salida", () => {
    const result = blueprint(item(), { successCriteria: [] });
    expect(result.status).toBe("needs-stop");
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.recommendedRouteId).toBe("augmentation");
  });

  it("detiene el gasto si la condición ya aparece en la pieza", () => {
    const current = item({
      modifiers: [
        explicit("p1", "prefix", "+20 de daño físico"),
        { ...explicit("s1", "suffix", "+2 al nivel de proyectiles"), tier: 2 },
      ],
    });
    const result = blueprint(current);
    expect(result.status).toBe("already-complete");
    expect(result.headline).toContain("ya cumple");
  });

  it("presenta Essence y Alloy como reemplazos que exigen tooltip, nunca como receta confirmada", () => {
    const fullRare = item({
      rarity: "rare",
      modifiers: [
        explicit("p1", "prefix"),
        explicit("p2", "prefix"),
        explicit("p3", "prefix"),
        explicit("s1", "suffix"),
        explicit("s2", "suffix"),
        explicit("s3", "suffix"),
      ],
    });
    const result = blueprint(fullRare, { protectedModifierIds: ["p1", "s1"] });
    expect(result.status).toBe("ready");
    expect(result.recommendedRouteId).toBeNull();
    expect(result.routes.map((route) => [route.id, route.availability, route.risk])).toEqual([
      ["essence", "needs-tooltip", "replacement"],
      ["alloy", "needs-tooltip", "replacement"],
    ]);
    expect(result.routes[0]?.preserves).toMatch(/no se puede prometer/i);
  });

  it("no fabrica una ruta cuando el objeto está corrupto", () => {
    const current = item({
      craftingState: {
        corrupted: true,
        mirrored: false,
        split: false,
        unidentified: false,
      },
    });
    const result = blueprint(current);
    expect(result.status).toBe("needs-item-data");
    expect(result.routes).toEqual([]);
  });
});

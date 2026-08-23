import { describe, expect, it } from "vitest";
import { buildCraftingCoachStep } from "../../shared/craftingCoach.js";
import type { CraftingItemDiagnosis } from "../../shared/craftingDiagnosis.js";
import type { CraftingRoute } from "../../shared/craftingRoute.js";

const diagnosis: CraftingItemDiagnosis = {
  state: "complete",
  label: "Lectura completa",
  summary: "Estructura observada.",
  nextAction: "Ya puedes continuar.",
  explicitCount: 5,
  auxiliaryCount: 0,
  prefixCount: 3,
  suffixCount: 2,
  unclassifiedExplicitCount: 0,
  observedTotalLimit: 6,
  observedOpenSlots: 1,
  blockers: [],
  limitations: [],
};

const route: CraftingRoute = {
  state: "single-currency",
  eyebrow: "Siguiente acción legal",
  headline: "Orbe exaltado",
  summary: "Única moneda básica compatible.",
  currencyActions: [{ id: "exalted", label: "Orbe exaltado" }],
  toolSuggestions: [],
};

describe("buildCraftingCoachStep", () => {
  it("empieza preguntando el objetivo y no por una moneda", () => {
    const step = buildCraftingCoachStep({
      diagnosis,
      route,
      goalCategory: "other",
      successCriteriaReady: false,
    });
    expect(step.stage).toBe("choose-goal");
    expect(step.step).toBe(1);
  });

  it("pide una parada observable antes de preparar el gasto", () => {
    const step = buildCraftingCoachStep({
      diagnosis,
      route,
      goalCategory: "damage",
      successCriteriaReady: false,
    });
    expect(step.stage).toBe("choose-stop");
    expect(step.title).toContain("dejar de gastar");
  });

  it("expone una sola moneda compatible como próxima acción", () => {
    const step = buildCraftingCoachStep({
      diagnosis,
      route,
      goalCategory: "damage",
      successCriteriaReady: true,
    });
    expect(step.stage).toBe("ready-currency");
    expect(step.title).toBe("Orbe exaltado");
  });

  it("no ordena dos monedas legales como mejor o peor", () => {
    const step = buildCraftingCoachStep({
      diagnosis,
      route: { ...route, state: "currency-choice", currencyActions: [
        { id: "augmentation", label: "Orbe de aumento" },
        { id: "regal", label: "Orbe regio" },
      ] },
      goalCategory: "damage",
      successCriteriaReady: true,
    });
    expect(step.stage).toBe("choose-currency");
    expect(step.detail).toContain("Única moneda");
  });

  it("detiene la ruta cuando faltan datos estructurales", () => {
    const step = buildCraftingCoachStep({
      diagnosis: { ...diagnosis, state: "partial", nextAction: "Pega el texto avanzado." },
      route: { ...route, state: "needs-data" },
      goalCategory: "damage",
      successCriteriaReady: true,
    });
    expect(step.stage).toBe("needs-data");
    expect(step.detail).toBe("Pega el texto avanzado.");
  });
});

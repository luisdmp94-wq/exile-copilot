import { describe, expect, it } from "vitest";
import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
} from "../../shared/craftingActions.js";
import { assessCraftingAffixes } from "../../shared/craftingAffixAssessment.js";
import {
  ALLOY_REMOVAL_LABELS_EN,
  ALLOY_RESULT_UNKNOWN_LABEL_EN,
  evaluateAlloyPlan,
  type AlloyPlanInput,
} from "../../shared/craftingAlloys.js";
import { compareCraftingBases } from "../../shared/craftingBaseComparison.js";
import { buildExpertCraftingBlueprint } from "../../shared/craftingBlueprint.js";
import { craftingBuildIntentLabel } from "../../shared/craftingBuildIntent.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import {
  ESSENCE_RESULT_UNKNOWN_LABEL_EN,
  ESSENCE_TIER_LABELS_EN,
  evaluateEssencePlan,
} from "../../shared/craftingEssences.js";
import {
  CRAFTING_GOAL_LABELS,
  CRAFTING_GOAL_LABELS_EN,
  craftingGoalLabel,
  evaluateCraftingGoalSignal,
} from "../../shared/craftingGoal.js";
import { craftingLaboratoryRouteLabel } from "../../shared/craftingProjectRoute.js";
import { evaluateCraftingProtection } from "../../shared/craftingProtection.js";
import { buildCraftingRoute } from "../../shared/craftingRoute.js";
import {
  craftingSuccessCriterionLabel,
  evaluateCraftingSuccessCriteria,
  type CraftingSuccessCriterion,
} from "../../shared/craftingSuccessCriteria.js";
import { buildCraftingTargetEvidence } from "../../shared/craftingTargetEvidence.js";
import {
  craftingActionEffect,
  craftingActionEvidence,
  craftingActionLabel,
  craftingBaseCandidateText,
  craftingBaseComparisonLabel,
  craftingCurrencyLabelFor,
  craftingVariantLabel,
} from "../../shared/craftingWorkshopText.js";
import type { CharacterProfile, Item, Modifier } from "../../shared/domain.js";
import { buildCraftingMentorReading } from "../../src/lib/craftingMentorReading.js";

const SPANISH = /[áéíóúñ¿¡]|\b(?:de|del|la|las|los|el|que|una|objeto|pieza|grado|afijo|modificador)\b/i;

/** Recorre cualquier salida y devuelve todas las cadenas que contiene. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function expectEnglish(value: unknown, ignore: readonly string[] = []): void {
  const offenders = strings(value).filter(
    (text) => !ignore.includes(text) && SPANISH.test(text),
  );
  expect(offenders).toEqual([]);
}

const cleanState = { corrupted: false, mirrored: false, split: false, unidentified: false };

function mod(
  id: string,
  affix: "prefix" | "suffix",
  text: string,
  tier?: number,
  tags: string[] = [],
): Modifier {
  return {
    id,
    text,
    kind: "explicit",
    affix,
    values: [],
    verified: false,
    tags,
    ...(tier === undefined ? {} : { tier }),
  };
}

function item(id: string, patch: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    itemClass: "Crossbows",
    baseType: "Crossbow",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    modifiers: [],
    craftingState: cleanState,
    sources: [],
    ...patch,
  };
}

const magic = item("magic", {
  rarity: "magic",
  modifiers: [mod("p1", "prefix", "+20 to physical damage", 1, ["damage", "physical"])],
});
const fullRare = item("full", {
  modifiers: [
    mod("p1", "prefix", "Adds fire damage", 1, ["damage", "fire"]),
    mod("p2", "prefix", "Adds cold damage", 2, ["damage", "cold"]),
    mod("p3", "prefix", "Adds lightning damage", 4, ["damage", "lightning"]),
    mod("s1", "suffix", "+10% attack speed", 1, ["speed"]),
    mod("s2", "suffix", "+40 to life", undefined, ["life"]),
    mod("s3", "suffix", "+20% fire resistance", 3, ["resistance"]),
  ],
});
const ids = (current: Item) => current.modifiers.map((modifier) => modifier.text);

describe("Taller avanzado en inglés", () => {
  it("nombra las categorías del objetivo en inglés sin tocar las españolas", () => {
    expect(CRAFTING_GOAL_LABELS_EN.defence).toBe("Defence or survival");
    expect(craftingGoalLabel("damage", "en")).toBe("Damage");
    expect(craftingGoalLabel("damage")).toBe(CRAFTING_GOAL_LABELS.damage);
    expect(Object.keys(CRAFTING_GOAL_LABELS_EN)).toEqual(Object.keys(CRAFTING_GOAL_LABELS));
  });

  it("el detector de español distingue las dos versiones", () => {
    const es = evaluateCraftingGoalSignal("damage", magic.modifiers);
    expect(strings(es).some((text) => SPANISH.test(text))).toBe(true);
  });

  it("lee la señal del objetivo en inglés", () => {
    const signal = evaluateCraftingGoalSignal("damage", magic.modifiers, "en");
    expect(signal.status).toBe("direct");
    expect(signal.title).toBe("Direct damage signal");
    expectEnglish(signal);
    expectEnglish(evaluateCraftingGoalSignal("other", [], "en"));
    expectEnglish(evaluateCraftingGoalSignal("speed", [], "en"));
    expectEnglish(evaluateCraftingGoalSignal("speed", magic.modifiers, "en"));
  });

  it("escribe las condiciones de parada y su evaluación en inglés", () => {
    const criteria: CraftingSuccessCriterion[] = [
      { kind: "goal-affix-count", category: "damage", minimumCount: 2 },
      { kind: "exact-modifier-text", text: "Adds fire damage", maximumTier: 1 },
      { kind: "explicit-count", minimumCount: 1 },
    ];
    expect(criteria.map((criterion) => craftingSuccessCriterionLabel(criterion, "en"))).toEqual([
      "At least 2 damage affixes",
      "Must show: Adds fire damage (tier 1 or better)",
      "Reach 1 explicit affix",
    ]);
    const done = evaluateCraftingSuccessCriteria({ criteria, resultItem: fullRare }, "en");
    expect(done.status).toBe("fulfilled");
    expect(done.title).toBe("You've reached your stop point");
    expectEnglish(done, ids(fullRare));

    const pending = evaluateCraftingSuccessCriteria({
      criteria: [
        { kind: "goal-affix-count", category: "defence", minimumCount: 5 },
        { kind: "exact-modifier-text", text: "Adds cold damage", maximumTier: 1 },
        { kind: "explicit-count", minimumCount: 6 },
      ],
      resultItem: magic,
    }, "en");
    expect(pending.status).toBe("not-fulfilled");
    expectEnglish(pending, ["Adds cold damage"]);
    expectEnglish(evaluateCraftingSuccessCriteria({ criteria: [], resultItem: magic }, "en"));
  });

  it("explica la evidencia del objetivo en inglés con los mismos estados", () => {
    for (const coverage of ["available-complete", "available-partial", "unavailable", "unknown"] as const) {
      const es = buildCraftingTargetEvidence({
        selectedItem: magic,
        items: [magic, fullRare],
        goalCategory: "damage",
        successCriteria: [{ kind: "goal-affix-count", category: "damage", minimumCount: 3 }],
        modPoolCoverage: coverage,
      });
      const en = buildCraftingTargetEvidence({
        selectedItem: magic,
        items: [magic, fullRare],
        goalCategory: "damage",
        successCriteria: [{ kind: "goal-affix-count", category: "damage", minimumCount: 3 }],
        modPoolCoverage: coverage,
      }, "en");
      expect(en.status).toBe(es.status);
      expect(en.observations).toEqual(es.observations);
      expect(en.fulfilledItemIds).toEqual(es.fulfilledItemIds);
      expectEnglish({ headline: en.headline, summary: en.summary, limitations: en.limitations });
    }
  });

  it("valora los afijos en inglés con los mismos conteos", () => {
    const es = assessCraftingAffixes(fullRare, "damage", ["p1"]);
    const en = assessCraftingAffixes(fullRare, "damage", ["p1"], "en");
    expect(en.alignedCount).toBe(es.alignedCount);
    expect(en.entries.map((entry) => entry.kind)).toEqual(es.entries.map((entry) => entry.kind));
    expect(en.headline).toBe("3 affixes point to damage");
    expect(en.entries[0]?.label).toBe("Protect first");
    expectEnglish({
      headline: en.headline,
      summary: en.summary,
      limitations: en.limitations,
      entries: en.entries.map((entry) => [entry.label, entry.reason]),
    });
  });

  it("evalúa Alloys y Essences en inglés sin cambiar el estado", () => {
    const plan: AlloyPlanInput = {
      alloyName: "Transcendent Alloy",
      fullTooltipText: "Full tooltip text here",
      guaranteedModifierText: "+1 crafted line",
      declaredItemClasses: ["Crossbows"],
      playerConfirmedClassApplies: true,
      removalSelection: "random",
    };
    const alloyEs = evaluateAlloyPlan(fullRare, plan);
    const alloyEn = evaluateAlloyPlan(fullRare, plan, "en");
    expect(alloyEn.status).toBe(alloyEs.status);
    expect(alloyEn.reason).toBe(
      "The evidence you entered fits, but any of the 6 current explicit modifiers can be replaced.",
    );
    expectEnglish(evaluateAlloyPlan(item("c", { craftingState: { ...cleanState, corrupted: true } }), plan, "en"));
    expectEnglish(evaluateAlloyPlan(fullRare, { ...plan, declaredItemClasses: [] }, "en"));
    expectEnglish(Object.values(ALLOY_REMOVAL_LABELS_EN));
    expectEnglish(ALLOY_RESULT_UNKNOWN_LABEL_EN);

    const essenceEn = evaluateEssencePlan(magic, {
      tier: "greater",
      essenceName: "Greater Essence of Battle",
      guaranteedModifierText: "+10% accuracy",
    }, "en");
    expect(essenceEn.status).toBe("compatible");
    expectEnglish(essenceEn);
    expectEnglish(evaluateEssencePlan(magic, { tier: "perfect", essenceName: "", guaranteedModifierText: "" }, "en"));
    expectEnglish(evaluateEssencePlan(fullRare, { tier: "perfect", essenceName: "x", guaranteedModifierText: "" }, "en"));
    expect(ESSENCE_TIER_LABELS_EN.greater).toBe("Greater");
    expectEnglish(ESSENCE_RESULT_UNKNOWN_LABEL_EN);
  });

  it("explica la protección en inglés", () => {
    for (const removalSelection of ["none", "random", "player-selected", "unspecified"] as const) {
      for (const removed of [0, 1, 6]) {
        const es = evaluateCraftingProtection({
          item: fullRare,
          protectedModifierIds: ["p1"],
          removedModifierCount: removed,
          removalSelection,
        });
        const en = evaluateCraftingProtection({
          item: fullRare,
          protectedModifierIds: ["p1"],
          removedModifierCount: removed,
          removalSelection,
        }, "en");
        expect(en.status).toBe(es.status);
        expectEnglish(en.reason);
      }
    }
    expectEnglish(evaluateCraftingProtection({
      item: fullRare,
      protectedModifierIds: ["gone"],
      removedModifierCount: 1,
      removalSelection: "random",
    }, "en").reason);
  });

  it("usa los nombres oficiales de las monedas en la ruta y el plan", () => {
    const evaluations = evaluateObservedCraftingActions(magic, OBSERVED_CRAFTING_ACTIONS, "en");
    const diagnosis = diagnoseCraftingItem(magic, "en");
    const route = buildCraftingRoute(magic, diagnosis, evaluations, "en");
    expect(route.currencyActions.map((action) => action.label)).toEqual([
      "Orb of Augmentation",
      "Regal Orb",
    ]);
    expectEnglish(route);

    const blueprint = buildExpertCraftingBlueprint({
      item: magic,
      diagnosis,
      evaluations,
      route,
      objective: "Final crossbow",
      protectedModifierIds: ["p1"],
      successCriteria: [{ kind: "explicit-count", minimumCount: 3 }],
      budget: { amount: 50, currency: "exalted" },
    }, "en");
    expect(blueprint.headline).toBe("Orb of Augmentation");
    expect(blueprint.budgetLabel).toBe("50 exalted");
    expect(blueprint.stopConditions).toEqual(["Reach 3 explicit affixes"]);
    expectEnglish(blueprint, ids(magic));

    const full = buildCraftingRoute(fullRare, diagnoseCraftingItem(fullRare, "en"),
      evaluateObservedCraftingActions(fullRare, OBSERVED_CRAFTING_ACTIONS, "en"), "en");
    expect(full.state).toBe("replacement-tools");
    expectEnglish(full);
    expectEnglish(buildExpertCraftingBlueprint({
      item: fullRare,
      diagnosis: diagnoseCraftingItem(fullRare, "en"),
      evaluations: evaluateObservedCraftingActions(fullRare, OBSERVED_CRAFTING_ACTIONS, "en"),
      route: full,
      objective: "",
      protectedModifierIds: [],
      successCriteria: [],
    }, "en"), ids(fullRare));
  });

  it("traduce acciones, variantes y evidencia por id", () => {
    const [transmutation, augmentation] = OBSERVED_CRAFTING_ACTIONS;
    expect(craftingActionLabel(transmutation!, "en")).toBe("Orb of Transmutation");
    expect(craftingActionLabel(transmutation!)).toBe(transmutation!.label);
    expect(craftingActionEffect(augmentation!, "en")).toBe("Adds 1 random modifier to a magic item.");
    const greater = augmentation!.variants.find((variant) => variant.id === "greater")!;
    expect(craftingVariantLabel(greater, "en")).toBe("Greater");
    expect(craftingCurrencyLabelFor(augmentation!, greater, "en")).toBe("Greater Orb of Augmentation");
    expect(craftingActionEvidence(augmentation!, "en")).toMatch(/^Observed tooltip: /);
    expect(craftingActionEvidence(augmentation!)).toBe(augmentation!.evidence);
  });

  it("compara bases en inglés con los mismos estados", () => {
    const profile: CharacterProfile = {
      id: "p",
      name: "Archer",
      characterClass: "Ranger",
      ascendancy: null,
      ascendancyId: null,
      level: 30,
      levelSource: "observed",
      archetype: null,
      league: "Test",
      patch: "test",
      items: [],
      skills: [],
      passives: { allocated: [] },
      attributes: { str: 10, dex: null, int: 30 },
      resistances: { fire: null, cold: null, lightning: null, chaos: null },
      sources: [],
      importedAt: "2026-08-26T00:00:00.000Z",
    };
    const needy = item("needy", { requirements: { level: 60, str: 50, dex: 20 }, modifiers: fullRare.modifiers });
    const comparison = compareCraftingBases({
      selectedItem: magic,
      items: [magic, fullRare, needy],
      profile,
      goalCategory: "damage",
    });
    expect(craftingBaseComparisonLabel(comparison, magic, "en")).toBe("Same class: Crossbows");
    expect(craftingBaseComparisonLabel(comparison, magic)).toBe(comparison.comparisonLabel);
    const needyText = craftingBaseCandidateText(
      comparison.candidates.find((candidate) => candidate.item.id === "needy")!,
      profile,
      "en",
    );
    expect(needyText).toEqual({
      statusLabel: "Requirements not met",
      structuralLabel: "No open slots seen",
      requirementLabel: "Not met: level 30/60 · Str 10/50",
    });
    for (const candidate of comparison.candidates) {
      expect(craftingBaseCandidateText(candidate, profile)).toEqual({
        statusLabel: candidate.statusLabel,
        structuralLabel: candidate.structuralLabel,
        requirementLabel: candidate.requirementLabel,
      });
      expectEnglish(craftingBaseCandidateText(candidate, profile, "en"));
      expectEnglish(craftingBaseCandidateText(candidate, null, "en"));
    }
  });

  it("traduce las etiquetas del recorrido y la lectura del mentor", () => {
    expect(craftingBuildIntentLabel({
      source: "none",
      alignment: "unknown",
      focuses: [],
      suggestedCategories: [],
    }, "en")).toBe("no proven priority");
    expect(craftingBuildIntentLabel({
      source: "target",
      alignment: "aligned",
      focuses: ["fire", "maximum-life"],
      suggestedCategories: ["damage", "defence"],
    }, "en")).toBe("fire damage · maximum life");
    expect(craftingLaboratoryRouteLabel({
      diagnosisState: "complete",
      objectiveReady: true,
      successCriteriaReady: true,
      stopAlreadyReached: false,
    }, "en")).toBe("Ready");
    expect(craftingLaboratoryRouteLabel({
      diagnosisState: "partial",
      objectiveReady: true,
      successCriteriaReady: true,
      stopAlreadyReached: false,
    }, "en")).toBe("Blocked");

    for (const goal of ["damage", "defence", "other"] as const) {
      for (const current of [magic, fullRare]) {
        const es = buildCraftingMentorReading(current, diagnoseCraftingItem(current), goal);
        const en = buildCraftingMentorReading(current, diagnoseCraftingItem(current), goal, "en");
        expect(en.verdict).toBe(es.verdict);
        expectEnglish([en.verdictLabel, en.verdictDetail]);
      }
    }
  });
});

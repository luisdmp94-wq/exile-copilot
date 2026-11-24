import type { Item, Modifier } from "@shared/domain.js";
import type { CraftingItemDiagnosis } from "@shared/craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";

export interface CraftingMentorReading {
  verdict: "wait" | "define" | "protect" | "controlled-test" | "review";
  verdictLabel: string;
  verdictDetail: string;
  matchingModifiers: Modifier[];
  unmatchedModifiers: Modifier[];
  protectCandidates: Modifier[];
}

/**
 * Lectura conservadora del objeto. "A favor" significa coincidencia literal
 * de tags con el objetivo; nunca equivale a DPS, valor de mercado o garantía.
 */
export function buildCraftingMentorReading(
  item: Item,
  diagnosis: CraftingItemDiagnosis,
  goalCategory: CraftingGoalCategory,
  lang: "es" | "en" = "es",
): CraftingMentorReading {
  const en = lang === "en";
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const matchingModifiers = explicit.filter(
    (modifier) => evaluateCraftingGoalSignal(goalCategory, [modifier]).status === "direct",
  );
  const unmatchedModifiers =
    goalCategory === "other"
      ? []
      : explicit.filter(
          (modifier) => evaluateCraftingGoalSignal(goalCategory, [modifier]).status !== "direct",
        );
  const protectCandidates = explicit.filter(
    (modifier) => modifier.tier !== undefined && modifier.tier <= 2,
  );

  if (diagnosis.state !== "complete") {
    return {
      verdict: "wait",
      verdictLabel: en ? "Wait" : "Espera",
      verdictDetail: en ? "Some data is missing before you spend." : "Faltan datos antes de gastar.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (goalCategory === "other") {
    return {
      verdict: "define",
      verdictLabel: en ? "Set the goal" : "Define el objetivo",
      verdictDetail: en
        ? "Without a goal I can't tell progress from noise."
        : "Sin saber qué buscas no puedo decir si la pieza va bien.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (diagnosis.observedOpenSlots === 0) {
    return {
      verdict: "protect",
      verdictLabel: en
        ? protectCandidates.length > 0 ? "Don't risk it yet" : "Item is full"
        : protectCandidates.length > 0 ? "No arriesgues aún" : "Pieza llena",
      verdictDetail: en
        ? protectCandidates.length > 0
          ? `${protectCandidates.length} tier 1–2 modifier${protectCandidates.length === 1 ? "" : "s"} could be at risk.`
          : "To go on you would have to replace, not add."
        : protectCandidates.length > 0
          ? `${protectCandidates.length} afijo${protectCandidates.length === 1 ? "" : "s"} de grado 1–2 puede${protectCandidates.length === 1 ? "" : "n"} quedar en riesgo.`
          : "Ya no cabe nada: para seguir habría que cambiar una línea por otra.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (matchingModifiers.length > 0) {
    return {
      verdict: "controlled-test",
      verdictLabel: en ? "Controlled test" : "Prueba controlada",
      verdictDetail: en
        ? `${matchingModifiers.length} modifier${matchingModifiers.length === 1 ? " already fits" : "s already fit"} your goal.`
        : `${matchingModifiers.length} mod(s) ya encajan con tu objetivo.`,
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  return {
    verdict: "review",
    verdictLabel: en ? "Check first" : "Revisa primero",
    verdictDetail: en
      ? "Nothing matches your goal directly."
      : "Ninguna línea es de lo que buscas.",
    matchingModifiers,
    unmatchedModifiers,
    protectCandidates,
  };
}

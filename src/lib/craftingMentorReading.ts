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
): CraftingMentorReading {
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
      verdictLabel: "Espera",
      verdictDetail: "Faltan datos antes de gastar.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (goalCategory === "other") {
    return {
      verdict: "define",
      verdictLabel: "Define el objetivo",
      verdictDetail: "Sin objetivo no puedo separar progreso de ruido.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (diagnosis.observedOpenSlots === 0) {
    return {
      verdict: "protect",
      verdictLabel: protectCandidates.length > 0 ? "No arriesgues aún" : "Pieza llena",
      verdictDetail:
        protectCandidates.length > 0
          ? `${protectCandidates.length} afijo${protectCandidates.length === 1 ? "" : "s"} de grado 1–2 puede${protectCandidates.length === 1 ? "" : "n"} quedar en riesgo.`
          : "Para continuar habría que reemplazar, no añadir.",
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  if (matchingModifiers.length > 0) {
    return {
      verdict: "controlled-test",
      verdictLabel: "Prueba controlada",
      verdictDetail: `${matchingModifiers.length} mod(s) ya encajan con tu objetivo.`,
      matchingModifiers,
      unmatchedModifiers,
      protectCandidates,
    };
  }
  return {
    verdict: "review",
    verdictLabel: "Revisa primero",
    verdictDetail: "No hay una coincidencia literal con tu objetivo.",
    matchingModifiers,
    unmatchedModifiers,
    protectCandidates,
  };
}

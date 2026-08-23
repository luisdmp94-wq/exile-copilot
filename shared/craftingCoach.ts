import type { CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import type { CraftingGoalCategory } from "./craftingGoal.js";
import type { CraftingRoute } from "./craftingRoute.js";

export type CraftingCoachStage =
  | "needs-data"
  | "choose-goal"
  | "choose-stop"
  | "ready-currency"
  | "choose-currency"
  | "replacement"
  | "blocked";

export interface CraftingCoachStep {
  stage: CraftingCoachStage;
  step: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  detail: string;
}

/**
 * Reduce el banco a la próxima decisión que el jugador puede tomar ahora.
 * No decide si un objeto es bueno ni ordena resultados aleatorios: solo
 * organiza diagnóstico, intención, parada y compatibilidad ya calculados.
 */
export function buildCraftingCoachStep(input: {
  diagnosis: CraftingItemDiagnosis;
  route: CraftingRoute;
  goalCategory: CraftingGoalCategory;
  successCriteriaReady: boolean;
}): CraftingCoachStep {
  const { diagnosis, route, goalCategory, successCriteriaReady } = input;

  if (diagnosis.state !== "complete" || route.state === "needs-data") {
    return {
      stage: "needs-data",
      step: 1,
      eyebrow: "Antes de gastar",
      title: "Necesito leer mejor esta pieza",
      detail: diagnosis.nextAction,
    };
  }

  if (goalCategory === "other") {
    return {
      stage: "choose-goal",
      step: 1,
      eyebrow: "Paso 1 de 3 · Objetivo",
      title: "¿Qué quieres mejorar?",
      detail: "Elige una dirección. No hace falta conocer mods ni recetas para continuar.",
    };
  }

  if (!successCriteriaReady) {
    return {
      stage: "choose-stop",
      step: 2,
      eyebrow: "Paso 2 de 3 · Parada",
      title: "Decide cuándo dejar de gastar",
      detail: "Usaremos una señal visible en el texto del objeto; no una valoración inventada.",
    };
  }

  if (route.state === "single-currency") {
    return {
      stage: "ready-currency",
      step: 3,
      eyebrow: "Paso 3 de 3 · Acción",
      title: route.headline,
      detail: route.summary,
    };
  }

  if (route.state === "currency-choice") {
    return {
      stage: "choose-currency",
      step: 3,
      eyebrow: "Paso 3 de 3 · Acción",
      title: "Elige qué etapa quieres probar",
      detail: route.summary,
    };
  }

  if (route.state === "replacement-tools") {
    return {
      stage: "replacement",
      step: 3,
      eyebrow: "Paso 3 de 3 · Pieza llena",
      title: "Para seguir tendrías que reemplazar",
      detail: route.summary,
    };
  }

  return {
    stage: "blocked",
    step: 3,
    eyebrow: "No gastes todavía",
    title: "No hay un paso confirmado",
    detail: route.summary,
  };
}

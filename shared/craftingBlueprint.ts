import type {
  CraftingActionEvaluation,
  CraftingActionId,
} from "./craftingActions.js";
import type { CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import { EXPECTED_RESULT_RARITY } from "./craftingComparison.js";
import type { CraftingRoute } from "./craftingRoute.js";
import {
  craftingSuccessCriterionLabel,
  evaluateCraftingSuccessCriteria,
  type CraftingSuccessCriterion,
} from "./craftingSuccessCriteria.js";
import type { Item } from "./domain.js";

export type ExpertCraftingBlueprintStatus =
  | "needs-item-data"
  | "needs-objective"
  | "needs-stop"
  | "already-complete"
  | "needs-route-data"
  | "ready";

export type ExpertRouteRisk = "controlled" | "stage-change" | "replacement";

export interface ExpertCraftingRouteCandidate {
  id: CraftingActionId | "essence" | "alloy";
  label: string;
  availability: "legal" | "needs-tooltip";
  effect: string;
  preserves: string;
  consequence: string;
  uncertainty: string;
  risk: ExpertRouteRisk;
  recommended: boolean;
  recommendationReason: string | null;
}

export interface ExpertCraftingBlueprint {
  status: ExpertCraftingBlueprintStatus;
  eyebrow: string;
  headline: string;
  nextAction: string;
  objective: string | null;
  protectedLines: string[];
  stopConditions: string[];
  routes: ExpertCraftingRouteCandidate[];
  recommendedRouteId: ExpertCraftingRouteCandidate["id"] | null;
  limitations: string[];
}

function legalCurrencyCandidates(
  item: Item,
  evaluations: readonly CraftingActionEvaluation[],
): ExpertCraftingRouteCandidate[] {
  const legal = evaluations.filter((entry) => entry.status === "compatible");
  const legalIds = new Set(legal.map((entry) => entry.action.id));
  const augmentationBeforeRegal = legalIds.has("augmentation") && legalIds.has("regal");

  return legal.map((entry) => {
    const { action } = entry;
    const resultingRarity = EXPECTED_RESULT_RARITY[action.id];
    const stageChanges = resultingRarity !== item.rarity;
    const recommended =
      legal.length === 1 || (augmentationBeforeRegal && action.id === "augmentation");
    const preserves =
      action.id === "transmutation"
        ? "La base no tiene líneas explícitas que proteger."
        : "La acción observada añade una línea; no declara reemplazar las actuales.";

    let consequence = `La rareza se mantiene como ${resultingRarity === "rare" ? "rara" : "mágica"}.`;
    if (action.id === "transmutation") {
      consequence = "La base pasa de normal a mágica y entra en la siguiente etapa del craft.";
    } else if (action.id === "augmentation") {
      consequence = "Mantiene la pieza mágica y conserva Regio como decisión posterior.";
    } else if (action.id === "regal") {
      consequence = "La pieza pasa a rara; después ya no podrás usar Aumento sobre ella.";
    } else if (action.id === "exalted") {
      consequence = "Ocupa uno de los huecos explícitos que todavía quedan en la pieza rara.";
    }

    return {
      id: action.id,
      label: action.label,
      availability: "legal" as const,
      effect: action.effect,
      preserves,
      consequence,
      uncertainty: "El modificador nuevo es aleatorio; esta acción no garantiza tu condición de parada.",
      risk: stageChanges ? "stage-change" as const : "controlled" as const,
      recommended,
      recommendationReason: recommended
        ? augmentationBeforeRegal && action.id === "augmentation"
          ? "Primero conserva la etapa mágica; Regio seguirá disponible después."
          : "Es la única acción básica legal demostrada desde este estado."
        : null,
    };
  });
}

function replacementCandidates(route: CraftingRoute): ExpertCraftingRouteCandidate[] {
  return route.toolSuggestions.map((tool) => ({
    id: tool,
    label: tool === "essence" ? "Essence" : "Alloy",
    availability: "needs-tooltip" as const,
    effect: "Puede añadir una línea garantizada reemplazando otra línea de la pieza.",
    preserves: "No se puede prometer que conserve tus líneas intocables hasta leer el tooltip real.",
    consequence: "La ruta implica reemplazo; el resultado anterior no se puede reconstruir desde la app.",
    uncertainty: "Faltan el efecto exacto, la compatibilidad y la línea que podría desaparecer.",
    risk: "replacement" as const,
    recommended: false,
    recommendationReason: null,
  }));
}

/**
 * Convierte las decisiones ya observadas del laboratorio en un contrato de
 * fabricación compacto. No añade recetas, pesos, precios ni valoraciones de
 * build: ordena únicamente consecuencias estructurales demostradas.
 */
export function buildExpertCraftingBlueprint(input: {
  item: Item;
  diagnosis: CraftingItemDiagnosis;
  evaluations: readonly CraftingActionEvaluation[];
  route: CraftingRoute;
  objective: string;
  protectedModifierIds: readonly string[];
  successCriteria: readonly CraftingSuccessCriterion[];
}): ExpertCraftingBlueprint {
  const objective = input.objective.trim();
  const explicitById = new Map(
    input.item.modifiers
      .filter((modifier) => modifier.kind === "explicit")
      .map((modifier) => [modifier.id, modifier.text]),
  );
  const protectedLines = [...new Set(input.protectedModifierIds)]
    .map((id) => explicitById.get(id))
    .filter((text): text is string => text !== undefined);
  const validStopConditions = input.successCriteria.filter(
    (criterion) =>
      criterion.kind !== "exact-modifier-text" || criterion.text.trim().length >= 3,
  );
  const stopConditions = validStopConditions.map(craftingSuccessCriterionLabel);
  const currentAssessment = evaluateCraftingSuccessCriteria({
    criteria: validStopConditions,
    resultItem: input.item,
  });
  const routes = [
    ...legalCurrencyCandidates(input.item, input.evaluations),
    ...replacementCandidates(input.route),
  ];
  const recommendedRoute = routes.find((candidate) => candidate.recommended) ?? null;

  const common = {
    objective: objective.length >= 3 ? objective : null,
    protectedLines,
    stopConditions,
    routes,
    recommendedRouteId: recommendedRoute?.id ?? null,
    limitations: [
      "Sin un pool exhaustivo no se calculan probabilidades ni intentos esperados.",
      "El plan compara cambios estructurales; no estima DPS ni el valor de mercado de la pieza.",
    ],
  };

  if (input.diagnosis.state !== "complete") {
    return {
      ...common,
      status: "needs-item-data",
      eyebrow: "Plan bloqueado",
      headline: "Completa primero la lectura de la pieza",
      nextAction: input.diagnosis.nextAction,
    };
  }
  if (objective.length < 3) {
    return {
      ...common,
      status: "needs-objective",
      eyebrow: "Falta el destino",
      headline: "Define qué resultado estás persiguiendo",
      nextAction: "Elige una categoría o describe el resultado final antes de comparar monedas.",
    };
  }
  if (stopConditions.length === 0) {
    return {
      ...common,
      status: "needs-stop",
      eyebrow: "Falta la salida",
      headline: "Decide cuándo dejarás de gastar",
      nextAction: "Añade al menos una condición que puedas comprobar en el siguiente texto pegado.",
    };
  }
  if (currentAssessment.status === "fulfilled") {
    return {
      ...common,
      status: "already-complete",
      eyebrow: "Craft terminado",
      headline: "La pieza ya cumple tu contrato de salida",
      nextAction: "No gastes otra moneda para perseguir estas mismas condiciones.",
    };
  }
  if (routes.length === 0) {
    return {
      ...common,
      status: "needs-route-data",
      eyebrow: "Sin ruta demostrada",
      headline: "No hay una primera acción confirmada",
      nextAction: "Revisa los bloqueos o vuelve a pegar el objeto antes de gastar.",
    };
  }
  return {
    ...common,
    status: "ready",
    eyebrow: recommendedRoute ? "Primera acción conservadora" : "Decisión manual necesaria",
    headline: recommendedRoute?.label ?? "Compara las rutas antes de elegir",
    nextAction:
      recommendedRoute?.recommendationReason ??
      "Ninguna ruta domina a las demás con la evidencia disponible; elige qué riesgo aceptar.",
  };
}

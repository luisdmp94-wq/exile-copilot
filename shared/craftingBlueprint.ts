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
import type { Budget, Item } from "./domain.js";

export type ExpertCraftingBlueprintStatus =
  | "needs-item-data"
  | "needs-objective"
  | "needs-stop"
  | "already-complete"
  | "needs-route-data"
  | "ready";

export type ExpertRouteRisk = "controlled" | "stage-change" | "replacement";

export type ExpertCraftingProjectPhase =
  | "blocked"
  | "base"
  | "foundation"
  | "finishing"
  | "recovery"
  | "finished";

export type ExpertCraftingBaseDecisionKind =
  | "hold"
  | "continue"
  | "recover"
  | "change-base"
  | "stop";

export interface ExpertCraftingProjectBranch {
  id: "success" | "salvage" | "failure";
  label: string;
  trigger: string;
  response: string;
}

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
  projectPhase: ExpertCraftingProjectPhase;
  baseDecision: {
    kind: ExpertCraftingBaseDecisionKind;
    label: string;
    detail: string;
  };
  branches: ExpertCraftingProjectBranch[];
  budgetLabel: string | null;
  limitations: string[];
}

const BUDGET_CURRENCY_LABEL: Record<Budget["currency"], string> = {
  chaos: "caos",
  exalted: "exaltados",
  divine: "divinos",
  gold: "oro",
};

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
  budget?: Budget;
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
  const projectPhase: ExpertCraftingProjectPhase =
    input.diagnosis.state !== "complete"
      ? "blocked"
      : currentAssessment.status === "fulfilled"
        ? "finished"
        : input.item.rarity === "normal"
          ? "base"
          : input.item.rarity === "magic"
            ? "foundation"
            : input.route.state === "replacement-tools"
              ? "recovery"
              : "finishing";
  const baseDecision: ExpertCraftingBlueprint["baseDecision"] =
    input.diagnosis.state !== "complete"
      ? {
          kind: "hold",
          label: "No invertir todavía",
          detail: input.diagnosis.nextAction,
        }
      : currentAssessment.status === "fulfilled"
        ? {
            kind: "stop",
            label: "Conservar esta pieza",
            detail: "El contrato observable ya está cumplido; otra acción solo añadiría riesgo.",
          }
        : routes.length === 0
          ? {
              kind: "change-base",
              label: "Cambiar de base",
              detail: "No existe una primera acción demostrada desde el estado actual.",
            }
          : input.route.state === "replacement-tools"
            ? {
                kind: "recover",
                label: "Decidir si merece recuperación",
                detail: "La pieza está llena: continuar exige leer una herramienta de reemplazo y aceptar qué línea puede perderse.",
              }
            : {
                kind: "continue",
                label: "La base puede continuar",
                detail: recommendedRoute
                  ? `Hay una primera acción conservadora demostrada: ${recommendedRoute.label}.`
                  : "Hay rutas legales, pero ninguna domina con la evidencia disponible.",
              };
  const branches: ExpertCraftingProjectBranch[] = [
    {
      id: "success",
      label: "Si sale bien",
      trigger: stopConditions.length > 0
        ? "El resultado cumple todas las condiciones de parada."
        : "El resultado alcanza el final que definas.",
      response: "Detener el gasto, conservar el resultado y compararlo con tu equipo antes de llamarlo mejora.",
    },
    {
      id: "salvage",
      label: "Si es aprovechable",
      trigger: "Conserva lo intocable o mejora la dirección, pero todavía no cumple el contrato.",
      response: "Pegar el resultado y recalcular la fase. El proyecto mantiene objetivo, protecciones y parada.",
    },
    {
      id: "failure",
      label: "Si falla",
      trigger: protectedLines.length > 0
        ? "Pierde una línea protegida, agota la ruta o el resultado deja de justificar la base."
        : "Agota la ruta o el resultado deja de justificar la base.",
      response: "Parar. Evaluar recuperación con el tooltip real o cambiar de base; nunca encadenar otra moneda por inercia.",
    },
  ];

  const common = {
    objective: objective.length >= 3 ? objective : null,
    protectedLines,
    stopConditions,
    routes,
    recommendedRouteId: recommendedRoute?.id ?? null,
    projectPhase,
    baseDecision,
    branches,
    budgetLabel: input.budget
      ? `${input.budget.amount} ${BUDGET_CURRENCY_LABEL[input.budget.currency]}`
      : null,
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

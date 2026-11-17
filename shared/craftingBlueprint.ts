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
import { craftingActionEffect, craftingActionLabel } from "./craftingWorkshopText.js";

type Lang = "es" | "en";

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

const BUDGET_CURRENCY_LABEL_EN: Record<Budget["currency"], string> = {
  chaos: "chaos",
  exalted: "exalted",
  divine: "divine",
  gold: "gold",
};

function legalCurrencyCandidates(
  item: Item,
  evaluations: readonly CraftingActionEvaluation[],
  lang: Lang,
): ExpertCraftingRouteCandidate[] {
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
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
        ? t(
            "La base no tiene líneas explícitas que proteger.",
            "The base has no explicit lines to protect.",
          )
        : t(
            "La acción observada añade una línea; no declara reemplazar las actuales.",
            "This action adds a line; it doesn't say it replaces the current ones.",
          );

    let consequence = t(
      `La rareza se mantiene como ${resultingRarity === "rare" ? "rara" : "mágica"}.`,
      `The item stays ${resultingRarity === "rare" ? "rare" : "magic"}.`,
    );
    if (action.id === "transmutation") {
      consequence = t(
        "La base pasa de normal a mágica y entra en la siguiente etapa del craft.",
        "The base goes from normal to magic and enters the next stage of the craft.",
      );
    } else if (action.id === "augmentation") {
      consequence = t(
        "Mantiene la pieza mágica y conserva Regio como decisión posterior.",
        "Keeps the item magic and leaves the Regal Orb as a later decision.",
      );
    } else if (action.id === "regal") {
      consequence = t(
        "La pieza pasa a rara; después ya no podrás usar Aumento sobre ella.",
        "The item becomes rare; after that you can't use an Orb of Augmentation on it.",
      );
    } else if (action.id === "exalted") {
      consequence = t(
        "Ocupa uno de los huecos explícitos que todavía quedan en la pieza rara.",
        "Fills one of the explicit slots still open on the rare item.",
      );
    }

    return {
      id: action.id,
      label: craftingActionLabel(action, lang),
      availability: "legal" as const,
      effect: craftingActionEffect(action, lang),
      preserves,
      consequence,
      uncertainty: t(
        "El modificador nuevo es aleatorio; esta acción no garantiza tu condición de parada.",
        "The new modifier is random; this action doesn't guarantee your stop condition.",
      ),
      risk: stageChanges ? "stage-change" as const : "controlled" as const,
      recommended,
      recommendationReason: recommended
        ? augmentationBeforeRegal && action.id === "augmentation"
          ? t(
              "Primero conserva la etapa mágica; Regio seguirá disponible después.",
              "Stay at the magic stage first; the Regal Orb will still be there later.",
            )
          : t(
              "Es la única acción básica legal demostrada desde este estado.",
              "It's the only basic legal action proven from this state.",
            )
        : null,
    };
  });
}

function replacementCandidates(route: CraftingRoute, lang: Lang): ExpertCraftingRouteCandidate[] {
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
  return route.toolSuggestions.map((tool) => ({
    id: tool,
    label: tool === "essence" ? "Essence" : "Alloy",
    availability: "needs-tooltip" as const,
    effect: t(
      "Puede añadir una línea garantizada reemplazando otra línea de la pieza.",
      "It can add a guaranteed line by replacing another line on the item.",
    ),
    preserves: t(
      "No se puede prometer que conserve tus líneas intocables hasta leer el tooltip real.",
      "There's no promise it keeps your must-keep lines until the real tooltip is read.",
    ),
    consequence: t(
      "La ruta implica reemplazo; el resultado anterior no se puede reconstruir desde la app.",
      "This route replaces something; the app can't rebuild the previous result.",
    ),
    uncertainty: t(
      "Faltan el efecto exacto, la compatibilidad y la línea que podría desaparecer.",
      "The exact effect, compatibility and the line that could disappear are still missing.",
    ),
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
}, lang: Lang = "es"): ExpertCraftingBlueprint {
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
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
  const stopConditions = validStopConditions.map((criterion) =>
    craftingSuccessCriterionLabel(criterion, lang),
  );
  const currentAssessment = evaluateCraftingSuccessCriteria({
    criteria: validStopConditions,
    resultItem: input.item,
  });
  const routes = [
    ...legalCurrencyCandidates(input.item, input.evaluations, lang),
    ...replacementCandidates(input.route, lang),
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
          label: t("No invertir todavía", "Don't invest yet"),
          detail: input.diagnosis.nextAction,
        }
      : currentAssessment.status === "fulfilled"
        ? {
            kind: "stop",
            label: t("Conservar esta pieza", "Keep this item"),
            detail: t(
              "El contrato observable ya está cumplido; otra acción solo añadiría riesgo.",
              "Your plan is already met; another action would only add risk.",
            ),
          }
        : routes.length === 0
          ? {
              kind: "change-base",
              label: t("Cambiar de base", "Change base"),
              detail: t(
                "No existe una primera acción demostrada desde el estado actual.",
                "There's no proven first action from the current state.",
              ),
            }
          : input.route.state === "replacement-tools"
            ? {
                kind: "recover",
                label: t("Decidir si merece recuperación", "Decide if it's worth saving"),
                detail: t(
                  "La pieza está llena: continuar exige leer una herramienta de reemplazo y aceptar qué línea puede perderse.",
                  "The item is full: going on means reading a replacement tool and accepting which line could be lost.",
                ),
              }
            : {
                kind: "continue",
                label: t("La base puede continuar", "The base can go on"),
                detail: recommendedRoute
                  ? t(
                      `Hay una primera acción conservadora demostrada: ${recommendedRoute.label}.`,
                      `There's a proven safe first action: ${recommendedRoute.label}.`,
                    )
                  : t(
                      "Hay rutas legales, pero ninguna domina con la evidencia disponible.",
                      "There are legal routes, but none clearly wins with the evidence you have.",
                    ),
              };
  const branches: ExpertCraftingProjectBranch[] = [
    {
      id: "success",
      label: t("Si sale bien", "If it works"),
      trigger: stopConditions.length > 0
        ? t(
            "El resultado cumple todas las condiciones de parada.",
            "The result meets every stop condition.",
          )
        : t("El resultado alcanza el final que definas.", "The result reaches the finish you set."),
      response: t(
        "Detener el gasto, conservar el resultado y compararlo con tu equipo antes de llamarlo mejora.",
        "Stop spending, keep the result and compare it with your gear before calling it an upgrade.",
      ),
    },
    {
      id: "salvage",
      label: t("Si es aprovechable", "If it's usable"),
      trigger: t(
        "Conserva lo intocable o mejora la dirección, pero todavía no cumple el contrato.",
        "It keeps your must-keep lines or improves the direction, but doesn't meet the plan yet.",
      ),
      response: t(
        "Pegar el resultado y recalcular la fase. El proyecto mantiene objetivo, protecciones y parada.",
        "Paste the result and work out the stage again. The project keeps its goal, protections and stop.",
      ),
    },
    {
      id: "failure",
      label: t("Si falla", "If it fails"),
      trigger: protectedLines.length > 0
        ? t(
            "El resultado pegado ya no conserva una línea protegida, agota la ruta o deja de justificar la base.",
            "The pasted result lost a protected line, used up the route or no longer justifies the base.",
          )
        : t(
            "Agota la ruta o el resultado deja de justificar la base.",
            "It uses up the route or the result no longer justifies the base.",
          ),
      response: t(
        "Parar. Evaluar recuperación con el tooltip real o cambiar de base; nunca encadenar otra moneda por inercia.",
        "Stop. Judge a rescue with the real tooltip or change base; never chain another currency out of habit.",
      ),
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
      ? `${input.budget.amount} ${(lang === "en" ? BUDGET_CURRENCY_LABEL_EN : BUDGET_CURRENCY_LABEL)[input.budget.currency]}`
      : null,
    limitations: [
      t(
        "Sin un pool exhaustivo no se calculan probabilidades ni intentos esperados.",
        "Without a full mod pool, chances and expected attempts aren't worked out.",
      ),
      t(
        "El plan compara cambios estructurales; no estima DPS ni el valor de mercado de la pieza.",
        "The plan compares structural changes; it doesn't estimate DPS or the item's market value.",
      ),
    ],
  };

  if (input.diagnosis.state !== "complete") {
    return {
      ...common,
      status: "needs-item-data",
      eyebrow: t("Plan bloqueado", "Plan blocked"),
      headline: t("Completa primero la lectura de la pieza", "First finish reading the item"),
      nextAction: input.diagnosis.nextAction,
    };
  }
  if (objective.length < 3) {
    return {
      ...common,
      status: "needs-objective",
      eyebrow: t("Falta el destino", "No goal yet"),
      headline: t("Define qué resultado estás persiguiendo", "Decide what result you're after"),
      nextAction: t(
        "Elige una categoría o describe el resultado final antes de comparar monedas.",
        "Pick a category or describe the final result before comparing currencies.",
      ),
    };
  }
  if (stopConditions.length === 0) {
    return {
      ...common,
      status: "needs-stop",
      eyebrow: t("Falta la salida", "No exit yet"),
      headline: t("Decide cuándo dejarás de gastar", "Decide when you'll stop spending"),
      nextAction: t(
        "Añade al menos una condición que puedas comprobar en el siguiente texto pegado.",
        "Add at least one condition you can check in the next pasted text.",
      ),
    };
  }
  if (currentAssessment.status === "fulfilled") {
    return {
      ...common,
      status: "already-complete",
      eyebrow: t("Craft terminado", "Craft finished"),
      headline: t("La pieza ya cumple tu contrato de salida", "The item already meets your stop plan"),
      nextAction: t(
        "No gastes otra moneda para perseguir estas mismas condiciones.",
        "Don't spend another currency chasing these same conditions.",
      ),
    };
  }
  if (routes.length === 0) {
    return {
      ...common,
      status: "needs-route-data",
      eyebrow: t("Sin ruta demostrada", "No proven route"),
      headline: t("No hay una primera acción confirmada", "No first action is confirmed"),
      nextAction: t(
        "Revisa los bloqueos o vuelve a pegar el objeto antes de gastar.",
        "Check what's blocking you or paste the item again before spending.",
      ),
    };
  }
  return {
    ...common,
    status: "ready",
    eyebrow: recommendedRoute
      ? t("Primera acción conservadora", "Safe first action")
      : t("Decisión manual necesaria", "Your call"),
    headline: recommendedRoute?.label ?? t("Compara las rutas antes de elegir", "Compare the routes before choosing"),
    nextAction:
      recommendedRoute?.recommendationReason ??
      t(
        "Ninguna ruta domina a las demás con la evidencia disponible; elige qué riesgo aceptar.",
        "No route beats the others with the evidence you have; choose which risk to accept.",
      ),
  };
}

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
            "La pieza todavía no tiene líneas que perder.",
            "The item has no lines to lose yet.",
          )
        : t(
            "Añade una línea; las que ya tiene se quedan.",
            "It adds a line; the ones already there stay.",
          );

    let consequence = t(
      `La rareza se mantiene como ${resultingRarity === "rare" ? "rara" : "mágica"}.`,
      `The item stays ${resultingRarity === "rare" ? "rare" : "magic"}.`,
    );
    if (action.id === "transmutation") {
      consequence = t(
        "La pieza pasa de normal a mágica.",
        "The item goes from normal to magic.",
      );
    } else if (action.id === "augmentation") {
      consequence = t(
        "La pieza sigue mágica; el Orbe regio lo decides después.",
        "The item stays magic; you decide on the Regal Orb later.",
      );
    } else if (action.id === "regal") {
      consequence = t(
        "La pieza pasa a rara; después ya no podrás usar Aumento sobre ella.",
        "The item becomes rare; after that you can't use an Orb of Augmentation on it.",
      );
    } else if (action.id === "exalted") {
      consequence = t(
        "Ocupa uno de los huecos que le quedan a la pieza.",
        "Fills one of the slots the item still has open.",
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
        "El modificador nuevo sale al azar: esta moneda no garantiza lo que buscas.",
        "The new modifier is random: this currency doesn't guarantee what you're after.",
      ),
      risk: stageChanges ? "stage-change" as const : "controlled" as const,
      recommended,
      recommendationReason: recommended
        ? augmentationBeforeRegal && action.id === "augmentation"
          ? t(
              "Primero Aumento: la pieza sigue mágica y el Orbe regio seguirá disponible después.",
              "Augmentation first: the item stays magic and the Regal Orb will still be there later.",
            )
          : t(
              "Es la única moneda básica que esta pieza admite ahora.",
              "It's the only basic currency this item takes right now.",
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
      "Puede poner una línea garantizada, pero quitando otra de la pieza.",
      "It can add a guaranteed line, but it removes another one from the item.",
    ),
    preserves: t(
      "No se puede prometer que respete las líneas que quieres conservar hasta leer su descripción en el juego.",
      "There's no promise it keeps the lines you want until its in-game description is read.",
    ),
    consequence: t(
      "Reemplaza una línea: lo que se pierda no se puede recuperar.",
      "It replaces a line: whatever is lost can't be brought back.",
    ),
    uncertainty: t(
      "Aún no sé qué línea pone, si vale para esta pieza ni cuál podría quitar.",
      "I don't know yet which line it adds, whether it fits this item or which one it could remove.",
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
          label: t("No gastes todavía", "Don't spend yet"),
          detail: input.diagnosis.nextAction,
        }
      : currentAssessment.status === "fulfilled"
        ? {
            kind: "stop",
            label: t("Quédate con esta pieza", "Keep this item"),
            detail: t(
              "Ya tiene lo que pediste; otra moneda solo añadiría riesgo.",
              "It already has what you asked for; another currency would only add risk.",
            ),
          }
        : routes.length === 0
          ? {
              kind: "change-base",
              label: t("Mejor busca otra pieza", "Better look for another item"),
              detail: t(
                "No hay ninguna moneda que pueda usar sobre esta tal como está.",
                "There's no currency I can use on this one as it is.",
              ),
            }
          : input.route.state === "replacement-tools"
            ? {
                kind: "recover",
                label: t("La pieza está llena", "The item is full"),
                detail: t(
                  "Para cambiarla hay que reemplazar una línea con una Essence o un Alloy. Mira antes cuál podrías perder.",
                  "To change it you have to replace a line with an Essence or an Alloy. Check first which one you could lose.",
                ),
              }
            : {
                kind: "continue",
                label: t("Puedes seguir con esta pieza", "You can go on with this item"),
                detail: recommendedRoute
                  ? t(
                      `El siguiente paso seguro es ${recommendedRoute.label}.`,
                      `The safe next step is ${recommendedRoute.label}.`,
                    )
                  : t(
                      "Hay varias opciones y ninguna es claramente mejor.",
                      "There are several options and none is clearly better.",
                    ),
              };
  const branches: ExpertCraftingProjectBranch[] = [
    {
      id: "success",
      label: t("Si sale lo que buscas", "If you get what you want"),
      trigger: stopConditions.length > 0
        ? t(
            "La pieza cumple todo lo que pusiste en «Paro cuando».",
            "The item meets everything you set under “I stop when”.",
          )
        : t("La pieza llega al final que elijas.", "The item reaches the finish you choose."),
      response: t(
        "Para. Guarda la pieza y compárala con la que llevas antes de ponértela.",
        "Stop. Keep the item and compare it with the one you're wearing before equipping it.",
      ),
    },
    {
      id: "salvage",
      label: t("Si sale algo útil, pero no eso", "If you get something useful, but not that"),
      trigger: t(
        "No pierdes nada de lo que querías conservar, pero aún no has llegado.",
        "You lose nothing you wanted to keep, but you're not there yet.",
      ),
      response: t(
        "Pega el resultado aquí y te digo el siguiente paso. Tu plan se mantiene.",
        "Paste the result here and I'll tell you the next step. Your plan stays.",
      ),
    },
    {
      id: "failure",
      label: t("Si sale mal", "If it goes wrong"),
      trigger: protectedLines.length > 0
        ? t(
            "Has perdido una línea protegida, o ya no queda nada útil que hacerle a la pieza.",
            "You've lost a protected line, or there's nothing useful left to do to the item.",
          )
        : t(
            "Ya no queda nada útil que hacerle a la pieza.",
            "There's nothing useful left to do to the item.",
          ),
      response: t(
        "Para. Mira si tiene arreglo o cambia de pieza; no gastes otra moneda por inercia.",
        "Stop. See if it can be rescued or change item; don't spend another currency out of habit.",
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
        "No calculo probabilidades ni cuántos intentos hacen falta: no tengo la lista completa de modificadores.",
        "I don't work out chances or how many attempts it takes: I don't have the full modifier list.",
      ),
      t(
        "No calculo el DPS ni cuánto vale la pieza en el mercado.",
        "I don't work out DPS or what the item is worth on the market.",
      ),
    ],
  };

  if (input.diagnosis.state !== "complete") {
    return {
      ...common,
      status: "needs-item-data",
      eyebrow: t("Falta leer la pieza", "The item isn't read yet"),
      headline: t("Antes necesito leer bien la pieza", "First I need to read the item properly"),
      nextAction: input.diagnosis.nextAction,
    };
  }
  if (objective.length < 3) {
    return {
      ...common,
      status: "needs-objective",
      eyebrow: t("Falta un dato", "One thing missing"),
      headline: t("Dime qué quieres mejorar", "Tell me what you want to improve"),
      nextAction: t(
        "Elige una opción arriba y te digo la siguiente moneda.",
        "Pick an option above and I'll tell you the next currency.",
      ),
    };
  }
  if (stopConditions.length === 0) {
    return {
      ...common,
      status: "needs-stop",
      eyebrow: t("Falta un dato", "One thing missing"),
      headline: t("Dime cuándo paras", "Tell me when you stop"),
      nextAction: input.route.state === "replacement-tools"
        ? t(
            "La pieza está llena: solo puedes cambiar una línea por otra. Escribe en «Paro cuando» la línea que buscas.",
            "The item is full: you can only swap one line for another. Write the line you're after under “I stop when”.",
          )
        : t(
            "Abre «Paro cuando» aquí abajo y elige al menos una condición.",
            "Open “I stop when” below and pick at least one condition.",
          ),
    };
  }
  if (currentAssessment.status === "fulfilled") {
    return {
      ...common,
      status: "already-complete",
      eyebrow: t("Ya está", "Done"),
      headline: t("La pieza ya cumple lo que pediste", "The item already meets what you asked for"),
      nextAction: t(
        "No gastes otra moneda buscando lo mismo. Si quieres más, cambia «Paro cuando».",
        "Don't spend another currency chasing the same thing. If you want more, change “I stop when”.",
      ),
    };
  }
  if (routes.length === 0) {
    return {
      ...common,
      status: "needs-route-data",
      eyebrow: t("Sin siguiente paso", "No next step"),
      headline: t("No hay ninguna moneda que pueda usar aquí", "There's no currency I can use here"),
      nextAction: t(
        "Mira por qué en «Por qué no otras monedas» o vuelve a pegar la pieza.",
        "See why under “Why not other currencies” or paste the item again.",
      ),
    };
  }
  return {
    ...common,
    status: "ready",
    eyebrow: recommendedRoute
      ? t("Siguiente paso", "Next step")
      : t("Tú decides", "Your call"),
    headline: recommendedRoute?.label ?? t("Hay varias opciones: compáralas antes de elegir", "There are several options: compare them before choosing"),
    nextAction:
      recommendedRoute?.recommendationReason ??
      t(
        "Ninguna es claramente mejor con lo que sé. Mira qué arriesga cada una.",
        "None is clearly better with what I know. Look at what each one risks.",
      ),
  };
}

import type { CraftingActionId } from "./craftingActions.js";
import type { Budget, CurrencyKind } from "./domain.js";

export type CraftingBudgetStatus =
  | "within-budget"
  | "over-budget"
  | "not-comparable";

export interface CraftingBudgetAssessment {
  status: CraftingBudgetStatus;
  title: string;
  detail: string;
  blocksAction: boolean;
  /** Solo existe cuando acción y presupuesto usan la misma unidad verificable. */
  requiredAmount: number | null;
}

const BUDGET_LABEL: Record<CurrencyKind, { singular: string; plural: string }> = {
  chaos: { singular: "caos", plural: "caos" },
  exalted: { singular: "exaltado", plural: "exaltados" },
  divine: { singular: "divino", plural: "divinos" },
  gold: { singular: "oro", plural: "oro" },
};

const ACTION_LABEL: Record<CraftingActionId, string> = {
  transmutation: "Orbe de transmutación",
  augmentation: "Orbe de aumento",
  regal: "Orbe regio",
  exalted: "Orbe exaltado",
};

/**
 * Las cuatro acciones observadas consumen una unidad de su propia moneda, pero
 * el presupuesto público solo admite caos, exaltados, divinos u oro. Por eso
 * únicamente Exaltado puede compararse de forma directa hoy. No se inventan
 * tasas para Aumento, Regio o Transmutación.
 */
export function assessCraftingBudget(input: {
  budget: Budget;
  actionId: CraftingActionId;
  plannedAttempts: number;
}): CraftingBudgetAssessment {
  const attempts = Math.max(1, Math.floor(input.plannedAttempts));
  const unit = BUDGET_LABEL[input.budget.currency];
  const budgetLabel = `${input.budget.amount} ${
    input.budget.amount === 1 ? unit.singular : unit.plural
  }`;
  const actionLabel = ACTION_LABEL[input.actionId];

  if (input.actionId !== "exalted" || input.budget.currency !== "exalted") {
    return {
      status: "not-comparable",
      title: "Coste todavía no comparable",
      detail:
        `Límite: ${budgetLabel}. Próximo paso: ${actionLabel}. ` +
        "Sin inventario o conversión verificados no sé si cabe.",
      blocksAction: false,
      requiredAmount: null,
    };
  }

  const requiredAmount = attempts;
  if (input.budget.amount < requiredAmount) {
    return {
      status: "over-budget",
      title: "El contrato supera tu límite",
      detail:
        `Contrato: ${requiredAmount} ${requiredAmount === 1 ? "exaltado" : "exaltados"}. ` +
        `Límite: ${budgetLabel}. Reduce pasos o cambia el presupuesto antes de gastar.`,
      blocksAction: true,
      requiredAmount,
    };
  }

  return {
    status: "within-budget",
    title: "Dentro del límite declarado",
    detail:
      `Contrato: ${requiredAmount} ${requiredAmount === 1 ? "exaltado" : "exaltados"} de un límite de ${budgetLabel}. ` +
      "Controla el gasto; no demuestra rentabilidad.",
    blocksAction: false,
    requiredAmount,
  };
}

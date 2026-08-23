import type {
  CraftingActionEvaluation,
  CraftingActionId,
} from "./craftingActions.js";
import type { CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import type { Item } from "./domain.js";

export type CraftingRouteState =
  | "single-currency"
  | "currency-choice"
  | "replacement-tools"
  | "needs-data";

export interface CraftingRouteAction {
  id: CraftingActionId;
  label: string;
}

export interface CraftingRoute {
  state: CraftingRouteState;
  eyebrow: string;
  headline: string;
  summary: string;
  currencyActions: CraftingRouteAction[];
  toolSuggestions: Array<"essence" | "alloy">;
}

/**
 * Convierte compatibilidad ya demostrada en navegación; no elige el resultado
 * «mejor», no interpreta afijos y no inventa probabilidades.
 */
export function buildCraftingRoute(
  item: Item,
  diagnosis: CraftingItemDiagnosis,
  evaluations: readonly CraftingActionEvaluation[],
): CraftingRoute {
  const compatible = evaluations
    .filter((entry) => entry.status === "compatible")
    .map((entry) => ({ id: entry.action.id, label: entry.action.label }));

  if (diagnosis.state !== "complete") {
    return {
      state: "needs-data",
      eyebrow: "No gastes todavía",
      headline: "Primero completa la lectura de la pieza",
      summary: diagnosis.nextAction,
      currencyActions: [],
      toolSuggestions: [],
    };
  }

  if (compatible.length === 1) {
    const action = compatible[0]!;
    return {
      state: "single-currency",
      eyebrow: "Siguiente acción legal",
      headline: action.label,
      summary:
        "Es la única moneda básica compatible con la estructura observada. Aún debes decidir si encaja con tu objetivo y aceptar su incertidumbre.",
      currencyActions: [action],
      toolSuggestions: [],
    };
  }

  if (compatible.length > 1) {
    return {
      state: "currency-choice",
      eyebrow: "Decisión de ruta",
      headline: "Hay más de un camino legal",
      summary:
        "La app no los ordena como mejor o peor: elige si quieres mantener la rareza actual o avanzar de etapa.",
      currencyActions: compatible,
      toolSuggestions: [],
    };
  }

  if (item.rarity === "rare" && diagnosis.observedOpenSlots === 0) {
    return {
      state: "replacement-tools",
      eyebrow: "Monedas básicas agotadas",
      headline: "Para seguir necesitas reemplazar, no añadir",
      summary:
        "Revisa una Essence o un Alloy reales. La app pedirá su tooltip antes de declarar la operación compatible; no asume el efecto por el nombre.",
      currencyActions: [],
      toolSuggestions: ["essence", "alloy"],
    };
  }

  return {
    state: "needs-data",
    eyebrow: "No gastes todavía",
    headline: "No hay una acción básica confirmada",
    summary:
      "Abre las acciones no aplicables para ver qué dato o condición impide continuar.",
    currencyActions: [],
    toolSuggestions: [],
  };
}

import type {
  CraftingActionEvaluation,
  CraftingActionId,
} from "./craftingActions.js";
import type { CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import type { Item } from "./domain.js";
import { craftingActionLabel } from "./craftingWorkshopText.js";

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
  lang: "es" | "en" = "es",
): CraftingRoute {
  const en = lang === "en";
  const compatible = evaluations
    .filter((entry) => entry.status === "compatible")
    .map((entry) => ({ id: entry.action.id, label: craftingActionLabel(entry.action, lang) }));

  if (diagnosis.state !== "complete") {
    return {
      state: "needs-data",
      eyebrow: en ? "Don't spend yet" : "No gastes todavía",
      headline: en ? "First finish reading the item" : "Primero completa la lectura de la pieza",
      summary: diagnosis.nextAction,
      currencyActions: [],
      toolSuggestions: [],
    };
  }

  if (compatible.length === 1) {
    const action = compatible[0]!;
    return {
      state: "single-currency",
      eyebrow: en ? "Next legal action" : "Siguiente acción legal",
      headline: action.label,
      summary: en
        ? "It's the only basic currency that fits the item as it is. You still need to decide if it fits your goal and accept that the result is random."
        : "Es la única moneda básica compatible con la estructura observada. Aún debes decidir si encaja con tu objetivo y aceptar su incertidumbre.",
      currencyActions: [action],
      toolSuggestions: [],
    };
  }

  if (compatible.length > 1) {
    return {
      state: "currency-choice",
      eyebrow: en ? "Route choice" : "Decisión de ruta",
      headline: en ? "There is more than one legal path" : "Hay más de un camino legal",
      summary: en
        ? "The app doesn't rank them as better or worse: choose whether to keep the current rarity or move to the next stage."
        : "La app no los ordena como mejor o peor: elige si quieres mantener la rareza actual o avanzar de etapa.",
      currencyActions: compatible,
      toolSuggestions: [],
    };
  }

  if (item.rarity === "rare" && diagnosis.observedOpenSlots === 0) {
    return {
      state: "replacement-tools",
      eyebrow: en ? "Basic currency used up" : "Monedas básicas agotadas",
      headline: en ? "To go on you need to replace, not add" : "Para seguir necesitas reemplazar, no añadir",
      summary: en
        ? "Check a real Essence or Alloy. The app will ask for its tooltip before calling the step compatible; it doesn't guess the effect from the name."
        : "Revisa una Essence o un Alloy reales. La app pedirá su tooltip antes de declarar la operación compatible; no asume el efecto por el nombre.",
      currencyActions: [],
      toolSuggestions: ["essence", "alloy"],
    };
  }

  return {
    state: "needs-data",
    eyebrow: en ? "Don't spend yet" : "No gastes todavía",
    headline: en ? "No basic action is confirmed" : "No hay una acción básica confirmada",
    summary: en
      ? "Open the actions that don't apply to see which data or condition is blocking you."
      : "Abre las acciones no aplicables para ver qué dato o condición impide continuar.",
    currencyActions: [],
    toolSuggestions: [],
  };
}

import { z } from "zod";
import type { Item } from "./domain.js";
import type { CraftingObjective } from "./craftingProtection.js";

export const AlloyRemovalSelectionSchema = z.enum([
  "random",
  "player-selected",
  "unspecified",
]);
export type AlloyRemovalSelection = z.infer<typeof AlloyRemovalSelectionSchema>;

export const ALLOY_REMOVAL_LABELS: Record<AlloyRemovalSelection, string> = {
  random: "El tooltip declara una retirada aleatoria",
  "player-selected": "El tooltip permite elegir qué se reemplaza",
  unspecified: "El tooltip no aclara cómo se elige",
};

export const AlloyPlanInputSchema = z.object({
  alloyName: z.string().trim().max(120),
  fullTooltipText: z.string().trim().max(2000),
  guaranteedModifierText: z.string().trim().max(500),
  declaredItemClasses: z.array(z.string().trim().min(1).max(120)).max(30),
  playerConfirmedClassApplies: z.boolean(),
  removalSelection: AlloyRemovalSelectionSchema,
});
export type AlloyPlanInput = z.infer<typeof AlloyPlanInputSchema>;

export type AlloyEvaluationStatus = "compatible" | "blocked" | "needs-data";

export interface AlloyEvaluation {
  status: AlloyEvaluationStatus;
  reason: string;
  resultRarity: Item["rarity"];
  expectedRemovedModifierCount: 1;
  expectedAddedCrafted: true;
  maximumCraftedModifierCount: 1;
  irreversible: true;
}

export type StartAlloyDecision = (
  item: Item,
  plan: AlloyPlanInput,
  evaluation: AlloyEvaluation,
  objective: CraftingObjective,
) => Promise<boolean>;

export const ALLOY_MECHANIC_SOURCE = {
  title: "Content Update 0.5.0 — The Runes of Aldur League and Item Changes",
  url: "https://www.pathofexile.com/forum/view-thread/3932540/filter-account-type/staff",
  patch: "0.5.0",
  lastMechanicChange: "0.5.3",
  leagueScope: "Runes of Aldur",
  declaredTotalCount: 13,
  verifiedAt: "2026-08-23",
} as const;

export const ALLOY_CLASS_RESTRICTION_SOURCES = [
  {
    patch: "0.5.2",
    url: "https://www.pathofexile.com/forum/view-thread/3960375",
    fact: "Transcendent Alloy dejó de poder aplicarse a Foci y Varas.",
  },
  {
    patch: "0.5.3",
    url: "https://www.pathofexile.com/forum/view-thread/3968601",
    fact: "Transcendent Alloy volvió a admitir Foci y Varas con valores inferiores.",
  },
] as const;

export const ALLOY_RESULT_UNKNOWN_LABEL =
  "Falta comprobar qué modificador reemplazó el Alloy y qué crafted modifier añadió.";

function result(
  item: Item,
  status: AlloyEvaluationStatus,
  reason: string,
): AlloyEvaluation {
  return {
    status,
    reason,
    resultRarity: item.rarity,
    expectedRemovedModifierCount: 1,
    expectedAddedCrafted: true,
    maximumCraftedModifierCount: 1,
    irreversible: true,
  };
}

/**
 * Preflight conservador de Alloys.
 *
 * GGG documenta el reemplazo y la naturaleza crafted del resultado, pero no
 * publica en las notas la matriz completa Alloy × tipo de objeto ni cómo se
 * elige la retirada. Esos datos deben proceder del tooltip que ve el jugador.
 */
export function evaluateAlloyPlan(item: Item, input: AlloyPlanInput): AlloyEvaluation {
  const plan = AlloyPlanInputSchema.parse(input);
  const state = item.craftingState;

  if (state === undefined) {
    return result(
      item,
      "needs-data",
      "El texto no confirma los estados especiales del objeto; vuelve a copiarlo con Ctrl+Alt+C.",
    );
  }
  if (state.doubleCorrupted || state.corrupted) {
    return result(item, "blocked", state.doubleCorrupted ? "El objeto tiene doble corrupción." : "El objeto está corrupto.");
  }
  if (state.mirrored) return result(item, "blocked", "El objeto está reflejado.");
  if (state.sanctified) return result(item, "blocked", "El objeto está santificado.");
  if (state.unmodifiable || state.unmodifiableExceptChaos) {
    return result(
      item,
      "blocked",
      state.unmodifiableExceptChaos
        ? "El objeto solo admite acciones de caos; un Alloy no se ha verificado como tal."
        : "El objeto declara que no puede modificarse.",
    );
  }
  if (state.mutated || state.desecrated || state.split || state.unidentified) {
    return result(
      item,
      "needs-data",
      "El objeto tiene un estado especial cuya interacción con Alloys todavía no está verificada.",
    );
  }

  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  if (explicit.length === 0) {
    return result(item, "needs-data", "No se detecta un modificador explícito que pueda ser reemplazado.");
  }
  const crafted = explicit.filter((modifier) => modifier.crafted);
  if (crafted.length > 0) {
    return result(
      item,
      "blocked",
      "El objeto ya contiene un crafted modifier. GGG limita los objetos a uno y no se ha verificado que este Alloy sustituya precisamente ese crafted modifier.",
    );
  }
  if (
    explicit.some(
      (modifier) => modifier.fractured || modifier.mutated || modifier.desecrated,
    )
  ) {
    return result(
      item,
      "needs-data",
      "Hay modificadores fractured, mutated o desecrated y no se ha verificado si pueden entrar en el reemplazo.",
    );
  }
  if (explicit.some((modifier) => modifier.affix === undefined)) {
    return result(
      item,
      "needs-data",
      "Necesito el texto copiado con Ctrl+Alt+C para clasificar todos los modificadores explícitos antes del reemplazo.",
    );
  }

  if (
    plan.alloyName.length < 3 ||
    plan.fullTooltipText.length < 10 ||
    plan.guaranteedModifierText.length < 3 ||
    plan.declaredItemClasses.length === 0
  ) {
    return result(
      item,
      "needs-data",
      "Copia el tooltip completo y registra literalmente las clases admitidas y el modificador fabricado garantizado.",
    );
  }
  if (!plan.playerConfirmedClassApplies) {
    return result(
      item,
      "needs-data",
      "Confirma que una de las clases escritas en el tooltip corresponde a la pieza seleccionada. Las restricciones de Alloys han cambiado entre parches y no se pueden deducir por el nombre.",
    );
  }

  return result(
    item,
    "compatible",
    plan.removalSelection === "random"
      ? `La evidencia declarada encaja, pero cualquiera de los ${explicit.length} modificadores explícitos actuales puede ser reemplazado.`
      : plan.removalSelection === "player-selected"
        ? "La evidencia declarada encaja y el tooltip indica que el jugador elige el modificador reemplazado; la selección final sigue perteneciendo al juego."
        : "La evidencia declarada encaja. GGG confirma que se reemplaza un modificador, pero no está verificado cómo se elige; la sesión conservará esa incógnita.",
  );
}

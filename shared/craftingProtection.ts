import { z } from "zod";
import type { Item, Modifier } from "./domain.js";
import { CraftingGoalCategorySchema } from "./craftingGoal.js";
import { CraftingSuccessCriteriaSchema } from "./craftingSuccessCriteria.js";

/** Contrato explícito del jugador: qué busca y qué no acepta perder. */
export const CraftingObjectiveSchema = z.object({
  goalCategory: CraftingGoalCategorySchema.optional(),
  desiredOutcome: z.string().trim().min(3).max(500),
  protectedModifierIds: z
    .array(z.string().trim().min(1).max(200))
    .max(12)
    .refine((ids) => new Set(ids).size === ids.length, "No se puede proteger dos veces el mismo modificador."),
  /** Pruebas observables elegidas por el jugador; el texto libre nunca las sustituye. */
  successCriteria: CraftingSuccessCriteriaSchema,
});
export type CraftingObjective = z.infer<typeof CraftingObjectiveSchema>;

export type RemovalSelection = "none" | "random" | "player-selected" | "unspecified";
export type ProtectionRisk = "none" | "possible" | "certain" | "unknown";

export interface CraftingProtectionEvaluation {
  status: "safe" | "warning" | "blocked" | "needs-data";
  risk: ProtectionRisk;
  reason: string;
  protectedModifiers: Modifier[];
  unprotectedExplicitCount: number;
  unknownModifierIds: string[];
}
/**
 * Evalúa únicamente el riesgo de perder una línea que el jugador marcó.
 * No interpreta si el modificador es bueno ni inventa cómo el juego selecciona
 * una retirada: esa selección debe venir del tooltip o de una regla verificada.
 */
export function evaluateCraftingProtection(input: {
  item: Item;
  protectedModifierIds: string[];
  removedModifierCount: number;
  removalSelection: RemovalSelection;
}, lang: "es" | "en" = "es"): CraftingProtectionEvaluation {
  const en = lang === "en";
  const ids = [...new Set(input.protectedModifierIds)];
  const explicit = input.item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const protectedModifiers = explicit.filter((modifier) => ids.includes(modifier.id));
  const knownIds = new Set(protectedModifiers.map((modifier) => modifier.id));
  const unknownModifierIds = ids.filter((id) => !knownIds.has(id));
  const unprotectedExplicitCount = explicit.length - protectedModifiers.length;

  if (unknownModifierIds.length > 0) {
    return {
      status: "needs-data",
      risk: "unknown",
      reason: en
        ? "Your protected lines no longer match the saved item. Pick them again before spending."
        : "La selección protegida ya no coincide con el snapshot del objeto. Vuelve a elegirla antes de gastar.",
      protectedModifiers,
      unprotectedExplicitCount,
      unknownModifierIds,
    };
  }
  if (protectedModifiers.length === 0 || input.removedModifierCount === 0) {
    return {
      status: "safe",
      risk: "none",
      reason: en
        ? protectedModifiers.length === 0
          ? "You haven't marked any must-keep modifiers for this step."
          : "This action doesn't say it removes any current modifiers."
        : protectedModifiers.length === 0
          ? "No has marcado modificadores imprescindibles para este paso."
          : "La acción registrada no declara la retirada de modificadores actuales.",
      protectedModifiers,
      unprotectedExplicitCount,
      unknownModifierIds: [],
    };
  }

  const protectedLossIsCertain = input.removedModifierCount > unprotectedExplicitCount;
  if (protectedLossIsCertain) {
    return {
      status: "blocked",
      risk: "certain",
      reason: en
        ? `The action removes ${input.removedModifierCount} modifier${input.removedModifierCount === 1 ? "" : "s"} and there aren't enough unprotected ones left: you would lose at least one you marked as must-keep.`
        : `La acción retira ${input.removedModifierCount} modificador${input.removedModifierCount === 1 ? "" : "es"} y no quedan suficientes modificadores sin proteger: se perdería al menos uno marcado como imprescindible.`,
      protectedModifiers,
      unprotectedExplicitCount,
      unknownModifierIds: [],
    };
  }

  if (input.removalSelection === "player-selected") {
    return {
      status: "safe",
      risk: "none",
      reason: en
        ? "The tooltip lets you choose what is removed, and at least one unprotected modifier can be picked."
        : "El tooltip permite elegir la retirada y existe al menos un modificador no protegido que puede seleccionarse.",
      protectedModifiers,
      unprotectedExplicitCount,
      unknownModifierIds: [],
    };
  }
  if (input.removalSelection === "random") {
    return {
      status: "warning",
      risk: "possible",
      reason: en
        ? `The removal is random: any of the ${protectedModifiers.length} protected modifiers could disappear.`
        : `La retirada es aleatoria: cualquiera de los ${protectedModifiers.length} modificadores protegidos podría desaparecer.`,
      protectedModifiers,
      unprotectedExplicitCount,
      unknownModifierIds: [],
    };
  }
  return {
    status: "needs-data",
    risk: "unknown",
    reason: en
      ? "It isn't confirmed how the removed modifier is chosen, so there's no promise your protected modifiers survive."
      : "No está verificado cómo se elige la retirada; no se puede prometer que los modificadores protegidos sobrevivan.",
    protectedModifiers,
    unprotectedExplicitCount,
    unknownModifierIds: [],
  };
}

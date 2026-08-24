import { z } from "zod";
import type { Item } from "./domain.js";
import type { CraftingObjective } from "./craftingProtection.js";

export const EssenceTierSchema = z.enum([
  "lesser",
  "normal",
  "greater",
  "perfect",
  "corrupted",
]);
export type EssenceTier = z.infer<typeof EssenceTierSchema>;

export const ESSENCE_TIER_LABELS: Record<EssenceTier, string> = {
  lesser: "Menor",
  normal: "Normal",
  greater: "Superior",
  perfect: "Perfecta",
  corrupted: "Obtenida mediante corrupción",
};

export const EssencePlanInputSchema = z.object({
  tier: EssenceTierSchema,
  essenceName: z.string().trim().max(120),
  guaranteedModifierText: z.string().trim().max(500),
});
export type EssencePlanInput = z.infer<typeof EssencePlanInputSchema>;

export type EssenceEvaluationStatus = "compatible" | "blocked" | "needs-data";
export type EssenceOperation = "magic-to-rare" | "replace-random-rare-modifier";

export interface EssenceEvaluation {
  status: EssenceEvaluationStatus;
  reason: string;
  operation: EssenceOperation;
  targetRarity: "magic" | "rare";
  resultRarity: "rare";
  randomRemoval: boolean;
  irreversible: true;
}

export type StartEssenceDecision = (
  item: Item,
  plan: EssencePlanInput,
  evaluation: EssenceEvaluation,
  objective: CraftingObjective,
) => Promise<boolean>;

export const ESSENCE_MECHANIC_SOURCE = {
  title: "Path of Exile 2: The Third Edict — Essence Rework",
  url: "https://www.pathofexile.com/forum/view-thread/3826682/page/1",
  appliesFrom: "0.3.0",
  verifiedAt: "2026-08-23",
} as const;

export const ESSENCE_RESULT_UNKNOWN_LABEL =
  "Falta comprobar qué modificador desapareció y cuál añadió realmente la Essence.";

export function essenceOperation(tier: EssenceTier): EssenceOperation {
  return tier === "perfect" || tier === "corrupted"
    ? "replace-random-rare-modifier"
    : "magic-to-rare";
}

function result(
  plan: EssencePlanInput,
  status: EssenceEvaluationStatus,
  reason: string,
): EssenceEvaluation {
  const operation = essenceOperation(plan.tier);
  return {
    status,
    reason,
    operation,
    targetRarity: operation === "magic-to-rare" ? "magic" : "rare",
    resultRarity: "rare",
    randomRemoval: operation === "replace-random-rare-modifier",
    irreversible: true,
  };
}

/**
 * Preflight estructural de Essences.
 *
 * No contiene una tabla inventada de resultados por nombre: el efecto
 * garantizado debe proceder del tooltip exacto que ve el jugador. La fuente
 * oficial solo respalda la transición de rareza y si existe reemplazo aleatorio.
 */
export function evaluateEssencePlan(item: Item, input: EssencePlanInput): EssenceEvaluation {
  const plan = EssencePlanInputSchema.parse(input);
  const state = item.craftingState;
  const operation = essenceOperation(plan.tier);
  const requiredRarity = operation === "magic-to-rare" ? "magic" : "rare";

  if (item.rarity !== requiredRarity) {
    return result(
      plan,
      "blocked",
      operation === "magic-to-rare"
        ? "Las Essences Menor, Normal y Superior observadas oficialmente requieren un objeto mágico."
        : "Las Essences Perfectas u obtenidas mediante corrupción requieren un objeto raro.",
    );
  }

  if (state === undefined) {
    return result(
      plan,
      "needs-data",
      "El texto no confirma los estados especiales del objeto; vuelve a copiarlo con Ctrl+Alt+C.",
    );
  }
  if (state.doubleCorrupted || state.corrupted) {
    return result(
      plan,
      "blocked",
      state.doubleCorrupted
        ? "El objeto tiene doble corrupción."
        : "El objeto está corrupto.",
    );
  }
  if (state.mirrored) return result(plan, "blocked", "El objeto está reflejado.");
  if (state.sanctified) return result(plan, "blocked", "El objeto está santificado.");
  if (state.unmodifiable || state.unmodifiableExceptChaos) {
    return result(
      plan,
      "blocked",
      state.unmodifiableExceptChaos
        ? "El objeto declara que solo puede modificarse mediante una acción de caos; esta Essence no se ha verificado como tal."
        : "El objeto declara que no puede modificarse.",
    );
  }
  if (state.mutated || state.desecrated || state.split || state.unidentified) {
    return result(
      plan,
      "needs-data",
      "El objeto tiene un estado especial cuya interacción con Essences todavía no está verificada.",
    );
  }

  if (plan.essenceName.length < 3 || plan.guaranteedModifierText.length < 3) {
    return result(
      plan,
      "needs-data",
      "Copia el nombre y el efecto garantizado exactos del tooltip de la Essence; no se deducen por el nombre.",
    );
  }

  const explicitCount = item.modifiers.filter((modifier) => modifier.kind === "explicit").length;
  if (operation === "replace-random-rare-modifier" && explicitCount === 0) {
    return result(
      plan,
      "needs-data",
      "No se detecta ningún modificador explícito que pueda ser retirado; revisa el texto avanzado del objeto.",
    );
  }

  return result(
    plan,
    "compatible",
    operation === "magic-to-rare"
      ? "La rareza y los estados observables encajan: la acción elevará el objeto mágico a raro y añadirá el efecto indicado por el tooltip."
      : `La rareza y los estados observables encajan, pero uno de los ${explicitCount} modificadores explícitos actuales se retirará al azar antes de añadir el efecto indicado.`,
  );
}

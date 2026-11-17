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

export const ESSENCE_TIER_LABELS_EN: Record<EssenceTier, string> = {
  lesser: "Lesser",
  normal: "Normal",
  greater: "Greater",
  perfect: "Perfect",
  corrupted: "Obtained through corruption",
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
export const ESSENCE_RESULT_UNKNOWN_LABEL_EN =
  "Still need to check which modifier disappeared and which one the Essence actually added.";

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
export function evaluateEssencePlan(
  item: Item,
  input: EssencePlanInput,
  lang: "es" | "en" = "es",
): EssenceEvaluation {
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
  const plan = EssencePlanInputSchema.parse(input);
  const state = item.craftingState;
  const operation = essenceOperation(plan.tier);
  const requiredRarity = operation === "magic-to-rare" ? "magic" : "rare";

  if (item.rarity !== requiredRarity) {
    return result(
      plan,
      "blocked",
      operation === "magic-to-rare"
        ? t(
            "Las Essences Menor, Normal y Superior observadas oficialmente requieren un objeto mágico.",
            "Lesser, Normal and Greater Essences, as officially documented, need a magic item.",
          )
        : t(
            "Las Essences Perfectas u obtenidas mediante corrupción requieren un objeto raro.",
            "Perfect Essences and those obtained through corruption need a rare item.",
          ),
    );
  }

  if (state === undefined) {
    return result(
      plan,
      "needs-data",
      t(
        "El texto no confirma los estados especiales del objeto; vuelve a copiarlo con Ctrl+Alt+C.",
        "The text doesn't confirm the item's special states; copy it again with Ctrl+Alt+C.",
      ),
    );
  }
  if (state.doubleCorrupted || state.corrupted) {
    return result(
      plan,
      "blocked",
      state.doubleCorrupted
        ? t("El objeto tiene doble corrupción.", "The item is double corrupted.")
        : t("El objeto está corrupto.", "The item is corrupted."),
    );
  }
  if (state.mirrored) return result(plan, "blocked", t("El objeto está reflejado.", "The item is mirrored."));
  if (state.sanctified) return result(plan, "blocked", t("El objeto está santificado.", "The item is sanctified."));
  if (state.unmodifiable || state.unmodifiableExceptChaos) {
    return result(
      plan,
      "blocked",
      state.unmodifiableExceptChaos
        ? t(
            "El objeto declara que solo puede modificarse mediante una acción de caos; esta Essence no se ha verificado como tal.",
            "The item says it can only be modified by a chaos action; this Essence hasn't been confirmed as one.",
          )
        : t("El objeto declara que no puede modificarse.", "The item says it can't be modified."),
    );
  }
  const hasSpecialModifier = item.modifiers.some(
    (modifier) => modifier.fractured || modifier.mutated || modifier.desecrated,
  );
  if (
    state.mutated ||
    state.desecrated ||
    state.fractured ||
    state.split ||
    state.unidentified ||
    hasSpecialModifier
  ) {
    return result(
      plan,
      "needs-data",
      t(
        "El objeto tiene un estado especial cuya interacción con Essences todavía no está verificada.",
        "The item has a special state whose interaction with Essences isn't confirmed yet.",
      ),
    );
  }

  if (plan.essenceName.length < 3 || plan.guaranteedModifierText.length < 3) {
    return result(
      plan,
      "needs-data",
      t(
        "Copia el nombre y el efecto garantizado exactos del tooltip de la Essence; no se deducen por el nombre.",
        "Copy the exact name and guaranteed effect from the Essence tooltip; they aren't guessed from the name.",
      ),
    );
  }

  const explicitCount = item.modifiers.filter((modifier) => modifier.kind === "explicit").length;
  if (operation === "replace-random-rare-modifier" && explicitCount === 0) {
    return result(
      plan,
      "needs-data",
      t(
        "No se detecta ningún modificador explícito que pueda ser retirado; revisa el texto avanzado del objeto.",
        "No explicit modifier was found that could be removed; check the item's advanced text.",
      ),
    );
  }

  return result(
    plan,
    "compatible",
    operation === "magic-to-rare"
      ? t(
          "La rareza y los estados observables encajan: la acción elevará el objeto mágico a raro y añadirá el efecto indicado por el tooltip.",
          "The rarity and visible states fit: this will upgrade the magic item to rare and add the effect the tooltip shows.",
        )
      : t(
          `La rareza y los estados observables encajan, pero uno de los ${explicitCount} modificadores explícitos actuales se retirará al azar antes de añadir el efecto indicado.`,
          `The rarity and visible states fit, but one of the ${explicitCount} current explicit modifiers will be removed at random before the effect is added.`,
        ),
  );
}

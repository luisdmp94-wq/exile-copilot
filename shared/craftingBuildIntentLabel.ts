/**
 * Cómo se nombra el encaje de una pieza con la build. Va aparte de
 * `craftingBuildIntent.ts` porque aquel importa el motor del guía y este
 * rótulo lo usa la mascota, que se carga con la portada.
 */
import type { CraftingBuildIntent } from "./craftingBuildIntentModel.js";
import { COACH_FOCUS_LABELS, COACH_FOCUS_LABELS_EN } from "./craftingFocus.js";
import { CRAFTING_GOAL_LABELS, CRAFTING_GOAL_LABELS_EN } from "./craftingGoal.js";

export function craftingBuildIntentLabel(
  intent: CraftingBuildIntent,
  lang: "es" | "en" = "es",
): string {
  const en = lang === "en";
  if (intent.focuses.length > 0) {
    return intent.focuses
      .map((focus) => (en ? COACH_FOCUS_LABELS_EN : COACH_FOCUS_LABELS)[focus])
      .join(" · ");
  }
  if (intent.suggestedCategories.length > 0) {
    return intent.suggestedCategories
      .map((category) => (en ? CRAFTING_GOAL_LABELS_EN : CRAFTING_GOAL_LABELS)[category])
      .join(" · ");
  }
  return en ? "no proven priority" : "sin prioridad demostrada";
}

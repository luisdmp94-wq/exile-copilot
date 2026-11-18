/**
 * Forma del «encaje con la build», sin lógica. Va aparte de
 * `craftingBuildIntent.ts` porque aquel importa el motor del guía, y estos
 * tipos los necesita el contexto del Mentor, que se carga con la portada.
 */
import type { CoachFocus } from "./craftingFocus.js";
import type { CraftingGoalCategory } from "./craftingGoal.js";

export const CRAFTING_BUILD_INTENT_SOURCES = [
  "target",
  "resistances",
  "profile-goal",
  "none",
] as const;
export type CraftingBuildIntentSource = (typeof CRAFTING_BUILD_INTENT_SOURCES)[number];

export const CRAFTING_BUILD_ALIGNMENTS = [
  "aligned",
  "choice-required",
  "conflict",
  "unknown",
] as const;
export type CraftingBuildAlignment = (typeof CRAFTING_BUILD_ALIGNMENTS)[number];

export type SuggestedCraftingGoalCategory = Exclude<CraftingGoalCategory, "other">;

export interface CraftingBuildIntent {
  source: CraftingBuildIntentSource;
  alignment: CraftingBuildAlignment;
  focuses: CoachFocus[];
  suggestedCategories: SuggestedCraftingGoalCategory[];
}

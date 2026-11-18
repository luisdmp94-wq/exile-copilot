import { suggestCraftingFocusFromContext } from "./craftingCoach.js";
import type { CoachFocus } from "./craftingFocus.js";
import type { CraftingGoalCategory } from "./craftingGoal.js";
import type { BuildTarget, CharacterProfile, GoalKind } from "./domain.js";

import type {
  CraftingBuildAlignment,
  CraftingBuildIntent,
  CraftingBuildIntentSource,
  SuggestedCraftingGoalCategory,
} from "./craftingBuildIntentModel.js";

export {
  CRAFTING_BUILD_ALIGNMENTS,
  CRAFTING_BUILD_INTENT_SOURCES,
  type CraftingBuildAlignment,
  type CraftingBuildIntent,
  type CraftingBuildIntentSource,
  type SuggestedCraftingGoalCategory,
} from "./craftingBuildIntentModel.js";

const FOCUS_CATEGORY: Record<CoachFocus, SuggestedCraftingGoalCategory> = {
  physical: "damage",
  fire: "damage",
  cold: "damage",
  lightning: "damage",
  chaos: "damage",
  critical: "damage",
  "attack-speed": "speed",
  "projectile-levels": "skills",
  "maximum-life": "defence",
  resistances: "defence",
  armour: "defence",
  evasion: "defence",
  "energy-shield": "defence",
};

function categoryFromProfileGoal(goal: GoalKind): SuggestedCraftingGoalCategory | null {
  if (goal === "damage") return "damage";
  if (goal === "survival") return "defence";
  return null;
}

/**
 * Relaciona el objetivo del craft con hechos que el jugador ya declaró o que
 * el expediente puede medir. No afirma que la base admita esos modificadores,
 * no ordena prioridades y no calcula la utilidad final de la pieza.
 */
export function deriveCraftingBuildIntent(input: {
  profile: Pick<CharacterProfile, "resistances"> | null;
  target: Pick<BuildTarget, "name" | "desiredMods"> | null | undefined;
  profileGoal: GoalKind;
  goalCategory: CraftingGoalCategory;
}): CraftingBuildIntent {
  const suggestion = suggestCraftingFocusFromContext(input.profile, input.target);
  let source: CraftingBuildIntentSource = suggestion.source;
  let focuses = suggestion.focuses;
  let suggestedCategories = [
    ...new Set(focuses.map((focus) => FOCUS_CATEGORY[focus])),
  ];

  if (source === "none") {
    const profileCategory = categoryFromProfileGoal(input.profileGoal);
    if (profileCategory !== null) {
      source = "profile-goal";
      suggestedCategories = [profileCategory];
    }
    focuses = [];
  }

  const alignment: CraftingBuildAlignment =
    suggestedCategories.length === 0
      ? "unknown"
      : input.goalCategory === "other"
        ? "choice-required"
        : suggestedCategories.includes(input.goalCategory)
          ? "aligned"
          : "conflict";

  return {
    source,
    alignment,
    focuses,
    suggestedCategories,
  };
}

export { craftingBuildIntentLabel } from "./craftingBuildIntentLabel.js";

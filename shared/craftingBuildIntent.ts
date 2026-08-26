import { suggestCraftingFocusFromContext } from "./craftingCoach.js";
import {
  COACH_FOCUS_LABELS,
  type CoachFocus,
} from "./craftingFocus.js";
import {
  CRAFTING_GOAL_LABELS,
  type CraftingGoalCategory,
} from "./craftingGoal.js";
import type { BuildTarget, CharacterProfile, GoalKind } from "./domain.js";

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

export function craftingBuildIntentLabel(intent: CraftingBuildIntent): string {
  if (intent.focuses.length > 0) {
    return intent.focuses.map((focus) => COACH_FOCUS_LABELS[focus]).join(" · ");
  }
  if (intent.suggestedCategories.length > 0) {
    return intent.suggestedCategories
      .map((category) => CRAFTING_GOAL_LABELS[category])
      .join(" · ");
  }
  return "sin prioridad demostrada";
}

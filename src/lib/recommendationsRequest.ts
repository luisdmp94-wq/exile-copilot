import type { RecommendationsRequest } from "@shared/api.js";
import type {
  Budget,
  CharacterProfile,
  GoalKind,
} from "@shared/domain.js";
import type { TargetDraft } from "@/sections/TargetSection";
import { buildTargetFromDraft } from "@/lib/buildTarget";

/**
 * Construye la petición de recomendaciones con una forma fija (orden de claves
 * estable) para que su serialización JSON sirva de huella de invalidación.
 */
export function buildRecommendationsRequest(
  profile: CharacterProfile,
  targetDraft: TargetDraft,
  budget: Budget,
  goal: GoalKind,
  league: string,
  patch: string,
): RecommendationsRequest {
  return {
    profile,
    target: buildTargetFromDraft(targetDraft),
    budget,
    goal: { kind: goal },
    league,
    patch,
  };
}

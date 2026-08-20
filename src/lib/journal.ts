import {
  CreateJournalEntryRequestSchema,
  type CreateJournalEntryRequest,
} from "@shared/api.js";
import type {
  Budget,
  CharacterProfile,
  GoalKind,
  Recommendation,
} from "@shared/domain.js";

/**
 * Conserva un motivo corto sin inventar nada. El explicador actual puede
 * concatenar coste/riesgo/confianza en `reason`; esas piezas ya viajan en el
 * snapshot estructurado de la recomendación.
 */
export function compactRecommendationReason(reason: string): string {
  const beforeMetadata = reason.split(/\bImpacto esperado\b/i)[0]?.trim() ?? reason.trim();
  if (beforeMetadata.length <= 600) return beforeMetadata;
  return `${beforeMetadata.slice(0, 597).trimEnd()}…`;
}

export function journalEntryFromRecommendation(
  recommendation: Recommendation,
  profile: CharacterProfile,
  budget: Budget,
  goal: GoalKind,
): CreateJournalEntryRequest {
  return CreateJournalEntryRequestSchema.parse({
    kind: "decision",
    title: recommendation.title,
    summary: compactRecommendationReason(recommendation.reason),
    nextAction: recommendation.action,
    relatedItemIds: recommendation.relatedItemIds,
    sources: recommendation.sources,
    context: {
      characterLevel: profile.level,
      league: profile.league,
      patch: profile.patch,
      budget,
      goal,
    },
    recommendationSnapshot: recommendation,
    makePrimary: true,
  });
}

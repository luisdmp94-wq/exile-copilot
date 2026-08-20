import type { MentorQueryRequest } from "@shared/mentorQuery.js";
import type {
  Budget,
  CharacterJournal,
  CharacterProfile,
  GoalKind,
} from "@shared/domain.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import type { TargetDraft } from "@/sections/TargetSection";
import { buildTargetFromDraft } from "@/lib/buildTarget";

/**
 * Construye la petición al mentor con una forma FIJA (orden de claves estable)
 * para que su serialización sirva de huella de invalidación de la conversación.
 *
 * El cliente solo envía la revisión que ha visto: la memoria autoritativa la
 * carga siempre el servidor. La huella en sí vive en `shared/mentorQuery.ts`
 * (`mentorInputsKey`), que no depende de la interfaz.
 */
export function buildMentorRequest(
  question: string,
  profile: CharacterProfile,
  targetDraft: TargetDraft,
  budget: Budget,
  goal: GoalKind,
  league: string,
  patch: string,
  journal: CharacterJournal | null,
): MentorQueryRequest {
  return {
    question,
    profile,
    target: buildTargetFromDraft(targetDraft),
    budget,
    goal: { kind: goal },
    league,
    patch,
    ...(journal ? { journalRevision: buildRecommendationMemory(journal).revision } : {}),
  };
}

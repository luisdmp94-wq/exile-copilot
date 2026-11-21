import { classifyMentorQuestion } from "@shared/mentorIntent.js";
import type { QuickReviewFinding, QuickReviewResult } from "@shared/quickReview.js";

/**
 * Sin equipo, el Mentor contesta con la revisión rápida. Antes daba la misma
 * lista a cualquier pregunta; ahora la ordena según lo que se pregunta:
 *
 * - «¿Por qué muero?» (foco supervivencia): primero lo que hace aguantar
 *   (resistencias), aunque no sea lo que más frena en general.
 * - «¿Cuál es mi principal problema?» (explicar prioridad): solo el primero.
 * - Lo demás («¿Qué mejoro ahora?» o sin pregunta): los 3 que más frenan.
 */
export type MentorReviewMode = "survival" | "main" | "list";

/** Lo que hace aguantar más golpes, según la revisión rápida. */
const SURVIVAL_IDS = new Set(["res"]);

export function mentorReviewAnswer(
  review: Pick<QuickReviewResult, "top" | "rest">,
  question: string | null,
): { mode: MentorReviewMode; findings: QuickReviewFinding[] } {
  const all = [...review.top, ...review.rest];
  if (question === null || all.length === 0) return { mode: "list", findings: review.top };
  const { intent, focus } = classifyMentorQuestion(question);
  if (focus === "survival") {
    const survival = all.filter((finding) => SURVIVAL_IDS.has(finding.id));
    // Sin nada de aguante que decir, mejor la lista normal que un título falso.
    if (survival.length === 0) return { mode: "list", findings: review.top };
    const others = all.filter((finding) => !SURVIVAL_IDS.has(finding.id));
    return { mode: "survival", findings: [...survival, ...others].slice(0, 3) };
  }
  if (intent === "explain_priority") return { mode: "main", findings: all.slice(0, 1) };
  return { mode: "list", findings: review.top };
}

import { classifyMentorQuestion } from "@shared/mentorIntent.js";
import type { QuickReviewFinding, QuickReviewResult } from "@shared/quickReview.js";

/**
 * Sin equipo, el Mentor contesta con la revisión rápida. Antes daba la misma
 * lista a cualquier pregunta; ahora la ordena según lo que se pregunta:
 *
 * - «¿Por qué muero?» (foco supervivencia): primero lo que hace aguantar
 *   (resistencias), aunque no sea lo que más frena en general.
 * - «Me falta daño» (foco daño): primero lo que hace pegar más (gema, arma,
 *   contagio, maldición, ascendencia), sin las resistencias.
 * - «¿Cuál es mi principal problema?» (explicar prioridad): solo el primero.
 * - Lo demás («¿Qué mejoro ahora?» o sin pregunta): los 3 que más frenan.
 */
export type MentorReviewMode = "survival" | "damage" | "main" | "list";

/** Lo que hace aguantar más golpes, según la revisión rápida. */
const SURVIVAL_IDS = new Set(["res"]);

/** Lo que hace pegar más, según la revisión rápida. */
const DAMAGE_IDS = new Set(["gem", "weapon", "contagion", "curse", "asc-first", "asc-second"]);

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
  if (focus === "damage") {
    // Solo lo que da daño: a quien pregunta por daño no se le contesta «mejor
    // resistencias». «all» ya viene ordenado por gravedad.
    const damage = all.filter((finding) => DAMAGE_IDS.has(finding.id));
    if (damage.length === 0) return { mode: "list", findings: review.top };
    return { mode: "damage", findings: damage.slice(0, 3) };
  }
  if (intent === "explain_priority") return { mode: "main", findings: all.slice(0, 1) };
  return { mode: "list", findings: review.top };
}

/**
 * Sin equipo, la pregunta llega igual al servidor: lo que es del juego (gemas,
 * árbol, resistencias…) lo contesta sin personaje. Si lo que pide es elegir
 * una mejora, el servidor responde «necesito completar tu personaje» sin
 * acción ni recomendaciones: esa es la señal para que conteste la revisión
 * rápida. Solo tiene sentido mirarlo mientras el personaje está incompleto.
 */
export function answerNeedsCharacter(answer: {
  intent: string;
  nextAction: unknown;
  usedRecommendationIds: readonly string[];
}): boolean {
  return (
    (answer.intent === "next_improvement" || answer.intent === "explain_priority") &&
    answer.nextAction === null &&
    answer.usedRecommendationIds.length === 0
  );
}

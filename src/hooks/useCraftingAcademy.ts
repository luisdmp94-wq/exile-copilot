import { useCallback, useMemo, useState } from "react";
import {
  ACADEMY_CONCEPTS,
  CRAFTING_ACADEMY_EXAM,
  CRAFTING_ACADEMY_LESSONS,
  allAcademyScenarios,
  pendingAcademyConcepts,
  type AcademyConceptId,
  type AcademyLesson,
  type AcademyScenario,
} from "@shared/craftingAcademy.js";
import {
  discardAcademyProgress,
  emptyAcademyProgress,
  loadAcademyProgress,
  saveAcademyProgress,
  type AcademyProgress,
  type AcademyStage,
} from "@/lib/craftingAcademyProgress";

export interface AcademyStep {
  scenario: AcademyScenario;
  lesson: AcademyLesson | null;
  /** Posición 1..n dentro del tramo actual (lecciones o examen). */
  position: number;
  total: number;
}

export interface AcademyPendingConcept {
  id: AcademyConceptId;
  label: string;
  recap: string;
}

export interface CraftingAcademyState {
  stage: AcademyStage;
  step: AcademyStep | null;
  /** Respuesta ya dada para el escenario actual; null si aún no ha respondido. */
  currentAnswer: { optionId: string; correct: boolean } | null;
  /** Aciertos y total del examen en curso, para el resultado educativo. */
  examScore: { correct: number; total: number };
  pendingConcepts: AcademyPendingConcept[];
  /** Escenarios del recorrido de lecciones ya respondidos. */
  lessonsAnswered: number;
  lessonsTotal: number;
  /** true si el examen en curso es un repaso de conceptos pendientes. */
  isRetry: boolean;
  hasProgress: boolean;
  start: () => void;
  answer: (optionId: string, correct: boolean) => void;
  next: () => void;
  retryPendingConcepts: () => void;
  restart: () => void;
}

const LESSON_ROUTE: AcademyStep[] = CRAFTING_ACADEMY_LESSONS.flatMap((lesson) =>
  lesson.scenarios.map((scenario) => ({ scenario, lesson, position: 0, total: 0 })),
).map((entry, index, all) => ({ ...entry, position: index + 1, total: all.length }));

const ALL_EXAM_IDS = CRAFTING_ACADEMY_EXAM.map((scenario) => scenario.id);
const SCENARIOS_BY_ID = new Map(allAcademyScenarios().map((scenario) => [scenario.id, scenario]));

function examSteps(ids: readonly string[]): AcademyStep[] {
  const scenarios = ids
    .map((id) => SCENARIOS_BY_ID.get(id))
    .filter((scenario): scenario is AcademyScenario => scenario !== undefined);
  return scenarios.map((scenario, index) => ({
    scenario,
    lesson: null,
    position: index + 1,
    total: scenarios.length,
  }));
}

/**
 * Máquina de estados del nivel básico.
 *
 * El progreso se lee UNA vez de forma perezosa y se guarda dentro de los
 * manejadores. No hay ningún `useEffect` que llame a `setState`: eso evita
 * renders en cascada y mantiene el estado consistente bajo Strict Mode, donde
 * cada componente se monta dos veces.
 */
export function useCraftingAcademy(): CraftingAcademyState {
  const [progress, setProgress] = useState<AcademyProgress>(
    () => loadAcademyProgress() ?? emptyAcademyProgress([...ALL_EXAM_IDS]),
  );
  const [restored] = useState(() => loadAcademyProgress() !== null);

  const commit = useCallback((next: AcademyProgress) => {
    setProgress(next);
    saveAcademyProgress(next);
  }, []);

  const currentExamSteps = useMemo(
    () => examSteps(progress.examScenarioIds.length > 0 ? progress.examScenarioIds : ALL_EXAM_IDS),
    [progress.examScenarioIds],
  );

  const step = useMemo<AcademyStep | null>(() => {
    if (progress.stage === "lesson") return LESSON_ROUTE[progress.cursor] ?? null;
    if (progress.stage === "exam") return currentExamSteps[progress.cursor] ?? null;
    return null;
  }, [progress.stage, progress.cursor, currentExamSteps]);

  const currentAnswer = step ? (progress.answers[step.scenario.id] ?? null) : null;

  const examScore = useMemo(() => {
    const answered = currentExamSteps.filter((entry) => progress.answers[entry.scenario.id]);
    return {
      correct: answered.filter((entry) => progress.answers[entry.scenario.id]?.correct).length,
      total: currentExamSteps.length,
    };
  }, [currentExamSteps, progress.answers]);

  const pendingConcepts = useMemo<AcademyPendingConcept[]>(
    () =>
      pendingAcademyConcepts(
        progress.answers,
        currentExamSteps.map((entry) => entry.scenario),
      ).map((id) => ({
        id,
        label: ACADEMY_CONCEPTS[id].label,
        recap: ACADEMY_CONCEPTS[id].recap,
      })),
    [currentExamSteps, progress.answers],
  );

  const lessonsAnswered = LESSON_ROUTE.filter(
    (entry) => progress.answers[entry.scenario.id] !== undefined,
  ).length;

  const start = useCallback(() => {
    commit({ ...progress, stage: "lesson", cursor: 0 });
  }, [commit, progress]);

  const answer = useCallback(
    (optionId: string, correct: boolean) => {
      if (!step) return;
      // La primera respuesta es la que cuenta: repetir la lección no reescribe
      // el resultado del examen ni infla los aciertos.
      if (progress.answers[step.scenario.id]) return;
      commit({
        ...progress,
        answers: { ...progress.answers, [step.scenario.id]: { optionId, correct } },
      });
    },
    [commit, progress, step],
  );

  const next = useCallback(() => {
    if (progress.stage === "lesson") {
      const nextCursor = progress.cursor + 1;
      if (nextCursor < LESSON_ROUTE.length) {
        commit({ ...progress, cursor: nextCursor });
        return;
      }
      commit({ ...progress, stage: "exam", cursor: 0, examScenarioIds: [...ALL_EXAM_IDS] });
      return;
    }
    if (progress.stage === "exam") {
      const nextCursor = progress.cursor + 1;
      if (nextCursor < currentExamSteps.length) {
        commit({ ...progress, cursor: nextCursor });
        return;
      }
      commit({ ...progress, stage: "results" });
    }
  }, [commit, progress, currentExamSteps.length]);

  const retryPendingConcepts = useCallback(() => {
    const pendingIds = new Set(pendingConcepts.map((concept) => concept.id));
    const retryIds = CRAFTING_ACADEMY_EXAM.filter((scenario) =>
      pendingIds.has(scenario.conceptId),
    ).map((scenario) => scenario.id);
    if (retryIds.length === 0) return;
    // Solo se limpian las respuestas de los conceptos pendientes: lo acertado
    // no se vuelve a preguntar.
    const answers = { ...progress.answers };
    for (const id of retryIds) delete answers[id];
    commit({ ...progress, stage: "exam", cursor: 0, answers, examScenarioIds: retryIds });
  }, [commit, pendingConcepts, progress]);

  const restart = useCallback(() => {
    discardAcademyProgress();
    const fresh = emptyAcademyProgress([...ALL_EXAM_IDS]);
    setProgress(fresh);
  }, []);

  return {
    stage: progress.stage,
    step,
    currentAnswer,
    examScore,
    pendingConcepts,
    lessonsAnswered,
    lessonsTotal: LESSON_ROUTE.length,
    isRetry: progress.examScenarioIds.length > 0 && progress.examScenarioIds.length < ALL_EXAM_IDS.length,
    hasProgress: restored || Object.keys(progress.answers).length > 0 || progress.stage !== "intro",
    start,
    answer,
    next,
    retryPendingConcepts,
    restart,
  };
}

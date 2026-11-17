import type { Recommendation } from "@shared/domain.js";
import {
  observationMethodForExpectedImpact,
  type DecisionOutcome,
} from "@shared/decisionSession.js";
import { pageLang } from "../i18n/lang";

export interface DecisionOutcomeOption {
  value: DecisionOutcome;
  label: string;
  description: string;
  defaultResult: string;
}

/** Las mismas opciones en inglés, en el mismo orden. */
const ENGLISH_OUTCOMES: Record<DecisionOutcome, Omit<DecisionOutcomeOption, "value">> = {
  resolved: {
    label: "Problem solved",
    description: "The change fixed what we were checking.",
    defaultResult: "The problem was solved when I tried the change.",
  },
  improved: {
    label: "Better, but still there",
    description: "It helped, but there is still work to do.",
    defaultResult: "The change made the problem better, but it's still there.",
  },
  unchanged: {
    label: "No change",
    description: "I didn't notice a real difference.",
    defaultResult: "I didn't notice a real difference after the change.",
  },
  worse: {
    label: "Got worse",
    description: "The change caused a problem or made the old one worse.",
    defaultResult: "Things got worse after the change.",
  },
  different: {
    label: "Something else happened",
    description: "We got a result we didn't expect.",
    defaultResult: "Something different from what we expected happened.",
  },
};

/** Orden deliberado: primero el cierre feliz; al final, lo inesperado. */
export const DECISION_OUTCOME_OPTIONS: readonly DecisionOutcomeOption[] = [
  {
    value: "resolved",
    label: "Problema resuelto",
    description: "El cambio solucionó lo que estábamos comprobando.",
    defaultResult: "El problema quedó resuelto al probar el cambio.",
  },
  {
    value: "improved",
    label: "Mejoró, pero continúa",
    description: "Ayudó, aunque todavía queda trabajo por hacer.",
    defaultResult: "El cambio mejoró el problema, pero todavía continúa.",
  },
  {
    value: "unchanged",
    label: "Sigue igual",
    description: "No noté una diferencia relevante.",
    defaultResult: "No observé una diferencia relevante después del cambio.",
  },
  {
    value: "worse",
    label: "Empeoró",
    description: "El cambio introdujo un problema o empeoró el anterior.",
    defaultResult: "El resultado empeoró después de aplicar el cambio.",
  },
  {
    value: "different",
    label: "Ocurrió algo diferente",
    description: "Apareció un resultado que no esperábamos.",
    defaultResult: "Ocurrió algo diferente de lo que esperábamos.",
  },
] as const;

/** Las opciones en el idioma que muestra la página. */
export function decisionOutcomeOptions(): readonly DecisionOutcomeOption[] {
  if (pageLang() !== "en") return DECISION_OUTCOME_OPTIONS;
  return DECISION_OUTCOME_OPTIONS.map((option) => ({ value: option.value, ...ENGLISH_OUTCOMES[option.value] }));
}

export function outcomeResultText(
  outcome: DecisionOutcome,
  observation: string,
): string {
  const base = decisionOutcomeOptions().find((option) => option.value === outcome);
  const detail = observation.trim();
  if (!base) return detail;
  return detail.length > 0 ? `${base.defaultResult} ${detail}` : base.defaultResult;
}

/**
 * Convierte la evidencia que ya tiene una recomendación en una instrucción
 * observable. No añade mecánicas ni umbrales de PoE2 que el motor no conozca.
 */
export function observationMethodForRecommendation(
  recommendation: Pick<Recommendation, "impact">,
): string {
  return observationMethodForExpectedImpact(recommendation.impact.description, pageLang());
}

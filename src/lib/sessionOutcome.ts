import type { Recommendation } from "@shared/domain.js";
import {
  observationMethodForExpectedImpact,
  type DecisionOutcome,
} from "@shared/decisionSession.js";

export interface DecisionOutcomeOption {
  value: DecisionOutcome;
  label: string;
  description: string;
  defaultResult: string;
}

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

export function outcomeResultText(
  outcome: DecisionOutcome,
  observation: string,
): string {
  const base = DECISION_OUTCOME_OPTIONS.find((option) => option.value === outcome);
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
  return observationMethodForExpectedImpact(recommendation.impact.description);
}

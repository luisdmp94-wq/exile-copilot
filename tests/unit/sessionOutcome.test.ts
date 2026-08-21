import { describe, expect, it } from "vitest";
import {
  conclusionForDecisionOutcome,
  DecisionSessionSchema,
} from "../../shared/decisionSession.js";
import {
  DECISION_OUTCOME_OPTIONS,
  observationMethodForRecommendation,
  outcomeResultText,
} from "../../src/lib/sessionOutcome.js";

describe("regreso de una prueba", () => {
  it("ofrece cinco respuestas cortas, estables y sin duplicados", () => {
    expect(DECISION_OUTCOME_OPTIONS.map((option) => option.value)).toEqual([
      "resolved",
      "improved",
      "unchanged",
      "worse",
      "different",
    ]);
    expect(new Set(DECISION_OUTCOME_OPTIONS.map((option) => option.value)).size).toBe(5);
  });

  it("solo cierra automáticamente cuando el jugador declara resuelto", () => {
    expect(conclusionForDecisionOutcome("resolved")).toBe("complete");
    expect(conclusionForDecisionOutcome("improved")).toBe("continue");
    expect(conclusionForDecisionOutcome("unchanged")).toBe("continue");
    expect(conclusionForDecisionOutcome("worse")).toBe("continue");
    expect(conclusionForDecisionOutcome("different")).toBe("continue");
    expect(conclusionForDecisionOutcome("different", true)).toBe("change_strategy");
  });

  it("compone un resultado válido aunque el comentario opcional quede vacío", () => {
    expect(outcomeResultText("unchanged", "")).toMatch(/no observé/i);
    expect(outcomeResultText("worse", "Los bosses me alcanzan antes.")).toContain(
      "Los bosses me alcanzan antes.",
    );
  });

  it("convierte el impacto existente en algo observable sin inventar mecánicas", () => {
    const text = observationMethodForRecommendation({
      impact: {
        metric: "supervivencia",
        description: "Reducir las muertes evitables.",
        magnitude: "high",
        isPartialMetric: true,
      },
    });
    expect(text).toContain("Reducir las muertes evitables.");
    expect(text).toMatch(/estadística o sensación empeoró/i);
  });

  it("carga resultados anteriores al Hito 6C sin inventarles una categoría", () => {
    const parsed = DecisionSessionSchema.parse({
      id: "sesion-legacy-6c",
      characterId: "personaje-legacy-6c",
      kind: "guided_decision",
      status: "waiting_result",
      objective: "Probar una mejora anterior",
      hypothesis: "Podría ayudar",
      unknowns: [],
      constraints: [],
      evidence: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      activeAction: null,
      blockedRecommendation: null,
      budget: null,
      lastResult: {
        text: "Parecía algo mejor.",
        subjective: true,
        unexpectedValuable: null,
        recordedAt: "2026-08-21T00:00:00.000Z",
      },
      conclusion: null,
      characterFingerprint: "abc",
      needsReconciliation: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    });

    expect(parsed.lastResult?.outcome).toBeNull();
    expect(parsed.lastResult?.text).toBe("Parecía algo mejor.");
  });
});

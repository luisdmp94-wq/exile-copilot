import { describe, expect, it } from "vitest";
import { journalNowTracksVisibleRecommendation } from "../../shared/recommendationInvalidation.js";

describe("transición de recomendación a siguiente paso", () => {
  const result = {
    recommendations: [{ id: "rec-visible" }, { id: "rec-alternativa" }],
  };

  it("reconoce que el diario acaba de guardar una recomendación del lote visible", () => {
    expect(
      journalNowTracksVisibleRecommendation(result, {
        primaryEntry: {
          recommendationSnapshot: { id: "rec-visible" },
        },
      }),
    ).toBe(true);
  });

  it("no oculta una invalidación real causada por otra decisión del diario", () => {
    expect(
      journalNowTracksVisibleRecommendation(result, {
        primaryEntry: {
          recommendationSnapshot: { id: "rec-anterior" },
        },
      }),
    ).toBe(false);
  });

  it("no confunde un diario vacío con una transición confirmada", () => {
    expect(
      journalNowTracksVisibleRecommendation(result, { primaryEntry: null }),
    ).toBe(false);
  });
});

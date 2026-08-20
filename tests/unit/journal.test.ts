import { describe, expect, it } from "vitest";
import { CreateJournalEntryRequestSchema } from "../../shared/api.js";
import {
  CharacterProfileSchema,
  RecommendationSchema,
} from "../../shared/domain.js";
import {
  compactRecommendationReason,
  journalEntryFromRecommendation,
} from "../../src/lib/journal.js";

const profile = CharacterProfileSchema.parse({
  id: "char-1",
  name: "Vaalsexaldur",
  characterClass: "Mercenary",
  ascendancy: "Gemling Legionnaire",
  ascendancyId: null,
  level: 67,
  archetype: "mercenary-crossbow",
  league: "Runes of Aldur",
  patch: "0.5.4f",
  items: [],
  skills: [],
  passives: { allocated: [] },
  attributes: { str: null, dex: null, int: null },
  resistances: { fire: 75, cold: 11, lightning: 75, chaos: null },
  sources: [],
  importedAt: "2026-08-20T10:00:00.000Z",
});

const recommendation = RecommendationSchema.parse({
  id: "rec-frio",
  priority: 1,
  title: "Cubrir resistencia de frío",
  action: "Enséñame el primer anillo candidato antes de comprarlo.",
  reason:
    "Tienes frío en 11%; es el cuello de botella defensivo conocido. Impacto esperado (high): supervivencia.",
  cost: { min: null, max: null, currency: "exalted", known: false },
  impact: {
    metric: "resistencia de frío",
    description: "Mejora parcial de supervivencia.",
    magnitude: "high",
    isPartialMetric: true,
  },
  risk: { level: "low", description: "Cambio de equipo reversible." },
  mayLoseValuableMods: true,
  irreversible: false,
  patch: "0.5.4f",
  sources: [
    {
      kind: "user",
      label: "Perfil del jugador",
      retrievedAt: "2026-08-20T10:00:00.000Z",
    },
  ],
  dataUpdatedAt: "2026-08-20T10:00:00.000Z",
  confidence: "high",
  unverified: ["Coste no verificado"],
  relatedItemIds: ["ring-1"],
});

describe("Character Journal", () => {
  it("convierte una recomendación en memoria auditable y una sola próxima acción", () => {
    const input = journalEntryFromRecommendation(
      recommendation,
      profile,
      { amount: 25, currency: "exalted" },
      "survival",
    );

    expect(input.kind).toBe("decision");
    expect(input.title).toBe(recommendation.title);
    expect(input.summary).toBe(
      "Tienes frío en 11%; es el cuello de botella defensivo conocido.",
    );
    expect(input.nextAction).toBe(recommendation.action);
    expect(input.makePrimary).toBe(true);
    expect(input.relatedItemIds).toEqual(["ring-1"]);
    expect(input.recommendationSnapshot).toEqual(recommendation);
    expect(input.context).toEqual({
      characterLevel: 67,
      league: "Runes of Aldur",
      patch: "0.5.4f",
      budget: { amount: 25, currency: "exalted" },
      goal: "survival",
    });
  });

  it("recorta un motivo largo sin inventar contenido", () => {
    const reason = "a".repeat(700);
    const compact = compactRecommendationReason(reason);
    expect(compact.length).toBe(598);
    expect(compact.endsWith("…")).toBe(true);
    expect(compact.slice(0, -1)).toBe(reason.slice(0, 597));
  });

  it("rechaza una entrada principal sin próxima acción", () => {
    const parsed = CreateJournalEntryRequestSchema.safeParse({
      kind: "note",
      title: "Nota",
      summary: "Contexto",
      nextAction: null,
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: 67,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: true,
    });
    expect(parsed.success).toBe(false);
  });
});

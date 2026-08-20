import { describe, expect, it } from "vitest";
import { CreateJournalEntryRequestSchema } from "../../shared/api.js";
import {
  CharacterJournalSchema,
  CharacterProfileSchema,
  JournalEntrySchema,
  MAX_JOURNAL_TITLE_LENGTH,
  RecommendationSchema,
  compactJournalTitle,
} from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
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

  it("recorta de forma segura un título generado antes de guardarlo", () => {
    const longRecommendation = RecommendationSchema.parse({
      ...recommendation,
      title: `Actualizar el perfil tras «${"x".repeat(160)}»`,
    });
    const input = journalEntryFromRecommendation(
      longRecommendation,
      profile,
      { amount: 25, currency: "exalted" },
      "survival",
    );
    expect(input.title).toHaveLength(160);
    expect(input.title.endsWith("…")).toBe(true);
    expect(CreateJournalEntryRequestSchema.safeParse(input).success).toBe(true);
  });

  it("recorta títulos sin dejar surrogates aislados (ASCII, emojis y frontera)", () => {
    // Un surrogate suelto es un alto sin su bajo, o un bajo sin su alto.
    const surrogateSuelto =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

    // Frontera exacta: 160 unidades se conservan tal cual; 161 se recortan.
    const justo = "a".repeat(MAX_JOURNAL_TITLE_LENGTH);
    expect(compactJournalTitle(justo)).toBe(justo);
    expect(compactJournalTitle(justo)).toHaveLength(MAX_JOURNAL_TITLE_LENGTH);

    const unaMas = "a".repeat(MAX_JOURNAL_TITLE_LENGTH + 1);
    const recortado = compactJournalTitle(unaMas);
    expect(recortado).toHaveLength(MAX_JOURNAL_TITLE_LENGTH);
    expect(recortado.endsWith("…")).toBe(true);
    expect(surrogateSuelto.test(recortado)).toBe(false);

    // Emoji partido justo en el corte: "🗡" ocupa 2 unidades y empieza en la
    // 159, así que el recorte por unidades caía en mitad del par.
    const emojiEnLaFrontera = `${"a".repeat(MAX_JOURNAL_TITLE_LENGTH - 2)}🗡🛡`;
    expect(emojiEnLaFrontera.length).toBeGreaterThan(MAX_JOURNAL_TITLE_LENGTH);
    const conEmoji = compactJournalTitle(emojiEnLaFrontera);
    expect(conEmoji.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(conEmoji.endsWith("…")).toBe(true);
    expect(surrogateSuelto.test(conEmoji)).toBe(false);
    // El emoji entero anterior al corte sobrevive; el partido desaparece.
    expect(conEmoji).toBe(`${"a".repeat(MAX_JOURNAL_TITLE_LENGTH - 2)}…`);

    // Título íntegramente de emojis: tampoco puede partir ninguno.
    const soloEmojis = "🗡".repeat(MAX_JOURNAL_TITLE_LENGTH);
    const emojisRecortados = compactJournalTitle(soloEmojis);
    expect(emojisRecortados.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(emojisRecortados.endsWith("…")).toBe(true);
    expect(surrogateSuelto.test(emojisRecortados)).toBe(false);

    // Un emoji completo justo antes del corte NO se descarta por precaución.
    const emojiCompletoAntes = `${"a".repeat(MAX_JOURNAL_TITLE_LENGTH - 3)}🗡bb`;
    const conservado = compactJournalTitle(emojiCompletoAntes);
    expect(conservado).toBe(`${"a".repeat(MAX_JOURNAL_TITLE_LENGTH - 3)}🗡…`);
    expect(surrogateSuelto.test(conservado)).toBe(false);
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

  it("acota los objetos relacionados que llegan desde el cliente", () => {
    const baseInput = {
      kind: "note",
      title: "Nota acotada",
      summary: "Contexto",
      nextAction: null,
      sources: [],
      context: {
        characterLevel: 67,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: false,
    };

    expect(
      CreateJournalEntryRequestSchema.safeParse({
        ...baseInput,
        relatedItemIds: Array.from({ length: 101 }, (_, index) => `item-${index}`),
      }).success,
    ).toBe(false);
    expect(
      CreateJournalEntryRequestSchema.safeParse({
        ...baseInput,
        relatedItemIds: ["x".repeat(201)],
      }).success,
    ).toBe(false);
  });

  it("proyecta solo la acción primaria y hasta diez resultados explícitos", () => {
    const primary = JournalEntrySchema.parse({
      id: "primary-1",
      characterId: profile.id,
      kind: "craft",
      status: "waiting_result",
      title: "Craft activo",
      summary: "Esperando el resultado real.",
      nextAction: "Aplicar una moneda.",
      result: null,
      relatedItemIds: ["weapon-1"],
      sources: [],
      context: {
        characterLevel: profile.level,
        league: profile.league,
        patch: profile.patch,
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:01:00.000Z",
      resolvedAt: null,
    });
    const completed = JournalEntrySchema.parse({
      ...primary,
      id: "completed-1",
      kind: "decision",
      status: "completed",
      title: recommendation.title,
      nextAction: null,
      result: "El anillo nuevo mantiene la vida.",
      recommendationSnapshot: recommendation,
      updatedAt: "2026-08-20T10:02:00.000Z",
      resolvedAt: "2026-08-20T10:02:00.000Z",
    });
    const journal = CharacterJournalSchema.parse({
      characterId: profile.id,
      primaryEntryId: primary.id,
      primaryEntry: primary,
      entries: [primary, completed],
    });

    const memory = buildRecommendationMemory(journal);
    expect(memory.primaryEntry?.entryId).toBe(primary.id);
    expect(memory.primaryEntry?.result).toBeNull();
    expect(memory.recentCompleted).toHaveLength(1);
    expect(memory.recentCompleted[0]).toMatchObject({
      entryId: completed.id,
      result: completed.result,
      recommendationId: recommendation.id,
    });
    expect(memory.revision).toMatch(/^journal-memory-v1:[0-9a-f]{16}$/);

    const changedResult = buildRecommendationMemory({
      ...journal,
      entries: [
        primary,
        { ...completed, result: "Un resultado distinto en el mismo timestamp." },
      ],
    });
    expect(changedResult.revision).not.toBe(memory.revision);

    const newerManualResults = Array.from({ length: 12 }, (_, index) => ({
      ...completed,
      id: `manual-${index}`,
      title: `Resultado manual ${index}`,
      recommendationSnapshot: null,
      updatedAt: `2026-08-21T10:${String(index).padStart(2, "0")}:00.000Z`,
      resolvedAt: `2026-08-21T10:${String(index).padStart(2, "0")}:00.000Z`,
    }));
    const memoryWithManualNoise = buildRecommendationMemory({
      ...journal,
      entries: [primary, ...newerManualResults, completed],
    });
    expect(memoryWithManualNoise.recentCompleted).toHaveLength(1);
    expect(memoryWithManualNoise.recentCompleted[0]?.entryId).toBe(completed.id);

    const profileSyncRecommendation = RecommendationSchema.parse({
      ...recommendation,
      id: "rec-memoria-resistencias-elementales",
      title: "Actualizar el perfil",
      actionKind: "profile_sync",
    });
    const newerProfileSyncResults = Array.from({ length: 12 }, (_, index) => ({
      ...completed,
      id: `profile-sync-${index}`,
      title: `Reconciliación ${index}`,
      recommendationSnapshot: profileSyncRecommendation,
      updatedAt: `2026-08-22T10:${String(index).padStart(2, "0")}:00.000Z`,
      resolvedAt: `2026-08-22T10:${String(index).padStart(2, "0")}:00.000Z`,
    }));
    const memoryWithProfileSyncNoise = buildRecommendationMemory({
      ...journal,
      entries: [primary, ...newerProfileSyncResults, completed],
    });
    expect(memoryWithProfileSyncNoise.recentCompleted).toHaveLength(1);
    expect(memoryWithProfileSyncNoise.recentCompleted[0]?.entryId).toBe(completed.id);
  });
});

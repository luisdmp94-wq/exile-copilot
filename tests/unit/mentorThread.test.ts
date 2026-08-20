import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterJournalSchema,
  CharacterProfileSchema,
  type CharacterJournal,
  type CharacterProfile,
} from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
import {
  MentorQueryRequestSchema,
  mentorInputsKey,
  type MentorQueryRequest,
} from "../../shared/mentorQuery.js";

/**
 * Hito 6A — invalidación del hilo conversacional.
 * La conversación NO se persiste: vive en memoria de la interfaz y se descarta
 * cuando cambia cualquier input relevante.
 */

function demoProfile(): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse(JSON.parse(raw));
}

function emptyJournal(characterId: string): CharacterJournal {
  return CharacterJournalSchema.parse({
    characterId,
    primaryEntryId: null,
    primaryEntry: null,
    entries: [],
  });
}

function requestFor(
  overrides: {
    question?: string;
    profile?: CharacterProfile;
    goal?: "survival" | "damage";
    budgetAmount?: number;
    league?: string;
    journal?: CharacterJournal | null;
  } = {},
): MentorQueryRequest {
  const profile = overrides.profile ?? demoProfile();
  const journal = overrides.journal === undefined ? emptyJournal(profile.id) : overrides.journal;
  return MentorQueryRequestSchema.parse({
    question: overrides.question ?? "¿Qué mejoro ahora?",
    profile,
    budget: { amount: overrides.budgetAmount ?? 50, currency: "chaos" },
    goal: { kind: overrides.goal ?? "survival" },
    league: overrides.league ?? "Runes of Aldur",
    patch: "0.5.4f",
    ...(journal ? { journalRevision: buildRecommendationMemory(journal).revision } : {}),
  });
}

describe("huella del hilo conversacional", () => {
  it("cambiar de pregunta NO invalida el hilo", () => {
    const a = mentorInputsKey(requestFor({ question: "¿Qué mejoro ahora?" }));
    const b = mentorInputsKey(requestFor({ question: "¿Por qué me recomiendas esto?" }));
    expect(b).toBe(a);
  });

  it("cambiar objetivo, presupuesto, liga o perfil SÍ invalida el hilo", () => {
    const base = mentorInputsKey(requestFor());
    expect(mentorInputsKey(requestFor({ goal: "damage" }))).not.toBe(base);
    expect(mentorInputsKey(requestFor({ budgetAmount: 999 }))).not.toBe(base);
    expect(mentorInputsKey(requestFor({ league: "Standard" }))).not.toBe(base);

    const otroPerfil = demoProfile();
    otroPerfil.life = 4321;
    expect(mentorInputsKey(requestFor({ profile: otroPerfil }))).not.toBe(base);
  });

  it("cambiar la revisión del diario SÍ invalida el hilo", () => {
    const profile = demoProfile();
    const conDiarioVacio = mentorInputsKey(requestFor({ profile }));

    const journalConEntrada = CharacterJournalSchema.parse({
      characterId: profile.id,
      primaryEntryId: "entry-1",
      primaryEntry: {
        id: "entry-1",
        characterId: profile.id,
        kind: "decision",
        status: "active",
        title: "Cubrir resistencias elementales",
        summary: "Anotado desde el mentor.",
        nextAction: "Compra un anillo de resistencia.",
        result: null,
        relatedItemIds: [],
        sources: [],
        context: {
          characterLevel: profile.level,
          league: profile.league,
          patch: profile.patch,
          budget: null,
          goal: null,
        },
        recommendationSnapshot: null,
        createdAt: "2026-08-21T10:00:00.000Z",
        updatedAt: "2026-08-21T10:00:00.000Z",
      },
      entries: [],
    });

    expect(mentorInputsKey(requestFor({ profile, journal: journalConEntrada }))).not.toBe(
      conDiarioVacio,
    );
  });

  it("el contrato descarta cualquier memoria inyectada por el cliente", () => {
    const profile = demoProfile();
    const parsed = MentorQueryRequestSchema.parse({
      question: "¿Qué mejoro ahora?",
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      journalRevision: "journal-memory-v1:abc",
      // El cliente no puede inyectar memoria: la clave se descarta.
      memory: { revision: "falsa", primaryEntry: null, recentCompleted: [] },
    });
    expect(Object.keys(parsed)).not.toContain("memory");
    expect(parsed.journalRevision).toBe("journal-memory-v1:abc");
  });

  it("sin diario cargado no se envía revisión (el servidor decide)", () => {
    expect(requestFor({ journal: null }).journalRevision).toBeUndefined();
  });
});

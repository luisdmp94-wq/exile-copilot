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
import { RecommendationMemorySchema } from "../../shared/domain.js";
import {
  initialMentorThreadState,
  lastMentorAnswer,
  mentorThreadReducer,
  savableNextAction,
  type MentorThreadState,
} from "../../src/lib/mentorThread.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import { createDatabase } from "../../server/db/database.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";
import { loadConfig } from "../../server/config.js";

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

  it("cambiar el contrato o la pieza activa de crafting SÍ invalida el hilo", () => {
    const profile = demoProfile();
    const selected = profile.items[0]!;
    const requestWithContext = (attemptLimit: 1 | 2 | 3, itemId = selected.id) =>
      MentorQueryRequestSchema.parse({
        ...requestFor({ profile }),
        contextEnvelope: {
          version: "1.0",
          activeArea: "crafting",
          character: { level: profile.level, characterClass: profile.characterClass },
          targetBuild: null,
          selectedItem: { id: itemId, name: selected.name || selected.baseType },
          craftingState: {
            mode: "coach",
            focus: "physical",
            rollMinimum: "high",
            attemptCurrent: 0,
            attemptLimit,
            phase: "planning",
            decision: null,
            nextAction: "regal",
          },
          activeRecommendationId: null,
          market: {
            budgetAmount: 50,
            budgetCurrency: "chaos",
            league: profile.league,
          },
          sessionActive: false,
          lastAction: null,
        },
      });

    const base = mentorInputsKey(requestWithContext(1));
    expect(mentorInputsKey(requestWithContext(2))).not.toBe(base);
    expect(mentorInputsKey(requestWithContext(1, "otra-pieza"))).not.toBe(base);
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

/**
 * Recuperación del 409 `memoria-diario-obsoleta`.
 *
 * El caso que fallaba: en la PRIMERA consulta el hilo todavía no tiene huella
 * de inputs, así que la invalidación por cambio de inputs no lo limpiaba y la
 * pregunta recién fallada se quedaba pintada. Al recargar el diario y volver a
 * preguntar, la misma pregunta aparecía dos veces.
 *
 * Estas regresiones empiezan SIEMPRE con el hilo vacío.
 */

const MENSAJE_409 = "La memoria del personaje cambió. Recárgala antes de volver a preguntar.";

function offlinePriceService(): PriceService {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  const client = new PoeNinjaClient({ db: createDatabase(":memory:"), config });
  return new PriceService(client);
}

/** Respuesta REAL del servicio: la acción guardable no es un fixture inventado. */
async function respuestaRealGuardable() {
  const profile = demoProfile();
  const answer = await answerMentorQuery(
    {
      question: "¿Qué mejoro ahora?",
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      memory: RecommendationMemorySchema.parse({
        revision: "journal-memory-v1:0000000000000000",
        primaryEntry: null,
        recentCompleted: [],
      }),
    },
    { priceService: offlinePriceService() },
  );
  return answer;
}

describe("hilo del mentor — recuperación del 409 de memoria obsoleta", () => {
  it("el hilo arranca vacío, sin error y sin huella", () => {
    expect(initialMentorThreadState.turns).toHaveLength(0);
    expect(initialMentorThreadState.error).toBeNull();
    expect(initialMentorThreadState.threadInputsKey).toBeNull();
  });

  it("un 409 en la PRIMERA pregunta retira el turno que acaba de fallar", () => {
    let state: MentorThreadState = initialMentorThreadState;

    state = mentorThreadReducer(state, {
      type: "ask",
      turnId: "player-1",
      question: "¿Qué mejoro ahora?",
    });
    expect(state.turns).toHaveLength(1);
    expect(state.loading).toBe(true);

    state = mentorThreadReducer(state, { type: "journal-stale", message: MENSAJE_409 });

    expect(state.turns).toHaveLength(0);
    expect(state.loading).toBe(false);
    expect(state.threadInputsKey).toBeNull();
    // El aviso permanece para que el jugador sepa por qué se reinició.
    expect(state.error).toBe(MENSAJE_409);
  });

  it("tras recargar el diario, reintentar no duplica la pregunta", () => {
    let state: MentorThreadState = initialMentorThreadState;
    const pregunta = "¿Qué mejoro ahora?";

    state = mentorThreadReducer(state, { type: "ask", turnId: "player-1", question: pregunta });
    state = mentorThreadReducer(state, { type: "journal-stale", message: MENSAJE_409 });
    // Reintento después de recargar el diario.
    state = mentorThreadReducer(state, { type: "ask", turnId: "player-2", question: pregunta });

    const repetidas = state.turns.filter((turn) => turn.role === "player" && turn.text === pregunta);
    expect(repetidas).toHaveLength(1);
    expect(state.error).toBeNull();
  });

  it("un 409 no deja respuesta antigua ni acción guardable obsoleta", async () => {
    const answer = await respuestaRealGuardable();
    // La respuesta del motor sobre un diario vacío sí ofrece acción guardable.
    expect(answer.nextAction?.canSaveToJournal).toBe(true);

    let state: MentorThreadState = initialMentorThreadState;
    state = mentorThreadReducer(state, {
      type: "ask",
      turnId: "player-1",
      question: "¿Qué mejoro ahora?",
    });
    state = mentorThreadReducer(state, {
      type: "answered",
      turnId: "mentor-1",
      answer,
      inputsKey: "clave-vieja",
    });
    expect(savableNextAction(state.turns)).not.toBeNull();

    state = mentorThreadReducer(state, {
      type: "ask",
      turnId: "player-2",
      question: "¿Cuál es mi principal problema?",
    });
    state = mentorThreadReducer(state, { type: "journal-stale", message: MENSAJE_409 });

    expect(state.turns).toHaveLength(0);
    expect(lastMentorAnswer(state.turns)).toBeNull();
    expect(savableNextAction(state.turns)).toBeNull();
    expect(state.threadInputsKey).toBeNull();
  });

  it("un fallo que NO es 409 conserva el hilo y solo retira la pregunta fallada", async () => {
    const answer = await respuestaRealGuardable();
    let state: MentorThreadState = initialMentorThreadState;

    state = mentorThreadReducer(state, {
      type: "ask",
      turnId: "player-1",
      question: "¿Qué mejoro ahora?",
    });
    state = mentorThreadReducer(state, {
      type: "answered",
      turnId: "mentor-1",
      answer,
      inputsKey: "clave",
    });
    state = mentorThreadReducer(state, {
      type: "ask",
      turnId: "player-2",
      question: "¿Cuál es mi principal problema?",
    });
    state = mentorThreadReducer(state, { type: "failed", message: "Red caída" });

    // Sigue la conversación válida anterior; la pregunta sin responder se va.
    expect(state.turns.map((turn) => turn.id)).toEqual(["player-1", "mentor-1"]);
    expect(state.error).toBe("Red caída");
    expect(state.threadInputsKey).toBe("clave");
  });

  it("una acción RECORDADA del diario nunca se ofrece como guardable", () => {
    const state = mentorThreadReducer(initialMentorThreadState, {
      type: "answered",
      turnId: "mentor-1",
      inputsKey: "clave",
      answer: {
        intent: "next_improvement",
        normalizedQuestion: "que mejoro ahora",
        answer: "Ya tienes una acción en marcha.",
        nextAction: {
          text: "Compra un anillo de resistencia.",
          recommendationId: null,
          relatedItemIds: [],
          canSaveToJournal: false,
          recommendation: null,
          recalledFromEntryId: "entry-1",
        },
        usedRecommendationIds: [],
        relatedItemIds: [],
        sources: [],
        confidence: null,
        unverified: [],
        memoryImpact: {
          revision: "journal-memory-v1:abc",
          blockedByPrimaryEntryId: "entry-1",
          usedEntryIds: [],
          repeatedRecommendationIds: [],
        },
        inputFingerprint: "huella",
        unsupported: null,
        generatedAt: "2026-08-21T10:00:00.000Z",
        engineVersion: "test",
      },
    });

    expect(lastMentorAnswer(state.turns)).not.toBeNull();
    expect(savableNextAction(state.turns)).toBeNull();
  });

  it("ignora una respuesta tardía después de invalidar la petición activa", async () => {
    const answer = await respuestaRealGuardable();
    let state = mentorThreadReducer(initialMentorThreadState, {
      type: "ask",
      turnId: "player-race",
      question: "¿Qué mejoro ahora?",
      requestId: "request-race",
    });

    state = mentorThreadReducer(state, { type: "clear" });
    const afterLateAnswer = mentorThreadReducer(state, {
      type: "answered",
      turnId: "mentor-race",
      answer,
      inputsKey: "obsoleta",
      requestId: "request-race",
    });

    expect(afterLateAnswer).toEqual(initialMentorThreadState);
    expect(afterLateAnswer.turns).toHaveLength(0);
  });
});

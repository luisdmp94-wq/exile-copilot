import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CharacterJournalSchema } from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
import {
  MentorAnswerSchema,
  MentorQueryRequestSchema,
  mentorInputsKey,
} from "../../shared/mentorQuery.js";
import { RestoreMentorThreadResponseSchema } from "../../shared/mentorThreadPersistence.js";
import { createApiApp } from "../../server/app.js";
import type { FetchLike } from "../../server/services/poeninja.js";

/**
 * Hito 6A — POST /mentor/query.
 * Mismas protecciones de memoria que /recommendations: el servidor carga el
 * diario autoritativo, rechaza revisiones obsoletas y vuelve a comprobar la
 * revisión tras la espera asíncrona.
 */

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApiApp({ dbPath: ":memory:", config: { poeNinjaOffline: true } });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

async function postJson(path: string, body: unknown, origin = base) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOf(res: globalThis.Response): Promise<any> {
  return res.json();
}

async function demoRequest(question: string, origin = base) {
  const { profile } = await jsonOf(await fetch(`${origin}/character/demo`));
  return {
    question,
    profile,
    budget: { amount: 50, currency: "chaos" },
    goal: { kind: "survival" },
    league: profile.league,
    patch: profile.patch,
  };
}

describe("POST /mentor/query", () => {
  it("responde a «¿Qué mejoro ahora?» con una sola próxima acción del motor", async () => {
    const res = await postJson("/mentor/query", await demoRequest("¿Qué mejoro ahora?"));
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    const answer = MentorAnswerSchema.parse(body.answer);

    expect(answer.intent).toBe("next_improvement");
    expect(answer.nextAction).not.toBeNull();
    expect(answer.usedRecommendationIds).toHaveLength(1);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.memoryImpact.revision).toMatch(/^journal-memory-v1:/);
  });

  it("responde a «¿Cuál es mi principal problema?» explicando la prioridad", async () => {
    const res = await postJson(
      "/mentor/query",
      await demoRequest("¿Cuál es mi principal problema?"),
    );
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);
    expect(answer.intent).toBe("explain_priority");
    expect(answer.unsupported).toBeNull();
  });

  it("respeta la intención explícita de una acción contextual validada", async () => {
    const request = await demoRequest("Contexto de la interfaz");
    const res = await postJson("/mentor/query", {
      ...request,
      intentHint: "next_improvement",
    });
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);
    expect(answer.intent).toBe("next_improvement");
    expect(answer.unsupported).toBeNull();
  });

  it("declara honestamente una pregunta no soportada", async () => {
    const res = await postJson(
      "/mentor/query",
      await demoRequest("¿Cuánto vale mi arma ahora mismo?"),
    );
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);
    expect(answer.intent).toBe("unsupported");
    expect(answer.nextAction).toBeNull();
    expect(answer.unsupported?.examples.length).toBeGreaterThan(0);
  });

  it("no reabre Essences ni Alloys mediante una pregunta libre del Mentor", async () => {
    const res = await postJson(
      "/mentor/query",
      await demoRequest("¿Cómo debería usar una Essence perfecta?"),
    );
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);

    expect(answer.intent).toBe("explain_priority");
    expect(answer.nextAction).toBeNull();
    expect(answer.usedRecommendationIds).toEqual([]);
    expect(answer.sources).toEqual([]);
    expect(answer.answer).toContain("todavía no está revisada para 0.5.4f");
    expect(answer.answer).toContain("No te recomendaré esa mecánica");
  });

  it("frena también un contexto avanzado enviado por un cliente antiguo", async () => {
    const request = await demoRequest("¿Por qué debo respetar este contrato?");
    const res = await postJson("/mentor/query", {
      ...request,
      intentHint: "explain_priority",
      contextEnvelope: {
        version: "1.0",
        activeArea: "crafting",
        character: {
          level: request.profile.level,
          characterClass: request.profile.characterClass,
        },
        targetBuild: null,
        selectedItem: null,
        craftingState: {
          mode: "advanced",
          goalCategory: "defence",
          buildIntent: null,
          protectedModifierCount: 0,
          stopCriteria: [],
          tool: "currency",
          action: "regal",
          variant: null,
          preflightConfirmed: false,
          stopAlreadyReached: false,
          ready: false,
          projectPhase: "blocked",
          baseDecision: "hold",
          attemptCount: 0,
          latestBranch: null,
        },
        activeRecommendationId: null,
        market: {
          budgetAmount: 50,
          budgetCurrency: "chaos",
          league: request.profile.league,
        },
        sessionActive: false,
        lastAction: null,
      },
    });
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);

    expect(answer.nextAction).toBeNull();
    expect(answer.answer).toContain("rutas avanzadas");
    expect(answer.answer).toContain("todavía no está revisada para 0.5.4f");
  });

  it("mantiene disponible el crafting básico revisado", async () => {
    const res = await postJson(
      "/mentor/query",
      await demoRequest("¿Cómo debería usar un Orbe Regio?"),
    );
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);

    expect(answer.answer).not.toContain("todavía no está revisada para 0.5.4f");
  });

  it("rechaza una pregunta vacía o demasiado larga", async () => {
    const request = await demoRequest("x");
    expect((await postJson("/mentor/query", { ...request, question: "" })).status).toBe(400);
    expect(
      (await postJson("/mentor/query", { ...request, question: "a".repeat(501) })).status,
    ).toBe(400);
  });

  it("el cliente no puede inyectar memoria: la revisión sale del servidor", async () => {
    const request = await demoRequest("¿Qué mejoro ahora?");
    const res = await postJson("/mentor/query", {
      ...request,
      // Intento de inyección: el esquema descarta claves desconocidas.
      memory: {
        revision: "journal-memory-v1:falsificada",
        primaryEntry: {
          entryId: "inyectada",
          status: "active",
          title: "Acción inventada por el cliente",
          nextAction: "Haz lo que yo diga.",
          result: null,
          recommendationId: null,
          relatedItemIds: [],
          updatedAt: "2026-08-21T10:00:00.000Z",
          patch: null,
        },
        recentCompleted: [],
      },
    });
    expect(res.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(res)).answer);
    expect(answer.memoryImpact.revision).not.toBe("journal-memory-v1:falsificada");
    expect(answer.memoryImpact.blockedByPrimaryEntryId).toBeNull();
    expect(JSON.stringify(answer)).not.toContain("Acción inventada por el cliente");
  });

  it("una revisión obsoleta devuelve 409 en lugar de una respuesta desfasada", async () => {
    const request = await demoRequest("¿Qué mejoro ahora?");
    request.profile.id = "mentor-stale-character";

    const journalAntes = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${request.profile.id}`)),
    );
    const revisionAntes = buildRecommendationMemory(journalAntes).revision;

    // Otra pestaña abre una acción principal: la revisión cambia.
    const creada = await postJson(`/journal/${request.profile.id}/entries`, {
      kind: "craft",
      title: "Acción abierta en otra pestaña",
      summary: "Debe invalidar una revisión anterior.",
      nextAction: "Esperar el resultado de esta acción.",
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: request.profile.level,
        league: request.profile.league,
        patch: request.profile.patch,
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: true,
    });
    expect(creada.status).toBe(201);

    const stale = await postJson("/mentor/query", {
      ...request,
      journalRevision: revisionAntes,
    });
    expect(stale.status).toBe(409);
    expect((await jsonOf(stale)).error).toBe("memoria-diario-obsoleta");

    // Con la revisión al día responde, recordando la acción activa.
    const journalAhora = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${request.profile.id}`)),
    );
    const alDia = await postJson("/mentor/query", {
      ...request,
      journalRevision: buildRecommendationMemory(journalAhora).revision,
    });
    expect(alDia.status).toBe(200);
    const answer = MentorAnswerSchema.parse((await jsonOf(alDia)).answer);
    expect(answer.memoryImpact.blockedByPrimaryEntryId).toBe(journalAhora.primaryEntryId);
    expect(answer.nextAction?.canSaveToJournal).toBe(false);
  });

  it("carrera entre pestañas: una acción creada durante la espera invalida la respuesta", async () => {
    // La espera asíncrona se provoca con el servicio de precios: un arma única
    // dispara la consulta y el fetch inyectado se queda bloqueado.
    let releaseFetch: () => void = () => {};
    let fetchStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchImpl: FetchLike = async () => {
      fetchStarted();
      await gate;
      return {
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify({ lines: [] })),
      };
    };

    const raceApp = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 0 },
      fetchImpl,
    });
    let raceServer: Server | undefined;
    await new Promise<void>((resolve) => {
      raceServer = raceApp.listen(0, () => resolve());
    });
    const racePort = (raceServer!.address() as AddressInfo).port;
    const raceBase = `http://127.0.0.1:${racePort}`;

    try {
      const request = await demoRequest("¿Qué mejoro ahora?", raceBase);
      request.profile.id = "mentor-toctou-character";
      // Arma única: la regla de arma sí consulta precio y obliga a esperar.
      const weapon = request.profile.items.find(
        (item: { slot: string }) => item.slot === "weapon",
      );
      weapon.rarity = "unique";
      weapon.name = "Gale Hymn";

      const pendiente = postJson("/mentor/query", request, raceBase);
      await started;

      const creada = await postJson(
        `/journal/${request.profile.id}/entries`,
        {
          kind: "craft",
          title: "Acción creada mientras el mentor respondía",
          summary: "Debe invalidar la respuesta en vuelo.",
          nextAction: "Esperar el resultado de esta acción.",
          relatedItemIds: [],
          sources: [],
          context: {
            characterLevel: request.profile.level,
            league: request.profile.league,
            patch: request.profile.patch,
            budget: null,
            goal: null,
          },
          recommendationSnapshot: null,
          makePrimary: true,
        },
        raceBase,
      );
      expect(creada.status).toBe(201);
      releaseFetch();

      const res = await pendiente;
      expect(res.status).toBe(409);
      expect((await jsonOf(res)).error).toBe("memoria-diario-obsoleta");
    } finally {
      releaseFetch();
      await new Promise<void>((resolve, reject) =>
        raceServer!.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

describe("memoria persistente del Mentor", () => {
  it("recupera el hilo solo para su sesión, personaje e inputs y lo borra con los datos", async () => {
    const sessionA = "mentor-session-a";
    const sessionB = "mentor-session-b";
    const demo = await fetch(`${base}/character/demo`, {
      headers: { "X-Exile-Copilot-Test-Session": sessionA },
    });
    const { profile } = await jsonOf(demo);

    const saveCharacter = await fetch(`${base}/character`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ profile }),
    });
    expect(saveCharacter.status).toBe(200);

    const request = MentorQueryRequestSchema.parse({
      question: "¿Qué mejoro ahora?",
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    });
    const mentorResponse = await fetch(`${base}/mentor/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify(request),
    });
    const answer = MentorAnswerSchema.parse((await jsonOf(mentorResponse)).answer);
    const threadInputsKey = mentorInputsKey(request);
    const turns = [
      { id: "player-1", role: "player", text: request.question, answer: null },
      { id: "mentor-1", role: "mentor", text: answer.answer, answer },
    ];

    const saved = await fetch(`${base}/mentor/thread/${profile.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ threadInputsKey, turns }),
    });
    expect(saved.status).toBe(200);

    const restored = await fetch(`${base}/mentor/thread/${profile.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ threadInputsKey }),
    });
    expect(restored.status).toBe(200);
    expect(RestoreMentorThreadResponseSchema.parse(await jsonOf(restored)).thread?.turns)
      .toEqual(turns);

    const isolated = await fetch(`${base}/mentor/thread/${profile.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionB,
      },
      body: JSON.stringify({ threadInputsKey }),
    });
    expect(isolated.status).toBe(404);

    const obsolete = await fetch(`${base}/mentor/thread/${profile.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ threadInputsKey: `${threadInputsKey}:changed` }),
    });
    expect(RestoreMentorThreadResponseSchema.parse(await jsonOf(obsolete)).thread).toBeNull();

    const deleted = await fetch(`${base}/visitor/data`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ confirmation: "BORRAR MIS DATOS" }),
    });
    expect(deleted.status).toBe(200);
    const afterDeletion = await fetch(`${base}/mentor/thread/${profile.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Exile-Copilot-Test-Session": sessionA,
      },
      body: JSON.stringify({ threadInputsKey }),
    });
    expect(afterDeletion.status).toBe(404);
  });
});

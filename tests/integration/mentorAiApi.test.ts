import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import type { CharacterProfile } from "../../shared/domain.js";
import type { MentorAnswer } from "../../shared/mentorQuery.js";
import { createApiApp } from "../../server/app.js";
import type { MentorDecisionSelector } from "../../server/mentor/mentorAi.js";

async function withServer<T>(
  selector: MentorDecisionSelector,
  run: (base: string) => Promise<T>,
): Promise<T> {
  const app = createApiApp({
    dbPath: ":memory:",
    config: { poeNinjaOffline: true },
    mentorSelector: selector,
  });
  let server: Server | undefined;
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server!.address() as AddressInfo).port;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function post(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function request(base: string, question: string) {
  const { profile } = await json<{ profile: CharacterProfile }>(
    await fetch(`${base}/character/demo`),
  );
  return {
    question,
    profile,
    budget: { amount: 50, currency: "chaos" },
    goal: { kind: "survival" },
    league: profile.league,
    patch: profile.patch,
  };
}

describe("POST /mentor/query — Hito 6E", () => {
  it("envía null a la IA cuando el nivel del perfil es solo un placeholder", async () => {
    let receivedLevel: number | null | undefined;
    const selector: MentorDecisionSelector = {
      name: "modelo-contexto",
      select: async (context) => {
        receivedLevel = context.character.level;
        return {
          kind: "no_safe_action",
          recommendationId: null,
          missingFactId: null,
        };
      },
    };

    await withServer(selector, async (base) => {
      const body = await request(base, "¿Qué mejoro ahora?");
      body.profile.level = 1;
      body.profile.levelSource = "placeholder";
      const response = await post(base, "/mentor/query", body);
      expect(response.status).toBe(200);
      expect(receivedLevel).toBeNull();
    });
  });

  it("acepta una pregunta libre y devuelve una acción canónica elegida por IA", async () => {
    const selector: MentorDecisionSelector = {
      name: "modelo-integracion",
      select: async (context) => ({
        kind: "choose_recommendation",
        recommendationId: context.candidates[0]!.id,
        missingFactId: null,
      }),
    };
    await withServer(selector, async (base) => {
      const response = await post(
        base,
        "/mentor/query",
        await request(base, "Estoy muriendo: ¿qué tocarías sin romper mi build?"),
      );
      expect(response.status).toBe(200);
      const { answer } = await json<{ answer: MentorAnswer }>(response);
      expect(answer.responseMode).toBe("ai");
      expect(answer.model).toBe("modelo-integracion");
      expect(answer.nextAction).not.toBeNull();
      expect(answer.nextAction?.recommendation).not.toBeNull();
      const nextAction = answer.nextAction!;
      const recommendation = nextAction.recommendation!;
      expect(recommendation.id).toBe(answer.usedRecommendationIds[0]);
      expect(nextAction.text).toBe(recommendation.action);
    });
  });

  it("mantiene la protección de carrera mientras la IA está pensando", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const selecting = new Promise<void>((resolve) => {
      started = resolve;
    });
    const selector: MentorDecisionSelector = {
      name: "modelo-lento",
      select: async (context) => {
        started();
        await gate;
        return {
          kind: "choose_recommendation",
          recommendationId: context.candidates[0]!.id,
          missingFactId: null,
        };
      },
    };

    await withServer(selector, async (base) => {
      const body = await request(base, "¿Qué mejoro ahora?");
      body.profile.id = "mentor-ai-race";
      const pending = post(base, "/mentor/query", body);
      await selecting;

      const created = await post(base, `/journal/${body.profile.id}/entries`, {
        kind: "decision",
        title: "Decisión creada en otra pestaña",
        summary: "Debe invalidar la respuesta de IA que sigue en vuelo.",
        nextAction: "Completar esta acción antes de abrir otra.",
        relatedItemIds: [],
        sources: [],
        context: {
          characterLevel: body.profile.level,
          league: body.profile.league,
          patch: body.profile.patch,
          budget: null,
          goal: null,
        },
        recommendationSnapshot: null,
        makePrimary: true,
      });
      expect(created.status).toBe(201);
      release();

      const response = await pending;
      expect(response.status).toBe(409);
      expect((await json<{ error: string }>(response)).error).toBe(
        "memoria-diario-obsoleta",
      );
    });
  });
});

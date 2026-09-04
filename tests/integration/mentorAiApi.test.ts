import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import type { CharacterProfile } from "../../shared/domain.js";
import type { MentorAnswer } from "../../shared/mentorQuery.js";
import { createApiApp } from "../../server/app.js";
import {
  MentorAiError,
  type MentorDecisionSelector,
} from "../../server/mentor/mentorAi.js";

async function withServer<T>(
  selector: MentorDecisionSelector,
  run: (base: string) => Promise<T>,
): Promise<T> {
  const app = createApiApp({
    dbPath: ":memory:",
    config: { poeNinjaOffline: true, mentorAiProvider: "groq" },
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
  it("no consulta la IA para una mecánica avanzada no revisada", async () => {
    const select = vi.fn();
    const selector: MentorDecisionSelector = {
      name: "modelo-no-debe-usarse",
      select,
    };

    await withServer(selector, async (base) => {
      const response = await post(
        base,
        "/mentor/query",
        await request(base, "¿Cómo uso un Alloy en este objeto?"),
      );
      expect(response.status).toBe(200);
      const { answer } = await json<{ answer: MentorAnswer }>(response);

      expect(select).not.toHaveBeenCalled();
      expect(answer.responseMode).toBe("rules");
      expect(answer.nextAction).toBeNull();
      expect(answer.answer).toContain("todavía no está revisada para 0.5.4f");
    });
  });

  it("no permite que una pista de conversación eluda una mecánica no revisada", async () => {
    const select = vi.fn();
    const selector: MentorDecisionSelector = {
      name: "modelo-no-debe-usarse",
      select,
    };

    await withServer(selector, async (base) => {
      const body = await request(base, "Cuéntame cómo funcionan los Alloys");
      const response = await post(base, "/mentor/query", {
        ...body,
        intentHint: "conversation",
      });
      expect(response.status).toBe(200);
      const { answer } = await json<{ answer: MentorAnswer }>(response);

      expect(select).not.toHaveBeenCalled();
      expect(answer.responseMode).toBe("rules");
      expect(answer.nextAction).toBeNull();
      expect(answer.answer).toContain("todavía no está revisada para 0.5.4f");
    });
  });

  it("no consulta la IA cuando el parche completo todavía no está operativo", async () => {
    const select = vi.fn();
    const selector: MentorDecisionSelector = {
      name: "modelo-no-debe-usarse",
      select,
    };

    await withServer(selector, async (base) => {
      const body = await request(base, "¿Qué mejoro ahora?");
      body.profile.patch = "0.5.5";
      body.patch = "0.5.5";

      const response = await post(base, "/mentor/query", body);
      expect(response.status).toBe(422);
      expect((await json<{ error: string }>(response)).error).toBe(
        "parche-sin-revisar",
      );
      expect(select).not.toHaveBeenCalled();
    });
  });

  it("registra un respaldo del proveedor sin copiar la pregunta ni el motivo", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const selector: MentorDecisionSelector = {
      name: "modelo-no-disponible",
      select: async () => {
        throw new MentorAiError(
          "Proveedor no disponible; DETALLE_INTERNO que no debe registrarse.",
        );
      },
    };

    try {
      await withServer(selector, async (base) => {
        const privateQuestion = "Pregunta privada sobre el arco de Luis";
        const response = await post(
          base,
          "/mentor/query",
          await request(base, privateQuestion),
        );
        expect(response.status).toBe(200);
        const { answer } = await json<{ answer: MentorAnswer }>(response);
        expect(answer.responseMode).toBe("rules_fallback");

        const eventLine = warning.mock.calls
          .map((call) => String(call[0]))
          .find((line) => line.includes("mentor_provider_fallback"));
        expect(eventLine).toBeDefined();
        expect(JSON.parse(eventLine!)).toMatchObject({
          event: "mentor_provider_fallback",
          provider: "groq",
          category: "provider_unavailable",
        });
        expect(eventLine).not.toContain(privateQuestion);
        expect(eventLine).not.toContain("DETALLE_INTERNO");
      });
    } finally {
      warning.mockRestore();
    }
  });

  it("no consulta la IA cuando el nivel del perfil es solo un placeholder", async () => {
    let selectorCalls = 0;
    const selector: MentorDecisionSelector = {
      name: "modelo-contexto",
      select: async () => {
        selectorCalls += 1;
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
      const { answer } = await json<{ answer: MentorAnswer }>(response);
      expect(selectorCalls).toBe(0);
      expect(answer.responseMode).toBe("rules");
      expect(answer.nextAction).toBeNull();
      expect(answer.answer).toContain("Faltan: nivel");
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

  it("usa la identidad anónima del navegador para antiabuso, no el id del personaje", async () => {
    const safetyIdentifiers: string[] = [];
    const selector: MentorDecisionSelector = {
      name: "modelo-privacidad",
      select: async (context, safetyIdentifier) => {
        safetyIdentifiers.push(safetyIdentifier);
        return {
          kind: "choose_recommendation",
          recommendationId: context.candidates[0]!.id,
          missingFactId: null,
        };
      },
    };

    await withServer(selector, async (base) => {
      const first = await request(base, "¿Qué mejoro ahora?");
      first.profile.id = "personaje-privado-uno";
      const second = await request(base, "¿Qué mejoro después?");
      second.profile.id = "personaje-privado-dos";

      expect((await post(base, "/mentor/query", first)).status).toBe(200);
      expect((await post(base, "/mentor/query", second)).status).toBe(200);
    });

    expect(safetyIdentifiers).toHaveLength(2);
    expect(safetyIdentifiers[0]).toMatch(/^ec_[a-f0-9]{32}$/);
    expect(safetyIdentifiers[1]).toBe(safetyIdentifiers[0]);
    expect(safetyIdentifiers.join(" ")).not.toContain("personaje-privado");
  });
});

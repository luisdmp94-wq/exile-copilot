import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../server/config.js";
import {
  createMentorDecisionSelector,
  MentorAiError,
  ResponsesMentorSelector,
  type MentorAiContext,
} from "../../server/mentor/mentorAi.js";

function context(): MentorAiContext {
  return {
    question: "¿Qué mejoro ahora?",
    heuristicIntent: "next_improvement",
    conversation: [],
    character: {
      level: 70,
      characterClass: "Mercenary",
      ascendancy: "Gemling Legionnaire",
      archetype: null,
      life: 2100,
      energyShield: 0,
      armour: null,
      evasion: null,
      resistances: { fire: 75, cold: 61, lightning: 40, chaos: 0 },
    },
    goal: { kind: "survival", note: null },
    budget: { amount: 50, currency: "chaos" },
    activeAction: null,
    buildMemory: [],
    items: [],
    candidates: [
      {
        id: "rec-resistencias-elementales",
        priority: 1,
        title: "Cubrir resistencias",
        action: "Sube frío y rayo hasta el cap.",
        reason: "Están por debajo del cap.",
        confidence: "high",
        actionKind: "game_change",
        relatedItemIds: [],
        missingFactIds: [],
      },
    ],
    missingFacts: [],
  };
}

function config(
  apiKey: string | null = "test-key",
  provider: "groq" | "openai" = "groq",
) {
  return {
    ...loadConfig({}),
    mentorAiEnabled: true,
    mentorAiProvider: provider,
    mentorAiApiKey: apiKey,
    mentorAiModel:
      provider === "groq" ? "openai/gpt-oss-120b" : "gpt-5.4-mini",
  };
}

describe("ResponsesMentorSelector", () => {
  it("no construye un cliente externo si el interruptor está activo pero falta la clave", () => {
    expect(createMentorDecisionSelector(config(null))).toBeNull();
  });

  it("usa Groq Responses con salida estructurada y sin campos incompatibles", async () => {
    let requestBody: Record<string, unknown> | null = null;
    let authorization = "";
    let endpoint = "";
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      endpoint = String(input);
      requestBody = JSON.parse(String(init?.body));
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    kind: "choose_recommendation",
                    recommendationId: "rec-resistencias-elementales",
                    missingFactId: null,
                    message: "Empezaría por cubrir las resistencias más bajas.",
                    followUpQuestion: null,
                    groundedRecommendationIds: ["rec-resistencias-elementales"],
                    groundedMissingFactIds: [],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const selector = new ResponsesMentorSelector(config(), fetchImpl);
    const decision = await selector.select(context(), "ec_test");

    expect(decision.recommendationId).toBe("rec-resistencias-elementales");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(endpoint).toBe("https://api.groq.com/openai/v1/responses");
    expect(authorization).toBe("Bearer test-key");
    expect(requestBody).toMatchObject({
      model: "openai/gpt-oss-120b",
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "exile_copilot_mentor_decision",
          strict: true,
        },
      },
    });
    expect(requestBody).not.toHaveProperty("store");
    expect(requestBody).not.toHaveProperty("safety_identifier");
    expect(JSON.stringify(requestBody)).not.toContain("test-key");
  });

  it("reintenta una sola vez si Groq no consigue validar la salida estructurada", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "json_validate_failed" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      kind: "explain_context",
                      recommendationId: null,
                      missingFactId: null,
                      message: null,
                      followUpQuestion: null,
                      groundedRecommendationIds: [],
                      groundedMissingFactIds: [],
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    try {
      const selector = new ResponsesMentorSelector(config(), fetchImpl);
      const decision = await selector.select(context(), "ec_test");

      expect(decision.kind).toBe("explain_context");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("reintento=si"));
    } finally {
      warn.mockRestore();
    }
  });

  it("conserva los campos de seguridad al usar OpenAI", async () => {
    let endpoint = "";
    let requestBody: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      endpoint = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    kind: "choose_recommendation",
                    recommendationId: "rec-resistencias-elementales",
                    missingFactId: null,
                    message: "Empezaría por cubrir las resistencias más bajas.",
                    followUpQuestion: null,
                    groundedRecommendationIds: ["rec-resistencias-elementales"],
                    groundedMissingFactIds: [],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const selector = new ResponsesMentorSelector(config("openai-key", "openai"), fetchImpl);
    await selector.select(context(), "ec_test");

    expect(endpoint).toBe("https://api.openai.com/v1/responses");
    expect(requestBody).toMatchObject({
      store: false,
      safety_identifier: "ec_test",
    });
  });

  it("frena sin clave y no intenta ninguna llamada", async () => {
    const fetchImpl = vi.fn();
    const selector = new ResponsesMentorSelector(config(null), fetchImpl);
    await expect(selector.select(context(), "ec_test")).rejects.toMatchObject({
      safeReason: expect.stringContaining("GROQ_API_KEY"),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("trata una negativa como fallo recuperable", async () => {
    const selector = new ResponsesMentorSelector(
      config(),
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              { type: "message", content: [{ type: "refusal", refusal: "No puedo." }] },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await expect(selector.select(context(), "ec_test")).rejects.toBeInstanceOf(
      MentorAiError,
    );
  });
});

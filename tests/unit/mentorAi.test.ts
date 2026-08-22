import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../server/config.js";
import {
  MentorAiError,
  OpenAiMentorSelector,
  type MentorAiContext,
} from "../../server/mentor/mentorAi.js";

function context(): MentorAiContext {
  return {
    question: "¿Qué mejoro ahora?",
    heuristicIntent: "next_improvement",
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

function config(apiKey: string | null = "test-key") {
  return {
    ...loadConfig({}),
    mentorAiEnabled: true,
    mentorAiApiKey: apiKey,
    mentorAiModel: "gpt-5.4-mini",
  };
}

describe("OpenAiMentorSelector", () => {
  it("usa Responses, store:false y salida estructurada sin exponer la clave", async () => {
    let requestBody: Record<string, unknown> | null = null;
    let authorization = "";
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
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
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const selector = new OpenAiMentorSelector(config(), fetchImpl);
    const decision = await selector.select(context(), "ec_test");

    expect(decision.recommendationId).toBe("rec-resistencias-elementales");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(authorization).toBe("Bearer test-key");
    expect(requestBody).toMatchObject({
      model: "gpt-5.4-mini",
      store: false,
      safety_identifier: "ec_test",
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "exile_copilot_mentor_decision",
          strict: true,
        },
      },
    });
    expect(JSON.stringify(requestBody)).not.toContain("test-key");
  });

  it("frena sin clave y no intenta ninguna llamada", async () => {
    const fetchImpl = vi.fn();
    const selector = new OpenAiMentorSelector(config(null), fetchImpl);
    await expect(selector.select(context(), "ec_test")).rejects.toMatchObject({
      safeReason: expect.stringContaining("OPENAI_API_KEY"),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("trata una negativa como fallo recuperable", async () => {
    const selector = new OpenAiMentorSelector(
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

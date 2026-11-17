import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationMemorySchema,
  type CharacterProfile,
  type RecommendationMemory,
} from "../../shared/domain.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";

/** El Mentor sin IA (por reglas) contesta en el idioma de la página. */

function demoProfile(): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse(JSON.parse(raw));
}

function memory(primary = false): RecommendationMemory {
  return RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: primary
      ? {
          entryId: "entry-activa",
          status: "waiting_result",
          title: "Cover elemental resistances",
          nextAction: "Buy a ring with fire resistance and equip it.",
          result: null,
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: ["demo-item-ring1"],
          updatedAt: "2026-08-21T10:00:00.000Z",
          patch: "0.5.4f",
        }
      : null,
    recentCompleted: [],
  });
}

const BASE = {
  profile: demoProfile(),
  budget: null,
  goal: { kind: "balanced" as const },
  league: "Standard",
  patch: "0.5.4f",
  lang: "en" as const,
};

const SPANISH = /[ñ¿¡áéíóú«»]|\b(?:el|la|los|las|del|para|tienes|que|personaje)\b/i;

describe("Mentor por reglas en inglés", () => {
  it("saluda y da las gracias en inglés", async () => {
    const hello = await answerMentorQuery({ ...BASE, question: "hello", memory: memory() });
    expect(hello.answer).toMatch(/^Hi!/);
    const thanks = await answerMentorQuery({ ...BASE, question: "thanks!", memory: memory() });
    expect(thanks.answer).toMatch(/^You're welcome/);
  });

  it("recomienda el siguiente paso en inglés", async () => {
    const answer = await answerMentorQuery({
      ...BASE,
      question: "What should I improve now?",
      memory: memory(),
    });
    expect(answer.intent).toBe("next_improvement");
    expect(answer.answer).not.toMatch(SPANISH);
    expect(answer.nextAction?.text ?? "").not.toMatch(SPANISH);
  });

  it("recuerda la acción en curso en inglés", async () => {
    const answer = await answerMentorQuery({
      ...BASE,
      question: "What should I improve now?",
      memory: memory(true),
    });
    expect(answer.answer).toMatch(/^You already have an action in progress/);
  });

  it("explica lo que no entiende y sugiere preguntas en inglés", async () => {
    const answer = await answerMentorQuery({
      ...BASE,
      question: "asdfgh qwerty",
      memory: memory(),
    });
    expect(answer.intent).toBe("unsupported");
    expect(answer.answer).not.toMatch(SPANISH);
    expect(answer.unsupported?.examples[0]).toBe("What should I improve now?");
  });

  it("pide los datos que faltan en inglés", async () => {
    const answer = await answerMentorQuery({
      ...BASE,
      profile: { ...demoProfile(), characterClass: "", items: [] },
      question: "What should I improve now?",
      memory: memory(),
    });
    expect(answer.answer).toMatch(/^Before picking an improvement/);
    expect(answer.answer).not.toMatch(SPANISH);
  });

  it("en español sigue igual", async () => {
    const answer = await answerMentorQuery({
      ...BASE,
      lang: "es",
      question: "hola",
      memory: memory(),
    });
    expect(answer.answer).toMatch(/^¡Hola!/);
  });
});

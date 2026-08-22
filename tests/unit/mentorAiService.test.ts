import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationMemorySchema,
  type CharacterProfile,
} from "../../shared/domain.js";
import { createDatabase } from "../../server/db/database.js";
import { loadConfig } from "../../server/config.js";
import {
  MentorAiError,
  type MentorDecisionSelector,
} from "../../server/mentor/mentorAi.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";

function demoProfile(): CharacterProfile {
  return CharacterProfileSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
}

function memory(primary = false) {
  return RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: primary
      ? {
          entryId: "entry-activa",
          status: "active",
          title: "Probar el anillo",
          nextAction: "Equipa el anillo y juega un mapa.",
          result: null,
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: ["demo-item-ring1"],
          updatedAt: "2026-08-22T10:00:00.000Z",
          patch: "0.5.4f",
        }
      : null,
    recentCompleted: [],
  });
}

function prices(): PriceService {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  return new PriceService(new PoeNinjaClient({ db: createDatabase(":memory:"), config }));
}

const BASE = {
  profile: demoProfile(),
  budget: { amount: 50, currency: "chaos" as const },
  goal: { kind: "survival" as const },
  league: "Runes of Aldur",
  patch: "0.5.4f",
};

function selector(
  select: MentorDecisionSelector["select"],
): MentorDecisionSelector {
  return { name: "modelo-prueba", select };
}

describe("mentor IA supervisado", () => {
  it("entiende una pregunta libre, pero la acción final sigue viniendo del motor", async () => {
    let canonicalAction = "";
    const fake = selector(async (context) => {
      const chosen = context.candidates[1] ?? context.candidates[0]!;
      canonicalAction = chosen.action;
      return {
        kind: "choose_recommendation",
        recommendationId: chosen.id,
        missingFactId: null,
      };
    });

    const answer = await answerMentorQuery(
      {
        ...BASE,
        question: "Estoy muriendo bastante, ¿qué tocarías sin romper mi idea de build?",
        memory: memory(),
      },
      { priceService: prices(), selector: fake },
    );

    expect(answer.responseMode).toBe("ai");
    expect(answer.model).toBe("modelo-prueba");
    expect(answer.unsupported).toBeNull();
    expect(answer.nextAction?.text).toBe(canonicalAction);
    expect(answer.nextAction?.recommendation?.action).toBe(canonicalAction);
    expect(answer.usedRecommendationIds).toEqual([answer.nextAction?.recommendationId]);
  });

  it("puede pedir un dato faltante real sin redactar una acción inventada", async () => {
    let factText = "";
    const fake = selector(async (context) => {
      const fact = context.missingFacts[0]!;
      factText = fact.text;
      return { kind: "ask_missing_fact", recommendationId: null, missingFactId: fact.id };
    });
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Es seguro comprar ya?", memory: memory() },
      { priceService: prices(), selector: fake },
    );

    expect(answer.responseMode).toBe("ai");
    expect(answer.nextAction).toBeNull();
    expect(answer.unverified).toEqual([factText]);
    expect(answer.answer).toContain(factText);
  });

  it("una elección de id inventado cae a reglas y lo declara", async () => {
    const fake = selector(async () => ({
      kind: "choose_recommendation",
      recommendationId: "rec-inventada",
      missingFactId: null,
    }));
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory: memory() },
      { priceService: prices(), selector: fake },
    );

    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.fallbackReason).toContain("inexistente");
    expect(answer.nextAction?.recommendationId).not.toBe("rec-inventada");
  });

  it("un fallo del proveedor no impide responder", async () => {
    const fake = selector(async () => {
      throw new MentorAiError("Proveedor de prueba no disponible; se usaron las reglas.");
    });
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory: memory() },
      { priceService: prices(), selector: fake },
    );
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.nextAction).not.toBeNull();
  });

  it("una acción activa evita incluso consultar la IA", async () => {
    const select = vi.fn<MentorDecisionSelector["select"]>();
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Y si hacemos otra cosa?", memory: memory(true) },
      { priceService: prices(), selector: selector(select) },
    );
    expect(select).not.toHaveBeenCalled();
    expect(answer.responseMode).toBe("rules");
    expect(answer.nextAction?.recalledFromEntryId).toBe("entry-activa");
  });
});

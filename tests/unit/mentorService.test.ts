import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationMemorySchema,
  type CharacterProfile,
  type RecommendationMemory,
} from "../../shared/domain.js";
import { MentorAnswerSchema } from "../../shared/mentorQuery.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import { createDatabase } from "../../server/db/database.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";
import { loadConfig } from "../../server/config.js";

/**
 * Hito 6A — el mentor conversacional reutiliza el motor y respeta el diario.
 * No genera consejos propios ni inventa datos.
 */

function demoProfile(): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse(JSON.parse(raw));
}

function offlinePriceService(): PriceService {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  const client = new PoeNinjaClient({ db: createDatabase(":memory:"), config });
  return new PriceService(client);
}

function emptyMemory(): RecommendationMemory {
  return RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: null,
    recentCompleted: [],
  });
}

function memoryWithPrimary(): RecommendationMemory {
  return RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:1111111111111111",
    primaryEntry: {
      entryId: "entry-activa",
      status: "waiting_result",
      title: "Cubrir resistencias elementales",
      nextAction: "Compra un anillo con resistencia de fuego y equípalo.",
      result: null,
      recommendationId: "rec-resistencias-elementales",
      relatedItemIds: ["demo-item-ring1"],
      updatedAt: "2026-08-21T10:00:00.000Z",
      patch: "0.5.4f",
    },
    recentCompleted: [],
  });
}

const BASE = {
  profile: demoProfile(),
  budget: { amount: 50, currency: "chaos" as const },
  goal: { kind: "survival" as const },
  league: "Runes of Aldur",
  patch: "0.5.4f",
};

describe("mentor — intención next_improvement", () => {
  it("responde con UNA sola próxima acción tomada del motor", async () => {
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory: emptyMemory() },
      { priceService: offlinePriceService() },
    );

    expect(MentorAnswerSchema.safeParse(answer).success).toBe(true);
    expect(answer.intent).toBe("next_improvement");
    expect(answer.unsupported).toBeNull();
    expect(answer.nextAction).not.toBeNull();
    expect(answer.nextAction?.canSaveToJournal).toBe(true);
    // La acción y las fuentes proceden de una recomendación real del motor.
    expect(answer.usedRecommendationIds).toHaveLength(1);
    expect(answer.nextAction?.recommendationId).toBe(answer.usedRecommendationIds[0]);
    expect(answer.nextAction?.recommendation?.id).toBe(answer.usedRecommendationIds[0]);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.confidence).not.toBeNull();
    expect(answer.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("mentor — intención explain_priority", () => {
  it("explica la prioridad citando el motivo del motor, sin cambiar de decisión", async () => {
    const memory = emptyMemory();
    const siguiente = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );
    const explicacion = await answerMentorQuery(
      { ...BASE, question: "¿Cuál es mi principal problema?", memory },
      { priceService: offlinePriceService() },
    );

    expect(explicacion.intent).toBe("explain_priority");
    // Misma decisión, contada de otra forma: nunca dos acciones distintas.
    expect(explicacion.usedRecommendationIds).toEqual(siguiente.usedRecommendationIds);
    expect(explicacion.nextAction?.text).toBe(siguiente.nextAction?.text);
    expect(explicacion.answer).not.toBe(siguiente.answer);
  });

  it("no muestra niveles internos (low/medium/high) en el texto que lee la persona", async () => {
    const explicacion = await answerMentorQuery(
      { ...BASE, question: "¿Cuál es mi principal problema?", memory: emptyMemory() },
      { priceService: offlinePriceService() },
    );

    expect(explicacion.answer).toMatch(/Riesgo (bajo|medio|alto):/);
    expect(explicacion.answer).not.toMatch(/\b(low|medium|high)\b/);
  });
});

describe("mentor — resistencias en español", () => {
  /** Todo el texto que la interfaz llega a pintar de una respuesta. */
  function textoVisible(answer: Awaited<ReturnType<typeof answerMentorQuery>>): string {
    return [
      answer.answer,
      answer.nextAction?.text ?? "",
      ...answer.unverified,
      ...answer.sources.map((s) => s.label),
      answer.unsupported?.reason ?? "",
    ].join(" | ");
  }

  it("el personaje demo presenta «frío 61%, rayo 40%», no las claves del dominio", async () => {
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory: emptyMemory() },
      { priceService: offlinePriceService() },
    );

    expect(answer.answer).toContain("frío 61%, rayo 40%");
    expect(answer.nextAction?.text).toContain("frío 61%, rayo 40%");
  });

  it("ninguna intención filtra identificadores ingleses de resistencia", async () => {
    for (const question of ["¿Qué mejoro ahora?", "¿Cuál es mi principal problema?"]) {
      const answer = await answerMentorQuery(
        { ...BASE, question, memory: emptyMemory() },
        { priceService: offlinePriceService() },
      );
      expect(textoVisible(answer)).not.toMatch(/\b(fire|cold|lightning|chaos)\b/);
    }
  });

  it("las claves ESTRUCTURADAS del dominio siguen intactas", () => {
    // La traducción es solo de textos: el perfil conserva sus claves inglesas.
    expect(Object.keys(demoProfile().resistances).sort()).toEqual([
      "chaos",
      "cold",
      "fire",
      "lightning",
    ]);
  });
});

describe("mentor — pregunta no soportada", () => {
  it("contesta honestamente, sin acción y con ejemplos válidos", async () => {
    const priceService = offlinePriceService();
    const spy = vi.spyOn(priceService, "getQuotes");

    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Cuánto vale mi arma en el mercado?", memory: emptyMemory() },
      { priceService },
    );

    expect(answer.intent).toBe("unsupported");
    expect(answer.nextAction).toBeNull();
    expect(answer.usedRecommendationIds).toEqual([]);
    expect(answer.unsupported?.examples.length).toBeGreaterThan(0);
    expect(answer.unsupported?.reason).toContain("no invento");
    // Una pregunta no soportada no consulta precios ni ejecuta reglas.
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("mentor — acción principal activa (el diario manda)", () => {
  it("recuerda el paso en curso en lugar de generar otro y no consulta precios", async () => {
    const priceService = offlinePriceService();
    const spy = vi.spyOn(priceService, "getQuotes");
    const memory = memoryWithPrimary();

    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué hago ahora?", memory },
      { priceService },
    );

    expect(answer.memoryImpact.blockedByPrimaryEntryId).toBe("entry-activa");
    expect(answer.answer).toContain("Cubrir resistencias elementales");
    // El paso se RECUERDA: ya está en el diario, no se vuelve a guardar.
    expect(answer.nextAction?.text).toBe(
      "Compra un anillo con resistencia de fuego y equípalo.",
    );
    expect(answer.nextAction?.canSaveToJournal).toBe(false);
    expect(answer.nextAction?.recalledFromEntryId).toBe("entry-activa");
    expect(answer.nextAction?.recommendation).toBeNull();
    expect(answer.usedRecommendationIds).toEqual([]);
    // Cero consultas de precio mientras el diario bloquea la decisión.
    expect(spy).not.toHaveBeenCalled();
  });

  it("también bloquea la explicación de prioridad", async () => {
    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Por qué me recomiendas esto?", memory: memoryWithPrimary() },
      { priceService: offlinePriceService() },
    );
    expect(answer.intent).toBe("explain_priority");
    expect(answer.memoryImpact.blockedByPrimaryEntryId).toBe("entry-activa");
    expect(answer.answer).toContain("una sola acción a la vez");
  });
});

describe("mentor — resultado previo que produce reconciliación", () => {
  it("antepone la reconciliación del perfil (profile_sync) tras una mejora completada", async () => {
    const memory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1:2222222222222222",
      primaryEntry: null,
      recentCompleted: [
        {
          entryId: "entry-completada",
          status: "completed",
          title: "Cubrir resistencias elementales",
          nextAction: "Compré el anillo y lo equipé.",
          result: "Equipado. Fuego a 75.",
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: ["demo-item-ring1"],
          updatedAt: "2026-08-21T12:00:00.000Z",
          patch: "0.5.4f",
        },
      ],
    });

    const answer = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );

    // El motor reconcilia la recomendación repetida y lo declara en memoryImpact.
    expect(answer.memoryImpact.repeatedRecommendationIds).toContain(
      "rec-resistencias-elementales",
    );
    expect(answer.memoryImpact.usedEntryIds).toContain("entry-completada");
    // El mentor NO reordena: transmite la decisión que el motor puso primera.
    expect(answer.usedRecommendationIds).toHaveLength(1);
    // El texto libre del jugador es evidencia, no una estadística interpretada.
    const serializada = JSON.stringify(answer);
    expect(serializada).not.toContain("Fuego a 75");
  });

  it("cuando la reconciliación es la decisión principal, el mentor la ofrece como profile_sync", async () => {
    // Perfil donde la ÚNICA carencia es la resistencia que el diario dice
    // haber resuelto: el motor reconcilia ese candidato y queda el primero.
    const profile = demoProfile();
    profile.resistances = { fire: 40, cold: 75, lightning: 75, chaos: 0 };
    profile.life = profile.level * 35;
    profile.attributes = { str: 300, dex: 300, int: 300 };
    profile.items = [];
    profile.skills = [];

    const memory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1:3333333333333333",
      primaryEntry: null,
      recentCompleted: [
        {
          entryId: "entry-completada",
          status: "completed",
          title: "Cubrir resistencias elementales",
          nextAction: "Compré el anillo y lo equipé.",
          result: "Equipado. Fuego a 75.",
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: [],
          updatedAt: "2026-08-21T12:00:00.000Z",
          patch: "0.5.4f",
        },
      ],
    });

    const answer = await answerMentorQuery(
      { ...BASE, profile, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );

    expect(answer.usedRecommendationIds).toEqual([
      "rec-memoria-resistencias-elementales",
    ]);
    expect(answer.nextAction?.recommendation?.actionKind).toBe("profile_sync");
    expect(answer.nextAction?.text).toContain("Actualiza en «Mi personaje»");
    expect(answer.nextAction?.canSaveToJournal).toBe(true);
    expect(JSON.stringify(answer)).not.toContain("Fuego a 75");
  });
});

describe("mentor — honestidad de los datos", () => {
  it("no inventa estadísticas, DPS ni precios", async () => {
    const answers = await Promise.all(
      ["¿Qué mejoro ahora?", "¿Cuál es mi principal problema?"].map((question) =>
        answerMentorQuery(
          { ...BASE, question, memory: emptyMemory() },
          { priceService: offlinePriceService() },
        ),
      ),
    );

    for (const answer of answers) {
      expect(answer.answer).not.toMatch(/\bDPS\b/i);
      // Sin cifras de dinero inventadas en la respuesta narrativa.
      expect(answer.answer).not.toMatch(/\b\d+(?:[.,]\d+)?\s*(divine|exalted|chaos)\b/i);
      // Toda fuente citada procede del motor: nunca se fabrica una.
      for (const source of answer.sources) {
        expect(["calculation", "user", "poe.ninja", "community", "ggg", "internal"]).toContain(
          source.kind,
        );
      }
    }
  });

  it("sin recomendaciones que ofrecer lo dice, en vez de improvisar", async () => {
    // Perfil sin carencias evidentes: el motor no produce candidatos.
    const profile = demoProfile();
    profile.resistances = { fire: 75, cold: 75, lightning: 75, chaos: 20 };
    profile.life = profile.level * 35;
    profile.attributes = { str: 300, dex: 300, int: 300 };
    profile.items = [];
    profile.skills = [];

    const answer = await answerMentorQuery(
      { ...BASE, profile, question: "¿Qué mejoro ahora?", memory: emptyMemory() },
      { priceService: offlinePriceService() },
    );

    expect(answer.nextAction).toBeNull();
    expect(answer.answer).toContain("no encuentro una mejora clara");
    expect(answer.usedRecommendationIds).toEqual([]);
  });
});

describe("mentor — determinismo", () => {
  it("mismas entradas producen la misma huella y la misma decisión", async () => {
    const memory = emptyMemory();
    const a = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );
    const b = await answerMentorQuery(
      { ...BASE, question: "que mejoro ahora", memory },
      { priceService: offlinePriceService() },
    );
    expect(b.inputFingerprint).toBe(a.inputFingerprint);
    expect(b.usedRecommendationIds).toEqual(a.usedRecommendationIds);
    expect(b.answer).toBe(a.answer);
  });

  it("la huella cambia si cambian los inputs relevantes", async () => {
    const memory = emptyMemory();
    const base = await answerMentorQuery(
      { ...BASE, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );
    const otroObjetivo = await answerMentorQuery(
      { ...BASE, goal: { kind: "damage" }, question: "¿Qué mejoro ahora?", memory },
      { priceService: offlinePriceService() },
    );
    expect(otroObjetivo.inputFingerprint).not.toBe(base.inputFingerprint);
  });
});

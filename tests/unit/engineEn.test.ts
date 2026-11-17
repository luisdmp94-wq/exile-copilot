import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile } from "../../shared/domain.js";
import { generateRecommendations } from "../../server/engine/engine.js";
import { RULES } from "../../server/engine/rules.js";

function demoProfile(): CharacterProfile {
  const raw = readFileSync(fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)), "utf8");
  return CharacterProfileSchema.parse(JSON.parse(raw));
}

/** Un personaje con casi todo por arreglar: dispara la mayoría de reglas. */
function roughProfile(): CharacterProfile {
  const profile = demoProfile();
  return {
    ...profile,
    life: 200,
    resistances: { fire: 20, cold: null, lightning: 60, chaos: -30 },
    items: profile.items.filter((item) => item.slot !== "boots" && item.slot !== "belt"),
    skills: profile.skills.map((skill, index) => (index === 0 ? { ...skill, supports: [] } : skill)),
  };
}

const SPANISH = /[ñ¿¡áéíóú]|\b(?:el|la|los|las|del|para|tienes|resistencia|vida|arma|huecos?)\b/i;

describe("motor de recomendaciones en inglés", () => {
  const base = { budget: null, goal: { kind: "balanced" as const }, league: "Standard", patch: "0.5.4f" };

  it("decide exactamente lo mismo en los dos idiomas", async () => {
    const spanish = await generateRecommendations(roughProfile(), base);
    const english = await generateRecommendations(roughProfile(), { ...base, lang: "en" });
    expect(english.recommendations.map((rec) => rec.id)).toEqual(spanish.recommendations.map((rec) => rec.id));
    expect(english.inputFingerprint).toBe(spanish.inputFingerprint);
  });

  it("todas las reglas escriben en inglés sin colar español", () => {
    const ctx = { profile: roughProfile(), league: "Standard", patch: "0.5.4f", lang: "en" as const };
    const candidates = RULES.flatMap((rule) => rule(ctx));
    expect(candidates.length).toBeGreaterThan(3);
    for (const candidate of candidates) {
      for (const text of [candidate.title, candidate.action, candidate.reason, candidate.impactDescription, candidate.riskDescription, ...candidate.unverified]) {
        expect(text, text).not.toMatch(SPANISH);
      }
    }
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildFileImporter.js";
import { generateRecommendations } from "../../server/engine/engine.js";
import { createDatabase } from "../../server/db/database.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";
import { loadConfig } from "../../server/config.js";

function demoProfile() {
  const content = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoBuild.build.json", import.meta.url)),
    "utf8",
  );
  return importBuild(content).profile;
}

function offlinePriceService() {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  const client = new PoeNinjaClient({ db: createDatabase(":memory:"), config });
  return new PriceService(client);
}

const BASE_OPTIONS = {
  budget: { amount: 50, currency: "chaos" as const },
  league: "Runes of Aldur",
  patch: "0.5.0",
};

describe("engine (motor determinista)", () => {
  it("genera exactamente 3 recomendaciones con todos los campos obligatorios", async () => {
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "balanced" } },
      { priceService: offlinePriceService() },
    );

    expect(result.engineVersion).toBe("1.0.0");
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.map((r) => r.priority)).toEqual([1, 2, 3]);

    for (const rec of result.recommendations) {
      expect(rec.id).toBeTruthy();
      expect(rec.title).toBeTruthy();
      expect(rec.action).toBeTruthy();
      expect(rec.reason).toBeTruthy();
      expect(rec.cost).toHaveProperty("known");
      expect(rec.impact.isPartialMetric).toBe(true); // nunca DPS ficticio
      expect(rec.impact.description).not.toMatch(/\bDPS\b/i);
      expect(rec.risk.description).toBeTruthy();
      expect(typeof rec.mayLoseValuableMods).toBe("boolean");
      expect(typeof rec.irreversible).toBe("boolean");
      expect(rec.patch).toBe("0.5.0");
      expect(rec.sources.length).toBeGreaterThanOrEqual(2);
      expect(rec.sources.some((s) => s.kind === "calculation")).toBe(true);
      expect(rec.dataUpdatedAt).toBeTruthy();
      expect(["low", "medium", "high"]).toContain(rec.confidence);
      expect(Array.isArray(rec.unverified)).toBe(true);
    }
  });

  it("para goal survival la prioridad 1 son las resistencias", async () => {
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );
    expect(result.recommendations[0]?.id).toBe("rec-resistencias-elementales");
    expect(result.recommendations[0]?.title).toContain("resistencias");
  });

  it("es determinista: mismas entradas, mismas recomendaciones", async () => {
    const profile = demoProfile();
    const opts = { ...BASE_OPTIONS, goal: { kind: "damage" as const } };
    const a = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    const b = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    expect(a.recommendations.map((r) => r.id)).toEqual(b.recommendations.map((r) => r.id));
    expect(a.recommendations.map((r) => r.priority)).toEqual(b.recommendations.map((r) => r.priority));
  });

  it("sin precio verificado: coste null, known:false y marcado No verificado", async () => {
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "damage" } },
      { priceService: offlinePriceService() }, // offline → fixtures → verified:false
    );
    const weapon = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(weapon).toBeDefined();
    expect(weapon?.cost.min).toBeNull();
    expect(weapon?.cost.max).toBeNull();
    expect(weapon?.cost.known).toBe(false);
    expect(weapon?.unverified.some((u) => u.includes("No verificado"))).toBe(true);
  });

  it("sin servicio de precios tampoco inventa costes", async () => {
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "balanced" } },
      {},
    );
    for (const rec of result.recommendations) {
      expect(rec.cost.known).toBe(false);
      expect(rec.cost.min).toBeNull();
    }
  });

  it("sin carencias evidentes devuelve menos o ninguna recomendación", async () => {
    const profile = demoProfile();
    // Arreglamos todas las carencias del demo build
    profile.resistances = { fire: 75, cold: 75, lightning: 75, chaos: 20 };
    profile.life = profile.level * 35;
    profile.attributes = { str: 300, dex: 300, int: 300 };
    const weapon = profile.items.find((i) => i.slot === "weapon");
    if (weapon) {
      weapon.quality = 20;
      weapon.modifiers = Array.from({ length: 4 }, (_, i) => ({
        id: `m${i}`,
        text: `mod ${i}`,
        kind: "explicit" as const,
        values: [i],
        verified: false,
      }));
    }
    profile.skills = profile.skills.map((s) => ({ ...s, supports: ["A", "B"] }));

    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "balanced" } },
      { priceService: offlinePriceService() },
    );
    expect(result.recommendations.length).toBeLessThanOrEqual(1);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type BuildTarget, type CharacterProfile } from "../../shared/domain.js";
import {
  computeInputFingerprint,
  convertBudget,
  generateRecommendations,
  type PriceLookup,
} from "../../server/engine/engine.js";
import { createDatabase } from "../../server/db/database.js";
import { PoeNinjaClient, PriceService, type QuotesResult } from "../../server/services/poeninja.js";
import { loadConfig } from "../../server/config.js";

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

const BASE_OPTIONS = {
  budget: { amount: 50, currency: "chaos" as const },
  league: "Runes of Aldur",
  patch: "0.5.0",
};

/** PriceLookup falso con quote verificado en divine y tasas configurables. */
function fakePriceLookup(opts: { value: number; rates: Record<string, number> | null }): PriceLookup {
  const quote = {
    itemName: "Fake Unique",
    currency: "divine" as const,
    value: opts.value,
    source: "poe.ninja" as const,
    league: BASE_OPTIONS.league,
    fetchedAt: "2026-08-19T10:00:00.000Z",
    fromCache: false,
    verified: true,
  };
  return {
    getQuotes: () =>
      Promise.resolve({
        quotes: [quote],
        league: BASE_OPTIONS.league,
        updatedAt: quote.fetchedAt,
        fromCache: false,
        degraded: false,
        primaryCurrency: "divine",
        rates: opts.rates,
      } satisfies QuotesResult),
  };
}

function profileWithUniqueWeapon(): CharacterProfile {
  const profile = demoProfile();
  const weapon = profile.items.find((i) => i.slot === "weapon");
  if (weapon) {
    weapon.rarity = "unique";
    weapon.name = "Fake Unique";
  }
  return profile;
}

describe("engine — exactitud y contratos", () => {
  it("demo snapshot → 3 recomendaciones con todos los campos obligatorios", async () => {
    const result = await generateRecommendations(
      demoProfile(),
      { ...BASE_OPTIONS, goal: { kind: "balanced" } },
      { priceService: offlinePriceService() },
    );

    expect(result.engineVersion).toBe("1.0.0");
    expect(result.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.map((r) => r.priority)).toEqual([1, 2, 3]);

    for (const rec of result.recommendations) {
      expect(rec.id).toBeTruthy();
      expect(rec.impact.isPartialMetric).toBe(true); // nunca DPS ficticio
      expect(rec.impact.description).not.toMatch(/\bDPS\b/i);
      expect(rec.patch).toBe("0.5.0");
      expect(rec.sources.some((s) => s.kind === "calculation")).toBe(true);
      // Nunca rangos inventados: si el coste es conocido, max queda null
      if (rec.cost.known) expect(rec.cost.max).toBeNull();
    }
  });

  it("goal survival → resistencias como prioridad 1", async () => {
    const result = await generateRecommendations(
      demoProfile(),
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );
    expect(result.recommendations[0]?.id).toBe("rec-resistencias-elementales");
  });

  it("null-safe: resistencias desconocidas → sin afirmaciones ni confidence alta", async () => {
    const profile = demoProfile();
    profile.resistances = { fire: null, cold: null, lightning: null, chaos: null };

    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );

    // No hay regla de resistencias ni de caos basada en datos inexistentes
    expect(result.recommendations.some((r) => r.id === "rec-resistencias-elementales")).toBe(false);
    expect(result.recommendations.some((r) => r.id === "rec-resistencia-caos")).toBe(false);
    // En su lugar: recomendación de completar datos, confidence low, coste null
    const gap = result.recommendations.find((r) => r.id === "rec-datos-resistencias");
    expect(gap).toBeDefined();
    expect(gap?.confidence).toBe("low");
    expect(gap?.cost.known).toBe(false);
    expect(gap?.cost.min).toBeNull();
    expect(gap?.unverified.some((u) => u.includes("No verificado"))).toBe(true);
    // Nadie afirma un porcentaje inventado
    for (const rec of result.recommendations) {
      expect(rec.action + rec.reason).not.toContain("0%");
    }
  });

  it("arma rare NUNCA se valora con precios de únicos aunque coincida el nombre/base", async () => {
    const profile = demoProfile();
    const weapon = profile.items.find((i) => i.slot === "weapon");
    // Nombre idéntico a un único del fixture, pero rare:
    if (weapon) {
      weapon.name = "Gale Hymn";
      weapon.rarity = "rare";
    }
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "damage" } },
      { priceService: offlinePriceService() },
    );
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec).toBeDefined();
    expect(rec?.cost.known).toBe(false);
    expect(rec?.cost.min).toBeNull();
    expect(rec?.unverified.some((u) => u.includes("no es único") || u.includes("no únicos"))).toBe(true);
  });

  it("quote offline (fixture) queda No verificado aunque tenga valor numérico", async () => {
    // Arma ÚNICA que sí existe en el fixture offline → hay valor, pero jamás verified
    const profile = profileWithUniqueWeapon();
    const weapon = profile.items.find((i) => i.slot === "weapon");
    if (weapon) weapon.name = "Gale Hymn";
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "damage" } },
      { priceService: offlinePriceService() },
    );
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec?.cost.known).toBe(false);
    expect(rec?.unverified.some((u) => u.includes("No verificado"))).toBe(true);
  });
});

describe("engine — conversión de presupuesto entre monedas", () => {
  it("convertBudget: misma moneda, tasas y casos no verificables", () => {
    expect(convertBudget({ amount: 50, currency: "chaos" }, "chaos", null)).toBe(50);
    // rates.exalted = 1000 → 1 divine = 1000 exalted
    expect(convertBudget({ amount: 1500, currency: "exalted" }, "divine", { exalted: 1000 })).toBe(1.5);
    expect(convertBudget({ amount: 70.88, currency: "chaos" }, "divine", { chaos: 35.44 })).toBe(2);
    // Sin tasas o moneda ausente → no verificable
    expect(convertBudget({ amount: 1500, currency: "exalted" }, "divine", null)).toBeNull();
    expect(convertBudget({ amount: 100, currency: "gold" }, "divine", { exalted: 1000 })).toBeNull();
  });

  it("coste en divine vs presupuesto en exalted: se convierte con rates y se penaliza si excede", async () => {
    const profile = profileWithUniqueWeapon();
    const opts = {
      league: BASE_OPTIONS.league,
      patch: BASE_OPTIONS.patch,
      goal: { kind: "damage" as const },
      budget: { amount: 1500, currency: "exalted" as const }, // = 1.5 divine con rates
    };
    const lookup = fakePriceLookup({ value: 2, rates: { exalted: 1000 } });

    const result = await generateRecommendations(profile, opts, { priceService: lookup });
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec?.cost.known).toBe(true);
    expect(rec?.cost.min).toBe(2);
    expect(rec?.cost.max).toBeNull(); // nunca rango inventado
    expect(rec?.cost.currency).toBe("divine");
    // Conversión verificada disponible: no se dice "No verificado si entra"
    expect(rec?.unverified.some((u) => u.includes("No verificado si entra en el presupuesto"))).toBe(false);

    // Con presupuesto holgado (3000 ex = 3 div > 2 div) no hay penalización:
    // el score relativo sube y la recomendación no pierde posiciones.
    const rich = await generateRecommendations(
      profile,
      { ...opts, budget: { amount: 3000, currency: "exalted" } },
      { priceService: lookup },
    );
    expect(rich.recommendations[0]?.id).toBe("rec-mejora-arma");
  });

  it("sin rates → NO se afirma que entra en el presupuesto", async () => {
    const profile = profileWithUniqueWeapon();
    const lookup = fakePriceLookup({ value: 2, rates: null });
    const result = await generateRecommendations(
      profile,
      {
        league: BASE_OPTIONS.league,
        patch: BASE_OPTIONS.patch,
        goal: { kind: "damage" },
        budget: { amount: 1500, currency: "exalted" },
      },
      { priceService: lookup },
    );
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec?.cost.known).toBe(true);
    expect(rec?.unverified.some((u) => u.includes("No verificado si entra en el presupuesto"))).toBe(true);
  });
});

describe("engine — target e fingerprint", () => {
  const target: BuildTarget = {
    name: "Guía comunitaria X",
    sourceUrl: "https://mobalytics.gg/poe-2/builds/example",
    desiredMods: ["increased projectile damage", "maximum life"],
    referenceOnly: true,
  };

  it("el target cambia las recomendaciones (mismas entradas ±target)", async () => {
    const profile = demoProfile();
    const opts = { ...BASE_OPTIONS, goal: { kind: "balanced" as const } };

    const sin = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    const con = await generateRecommendations(
      profile,
      { ...opts, target },
      { priceService: offlinePriceService() },
    );

    const idsSin = sin.recommendations.map((r) => r.id);
    const idsCon = con.recommendations.map((r) => r.id);
    expect(idsCon).not.toEqual(idsSin);
    const targetRec = con.recommendations.find((r) => r.id === "rec-mods-objetivo");
    expect(targetRec).toBeDefined();
    // "maximum life" sí existe en el perfil (max Life mods): solo falta projectile damage
    expect(targetRec?.action).toContain("projectile damage");
    expect(targetRec?.action).not.toContain("maximum life");
    expect(targetRec?.sources.some((s) => s.kind === "community")).toBe(true);
    expect(targetRec?.unverified.some((u) => u.includes("referenceOnly"))).toBe(true);
    // El fingerprint también cambia con target
    expect(con.inputFingerprint).not.toBe(sin.inputFingerprint);
  });

  it("fingerprint estable para mismos inputs y distinto si cambia el presupuesto", async () => {
    const profile = demoProfile();
    const opts = { ...BASE_OPTIONS, goal: { kind: "survival" as const } };
    const a = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    const b = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
    const c = await generateRecommendations(
      profile,
      { ...opts, budget: { amount: 999, currency: "chaos" } },
      { priceService: offlinePriceService() },
    );
    expect(c.inputFingerprint).not.toBe(a.inputFingerprint);
    expect(computeInputFingerprint({ profile, ...opts })).toBe(a.inputFingerprint);
  });

  it("determinista: mismas entradas, mismas recomendaciones", async () => {
    const profile = demoProfile();
    const opts = { ...BASE_OPTIONS, goal: { kind: "damage" as const } };
    const a = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    const b = await generateRecommendations(profile, opts, { priceService: offlinePriceService() });
    expect(a.recommendations.map((r) => r.id)).toEqual(b.recommendations.map((r) => r.id));
  });

  it("sin carencias evidentes devuelve menos o ninguna recomendación", async () => {
    const profile = demoProfile();
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
    profile.skills = profile.skills.map((s) => ({
      ...s,
      supports: [
        { name: "A", gemId: null },
        { name: "B", gemId: null },
      ],
    }));

    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "balanced" } },
      { priceService: offlinePriceService() },
    );
    expect(result.recommendations.length).toBeLessThanOrEqual(1);
  });
});

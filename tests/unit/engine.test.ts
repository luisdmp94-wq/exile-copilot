import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationMemorySchema,
  type BuildTarget,
  type CharacterProfile,
} from "../../shared/domain.js";
import type { MarketRates } from "../../shared/api.js";
import {
  computeInputFingerprint,
  convertBudget,
  generateRecommendations,
  type PriceLookup,
} from "../../server/engine/engine.js";
import { attributeRequirementsRule } from "../../server/engine/rules.js";
import { createDatabase } from "../../server/db/database.js";
import { PoeNinjaClient, PriceService, type QuotesResult } from "../../server/services/poeninja.js";
import { loadConfig } from "../../server/config.js";
import { journalEntryFromRecommendation } from "../../src/lib/journal.js";

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
  patch: "0.5.4f",
};

function liveRates(values: Record<string, number>): MarketRates {
  return { values, origin: "live", verified: true, fetchedAt: "2026-08-19T10:00:00.000Z" };
}

/** PriceLookup falso con quote verificado en divine y tasas configurables. */
function fakePriceLookup(opts: { value: number; rates: MarketRates | null }): PriceLookup {
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

    expect(result.engineVersion).toBe("1.1.0");
    expect(result.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.map((r) => r.priority)).toEqual([1, 2, 3]);

    for (const rec of result.recommendations) {
      expect(rec.id).toBeTruthy();
      expect(rec.impact.isPartialMetric).toBe(true); // nunca DPS ficticio
      expect(rec.impact.description).not.toMatch(/\bDPS\b/i);
      expect(rec.patch).toBe("0.5.4f");
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

    expect(result.recommendations.some((r) => r.id === "rec-resistencias-elementales")).toBe(false);
    expect(result.recommendations.some((r) => r.id === "rec-resistencia-caos")).toBe(false);
    const gap = result.recommendations.find((r) => r.id === "rec-datos-resistencias");
    expect(gap).toBeDefined();
    expect(gap?.confidence).toBe("low");
    expect(gap?.cost.known).toBe(false);
    expect(gap?.cost.min).toBeNull();
    expect(gap?.unverified.some((u) => u.includes("No verificado"))).toBe(true);
    for (const rec of result.recommendations) {
      expect(rec.action + rec.reason).not.toContain("0%");
    }
  });

  it("las resistencias desconocidas se enumeran en español, no con las claves del dominio", async () => {
    const profile = demoProfile();
    // fuego y frío desconocidos, rayo conocido y bajo: se ejercitan a la vez la
    // lista de desconocidas, la de bajas y la nota «No verificado».
    profile.resistances = { fire: null, cold: null, lightning: 40, chaos: -10 };

    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );

    const bajas = result.recommendations.find((r) => r.id === "rec-resistencias-elementales");
    expect(bajas?.action).toContain("rayo 40%");
    expect(bajas?.reason).toContain("rayo 40%");
    // La nota «No verificado» de la regla de resistencias tampoco filtra claves.
    expect(bajas?.unverified.join(" ")).toContain(
      "resistencias desconocidas no evaluadas: fuego, frío.",
    );

    // Con TODAS las elementales desconocidas aparece el hueco de datos, cuya
    // lista de resistencias también tiene que salir en español.
    const todoDesconocido = demoProfile();
    todoDesconocido.resistances = { fire: null, cold: null, lightning: null, chaos: null };
    const sinDatos = await generateRecommendations(
      todoDesconocido,
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );
    const gap = sinDatos.recommendations.find((r) => r.id === "rec-datos-resistencias");
    expect(gap?.unverified.join(" ")).toContain("Resistencias desconocidas: fuego, frío, rayo.");

    const visible = [...result.recommendations, ...sinDatos.recommendations]
      .flatMap((r) => [r.title, r.action, r.reason, ...r.unverified])
      .join(" | ");
    expect(visible).not.toMatch(/\b(fire|cold|lightning|chaos)\b/);
  });

  it("arma rare NUNCA se valora con precios de únicos aunque coincida el nombre/base", async () => {
    const profile = demoProfile();
    const weapon = profile.items.find((i) => i.slot === "weapon");
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

describe("engine — memoria del mentor", () => {
  it("se detiene ante una acción primaria y no consulta precios", async () => {
    let priceCalls = 0;
    const priceLookup: PriceLookup = {
      getQuotes: async () => {
        priceCalls += 1;
        throw new Error("No debería consultar precios con una acción activa");
      },
    };
    const memory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1|active",
      primaryEntry: {
        entryId: "active-1",
        status: "waiting_result",
        title: "Probar anillo",
        nextAction: "Equipar el anillo.",
        result: null,
        recommendationId: "rec-resistencias-elementales",
        relatedItemIds: ["demo-item-ring1"],
        updatedAt: "2026-08-20T10:00:00.000Z",
        patch: "0.5.4f",
      },
      recentCompleted: [],
    });

    const result = await generateRecommendations(
      demoProfile(),
      { ...BASE_OPTIONS, goal: { kind: "survival" }, memory },
      { priceService: priceLookup },
    );

    expect(result.recommendations).toEqual([]);
    expect(result.memoryImpact).toEqual({
      revision: memory.revision,
      blockedByPrimaryEntryId: "active-1",
      usedEntryIds: ["active-1"],
      repeatedRecommendationIds: [],
    });
    expect(priceCalls).toBe(0);
  });

  it("no repite una mejora completada: pide reconciliar el perfil sin interpretar el resultado", async () => {
    const memory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1|completed",
      primaryEntry: null,
      recentCompleted: [
        {
          entryId: "completed-resists",
          status: "completed",
          title: "Cubrir resistencias elementales",
          nextAction: null,
          result: "Texto libre: ahora tengo 999% y costó 3 mirrors.",
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: [],
          updatedAt: "2026-08-20T10:00:00.000Z",
          patch: "0.5.4f",
        },
        {
          entryId: "older-resists",
          status: "completed",
          title: "Intento antiguo que no debe prevalecer",
          nextAction: null,
          result: "Resultado anterior.",
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: [],
          updatedAt: "2026-08-19T10:00:00.000Z",
          patch: "0.5.4f",
        },
      ],
    });

    const result = await generateRecommendations(
      demoProfile(),
      { ...BASE_OPTIONS, goal: { kind: "survival" }, memory },
      { priceService: offlinePriceService() },
    );
    const reconciliation = result.recommendations.find(
      (entry) => entry.id === "rec-memoria-resistencias-elementales",
    );

    expect(reconciliation).toBeDefined();
    expect(reconciliation?.actionKind).toBe("profile_sync");
    expect(reconciliation?.title).toContain("Cubrir resistencias elementales");
    expect(reconciliation?.title).not.toContain("Intento antiguo");
    expect(reconciliation?.action).toContain("Actualiza en «Mi personaje»");
    const renderedText = `${reconciliation?.action ?? ""}${reconciliation?.reason ?? ""}`;
    expect(renderedText).not.toContain("999%");
    expect(renderedText).not.toContain("3 mirrors");
    expect(reconciliation?.cost.known).toBe(false);
    expect(reconciliation?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "user",
          label: expect.stringContaining("Resultado del diario"),
        }),
      ]),
    );
    expect(result.memoryImpact.usedEntryIds).toEqual(["completed-resists"]);
    expect(result.memoryImpact.repeatedRecommendationIds).toEqual([
      "rec-resistencias-elementales",
    ]);
  });

  it("la reconciliación de un título máximo sigue siendo guardable", async () => {
    const memory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1|long-title",
      primaryEntry: null,
      recentCompleted: [
        {
          entryId: "completed-long-title",
          status: "completed",
          title: "x".repeat(160),
          nextAction: null,
          result: "Resultado explícito.",
          recommendationId: "rec-resistencias-elementales",
          relatedItemIds: [],
          updatedAt: "2026-08-20T10:00:00.000Z",
          patch: "0.5.4f",
        },
      ],
    });
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "survival" }, memory },
      { priceService: offlinePriceService() },
    );
    const reconciliation = result.recommendations.find(
      (entry) => entry.id === "rec-memoria-resistencias-elementales",
    );
    expect(reconciliation).toBeDefined();
    expect(reconciliation?.title).toHaveLength(160);
    expect(reconciliation?.title.endsWith("…")).toBe(true);
    expect(() =>
      journalEntryFromRecommendation(
        reconciliation!,
        profile,
        BASE_OPTIONS.budget,
        "survival",
      ),
    ).not.toThrow();
  });

  it("la revisión de memoria forma parte de la huella de entrada", async () => {
    const profile = demoProfile();
    const baseMemory = RecommendationMemorySchema.parse({
      revision: "journal-memory-v1|a",
      primaryEntry: null,
      recentCompleted: [],
    });
    const a = await generateRecommendations(profile, {
      ...BASE_OPTIONS,
      goal: { kind: "balanced" },
      memory: baseMemory,
    });
    const b = await generateRecommendations(profile, {
      ...BASE_OPTIONS,
      goal: { kind: "balanced" },
      memory: { ...baseMemory, revision: "journal-memory-v1|b" },
    });
    expect(a.inputFingerprint).not.toBe(b.inputFingerprint);
  });
});

describe("engine — vínculo estructurado recomendación → objeto", () => {
  it("la regla del arma declara exactamente el arma que evaluó", async () => {
    const profile = demoProfile();
    const weapon = profile.items.find((i) => i.slot === "weapon");
    expect(weapon).toBeDefined();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "damage" } },
      { priceService: offlinePriceService() },
    );
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec?.relatedItemIds).toEqual([weapon!.id]);
  });

  it("las reglas que no evalúan una pieza concreta no declaran ningún objeto", async () => {
    const profile = demoProfile();
    const result = await generateRecommendations(
      profile,
      { ...BASE_OPTIONS, goal: { kind: "survival" } },
      { priceService: offlinePriceService() },
    );
    // Resistencias/vida no leen una pieza equipada: sin vínculo, la interfaz
    // no resaltará ningún hueco (nunca se deduce por el texto).
    const resist = result.recommendations.find((r) => r.id === "rec-resistencias-elementales");
    expect(resist).toBeDefined();
    expect(resist?.relatedItemIds).toEqual([]);
  });

  it("la regla de requisitos declara los objetos cuyos requisitos no se cumplen", () => {
    // Se comprueba contra la REGLA, no contra el top 3 del motor: con este
    // perfil la recomendación queda fuera de las tres primeras y la versión
    // anterior del test (envuelta en `if (rec)`) no comprobaba nada.
    const profile = demoProfile();
    profile.attributes = { str: 1, dex: 1, int: 1 };

    const candidates = attributeRequirementsRule({
      profile,
      league: BASE_OPTIONS.league,
      patch: BASE_OPTIONS.patch,
    });

    // Si la regla deja de emitir el candidato, el test falla.
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0]!;
    expect(candidate.ruleId).toBe("requisitos-atributos");
    // Igualdad exacta: los tres objetos del demo con requisitos incumplidos.
    expect(candidate.relatedItemIds).toEqual([
      "demo-item-weapon",
      "demo-item-helmet",
      "demo-item-body",
    ]);
    for (const id of candidate.relatedItemIds ?? []) {
      expect(profile.items.some((i) => i.id === id)).toBe(true);
    }
  });

  it("sin requisitos incumplidos la regla no emite candidato ni vínculo", () => {
    const profile = demoProfile();
    profile.attributes = { str: 999, dex: 999, int: 999 };
    expect(
      attributeRequirementsRule({
        profile,
        league: BASE_OPTIONS.league,
        patch: BASE_OPTIONS.patch,
      }),
    ).toEqual([]);
  });
});
describe("engine — conversión de presupuesto entre monedas", () => {
  it("convertBudget: misma moneda, tasas verificadas y casos no verificables", () => {
    expect(convertBudget({ amount: 50, currency: "chaos" }, "chaos", null)).toBe(50);
    // rates.values.exalted = 1000 → 1 divine = 1000 exalted
    expect(
      convertBudget({ amount: 1500, currency: "exalted" }, "divine", liveRates({ exalted: 1000 })),
    ).toBe(1.5);
    expect(
      convertBudget({ amount: 70.88, currency: "chaos" }, "divine", liveRates({ chaos: 35.44 })),
    ).toBe(2);
    // Sin tasas, tasas NO verificadas o moneda ausente → no verificable
    expect(convertBudget({ amount: 1500, currency: "exalted" }, "divine", null)).toBeNull();
    expect(
      convertBudget({ amount: 1500, currency: "exalted" }, "divine", {
        values: { exalted: 1000 },
        origin: "fixture",
        verified: false,
        fetchedAt: "2026-08-19T10:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      convertBudget({ amount: 100, currency: "gold" }, "divine", liveRates({ exalted: 1000 })),
    ).toBeNull();
  });

  it("coste en divine vs presupuesto en exalted: se convierte con rates verificadas", async () => {
    const profile = profileWithUniqueWeapon();
    const opts = {
      league: BASE_OPTIONS.league,
      patch: BASE_OPTIONS.patch,
      goal: { kind: "damage" as const },
      budget: { amount: 1500, currency: "exalted" as const }, // = 1.5 divine con rates
    };
    const lookup = fakePriceLookup({ value: 2, rates: liveRates({ exalted: 1000 }) });

    const result = await generateRecommendations(profile, opts, { priceService: lookup });
    const rec = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(rec?.cost.known).toBe(true);
    expect(rec?.cost.min).toBe(2);
    expect(rec?.cost.max).toBeNull(); // nunca rango inventado
    expect(rec?.cost.currency).toBe("divine");
    expect(rec?.unverified.some((u) => u.includes("No verificado si entra en el presupuesto"))).toBe(false);

    const rich = await generateRecommendations(
      profile,
      { ...opts, budget: { amount: 3000, currency: "exalted" } },
      { priceService: lookup },
    );
    expect(rich.recommendations[0]?.id).toBe("rec-mejora-arma");
  });

  it("quote live + rates stale → NO se afirma que entra en el presupuesto", async () => {
    const profile = profileWithUniqueWeapon();
    const lookup = fakePriceLookup({
      value: 2,
      rates: {
        values: { exalted: 1000 },
        origin: "cache-stale",
        verified: false, // tasas de caché antigua: no verificadas
        fetchedAt: "2026-08-10T10:00:00.000Z",
      },
    });
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
    expect(rec?.cost.known).toBe(true); // el quote sí es verificado
    expect(rec?.unverified.some((u) => u.includes("No verificado si entra en el presupuesto"))).toBe(true);
  });
});

describe("engine — target e fingerprint", () => {
  const target: BuildTarget = {
    name: "Guía comunitaria X",
    sourceUrl: "https://mobalytics.gg/poe-2/builds/example",
    desiredMods: ["increased projectile damage", "maximum life"],
    referenceOnly: true,
    plan: null,
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
    expect(targetRec?.action).toContain("projectile damage");
    expect(targetRec?.action).not.toContain("maximum life");
    expect(targetRec?.sources.some((s) => s.kind === "community")).toBe(true);
    expect(targetRec?.unverified.some((u) => u.includes("referenceOnly"))).toBe(true);
    expect(con.inputFingerprint).not.toBe(sin.inputFingerprint);
  });

  it("target con plan oficial: lee pistas de inventory_slots como referencia (sin stats)", async () => {
    const titanRaw = readFileSync(
      fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
      "utf8",
    );
    const plan = {
      build: JSON.parse(titanRaw),
      importedAt: "2026-08-19T10:00:00.000Z",
    };
    const targetConPlan: BuildTarget = {
      name: "Titan Warrior",
      desiredMods: [],
      referenceOnly: true,
      plan,
    };
    // Perfil vacío (sin items): el plan es solo referencia, nunca stats.
    const emptyProfile = demoProfile();
    emptyProfile.items = [];
    emptyProfile.resistances = { fire: null, cold: null, lightning: null, chaos: null };

    const result = await generateRecommendations(
      emptyProfile,
      { ...BASE_OPTIONS, goal: { kind: "balanced" }, target: targetConPlan },
      { priceService: offlinePriceService() },
    );
    const targetRec = result.recommendations.find((r) => r.id === "rec-mods-objetivo");
    expect(targetRec).toBeDefined();
    expect(targetRec?.action).toContain("Titan Warrior");
    expect(targetRec?.sources.some((s) => s.kind === "user")).toBe(true);
    // El plan es un plan: nunca se menciona equipo del planner como si fuera del personaje
    for (const rec of result.recommendations) {
      expect(rec.action + rec.reason).not.toMatch(/ballesta|crossbow|quality|0 mods/i);
    }
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

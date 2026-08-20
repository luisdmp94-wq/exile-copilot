import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { generateRecommendations } from "../../server/engine/engine.js";
import { exportGggBuild } from "../../server/exporters/gggBuildExporter.js";
import { ApiHttpError } from "../../server/errors.js";
import {
  GggBuildPlannerV1Schema,
} from "../../shared/gggBuildPlanner.js";
import {
  CharacterProfileSchema,
  type BuildTarget,
  type CharacterProfile,
} from "../../shared/domain.js";

const titanRaw = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
  "utf8",
);

const IMPORT_DEFAULTS = { league: "Runes of Aldur", patch: "0.5.4f" };

function titanPlan() {
  return {
    build: GggBuildPlannerV1Schema.parse(JSON.parse(titanRaw)),
    importedAt: "2026-08-19T10:00:00.000Z",
  };
}

function titanTarget(): BuildTarget {
  return {
    name: "Titan Warrior (oficial)",
    referenceOnly: true,
    desiredMods: [],
    plan: titanPlan(),
  };
}

/** Perfil vacío: sin datos verificables del usuario (stats desconocidos = null). */
function emptyProfile(overrides: Record<string, unknown> = {}): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "test-vacio",
    name: "Personaje de prueba",
    characterClass: "Warrior",
    level: 90,
    league: "Runes of Aldur",
    patch: "0.5.4f",
    importedAt: "2026-08-19T10:00:00.000Z",
    ...overrides,
  });
}

describe("importador oficial GGG (.build → plan, nunca perfil)", () => {
  it("importa un .build válido como plan crudo (profile ausente)", () => {
    const result = importBuild(titanRaw, IMPORT_DEFAULTS);
    expect(result.detectedFormat).toBe("ggg-build-planner-v1");
    expect(result.profile).toBeUndefined();
    expect(result.plan).toBeDefined();
    expect(result.plan?.build.name).toBe("Titan Warrior");
    expect(result.plan?.build.ascendancy).toBe("Warrior1");
    expect(result.plan?.build.author).toBe("Grinding Gear Games");
    expect(result.warnings.length).toBeGreaterThan(0);
    // Nunca se fabrican stats: el plan crudo no lleva vida/resistencias verificables.
    expect(JSON.stringify(result.plan)).not.toContain("\"life\"");
    expect(JSON.stringify(result.plan)).not.toContain("resistances");
  });

  it("conserva additional_text del plan oficial (import crudo, markup incluido)", () => {
    const result = importBuild(titanRaw, IMPORT_DEFAULTS);
    const gloves = result.plan?.build.inventory_slots?.find((s) => s.inventory_id === "Gloves1");
    expect(gloves?.additional_text).toContain("1. Increased Attack Speed");
    expect(gloves?.additional_text).toContain("<red>{Armour (Str Base)}");
    const passiveConTexto = result.plan?.build.passives?.find(
      (p) => typeof p === "object" && p.id === "strength89",
    );
    expect(passiveConTexto).toEqual({
      id: "strength89",
      additional_text: "<m>{<red>{Strength +5 is recommended}}",
    });
  });

  it("rechaza JSON roto con ApiHttpError 400", () => {
    try {
      importBuild("{ not json", IMPORT_DEFAULTS);
      expect.unreachable("debía lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).message).toBe("build-json-invalido");
    }
  });

  it("rechaza JSON que no cumple el esquema GGG Build Planner v1", () => {
    try {
      importBuild(JSON.stringify({ hello: "world" }), IMPORT_DEFAULTS);
      expect.unreachable("debía lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).message).toBe("ggg-build-invalido");
    }
  });

  it("rechaza contenido que no es ni .build ni código PoB", () => {
    try {
      importBuild("basura total sin formato", IMPORT_DEFAULTS);
      expect.unreachable("debía lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).message).toBe("formato-desconocido");
    }
  });
});

describe("motor + plan oficial como target (referencia, nunca stats)", () => {
  it("perfil vacío + plan Titan: huecos declarados, sin inventar stats ni mencionar ballesta/quality/0 mods", async () => {
    const result = await generateRecommendations(emptyProfile(), {
      budget: { amount: 50, currency: "divine" },
      goal: { kind: "balanced" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target: titanTarget(),
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      const text = `${rec.title} ${rec.action} ${rec.reason}`;
      expect(text).not.toMatch(/ballesta|crossbow|quality|0 mods/i);
      expect(text).not.toContain("0%"); // un dato desconocido nunca es "tienes 0%"
    }

    // Las pistas del plan oficial alimentan la regla de referencia con fuentes honestas.
    const ref = result.recommendations.find((r) => r.id === "rec-mods-objetivo");
    expect(ref).toBeDefined();
    expect(ref?.action).toContain("Titan Warrior");
    expect(ref?.action).toContain("Increased Health");
    expect(ref?.sources.some((s) => s.kind === "user" && s.label.includes("Plan oficial"))).toBe(true);
    expect(ref?.sources.some((s) => s.kind === "community")).toBe(true);
    // Y las carencias de datos se declaran, no se rellenan.
    expect(result.recommendations.some((r) => r.id === "rec-datos-resistencias")).toBe(true);
    expect(result.recommendations.some((r) => r.id === "rec-datos-vida")).toBe(true);
  });

  it("la regla de arma es genérica (sin asumir ballesta) aunque el plan pida physical dps", async () => {
    const profile = emptyProfile({
      life: 4000,
      items: [
        {
          id: "w1",
          name: "Gran Martillo del Valle",
          baseType: "Two Handed Mace",
          slot: "weapon",
          rarity: "rare",
          modifiers: [],
        },
      ],
    });
    const result = await generateRecommendations(profile, {
      budget: { amount: 50, currency: "divine" },
      goal: { kind: "damage" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target: titanTarget(),
    });
    const weapon = result.recommendations.find((r) => r.id === "rec-mejora-arma");
    expect(weapon).toBeDefined();
    expect(weapon?.title).toBe("Mejorar el arma");
    expect(`${weapon?.title} ${weapon?.action}`).not.toMatch(/ballesta|crossbow/i);
    expect(weapon?.action).toContain("Two Handed Mace");
  });
});

describe("exportador oficial (fidelidad de plan + mejoras legibles)", () => {
  it("reimportable: exportar con target plan produce un .build que vuelve como plan", () => {
    const exported = exportGggBuild(emptyProfile(), titanTarget());
    expect(exported.fileName.endsWith(".build")).toBe(true);
    const reimport = importBuild(exported.content, IMPORT_DEFAULTS);
    expect(reimport.detectedFormat).toBe("ggg-build-planner-v1");
    expect(reimport.plan).toBeDefined();
    expect(reimport.profile).toBeUndefined();
    expect(reimport.plan?.build.name).toBe("Titan Warrior");
  });

  it("fidelidad: passives, skills e inventory_slots se conservan verbatim del plan crudo", () => {
    const target = titanTarget();
    const exported = exportGggBuild(emptyProfile(), target);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));

    expect(parsed.passives).toEqual(target.plan!.build.passives);
    expect(parsed.skills).toEqual(target.plan!.build.skills);
    expect(parsed.inventory_slots).toEqual(target.plan!.build.inventory_slots);
    expect(parsed.author).toBe("Grinding Gear Games");
    // additional_text con markup oficial intacto
    const gloves = parsed.inventory_slots?.find((s) => s.inventory_id === "Gloves1");
    expect(gloves?.additional_text).toContain("<red>{Armour (Str Base)}");
  });

  it("unique_name de un único NO se exporta como dato estructurado y se reporta", () => {
    const profile = emptyProfile({
      items: [
        {
          id: "u1",
          name: "The Hammer of Faith",
          baseType: "Two Handed Mace",
          slot: "weapon",
          rarity: "unique",
          modifiers: [],
        },
      ],
    });
    const exported = exportGggBuild(profile); // sin plan: export desde perfil
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));
    const weaponSlot = parsed.inventory_slots?.find((s) => s.inventory_id === "Weapon1");
    expect(weaponSlot).toBeDefined();
    expect(weaponSlot?.unique_name).toBeUndefined();
    expect(
      exported.report.skippedUnverified.some((s) => s.includes("unique_name")),
    ).toBe(true);
  });

  it("ascendancy solo se escribe desde ascendancyId; el nombre visible se reporta", () => {
    // Nombre visible sin id oficial → skipped; con plan, ascendancy cae al valor crudo del plan.
    const sinId = exportGggBuild(
      emptyProfile({ ascendancy: "Titan", ascendancyId: null }),
      titanTarget(),
    );
    expect(sinId.report.skippedUnverified.some((s) => s.includes("Ascendencia"))).toBe(true);
    const parsedSinId = GggBuildPlannerV1Schema.parse(JSON.parse(sinId.content));
    expect(parsedSinId.ascendancy).toBe("Warrior1"); // del plan crudo, no del nombre visible

    // Id oficial verificado → se escribe.
    const conId = exportGggBuild(
      emptyProfile({ ascendancy: null, ascendancyId: "Warrior2" }),
      titanTarget(),
    );
    const parsedConId = GggBuildPlannerV1Schema.parse(JSON.parse(conId.content));
    expect(parsedConId.ascendancy).toBe("Warrior2");
    expect(conId.report.skippedUnverified.some((s) => s.includes("Ascendencia"))).toBe(false);

    // Sin plan y sin ascendancyId → no se exporta ascendancy.
    const sinPlan = exportGggBuild(emptyProfile({ ascendancy: "Titan", ascendancyId: null }));
    const parsedSinPlan = GggBuildPlannerV1Schema.parse(JSON.parse(sinPlan.content));
    expect(parsedSinPlan.ascendancy).toBeUndefined();
  });

  it("recomendaciones aplicadas → sección legible en description + additional_text del slot", () => {
    const exported = exportGggBuild(emptyProfile(), titanTarget(), [
      "rec-resistencias-elementales",
      "rec-mejora-arma",
    ]);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));

    expect(parsed.description).toContain("Mejoras planificadas:");
    expect(parsed.description).toContain("1) Cubrir resistencias elementales hasta el cap");
    expect(parsed.description).toContain("2) Mejorar el arma");

    // La mejora aterriza como additional_text en el slot relacionado (Ring1 / Weapon1).
    const ring1 = parsed.inventory_slots?.find((s) => s.inventory_id === "Ring1");
    expect(ring1?.additional_text).toContain(
      "Mejora planificada: Cubrir resistencias elementales hasta el cap",
    );
    const weapon1 = parsed.inventory_slots?.find((s) => s.inventory_id === "Weapon1");
    expect(weapon1?.additional_text).toContain("Mejora planificada: Mejorar el arma");
    // Y el texto original del plan sigue presente (fidelidad + anotación).
    expect(weapon1?.additional_text).toContain("Prioritize highest physical dps");
  });

  it("recomendación desconocida se omite y queda declarada en el informe", () => {
    const exported = exportGggBuild(emptyProfile(), titanTarget(), ["rec-inventada"]);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));
    expect(parsed.description ?? "").not.toContain("rec-inventada");
    expect(exported.report.skippedUnverified).toEqual(
      expect.arrayContaining([expect.stringContaining("rec-inventada")]),
    );
  });

  it("el informe declara lo no exportable del formato oficial", () => {
    const exported = exportGggBuild(emptyProfile(), titanTarget());
    expect(exported.report.notExportable.length).toBeGreaterThan(0);
    expect(exported.report.notExportable.join(" ")).toMatch(/Resistencias/i);
    expect(exported.report.exported.inventorySlots).toBe(
      titanTarget().plan!.build.inventory_slots!.length,
    );
  });
});

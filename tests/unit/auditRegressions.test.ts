import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { exportGggBuild } from "../../server/exporters/gggBuildExporter.js";
import { selectAppliedRecommendationIds } from "../../src/lib/appliedRecommendations.js";
import {
  GggBuildPlannerV1Schema,
  type BuildTargetPlan,
} from "../../shared/gggBuildPlanner.js";
import {
  CharacterProfileSchema,
  type BuildTarget,
  type CharacterProfile,
} from "../../shared/domain.js";

/**
 * Regresiones de la auditoría (sesión 4).
 * Cada bloque cubre un defecto demostrado antes de su corrección:
 *  1. level_interval: la doc oficial dice "?(array of uint, or uint)"; el
 *     esquema rechazaba arrays que no fueran tuplas de exactamente 2.
 *  2. Campos no documentados: se descartaban en silencio al importar y la
 *     reexportación los perdía sin declararlo (contradice la fidelidad).
 *  3. exportGggBuild mutaba el plan de entrada (copia superficial de skills):
 *     dos exports con el mismo target duplicaban el texto de mejoras.
 *  4. La exportación podía incluir ids de recomendaciones marcadas en una
 *     generación anterior que ya no existen en el resultado vigente.
 */

const IMPORT_DEFAULTS = { league: "Runes of Aldur", patch: "0.5.4f" };

function emptyProfile(): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "audit-vacio",
    name: "Personaje de auditoría",
    characterClass: "Warrior",
    level: 90,
    league: "Runes of Aldur",
    patch: "0.5.4f",
    importedAt: "2026-08-19T10:00:00.000Z",
  });
}

/**
 * Plan SINTÉTICO (no oficial) que ejercita TODOS los campos opcionales
 * documentados del esquema GGG Build Planner v1: level_interval (uint,
 * array de 1, array de 2 y array de 3), weapon_set, slot_x/slot_y,
 * unique_name, author, link y support_skills en objeto.
 */
const FULL_FIELDS_BUILD = {
  name: "Plan sintético de auditoría",
  author: "Exile Copilot (test)",
  link: "https://example.invalid/plan",
  description: "Plan de prueba que usa todos los campos documentados.",
  ascendancy: "Warrior1",
  passives: [
    "melee17",
    { id: "strength89", level_interval: 12, weapon_set: 2, additional_text: "texto" },
    { id: "melee18", level_interval: [7] },
    { id: "melee19", level_interval: [10, 20] },
    { id: "melee25", level_interval: [1, 2, 3] },
  ],
  skills: [
    {
      id: "Metadata/Items/Gems/SkillGemEarthquake",
      level_interval: [5, 15],
      additional_text: "skill con intervalo",
      support_skills: [
        "Metadata/Items/Gems/SupportGemFastForward",
        { id: "Metadata/Items/Gems/SupportGemAftershock", level_interval: [9] },
      ],
    },
  ],
  inventory_slots: [
    {
      inventory_id: "Weapon1",
      slot_x: 0,
      slot_y: 1,
      level_interval: [30, 60],
      unique_name: "The Hammer of Faith",
      additional_text: "hueco con coordenadas",
    },
  ],
};

function targetFromBuild(rawBuild: unknown): BuildTarget {
  const plan: BuildTargetPlan = {
    build: GggBuildPlannerV1Schema.parse(rawBuild),
    importedAt: "2026-08-19T10:00:00.000Z",
  };
  return { name: plan.build.name, referenceOnly: true, desiredMods: [], plan };
}

describe("auditoría 1 — level_interval según la doc oficial (uint o array de uint)", () => {
  it("acepta level_interval como uint, array de 1, de 2 y de 3 elementos", () => {
    const parsed = GggBuildPlannerV1Schema.parse(FULL_FIELDS_BUILD);
    expect(parsed.passives).toEqual(FULL_FIELDS_BUILD.passives);
    expect(parsed.skills).toEqual(FULL_FIELDS_BUILD.skills);
    expect(parsed.inventory_slots).toEqual(FULL_FIELDS_BUILD.inventory_slots);
  });

  it("sigue rechazando level_interval con valores no enteros o negativos", () => {
    expect(
      GggBuildPlannerV1Schema.safeParse({
        name: "x",
        passives: [{ id: "p1", level_interval: [-1] }],
      }).success,
    ).toBe(false);
    expect(
      GggBuildPlannerV1Schema.safeParse({
        name: "x",
        passives: [{ id: "p1", level_interval: [1.5] }],
      }).success,
    ).toBe(false);
  });

  it("fidelidad completa: reexportar un plan con TODOS los campos documentados es verbatim", () => {
    const target = targetFromBuild(FULL_FIELDS_BUILD);
    const exported = exportGggBuild(emptyProfile(), target);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));
    expect(parsed.passives).toEqual(FULL_FIELDS_BUILD.passives);
    expect(parsed.skills).toEqual(FULL_FIELDS_BUILD.skills);
    expect(parsed.inventory_slots).toEqual(FULL_FIELDS_BUILD.inventory_slots);
    expect(parsed.author).toBe(FULL_FIELDS_BUILD.author);
    expect(parsed.link).toBe(FULL_FIELDS_BUILD.link);
    expect(parsed.ascendancy).toBe(FULL_FIELDS_BUILD.ascendancy);
  });
});

describe("auditoría 2 — campos no documentados: se conservan y se declaran", () => {
  const buildWithUnknowns = {
    name: "Plan con campos futuros",
    ascendancy: "Warrior1",
    // Campo raíz no documentado en el esquema v1
    future_root_field: "valor futuro",
    passives: [{ id: "melee17", future_passive_field: 42 }],
    inventory_slots: [
      {
        inventory_id: "Weapon1",
        additional_text: "pista",
        future_slot_field: { nested: true },
      },
    ],
  };

  it("importar un .build con campos no documentados los conserva y avisa", () => {
    const result = importBuild(JSON.stringify(buildWithUnknowns), IMPORT_DEFAULTS);
    expect(result.detectedFormat).toBe("ggg-build-planner-v1");
    expect(result.plan).toBeDefined();
    const build = result.plan!.build as Record<string, unknown>;
    expect(build.future_root_field).toBe("valor futuro");
    const passive = (build.passives as Array<Record<string, unknown>>)[1 - 1];
    expect(passive).toMatchObject({ id: "melee17", future_passive_field: 42 });
    const slot = (build.inventory_slots as Array<Record<string, unknown>>)[0];
    expect(slot).toMatchObject({ future_slot_field: { nested: true } });
    // Aviso honesto: los campos fuera del esquema documentado se declaran.
    expect(
      result.warnings.some(
        (w) => w.includes("future_root_field") && w.includes("no documentado"),
      ),
    ).toBe(true);
  });

  it("reexportar conserva los campos no documentados (sin pérdida silenciosa)", () => {
    const imported = importBuild(JSON.stringify(buildWithUnknowns), IMPORT_DEFAULTS);
    const target: BuildTarget = {
      name: "Plan con campos futuros",
      referenceOnly: true,
      desiredMods: [],
      plan: imported.plan!,
    };
    const exported = exportGggBuild(emptyProfile(), target);
    const parsed = JSON.parse(exported.content) as Record<string, unknown>;
    expect(parsed.future_root_field).toBe("valor futuro");
    expect((parsed.passives as Array<Record<string, unknown>>)[0]).toMatchObject({
      future_passive_field: 42,
    });
    expect((parsed.inventory_slots as Array<Record<string, unknown>>)[0]).toMatchObject({
      future_slot_field: { nested: true },
    });
  });
});

describe("auditoría 3 — exportGggBuild no muta el plan de entrada", () => {
  it("dos exports con el mismo target no duplican texto ni contaminan el plan", () => {
    const target = targetFromBuild({
      name: "Plan reutilizado",
      skills: [
        {
          id: "Metadata/Items/Gems/SkillGemEarthquake",
          additional_text: "texto original",
        },
      ],
      inventory_slots: [{ inventory_id: "Weapon1", additional_text: "pista original" }],
    });
    const before = structuredClone(target.plan!.build);

    const applied = ["rec-enlaces-skill", "rec-mejora-arma"];
    exportGggBuild(emptyProfile(), target, applied);
    // El plan de entrada queda intacto tras el primer export.
    expect(target.plan!.build).toEqual(before);

    const second = exportGggBuild(emptyProfile(), target, applied);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(second.content));
    const skill = parsed.skills?.[0];
    const skillText = typeof skill === "object" ? (skill.additional_text ?? "") : "";
    const occurrences = skillText.split("Mejora planificada:").length - 1;
    expect(occurrences).toBe(1); // sin acumulación entre exports
    expect(skillText).toContain("texto original");
  });
});

describe("auditoría 4 — solo se exportan mejoras aplicadas del resultado vigente", () => {
  it("descarta ids marcados en una generación anterior que ya no existen", () => {
    const applied = {
      "rec-vida-baja": true, // de una generación anterior, ya no vigente
      "rec-resistencias-elementales": true,
      "rec-mejora-arma": false,
    };
    const current = [
      { id: "rec-resistencias-elementales" },
      { id: "rec-mejora-arma" },
      { id: "rec-enlaces-skill" },
    ];
    expect(selectAppliedRecommendationIds(applied, current)).toEqual([
      "rec-resistencias-elementales",
    ]);
    expect(selectAppliedRecommendationIds(applied, [])).toEqual([]);
    expect(selectAppliedRecommendationIds({}, current)).toEqual([]);
  });
});

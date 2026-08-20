import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { exportGggBuild } from "../../server/exporters/gggBuildExporter.js";
import {
  MAX_LISTED_GAPS,
  MAX_PLAN_HINTS,
  targetGapsRule,
} from "../../server/engine/rules.js";
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

describe("auditoría 5 — pistas del plan sin restos de markup GGG", () => {
  // El markup oficial (<tag>{...}) abre y cierra en líneas distintas: la línea
  // final del bloque ("3. Increased Armour}") conservaba la llave de cierre y
  // la recomendación mostraba "Increased Armour}; ...".
  const markupBuild = {
    name: "Plan con markup multilínea",
    inventory_slots: [
      {
        inventory_id: "BodyArmour1",
        additional_text:
          "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n-------------------\n1. Increased Health\n2. Increased Resistances\n3. Increased Armour}",
      },
      {
        inventory_id: "Ring1",
        additional_text:
          "<silver>{Any Ring (Resistance Base)}\n\n<grey>{Stat Priority\n-------------------\n1. Flat damage to attacks\n2. Increased Life}",
      },
    ],
  };

  it("las pistas quedan limpias: sin llaves, sin '};' y con el texto exacto", async () => {
    const { generateRecommendations } = await import("../../server/engine/engine.js");
    const result = await generateRecommendations(emptyProfile(), {
      budget: { amount: 50, currency: "divine" },
      goal: { kind: "balanced" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target: targetFromBuild(markupBuild),
    });
    const ref = result.recommendations.find((r) => r.id === "rec-mods-objetivo");
    expect(ref).toBeDefined();
    const action = ref!.action;
    // Texto exacto ya limpio, tal y como se muestra al usuario.
    expect(action).toContain("Increased Health; Increased Resistances; Increased Armour");
    expect(action).toContain("Flat damage to attacks; Increased Life");
    // Sin restos de sintaxis del markup original.
    expect(action).not.toMatch(/[{}]/);
    expect(action).not.toContain("};");
    expect(action).not.toMatch(/<[^>]+>/);
  });

  it("no rompe texto legítimo: markup anidado y desiredMods del usuario intactos", async () => {
    const { generateRecommendations } = await import("../../server/engine/engine.js");
    const target = targetFromBuild({
      name: "Plan anidado",
      inventory_slots: [
        {
          inventory_id: "Amulet1",
          // Markup anidado en una sola línea + pista sin markup.
          additional_text: "<m>{<red>{Increased Strength}}\nMaximum Mana",
        },
      ],
    });
    target.desiredMods = ["increased spell damage (10-20)"];
    const result = await generateRecommendations(emptyProfile(), {
      budget: { amount: 50, currency: "divine" },
      goal: { kind: "balanced" },
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target,
    });
    const ref = result.recommendations.find((r) => r.id === "rec-mods-objetivo");
    expect(ref).toBeDefined();
    expect(ref!.action).toContain("Increased Strength");
    expect(ref!.action).toContain("Maximum Mana");
    // Los paréntesis legítimos del usuario no se tocan.
    expect(ref!.action).toContain("increased spell damage (10-20)");
    expect(ref!.action).not.toMatch(/[{}]/);
  });
});

describe("auditoría 6 — limpieza de markup en un solo recorrido (O(n)) y límites", () => {
  /** Ejecuta la regla de referencia sobre un plan y devuelve su acción. */
  function actionFor(rawBuild: unknown, desiredMods: string[] = []): string {
    const target = targetFromBuild(rawBuild);
    target.desiredMods = desiredMods;
    const candidates = targetGapsRule({
      profile: emptyProfile(),
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target,
    });
    expect(candidates).toHaveLength(1);
    return candidates[0]!.action;
  }

  it("wrappers anidados y multilínea quedan limpios, incluida la línea de cierre", () => {
    const action = actionFor({
      name: "Plan anidado multilínea",
      inventory_slots: [
        {
          inventory_id: "BodyArmour1",
          additional_text:
            "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n-------------------\n1. Increased Health\n2. <m>{<red>{Increased Resistances}}\n3. Increased Armour}",
        },
      ],
    });
    expect(action).toContain("Increased Health; Increased Resistances; Increased Armour");
    expect(action).not.toMatch(/[{}]/);
    expect(action).not.toContain("};");
    expect(action).not.toMatch(/<[^>]+>/);
  });

  it("conserva literalmente llaves y paréntesis fuera de un wrapper reconocido", () => {
    const action = actionFor(
      {
        name: "Plan con literales",
        inventory_slots: [
          {
            inventory_id: "Ring1",
            // Llaves y paréntesis dentro del wrapper pero SIN etiqueta propia:
            // son texto legítimo del autor del plan y deben sobrevivir.
            additional_text:
              "<grey>{Stat Priority\n1. Increased Damage rango {10-20}\n2. Maximum Life (10-20)}",
          },
        ],
      },
      // Y un desiredMod del usuario con paréntesis legítimos.
      ["Flat damage rango {5-7}"],
    );
    expect(action).toContain("Increased Damage rango {10-20}");
    expect(action).toContain("Maximum Life (10-20)");
    expect(action).toContain("Flat damage rango {5-7}");
    // No queda ningún resto del wrapper que sí era markup.
    expect(action).not.toContain("<grey>");
    expect(action).not.toContain("Stat Priority}");
  });

  it("un wrapper sin cerrar se conserva verbatim (no se pierde texto)", () => {
    const action = actionFor({
      name: "Plan con wrapper abierto",
      inventory_slots: [
        { inventory_id: "Helm1", additional_text: "Increased Armour <red>{sin cerrar" },
      ],
    });
    expect(action).toContain("Increased Armour <red>{sin cerrar");
  });

  it("frontera de etiqueta: 32 caracteres es markup; 33 se conserva literal", () => {
    // MAX_MARKUP_TAG_LENGTH = 32 y el límite es INCLUSIVO: una etiqueta de
    // exactamente 32 caracteres debe reconocerse como wrapper. Antes se
    // rechazaba por un desfase de uno (solo llegaba a 31).
    const tag32 = "a".repeat(32);
    const tag33 = "a".repeat(33);

    const conTag32 = actionFor({
      name: "Etiqueta de 32",
      inventory_slots: [
        { inventory_id: "Helm1", additional_text: `Increased <${tag32}>{Armour}` },
      ],
    });
    expect(conTag32).toContain("Increased Armour");
    expect(conTag32).not.toContain(tag32);
    expect(conTag32).not.toMatch(/[{}]/);

    const conTag33 = actionFor({
      name: "Etiqueta de 33",
      inventory_slots: [
        { inventory_id: "Helm1", additional_text: `Increased <${tag33}>{Armour}` },
      ],
    });
    // Supera el límite documentado: no es markup, se conserva literal.
    expect(conTag33).toContain(`Increased <${tag33}>{Armour}`);
  });
  it("entrada profundamente anidada: sin regresión cuadrática y con salida correcta", () => {
    // 50 000 niveles ≈ 350 kB, muy por debajo del límite de 2 MB de la API.
    // El limpiador iterativo anterior reescribía toda la cadena por nivel:
    // medido en esta máquina daba 243 ms a 5 000 niveles, así que 50 000 (×10,
    // coste ×100) rondaría los 20-25 s. Un solo recorrido tarda milisegundos.
    // El umbral de 2 s no es frágil: separa dos órdenes de magnitud, no
    // "rápido" de "un poco menos rápido".
    const depth = 50_000;
    const rawBuild = {
      name: "Plan patológico",
      inventory_slots: [
        {
          inventory_id: "Weapon1",
          additional_text: `${"<red>{".repeat(depth)}Increased Armour${"}".repeat(depth)}`,
        },
      ],
    };
    const started = performance.now();
    const action = actionFor(rawBuild);
    const elapsedMs = performance.now() - started;

    expect(action).toContain("Increased Armour");
    expect(action).not.toMatch(/[{}]/);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("limita las pistas recogidas y declara cuántas carencias no enumera", () => {
    // 60 pistas distintas: por encima de MAX_PLAN_HINTS (40) y de MAX_LISTED_GAPS (12).
    // El sufijo es alfabético a propósito: normalizeModText descarta los
    // dígitos, así que unas pistas numeradas se deduplicarían entre sí.
    const suffix = (i: number): string =>
      String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
    const slots = Array.from({ length: 60 }, (_, i) => ({
      inventory_id: `Slot${i}`,
      additional_text: `<grey>{Increased Stat ${suffix(i)}}`,
    }));
    const action = actionFor({ name: "Plan enorme", inventory_slots: slots });

    const listed = action.split("Increased Stat ").length - 1;
    expect(listed).toBe(MAX_LISTED_GAPS);
    // El truncamiento se declara: 40 recogidas − 12 enumeradas = 28 restantes.
    expect(action).toContain(`(y ${MAX_PLAN_HINTS - MAX_LISTED_GAPS} más no enumeradas)`);
    expect(action.length).toBeLessThan(1000);
  });

  it("la limpieza no toca el plan crudo: reexportar lo devuelve idéntico", () => {
    const rawText =
      "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n-------------------\n1. Increased Health\n2. Increased Armour}";
    const target = targetFromBuild({
      name: "Plan intacto",
      inventory_slots: [{ inventory_id: "BodyArmour1", additional_text: rawText }],
    });
    const planBefore = structuredClone(target.plan!.build);

    // Ejecutar la regla (que limpia el markup) no puede alterar el plan.
    targetGapsRule({
      profile: emptyProfile(),
      league: "Runes of Aldur",
      patch: "0.5.4f",
      target,
    });
    expect(target.plan!.build).toEqual(planBefore);

    const exported = exportGggBuild(emptyProfile(), target);
    const parsed = GggBuildPlannerV1Schema.parse(JSON.parse(exported.content));
    expect(parsed.inventory_slots?.[0]?.additional_text).toBe(rawText);
    expect(parsed.inventory_slots).toEqual(planBefore.inventory_slots);
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

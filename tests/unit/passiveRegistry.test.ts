import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getRegistryProvenance,
  getRegistrySource,
  resolveAscendancy,
  resolvePassive,
  resolvePlan,
  registrySupportsPatch,
} from "../../server/registry/passiveRegistry.js";
import {
  GggSkillTreeExportSchema,
  assertExportInvariants,
} from "../../server/registry/gggExportSchema.js";
import {
  GGG_AFFILIATION_NOTICE,
  PassiveRegistrySchema,
} from "../../shared/passiveRegistry.js";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";
import { importBuild } from "../../server/importers/buildImporter.js";
import { exportGggBuild } from "../../server/exporters/gggBuildExporter.js";
import { CharacterProfileSchema, type CharacterProfile } from "../../shared/domain.js";
import { describeAscendancy } from "../../src/lib/ascendancyDisplay.js";

/**
 * Hito 4A — registro de pasivas y ascendencias derivado EXCLUSIVAMENTE del
 * export oficial de GGG (grindinggear/poe2-skilltree-export).
 */

const titanRaw = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
  "utf8",
);
const registryRaw = readFileSync(
  fileURLToPath(
    new URL("../../server/data/passives/passiveRegistry.1e9eb2d8.json", import.meta.url),
  ),
  "utf8",
);

/** Revisión FIJADA y auditada del export oficial. */
const PINNED_COMMIT = "1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6";
const PINNED_SHA256 = "f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe";

function emptyProfile(): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "registro-test",
    name: "Personaje de prueba",
    characterClass: "Warrior",
    level: 90,
    league: "Runes of Aldur",
    patch: "0.5.4f",
    importedAt: "2026-08-20T10:00:00.000Z",
  });
}

describe("registro: artefacto y procedencia", () => {
  it("el registro cumple su esquema estricto", () => {
    const parsed = PassiveRegistrySchema.safeParse(JSON.parse(registryRaw));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.registryVersion).toBe(1);
    expect(parsed.data?.nodes.length).toBeGreaterThan(1000);
  });

  it("la procedencia fija commit, hash y propietario, sin atribuir el parche a GGG", () => {
    const p = getRegistryProvenance();
    expect(p.sourceRepository).toBe("grindinggear/poe2-skilltree-export");
    expect(p.sourceUrl).toBe("https://github.com/grindinggear/poe2-skilltree-export");
    expect(p.sourceCommit).toBe(PINNED_COMMIT);
    expect(p.sourceFileUrl).toContain(PINNED_COMMIT);
    expect(p.sourceFileSha256).toBe(PINNED_SHA256);
    expect(p.sourceFileBytes).toBe(5_141_380);
    expect(p.dataOwner).toBe("Grinding Gear Games");
    // Licencia explícita: NO encontrada (null), nunca inventada.
    expect(p.license).toBeNull();
    expect(p.licenseNote).toContain("No se encontró licencia explícita");
    // El parche es compatibilidad PROBADA por nosotros...
    expect(p.testedAgainstPatch).toBe("0.5.4f");
    // ...y la etiqueta de la propia fuente es distinta: no se confunden.
    expect(p.sourceCommitMessage).toBe("0.5.2");
    expect(p.sourceCommitMessage).not.toBe(p.testedAgainstPatch);
  });

  it("el resumen para la UI expone origen y licencia sin cargar todo el registro", () => {
    const s = getRegistrySource();
    expect(s.sourceCommit).toBe(PINNED_COMMIT);
    expect(s.testedAgainstPatch).toBe("0.5.4f");
    expect(s.license).toBeNull();
    expect(s.dataOwner).toBe("Grinding Gear Games");
  });

  it("el aviso obligatorio de GGG está disponible con el texto exacto", () => {
    expect(GGG_AFFILIATION_NOTICE).toBe(
      "This product isn't affiliated with or endorsed by Grinding Gear Games in any way.",
    );
  });

  it("el registro no arrastra sprites ni recursos gráficos", () => {
    const registry = PassiveRegistrySchema.parse(JSON.parse(registryRaw));
    const asText = JSON.stringify(registry);
    expect(asText).not.toContain(".png");
    expect(asText).not.toContain("Art/2DArt");
    for (const node of registry.nodes.slice(0, 50)) {
      expect(Object.keys(node).sort()).toEqual(
        ["ascendancyId", "id", "name", "nodeType", "stats"].sort(),
      );
    }
  });
});

describe("registro: resolución de pasivas y ascendencias", () => {
  it("solo autoriza el registro para su parche probado y evidencia exacta", () => {
    expect(registrySupportsPatch("0.5.4f", ["passiveRegistry.1e9eb2d8"])).toBe(true);
    expect(registrySupportsPatch("1.0", ["passiveRegistry.1e9eb2d8"])).toBe(false);
    expect(registrySupportsPatch("0.5.4f", [])).toBe(false);
  });

  it("Titan Warrior resuelve 34/34 pasivas contra el árbol oficial", () => {
    const build = GggBuildPlannerV1Schema.parse(JSON.parse(titanRaw));
    const resolution = resolvePlan(build);

    expect(resolution.totalCount).toBe(34);
    expect(resolution.resolvedCount).toBe(34);
    expect(resolution.passives).toHaveLength(34);
    for (const passive of resolution.passives) {
      expect(passive.verified).toBe(true);
      expect(passive.name).not.toBeNull();
      expect(passive.name).not.toBe("");
      expect(passive.id.length).toBeGreaterThan(0); // el id crudo siempre viaja
    }
    // Nombres oficiales concretos del export (no deducidos del texto del id).
    const byId = new Map(resolution.passives.map((p) => [p.id, p]));
    expect(byId.get("melee17")?.name).toBe("Melee Damage");
    expect(byId.get("marauder_brute_notable1")?.name).toBe("Brutal");
    expect(byId.get("AscendancyWarrior1Notable4")?.name).toBe("Crushing Impacts");
    expect(byId.get("AscendancyWarrior1Notable4")?.nodeType).toBe("notable");
    expect(byId.get("AscendancyWarrior1Notable4")?.ascendancyId).toBe("Warrior1");
    expect(byId.get("jewel_slot1956")?.nodeType).toBe("jewel-socket");
    expect(byId.get("melee17")?.stats.length).toBeGreaterThan(0);
  });

  it("Warrior1 se resuelve al nombre oficial y a su clase", () => {
    const asc = resolveAscendancy("Warrior1");
    expect(asc).toEqual({
      id: "Warrior1",
      name: "Titan",
      className: "Warrior",
      verified: true,
    });
  });

  it("un id desconocido queda explícitamente no verificado, con el id crudo intacto", () => {
    const passive = resolvePassive("melee9999-no-existe");
    expect(passive).toEqual({
      id: "melee9999-no-existe",
      name: null,
      verified: false,
      stats: [],
      nodeType: null,
      ascendancyId: null,
    });

    const asc = resolveAscendancy("Warrior99");
    expect(asc).toEqual({ id: "Warrior99", name: null, className: null, verified: false });
  });

  it("el nombre NUNCA se deduce del texto del id", () => {
    // Un id inventado que "parece" una ascendencia de Warrior no resuelve.
    expect(resolveAscendancy("Warrior1Fake").name).toBeNull();
    // Un id con forma de notable tampoco.
    const fake = resolvePassive("AscendancyWarrior1Notable999");
    expect(fake.verified).toBe(false);
    expect(fake.name).toBeNull();
  });

  it("una ascendencia sin nombre publicado se marca no verificada pero conserva su clase", () => {
    // La fuente publica Ranger2 con name null: no se inventa un nombre.
    const asc = resolveAscendancy("Ranger2");
    expect(asc.name).toBeNull();
    expect(asc.verified).toBe(false);
    expect(asc.className).toBe("Ranger");
  });

  it("un plan sin ascendencia no fabrica resolución de ascendencia", () => {
    const resolution = resolvePlan(GggBuildPlannerV1Schema.parse({ name: "Sin ascendencia" }));
    expect(resolution.ascendancy).toBeNull();
    expect(resolution.totalCount).toBe(0);
    expect(resolution.resolvedCount).toBe(0);
  });
});

describe("UI: texto de ascendencias parcialmente conocidas", () => {
  it("Ranger2 (sin nombre publicado) muestra la clase conocida sin inventar el nombre", () => {
    const line = describeAscendancy(resolveAscendancy("Ranger2"));
    expect(line).toBe("Nombre no verificado · clase Ranger");
    expect(line).toContain("clase Ranger"); // la clase conocida sigue visible
    expect(line).not.toMatch(/Ranger2/); // el id se muestra aparte, nunca como nombre
  });

  it("Druid3 (sin nombre publicado) conserva su clase visible", () => {
    expect(describeAscendancy(resolveAscendancy("Druid3"))).toBe(
      "Nombre no verificado · clase Druid",
    );
  });

  it("verificada y desconocida mantienen su texto propio", () => {
    expect(describeAscendancy(resolveAscendancy("Warrior1"))).toBe("Titan · clase Warrior");
    expect(describeAscendancy(resolveAscendancy("NoExisteXYZ"))).toBe("No verificado");
  });
});
describe("registro: los avisos de importación reflejan el estado real", () => {
  it("importar Titan Warrior nunca afirma que sus pasivas no son resolubles", () => {
    const result = importBuild(titanRaw, { league: "Runes of Aldur", patch: "0.5.4f" });
    const warnings = result.warnings.join(" | ");

    // La afirmación antigua (pre-registro) no puede volver.
    expect(warnings).not.toMatch(/no son resolubles/i);
    expect(warnings).not.toContain("sin datos del juego");

    // El aviso vigente describe el comportamiento real:
    // pasivas → registro oficial; desconocidos → visibles y no verificados;
    // skills/support skills → aún sin fuente incorporada.
    const passivesWarning = result.warnings.find((w) => w.includes("registro"));
    expect(passivesWarning).toBeDefined();
    expect(passivesWarning).toContain("nombre inglés oficial");
    expect(passivesWarning).toContain("no verificado");
    expect(passivesWarning).toMatch(/skills y support skills todavía no se resuelven/);
  });
});
describe("registro: el `.build` crudo nunca se altera", () => {
  it("importar, resolver y reexportar Titan Warrior conserva ids y campos originales", () => {
    const original = JSON.parse(titanRaw) as Record<string, unknown>;
    const imported = importBuild(titanRaw, { league: "Runes of Aldur", patch: "0.5.4f" });
    expect(imported.plan).toBeDefined();

    const planBefore = structuredClone(imported.plan!.build);
    const resolution = resolvePlan(imported.plan!.build);
    expect(resolution.resolvedCount).toBe(34);
    // Resolver es de solo lectura: el plan queda exactamente igual.
    expect(imported.plan!.build).toEqual(planBefore);

    const exported = exportGggBuild(emptyProfile(), {
      name: "Titan Warrior",
      referenceOnly: true,
      desiredMods: [],
      plan: imported.plan!,
    });
    const reexported = JSON.parse(exported.content) as Record<string, unknown>;

    // Identificadores y campos oficiales, verbatim.
    expect(reexported.passives).toEqual(original.passives);
    expect(reexported.skills).toEqual(original.skills);
    expect(reexported.inventory_slots).toEqual(original.inventory_slots);
    expect(reexported.ascendancy).toEqual(original.ascendancy);
    expect(reexported.author).toEqual(original.author);
    expect(reexported.name).toEqual(original.name);
    // Ningún nombre resuelto se cuela en el archivo oficial.
    expect(exported.content).not.toContain("Crushing Impacts");
    expect(exported.content).not.toContain("Melee Damage");
  });
});

describe("registro: el proceso offline falla si la estructura oficial cambia", () => {
  it("acepta la forma real del export oficial", () => {
    const valid = {
      classes: [{ name: "Warrior", ascendancies: [{ id: "Warrior1", name: "Titan" }] }],
      nodes: { "1": { id: "melee17", skill: 1, name: "Melee Damage", stats: ["x"] } },
    };
    expect(GggSkillTreeExportSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza un export sin `nodes` o sin `classes`", () => {
    expect(GggSkillTreeExportSchema.safeParse({ classes: [] }).success).toBe(false);
    expect(GggSkillTreeExportSchema.safeParse({ classes: [{ name: "Warrior" }] }).success).toBe(
      false,
    );
  });

  it("rechaza tipos cambiados en los campos que consumimos", () => {
    const mutated = {
      classes: [{ name: "Warrior" }],
      // stats deja de ser un array de strings
      nodes: { "1": { id: "melee17", name: "Melee Damage", stats: "10% increased" } },
    };
    expect(GggSkillTreeExportSchema.safeParse(mutated).success).toBe(false);
  });

  it("los invariantes fallan con mensaje claro en lugar de degradarse", () => {
    const classes = [
      { name: "A" },
      { name: "B" },
      { name: "C" },
      { name: "D" },
      { name: "E" },
    ];

    const tooSmall = GggSkillTreeExportSchema.parse({
      classes,
      nodes: { "1": { id: "melee17", name: "Melee Damage", stats: [] } },
    });
    expect(() => assertExportInvariants(tooSmall)).toThrow(/nodos/i);

    const duplicated = GggSkillTreeExportSchema.parse({
      classes,
      nodes: Object.fromEntries([
        ...Array.from({ length: 1200 }, (_, i) => [
          String(i),
          { id: `n${i}`, name: "N", stats: [] },
        ]),
        ["dup", { id: "n1", name: "N", stats: [] }],
      ]),
    });
    expect(() => assertExportInvariants(duplicated)).toThrow(/duplicado/i);

    const noName = GggSkillTreeExportSchema.parse({
      classes,
      nodes: Object.fromEntries(
        Array.from({ length: 1200 }, (_, i) =>
          i === 5
            ? [String(i), { id: `n${i}`, stats: [] }]
            : [String(i), { id: `n${i}`, name: "N", stats: [] }],
        ),
      ),
    });
    expect(() => assertExportInvariants(noName)).toThrow(/name/i);
  });
});

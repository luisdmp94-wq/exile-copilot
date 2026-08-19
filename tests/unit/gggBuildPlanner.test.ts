import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";
import { importBuild } from "../../server/importers/buildImporter.js";
import { importGggBuildPlanner, parseGggBuildPlanner } from "../../server/importers/gggBuildImporter.js";
import { exportGggBuild } from "../../server/exporters/gggBuildExporter.js";
import { ApiHttpError } from "../../server/errors.js";

const DEFAULTS = { league: "Runes of Aldur", patch: "0.5.0" };

const titanContent = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
  "utf8",
);
const demoSnapshot = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  ),
);

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("gggBuildImporter (formato oficial Build Planner v1)", () => {
  it("el fixture Titan Warrior valida contra el esquema oficial", () => {
    const parsed = GggBuildPlannerV1Schema.safeParse(JSON.parse(titanContent));
    expect(parsed.success).toBe(true);
  });

  it("importa el ejemplo oficial de GGG a snapshot interno honesto", () => {
    const { profile, warnings } = importGggBuildPlanner(parseGggBuildPlanner(titanContent), DEFAULTS);

    expect(profile.name).toBe("Titan Warrior");
    expect(profile.ascendancy).toBe("Warrior1");
    // Sin mapeo documentado ascendancy → clase: no se inventa
    expect(profile.characterClass).toBe("Desconocida");
    // El formato oficial no almacena nivel/estadísticas: desconocidos, nunca 0
    expect(profile.level).toBe(1);
    expect(profile.resistances).toEqual({ fire: null, cold: null, lightning: null, chaos: null });
    expect(profile.attributes).toEqual({ str: null, dex: null, int: null });

    // Pasivas con id oficial
    expect(profile.passives.allocated.length).toBe(34);
    for (const node of profile.passives.allocated) expect(node.isOfficialId).toBe(true);
    const withText = profile.passives.allocated.find((n) => n.ref === "strength89");
    expect(withText?.additionalText).toContain("Strength +5");

    // Skills con gemId oficial
    expect(profile.skills.length).toBe(4);
    expect(profile.skills[0]?.mainSkillGemId).toBe("Metadata/Items/Gems/SkillGemEarthquake");
    expect(profile.skills[0]?.supports.map((s) => s.gemId)).toEqual([
      "Metadata/Items/Gems/SupportGemFastForward",
      "Metadata/Items/Gems/SupportGemAftershock",
    ]);

    // Inventory slots → items-pista (sin base verificada)
    expect(profile.items.length).toBe(9);
    expect(profile.items[0]?.slot).toBe("weapon");
    expect(profile.items[0]?.baseType).toBe("No verificado");

    // Warnings: campos ausentes + nombres no verificables
    expect(warnings.some((w) => w.includes("NO almacena nivel"))).toBe(true);
    expect(warnings.some((w) => w.includes("nombre no verificado"))).toBe(true);
  });

  it("dispatcher: JSON oficial → ggg-build-planner-v1", () => {
    const result = importBuild(titanContent, DEFAULTS);
    expect(result.detectedFormat).toBe("ggg-build-planner-v1");
    expect(result.profile.name).toBe("Titan Warrior");
  });

  it("dispatcher: JSON que no cumple el esquema oficial → 400 con detalle", () => {
    try {
      importBuild(JSON.stringify({ passives: 42 }), DEFAULTS);
      expect.unreachable("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).message).toBe("ggg-build-invalido");
    }
  });

  it("dispatcher: basura → 400 formato-desconocido", () => {
    try {
      importBuild("esto no es nada importable", DEFAULTS);
      expect.unreachable("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).message).toBe("formato-desconocido");
    }
  });

  it("dispatcher: código PoB generado en el test → pob-code con gemId null", () => {
    const xml = `<?xml version="1.0"?>
<PathOfBuilding>
  <Build level="70" className="Mercenary" ascendClassName="Gemling Legionnaire">
    <Skill mainSkill="true" label="Galvanic Shards"/>
  </Build>
</PathOfBuilding>`;
    const { profile, warnings, detectedFormat } = importBuild(makePobCode(xml), DEFAULTS);
    expect(detectedFormat).toBe("pob-code");
    expect(profile.characterClass).toBe("Mercenary");
    expect(profile.skills[0]?.mainSkill).toBe("Galvanic Shards");
    expect(profile.skills[0]?.mainSkillGemId).toBeNull();
    expect(warnings.some((w) => w.includes("No verificado"))).toBe(true);
  });
});

describe("gggBuildExporter (formato oficial Build Planner v1)", () => {
  it("exporta el snapshot del Titan Warrior: todo con id oficial, informe limpio", () => {
    const { profile } = importGggBuildPlanner(parseGggBuildPlanner(titanContent), DEFAULTS);
    const { fileName, content, report } = exportGggBuild(profile);

    expect(fileName.endsWith(".build")).toBe(true);
    expect(fileName).toBe("Titan-Warrior.build");

    const parsed = GggBuildPlannerV1Schema.safeParse(JSON.parse(content));
    expect(parsed.success).toBe(true);

    expect(report.exported.passives).toBe(34);
    expect(report.exported.skills).toBe(4);
    expect(report.exported.inventorySlots).toBe(9);
    expect(report.skippedUnverified).toHaveLength(0);
    // El informe es la verdad: el formato no puede almacenar nivel, liga, etc.
    expect(report.notExportable.length).toBeGreaterThan(0);
    expect(report.notExportable.join(" ")).toContain("Nivel");
    expect(report.notExportable.join(" ")).toContain("Resistencias");
  });

  it("snapshot demo (sin ids oficiales): pasivas/skills a skippedUnverified", () => {
    const { fileName, content, report } = exportGggBuild(demoSnapshot);

    expect(fileName.endsWith(".build")).toBe(true);
    expect(GggBuildPlannerV1Schema.safeParse(JSON.parse(content)).success).toBe(true);
    expect(report.exported.passives).toBe(0);
    expect(report.exported.skills).toBe(0);
    expect(report.skippedUnverified.length).toBeGreaterThan(0);
    expect(report.skippedUnverified.some((s) => s.includes("Prismatic Growth"))).toBe(true);
    expect(report.skippedUnverified.some((s) => s.includes("Galvanic Shards"))).toBe(true);
    expect(report.notExportable.length).toBeGreaterThan(0);
    // Los inventory_slots sí se exportan como pistas de texto
    expect(report.exported.inventorySlots).toBeGreaterThan(0);
  });

  it("mapea target.sourceUrl → link y target.summary → description", () => {
    const { content } = exportGggBuild(demoSnapshot, {
      name: "Referencia",
      sourceUrl: "https://mobalytics.gg/poe-2/builds/example",
      summary: "Build de referencia",
      desiredMods: [],
      referenceOnly: true,
    });
    const build = JSON.parse(content);
    expect(build.link).toBe("https://mobalytics.gg/poe-2/builds/example");
    expect(build.description).toBe("Build de referencia");
  });
});

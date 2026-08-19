import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BuildFileSchema } from "../../shared/buildFile.js";
import { importBuild } from "../../server/importers/buildFileImporter.js";
import { exportBuild } from "../../server/exporters/buildFileExporter.js";

function demoProfile() {
  const content = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoBuild.build.json", import.meta.url)),
    "utf8",
  );
  return importBuild(content).profile;
}

describe("buildFileExporter", () => {
  it("la salida valida contra BuildFileSchema", () => {
    const profile = demoProfile();
    const exported = exportBuild(profile, ["rec-resistencias-elementales"]);
    const parsed = BuildFileSchema.safeParse(JSON.parse(exported));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.formatVersion).toBe(1);
    expect(parsed.data?.appliedRecommendations).toEqual(["rec-resistencias-elementales"]);
  });

  it("round-trip export → import sin pérdida ni warnings de validación dura", () => {
    const profile = demoProfile();
    const exported = exportBuild(profile);
    const reimported = importBuild(exported);

    expect(reimported.detectedFormat).toBe("build-json");
    expect(reimported.warnings).toHaveLength(0); // round-trip limpio

    const p = reimported.profile;
    expect(p.name).toBe(profile.name);
    expect(p.characterClass).toBe(profile.characterClass);
    expect(p.ascendancy).toBe(profile.ascendancy);
    expect(p.level).toBe(profile.level);
    expect(p.archetype).toBe(profile.archetype);
    expect(p.league).toBe(profile.league);
    expect(p.patch).toBe(profile.patch);
    expect(p.attributes).toEqual(profile.attributes);
    expect(p.resistances).toEqual(profile.resistances);
    expect(p.life).toBe(profile.life);
    expect(p.items).toHaveLength(profile.items.length);
    expect(p.skills).toEqual(profile.skills);
    expect(p.passives).toEqual(profile.passives);
    // Los items conservan id, mods y requisitos
    expect(p.items.map((i) => i.id)).toEqual(profile.items.map((i) => i.id));
  });

  it("exporta perfiles sin campos opcionales (vida, ascendencia)", () => {
    const profile = demoProfile();
    delete profile.ascendancy;
    delete profile.life;
    delete profile.notes;
    const exported = exportBuild(profile);
    const parsed = BuildFileSchema.safeParse(JSON.parse(exported));
    expect(parsed.success).toBe(true);
  });
});

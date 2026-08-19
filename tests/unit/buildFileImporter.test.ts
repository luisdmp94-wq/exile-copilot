import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildFileImporter.js";
import { ApiHttpError } from "../../server/errors.js";

const demoBuild = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoBuild.build.json", import.meta.url)),
  "utf8",
);

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("buildFileImporter", () => {
  it("importa el fixture demo (JSON .build válido) sin warnings", () => {
    const { profile, warnings, detectedFormat } = importBuild(demoBuild);
    expect(detectedFormat).toBe("build-json");
    expect(warnings).toHaveLength(0);
    expect(profile.name).toBe("Demo Gemling");
    expect(profile.characterClass).toBe("Mercenary");
    expect(profile.ascendancy).toBe("Gemling Legionnaire");
    expect(profile.level).toBe(70);
    expect(profile.items).toHaveLength(8);
    expect(profile.skills).toHaveLength(3);
    expect(profile.resistances.lightning).toBe(40);
    expect(profile.resistances.chaos).toBe(-10);
    expect(profile.id).toBeTruthy();
    expect(profile.importedAt).toBeTruthy();
    expect(profile.sources[0]?.kind).toBe("user");
  });

  it("rellena campos opcionales ausentes y añade warnings", () => {
    const minimal = JSON.stringify({
      formatVersion: 1,
      patch: "0.3.0",
      league: "Rise of the Abyssal",
      character: { name: "Minimal", class: "Mercenary", level: 50 },
    });
    const { profile, warnings, detectedFormat } = importBuild(minimal);
    expect(detectedFormat).toBe("build-json");
    expect(warnings.length).toBeGreaterThanOrEqual(4); // items, skills, passives, character.*
    expect(profile.items).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.attributes).toEqual({ str: 0, dex: 0, int: 0 });
    expect(profile.resistances).toEqual({ fire: 0, cold: 0, lightning: 0, chaos: 0 });
  });

  it("rechaza basura con error 400 claro", () => {
    try {
      importBuild("esto no es nada importable");
      expect.unreachable("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).message).toBe("formato-desconocido");
    }
  });

  it("rechaza JSON que no cumple el esquema con detalle de validación", () => {
    const invalid = JSON.stringify({ formatVersion: 2, character: {} });
    try {
      importBuild(invalid);
      expect.unreachable("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).detail).toContain("formatVersion");
    }
  });

  it("importa un código PoB generado en el test (zlib deflate + base64url)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="70" className="Mercenary" ascendClassName="Gemling Legionnaire" mainSocketGroup="1">
    <Skill mainSkill="true" label="Galvanic Shards" slot="Weapon"/>
  </Build>
</PathOfBuilding>`;
    const code = makePobCode(xml);
    const { profile, warnings, detectedFormat } = importBuild(code);
    expect(detectedFormat).toBe("pob-code");
    expect(profile.characterClass).toBe("Mercenary");
    expect(profile.ascendancy).toBe("Gemling Legionnaire");
    expect(profile.level).toBe(70);
    expect(profile.skills[0]?.mainSkill).toBe("Galvanic Shards");
    // Todo marcado como no verificado
    expect(warnings.some((w) => w.includes("No verificado"))).toBe(true);
    expect(profile.items).toHaveLength(0);
  });

  it("un código PoB corrupto produce error 400, no una excepción rara", () => {
    const badCode = "a".repeat(64); // base64url válido pero no zlib
    try {
      importBuild(badCode);
      expect.unreachable("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError);
      expect((err as ApiHttpError).statusCode).toBe(400);
      expect((err as ApiHttpError).detail).toContain("No verificado");
    }
  });
});

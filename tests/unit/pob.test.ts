import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  decodePobCode,
  looksLikePobCode,
  POB_MAX_INPUT_CHARS,
  POB_MAX_OUTPUT_BYTES,
} from "../../server/adapters/pob.js";
import { importBuild } from "../../server/importers/buildImporter.js";

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("pob adapter — fixture real (PathOfBuilding2)", () => {
  // Código real exportado de Path of Building PoE2 (ver fixtures/pob2/PROVENANCE.txt).
  const realCode = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/pob2/realBuildCode.txt", import.meta.url)),
    "utf8",
  ).trim();

  it("decodifica un código real de PathOfBuilding2 (Ranger, nivel 1, ascendencia None)", () => {
    expect(looksLikePobCode(realCode)).toBe(true);
    const result = decodePobCode(realCode);
    expect(result.ok).toBe(true);
    expect(result.xml).toContain("<PathOfBuilding2>");
    expect(result.partial.characterClass).toBe("Ranger");
    expect(result.partial.targetVersion).toBe("0_1");
    expect(result.partial.passiveTreeVersion).toBe("0_5");
    expect(result.partial.level).toBe(1);
    expect(result.partial.ascendancy).toBe("None");
    expect(result.partial.attributes).toEqual({ str: 7, dex: 15, int: 7 });
    expect(result.partial.resistances).toEqual({ fire: -50, cold: -50, lightning: -50, chaos: 0 });
    expect(result.partial).toMatchObject({ life: 65, energyShield: 0, evasion: 7, armour: 0 });
    expect(result.partial.items).toEqual([]);
    expect(result.partial.skills).toEqual([]);
    expect(result.partial.passives).toEqual([{ ref: "50459", isOfficialId: false }]);
    // Todo lo extraído va marcado como no verificado.
    expect(result.warnings.some((w) => w.includes("No verificado"))).toBe(true);
  });
});

describe("pob adapter — instantánea rica", () => {
  const richXml = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/pob2/richCharacter.synthetic.xml", import.meta.url)),
    "utf8",
  );

  it("recupera set activo, estadísticas, gemas, pasivas y notas sin inventar ids oficiales", () => {
    const result = decodePobCode(makePobCode(richXml));
    expect(result.ok).toBe(true);
    expect(result.partial).toMatchObject({
      characterClass: "Ranger",
      targetVersion: "0_1",
      passiveTreeVersion: "0_5",
      ascendancy: "Ritualist",
      level: 90,
      attributes: { str: 138, dex: 196, int: 64 },
      resistances: { fire: 75, cold: 75, lightning: 75, chaos: 36 },
      life: 2687,
      energyShield: 437,
      evasion: 5251,
      armour: 1019,
      notes: "Instantánea sintética para verificar el contrato de importación & sus entidades.",
    });
    expect(result.partial.items).toHaveLength(2);
    expect(result.partial.items.map((item) => item.slot)).toEqual(["gloves", "boots"]);
    expect(result.partial.items[0]).toMatchObject({
      name: "Oblivion Paw",
      baseType: "Runeforged Vaal Wraps",
      itemLevel: 81,
      quality: 20,
      requirements: { level: 75 },
    });
    expect(result.partial.items[0]?.modifiers[0]).toMatchObject({
      text: "+18% to Fire Resistance",
      kind: "implicit",
    });
    expect(result.partial.skills).toHaveLength(1);
    expect(result.partial.skills[0]).toMatchObject({
      label: "Poisonburst principal",
      mainSkill: "Poisonburst Arrow",
      mainSkillGemId: "Metadata/Items/Gems/SkillGemPoisonburstArrow",
      supports: [{ name: "Deadly Poison", gemId: "Metadata/Items/Gems/SupportGemDeadlyPoison" }],
    });
    expect(result.partial.passives).toEqual([
      { ref: "50459", isOfficialId: false },
      { ref: "12345", isOfficialId: false },
    ]);
  });
});

describe("pob adapter — procedencia de versión", () => {
  const defaults = { league: "Runes of Aldur", patch: "0.5.4f" };

  it("no confunde targetVersion con el parche y conserva ambas versiones como procedencia", () => {
    const xml = `<PathOfBuilding2>
      <Build level="90" className="Ranger" targetVersion="0_1"/>
      <Tree activeSpec="1"><Spec id="1" treeVersion="0_5" nodes="50459"/></Tree>
    </PathOfBuilding2>`;
    const result = importBuild(makePobCode(xml), defaults, "character");

    expect(result.warnings.some((warning) => warning.startsWith("Incompatibilidad de versión"))).toBe(false);
    expect(result.warnings.join(" ")).toContain("árbol pasivo 0_5");
    expect(result.profile?.pobImport).toEqual({
      targetVersion: "0_1",
      passiveTreeVersion: "0_5",
    });
    expect(result.profile?.sources[0]?.label).toContain("compatibilidad 0_1 · árbol 0_5");
  });

  it("avisa de forma explícita si el árbol pasivo pertenece a otra familia", () => {
    const xml = `<PathOfBuilding2>
      <Build level="90" className="Ranger" targetVersion="0_1"/>
      <Tree activeSpec="1"><Spec id="1" treeVersion="0_4" nodes="50459"/></Tree>
    </PathOfBuilding2>`;
    const result = importBuild(makePobCode(xml), defaults, "character");

    expect(result.warnings[0]).toContain("Incompatibilidad de versión");
    expect(result.warnings[0]).toContain("0_4");
    expect(result.warnings[0]).toContain("0.5.4f");
    expect(result.profile?.pobImport?.passiveTreeVersion).toBe("0_4");
  });
});

describe("pob adapter — robustez", () => {
  it("decodifica un código PoB válido", () => {
    const xml = `<PathOfBuilding2><Build level="70" className="Mercenary"/></PathOfBuilding2>`;
    const result = decodePobCode(makePobCode(xml));
    expect(result.ok).toBe(true);
    expect(result.partial.characterClass).toBe("Mercenary");
    expect(result.partial.level).toBe(70);
  });

  it("rechaza explícitamente un código de Path of Building 1", () => {
    const xml = `<PathOfBuilding><Build level="95" className="Ranger"/></PathOfBuilding>`;
    const result = decodePobCode(makePobCode(xml));

    expect(result.ok).toBe(false);
    expect(result.partial).toEqual({ mainSkills: [], skills: [], items: [], passives: [] });
    expect(result.warnings.join(" ")).toMatch(/PoE1/);
    expect(result.warnings.join(" ")).toContain("PathOfBuilding2");
  });

  it("rechaza entradas que superan el límite de tamaño sin lanzar ni colgar", () => {
    const huge = "a".repeat(POB_MAX_INPUT_CHARS + 1);
    expect(looksLikePobCode(huge)).toBe(true); // formato base64url válido
    const result = decodePobCode(huge);
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("límite de entrada"))).toBe(true);
  });

  it("rechaza payloads cuya descompresión supera maxOutputLength (zip-bomb guard)", () => {
    // XML repetido que infla a más de POB_MAX_OUTPUT_BYTES
    const chunk = "<PathOfBuilding2><Build level=\"70\"/>".padEnd(1000, " ");
    const bigXml = `${chunk.repeat(Math.ceil((POB_MAX_OUTPUT_BYTES + 1000) / 1000))}</PathOfBuilding2>`;
    const code = makePobCode(bigXml);
    const result = decodePobCode(code);
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("descomprimir") || w.includes("descompresión"))).toBe(true);
  });

  it("código corrupto (base64url válido, no zlib) → rechazo con warning", () => {
    const result = decodePobCode("a".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

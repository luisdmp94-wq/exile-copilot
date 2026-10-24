import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { checkPastedCode, explainImportError, readBuildForCheck } from "../../src/lib/buildCheck.js";
import { extraDamageTaken, findBuildPriorities, prioritiesForInput } from "../../src/lib/buildPriorities.js";
import { CHECK_TEXT, initialCheckLang } from "../../src/lib/checkText.js";
import { EMPTY_MANUAL_VALUES, parseManualCheck } from "../../src/lib/manualCheck.js";

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function lowResProfile() {
  const xml = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/pob2/richCharacter.synthetic.xml", import.meta.url)),
    "utf8",
  )
    .replace('stat="FireResist" value="75"', 'stat="FireResist" value="52"')
    .replace('stat="LightningResist" value="75"', 'stat="LightningResist" value="61"')
    .replace('stat="ChaosResist" value="36"', 'stat="ChaosResist" value="-24"');
  const { profile } = importBuild(makePobCode(xml), { league: "Standard", patch: "0.5.5" }, "character");
  if (!profile) throw new Error("El código PoB2 debería producir un personaje");
  return profile;
}

describe("chequeo de build — idioma inicial", () => {
  it("?lang= manda sobre lo guardado y sobre el navegador", () => {
    expect(initialCheckLang("?lang=en", "es", ["es-ES"])).toBe("en");
    expect(initialCheckLang("?lang=es", "en", ["en-US"])).toBe("es");
  });

  it("sin ?lang= usa la elección guardada", () => {
    expect(initialCheckLang("", "en", ["es-ES"])).toBe("en");
  });

  it("sin nada guardado: español si el navegador lo usa, si no inglés", () => {
    expect(initialCheckLang("", null, ["es-MX", "en"])).toBe("es");
    expect(initialCheckLang("", null, ["de-DE", "es"])).toBe("es");
    expect(initialCheckLang("", null, ["en-GB"])).toBe("en");
    expect(initialCheckLang("?lang=fr", "xx", ["fr-FR"])).toBe("en");
  });
});

describe("chequeo de build — textos en inglés", () => {
  it("las prioridades salen en inglés con los mismos datos", () => {
    const priorities = findBuildPriorities(lowResProfile(), "en", "maps");
    expect(priorities).toEqual([
      {
        id: "resistencias-elementales",
        severity: "alta",
        title: "Raise your elemental resistances to 75%",
        facts: ["Fire 52% · 23 points short", "Lightning 61% · 14 points short"],
        why: "With fire at 52% you take 92% more fire damage than at 75%.",
      },
      expect.objectContaining({
        id: "huecos-equipo",
        title: "Fill your empty gear slots",
        facts: ["Empty: Weapon, Helmet, Body Armour, Belt, Amulet, Ring 1, Ring 2"],
      }),
      {
        id: "resistencia-caos",
        severity: "media",
        title: "Get your chaos resistance out of the negatives",
        facts: ["Chaos −24% · 24 points short of 0%"],
        why: "At −24% you take 24% more chaos damage than at 0%.",
      },
    ]);
  });

  it("el daño extra usa «times» y el formato decimal inglés", () => {
    expect(extraDamageTaken(-50, 75, "en")).toBe("6 times more");
    expect(extraDamageTaken(30, 75, "en")).toBe("2.8 times more");
    expect(extraDamageTaken(30, 75, "es")).toBe("2,8 veces más");
  });

  it("la lectura del personaje sale en inglés", () => {
    const reading = readBuildForCheck(lowResProfile(), "en");
    expect(reading.identity).toBe("Ranger · Ritualist · level 90");
    expect(reading.defences[0]).toEqual({ label: "Life", value: "2,687" });
    expect(reading.resistances.map((row) => row.label)).toEqual(["Fire", "Cold", "Lightning", "Chaos"]);
  });

  it("los errores salen en inglés y no filtran el detalle en español del servidor", () => {
    expect(checkPastedCode("", "en")).toBe("Paste your build code first.");
    expect(checkPastedCode("https://pobb.in/x", "en")).toContain("That's a link");
    expect(explainImportError("formato-desconocido", "Formato no reconocido.", "en")).toContain(
      "doesn't look like a Path of Building 2 code",
    );
    expect(explainImportError("otro-error", "Detalle en español", "en")).toBe(
      "I couldn't read the code (otro-error). Please try again in a moment.",
    );
  });

  it("el formulario manual valida en inglés y da las mismas prioridades", () => {
    expect(parseManualCheck({ ...EMPTY_MANUAL_VALUES, cold: "abc" }, [], "en")).toEqual({
      ok: false,
      message: "Cold: enter a whole number between -200 and 90, e.g. 52 or -30.",
    });
    const manual = parseManualCheck(
      { fire: "52", cold: "75", lightning: "61", chaos: "-24" },
      ["weapon", "helmet", "body", "belt", "amulet", "ring1", "ring2"],
      "en",
    );
    if (!manual.ok) throw new Error(manual.message);
    expect(prioritiesForInput(manual.input, "en", "maps")).toEqual(findBuildPriorities(lowResProfile(), "en", "maps"));
  });

  it("los dos idiomas tienen exactamente las mismas claves", () => {
    const keysOf = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object"
        ? Object.entries(value).flatMap(([key, child]) => keysOf(child, `${prefix}${key}.`))
        : [prefix];
    expect(keysOf(CHECK_TEXT.en).sort()).toEqual(keysOf(CHECK_TEXT.es).sort());
  });
});

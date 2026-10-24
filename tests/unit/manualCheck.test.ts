import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import type { CharacterProfile, ItemSlot } from "../../shared/domain.js";
import * as rules from "../../src/lib/buildPriorities.js";
import * as manual from "../../src/lib/manualCheck.js";

const { EMPTY_MANUAL_VALUES } = manual;
// Estos casos fijan los textos en español; los de inglés están en checkText.test.ts.
const parseManualCheck = (values: manual.ManualResistanceValues, emptySlots: ItemSlot[]) =>
  manual.parseManualCheck(values, emptySlots, "es");
const findBuildPriorities = (profile: CharacterProfile) => rules.findBuildPriorities(profile, "es");
const prioritiesForInput = (input: rules.BuildCheckInput) => rules.prioritiesForInput(input, "es");

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("chequeo manual — lectura del formulario", () => {
  it("acepta negativos con guion o signo menos y el símbolo %", () => {
    const result = parseManualCheck(
      { fire: "52", cold: " 75% ", lightning: "−10", chaos: "-30%" },
      [],
    );
    expect(result).toEqual({
      ok: true,
      input: {
        resistances: { fire: 52, cold: 75, lightning: -10, chaos: -30 },
        equippedSlots: ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"],
      },
    });
  });

  it("un campo en blanco queda sin dato, nunca a 0", () => {
    const result = parseManualCheck({ ...EMPTY_MANUAL_VALUES, fire: "60" }, []);
    expect(result.ok && result.input.resistances).toEqual({
      fire: 60,
      cold: null,
      lightning: null,
      chaos: null,
    });
  });

  it("rechaza valores que no son un entero razonable y dice qué campo falla", () => {
    expect(parseManualCheck({ ...EMPTY_MANUAL_VALUES, cold: "abc" }, [])).toEqual({
      ok: false,
      message: "Frío: escribe un número entero entre -200 y 90, por ejemplo 52 o -30.",
    });
    expect(parseManualCheck({ ...EMPTY_MANUAL_VALUES, fire: "52.5" }, []).ok).toBe(false);
    expect(parseManualCheck({ ...EMPTY_MANUAL_VALUES, fire: "500" }, []).ok).toBe(false);
  });

  it("pide al menos una resistencia", () => {
    expect(parseManualCheck(EMPTY_MANUAL_VALUES, ["ring2"])).toEqual({
      ok: false,
      message: "Escribe al menos una resistencia de tu hoja de personaje.",
    });
  });

  it("los huecos marcados salen de la lista de equipados", () => {
    const result = parseManualCheck({ ...EMPTY_MANUAL_VALUES, fire: "75" }, ["belt", "ring2"]);
    expect(result.ok && result.input.equippedSlots).toEqual([
      "weapon", "helmet", "body", "gloves", "boots", "amulet", "ring1",
    ]);
  });
});

describe("chequeo manual — mismas prioridades que con PoB2", () => {
  it("rellenar a mano los datos de un código PoB2 da exactamente el mismo resultado", () => {
    const xml = readFileSync(
      fileURLToPath(new URL("../../server/fixtures/pob2/richCharacter.synthetic.xml", import.meta.url)),
      "utf8",
    )
      .replace('stat="FireResist" value="75"', 'stat="FireResist" value="52"')
      .replace('stat="LightningResist" value="75"', 'stat="LightningResist" value="61"')
      .replace('stat="ChaosResist" value="36"', 'stat="ChaosResist" value="-24"');
    const { profile } = importBuild(
      makePobCode(xml),
      { league: "Standard", patch: "0.5.5" },
      "character",
    );
    if (!profile) throw new Error("El código PoB2 debería producir un personaje");

    const occupied = new Set(profile.items.map((item) => item.slot));
    const emptySlots = (
      ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"] as const
    ).filter((slot) => !occupied.has(slot));
    const manual = parseManualCheck(
      { fire: "52", cold: "75", lightning: "61", chaos: "-24" },
      emptySlots,
    );
    if (!manual.ok) throw new Error(manual.message);

    const fromPob = findBuildPriorities(profile);
    expect(fromPob.map((priority) => priority.id)).toEqual([
      "resistencias-elementales",
      "huecos-equipo",
      "resistencia-caos",
    ]);
    expect(prioritiesForInput(manual.input)).toEqual(fromPob);
  });
});

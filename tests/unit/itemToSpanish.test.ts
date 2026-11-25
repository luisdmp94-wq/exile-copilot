import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import {
  itemToEnglish,
  itemToSpanish,
  spanishModLine,
  type ItemTranslations,
} from "../../shared/itemTranslation.js";

const translations = JSON.parse(readFileSync("server/data/pob/item-translations.json", "utf8")) as ItemTranslations;
const realCode = deflateSync(Buffer.from(readFileSync("server/fixtures/pob2/richCharacter.synthetic.xml", "utf8"), "utf8"))
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
const defaults = { league: "Standard", patch: "0.5.5" };

describe("los objetos de un código de PoB2 se enseñan en español", () => {
  it("un modificador en inglés sale en español, con sus números y con mayúscula", () => {
    expect(spanishModLine("+25% to Fire Resistance", translations)).toBe("+25% a la resistencia al fuego");
    expect(spanishModLine("+73 to maximum Life", translations)).toBe("+73 a la vida máxima");
    expect(spanishModLine("30% increased Movement Speed", translations)).toBe("Velocidad de movimiento aumentada un 30%");
    expect(spanishModLine("Adds 5 to 12 Fire Damage", translations)).toBe("Agrega de 5 a 12 de daño de fuego");
    expect(spanishModLine("esto no es un modificador", translations)).toBeNull();
  });

  it("la base y el nombre del único se traducen; el nombre de un raro se queda", () => {
    const [spanishBase, englishBase] = Object.entries(translations.bases).find(([es, en]) => es !== en)!;
    const [spanishUnique, englishUnique] = Object.entries(translations.uniques).find(([es, en]) => es !== en)!;
    const item = (rarity: "rare" | "unique" | "normal", name: string) => ({
      id: "x",
      name,
      baseType: englishBase,
      slot: "ring1" as const,
      rarity,
      modifiers: [{ text: "+25% to Fire Resistance", kind: "explicit" as const, values: [25] }],
      rawText: `Rarity: RARE\n${name}\n${englishBase}`,
      sources: [],
    });
    const rare = itemToSpanish(item("rare", "Horror Visage") as never, translations);
    expect(rare.name).toBe("Horror Visage");
    expect(rare.baseType).toBe(spanishBase);
    expect(rare.modifiers[0]!.text).toBe("+25% a la resistencia al fuego");
    // PoB2 vuelve a leer el texto original: no se toca.
    expect(rare.rawText).toContain(englishBase);
    expect(itemToSpanish(item("unique", englishUnique) as never, translations).name).toBe(spanishUnique);
    expect(itemToSpanish(item("normal", englishBase) as never, translations).name).toBe(spanishBase);
  });

  it("con un personaje completo de PoB2, casi todo queda en español y vuelve al mismo inglés", () => {
    const profile = importBuild(realCode, defaults, "character").profile!;
    expect(profile.items.length).toBeGreaterThan(1);
    let lines = 0;
    let translated = 0;
    let bases = 0;
    for (const item of profile.items) {
      const spanish = itemToSpanish(item, translations);
      if (spanish.baseType !== item.baseType) bases++;
      item.modifiers.forEach((modifier, index) => {
        for (const [lineIndex, original] of modifier.text.split("\n").entries()) {
          lines++;
          const shown = spanish.modifiers[index]!.text.split("\n")[lineIndex]!;
          if (shown !== original) translated++;
        }
      });
      // De vuelta a PoB2 sin el texto original: la base es la misma.
      const back = itemToEnglish({ ...spanish, rawText: undefined }, translations).text;
      expect(back).toContain(item.baseType);
    }
    expect(bases / profile.items.length).toBeGreaterThan(0.8);
    expect(translated / lines).toBeGreaterThan(0.8);
  });
});

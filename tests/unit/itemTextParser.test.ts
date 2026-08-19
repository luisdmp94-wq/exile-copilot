import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";

const demoText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoItemText.txt", import.meta.url)),
  "utf8",
);

describe("itemTextParser", () => {
  it("parsea el fixture de ballesta rare del juego", () => {
    const { item, warnings } = parseItemText(demoText);

    expect(item.slot).toBe("weapon");
    expect(item.rarity).toBe("rare");
    expect(item.name).toBe("Doom Song");
    expect(item.baseType).toBe("Varnished Crossbow");
    expect(item.quality).toBe(20);
    expect(item.itemLevel).toBe(82);
    expect(item.requirements).toEqual({ level: 68, str: 90, dex: 200 });

    const implicits = item.modifiers.filter((m) => m.kind === "implicit");
    expect(implicits).toHaveLength(1);
    expect(implicits[0]?.text).toContain("Projectile Skills");
    expect(implicits[0]?.values).toEqual([2]);

    const explicits = item.modifiers.filter((m) => m.kind === "explicit");
    expect(explicits).toHaveLength(4);
    // Los mods no verificados se conservan como texto con verified:false
    for (const mod of item.modifiers) expect(mod.verified).toBe(false);
    expect(warnings).toHaveLength(0);
    expect(item.rawText).toBe(demoText);
  });

  it("parsea un objeto unique (nombre + base)", () => {
    const text = [
      "Item Class: Crossbows",
      "Rarity: Unique",
      "The Coming Calamity",
      "Heavy Crossbow",
      "--------",
      "Physical Damage: 80-120",
      "--------",
      "Item Level: 75",
      "--------",
      "Grants Skill: Galvanic Bolt",
      "+40% to Lightning Resistance",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("unique");
    expect(item.name).toBe("The Coming Calamity");
    expect(item.baseType).toBe("Heavy Crossbow");
    expect(item.slot).toBe("weapon");
  });

  it("parsea un objeto magic de una sola línea de nombre", () => {
    const text = [
      "Item Class: Helmets",
      "Rarity: Magic",
      "Gleaming Soldier Helmet",
      "--------",
      "Item Level: 60",
      "--------",
      "+45 to maximum Life",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("magic");
    expect(item.name).toBe("Gleaming Soldier Helmet");
    expect(item.slot).toBe("helmet");
    expect(item.modifiers[0]?.values).toEqual([45]);
  });

  it("acepta rareza en español", () => {
    const text = ["Item Class: Crossbows", "Rarity: Raro", "Canción Funesta", "Ballesta"].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("rare");
  });

  it("soporta requisitos en formato combinado de una línea", () => {
    const text = [
      "Item Class: Boots",
      "Rarity: Rare",
      "Trail Treads",
      "Laced Boots",
      "--------",
      "Requirements: Level: 55, Str: 40, Dex: 90",
      "--------",
      "Item Level: 61",
      "--------",
      "25% increased Movement Speed",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.requirements).toEqual({ level: 55, str: 40, dex: 90 });
    expect(item.slot).toBe("boots");
  });

  it("marca mods enchant/rune por su sufijo", () => {
    const text = [
      "Item Class: Amulets",
      "Rarity: Rare",
      "Eye of the Void",
      "Jade Amulet",
      "--------",
      "Item Level: 70",
      "--------",
      "+10% to all Elemental Resistances (enchant)",
      "+20 to Dexterity (rune)",
      "+30 to maximum Life",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.modifiers.map((m) => m.kind)).toEqual(["enchant", "rune", "explicit"]);
  });
});

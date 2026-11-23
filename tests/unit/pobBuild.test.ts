import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile, type Item } from "../../shared/domain.js";
import { itemToEnglish, translateModLine, type ItemTranslations } from "../../shared/itemTranslation.js";
import {
  findPobGem,
  gemLevelFor,
  pobAscendancyFor,
  pobClassFor,
  pobCodeFromDeflated,
  pobContentDigests,
  pobXmlForProfile,
  resistancePenaltyFor,
  trimPobXml,
  withoutPobXml,
  type PobBuildData,
  type PobGemInfo,
} from "../../shared/pobBuild.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { readPobXml } from "../../server/adapters/pobXml.js";
import { profileFromPob } from "../../server/importers/pobProfile.js";

const gemsFile = JSON.parse(readFileSync("server/data/pob/gems.json", "utf8")) as {
  levelTables: number[][];
  gems: Array<Omit<PobGemInfo, "levels"> & { levels: number[] | number }>;
  spanish: Record<string, string>;
};
const translations = JSON.parse(readFileSync("server/data/pob/item-translations.json", "utf8")) as ItemTranslations;
const data: PobBuildData = {
  treeVersion: (JSON.parse(readFileSync("server/data/pob/meta.json", "utf8")) as { treeVersion: string }).treeVersion,
  classes: JSON.parse(readFileSync("server/data/pob/classes.json", "utf8")),
  gems: gemsFile.gems.map((gem) => ({ ...gem, levels: Array.isArray(gem.levels) ? gem.levels : gemsFile.levelTables[gem.levels] })),
  spanishGems: gemsFile.spanish,
  itemTranslations: translations,
};

function profile(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "prueba",
    name: "Prueba",
    characterClass: "Bruja",
    ascendancy: "Liche",
    level: 30,
    levelSource: "observed",
    league: "Estándar",
    patch: "0.5.5",
    importedAt: "2026-11-22T00:00:00.000Z",
    skills: [
      { id: "1", label: "", mainSkill: "Drenar esencia", supports: [{ name: "Encadenamiento II" }] },
      { id: "2", label: "", mainSkill: "Contagio", level: 9, supports: [] },
    ],
    passives: { allocated: [{ ref: "54447" }, { ref: "62797" }], attributeChoices: { "62797": "int" } },
    ...overrides,
  });
}

describe("datos de PoB2 que genera npm run data:pob", () => {
  it("trae las ocho clases con sus ascendencias y los ids de su XML", () => {
    expect(data.classes.map((entry) => entry.name).sort()).toEqual(
      ["Druid", "Huntress", "Mercenary", "Monk", "Ranger", "Sorceress", "Warrior", "Witch"],
    );
    expect(pobClassFor(data, "Bruja")?.integerId).toBe(1);
    expect(pobAscendancyFor(pobClassFor(data, "Bruja"), "Liche")).toEqual({ internalId: "Witch3", name: "Lich" });
    expect(pobAscendancyFor(pobClassFor(data, "Guerrero"), "Herrero de Kitava")?.name).toBe("Smith of Kitava");
  });

  it("encuentra las gemas por su nombre en español o en inglés", () => {
    expect(findPobGem(data, "Drenar esencia")?.name).toBe("Essence Drain");
    expect(findPobGem(data, "Essence Drain")?.gameId).toBe("Metadata/Items/Gems/SkillGemEssenceDrain");
    expect(findPobGem(data, "Encadenamiento II")?.support).toBe(true);
    expect(findPobGem(data, "No existe")).toBeNull();
  });

  it("el nivel de gema que permite el nivel del personaje, como PoB2", () => {
    const gem = findPobGem(data, "Essence Drain")!;
    expect(gemLevelFor(gem, 1)).toBe(1);
    expect(gemLevelFor(gem, 49)).toBe(12);
    expect(gemLevelFor(gem, 100)).toBe(gem.levels.length);
  });
});

describe("la build de PoB2 desde la ficha", () => {
  it("clase, ascendencia, árbol, atributos, gemas y la habilidad elegida", () => {
    const built = pobXmlForProfile(profile(), data, { mainSkill: "Contagio" });
    expect(built.notes.base).toBe("profile");
    expect(built.xml).toContain('className="Witch" ascendClassName="Lich"');
    expect(built.xml).toContain('classInternalId="1" ascendancyInternalId="Witch3" nodes="54447,62797"');
    expect(built.xml).toContain('intNodes="62797"');
    expect(built.xml).toContain('nameSpec="Essence Drain" level="8"');
    expect(built.xml).toContain('nameSpec="Chain II" level="1"');
    expect(built.xml).toContain('nameSpec="Contagion" level="9"');
    expect(built.mainGroup).toBe(2);
    expect(built.mainSkill).toBe("Contagion");
    expect(built.notes.guessedGemLevels).toBe(1);
    expect(built.xml).toContain('name="resistancePenalty" number="-20"');
  });

  it("dice lo que no reconoce en vez de inventarlo", () => {
    const built = pobXmlForProfile(
      profile({ characterClass: "Desconocida", skills: [{ id: "1", label: "", mainSkill: "Gema rara", mainSkillGemId: null, supports: [] }] }),
      data,
    );
    expect(built.notes.noClass).toBe(true);
    expect(built.notes.unknownGems).toEqual(["Gema rara"]);
  });

  it("el árbol del editor manda sobre el guardado", () => {
    const built = pobXmlForProfile(profile(), data, { passives: ["54447", "62797", "14033"], attributeChoices: { "14033": "dex" } });
    expect(built.xml).toContain('nodes="54447,62797,14033"');
    expect(built.xml).toContain('dexNodes="14033"');
  });

  it("la habilidad que da un arma no se duplica: la crea PoB2 desde el objeto", () => {
    const wand = parseItemText(
      ["Item Class: Wands", "Rarity: Rare", "Doom Song", "Withered Wand", "--------", "Grants Skill: Level 11 Chaos Bolt", "--------", "+20 to maximum Mana"].join(
        "\n",
      ),
    ).item;
    const built = pobXmlForProfile(
      profile({ items: [{ ...wand, slot: "weapon" }], skills: [{ id: "1", label: "", mainSkill: "Descarga de caos", mainSkillGemId: null, supports: [] }] }),
      data,
    );
    expect(built.xml).not.toContain('nameSpec="Chaos Bolt"');
    expect(built.xml).toContain('<Slot name="Weapon 1" itemId="1"/>');
  });

  it("los objetos en español se traducen al inglés para PoB2", () => {
    const mace = parseItemText(
      [
        "Clase de objeto: Mazas",
        "Rareza: Mágico",
        "Maza de procesión de victoria",
        "------------------",
        "Daño físico: 12-18",
        "------------------",
        "## Nivel de objeto: 44",
        '{ Mod. de sufijo "de victoria" (Grado: 1) — Ataque }',
        "+25 a la precisión",
      ].join("\n"),
    ).item;
    const built = pobXmlForProfile(profile({ items: [{ ...mace, slot: "weapon" }] }), data);
    expect(built.notes.translatedItems).toBe(1);
    expect(built.notes.untranslatedLines).toBe(0);
    expect(built.xml).toContain("Marching Mace");
    expect(built.xml).toContain("+25 to Accuracy Rating");
  });
});

describe("la build de PoB2 desde un código importado", () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<PathOfBuilding2>",
    '<Build level="40" className="Witch" ascendClassName="Lich" mainSocketGroup="1" targetVersion="0_1"><PlayerStat stat="Life" value="1"/></Build>',
    '<Tree activeSpec="1"><Spec treeVersion="0_5" classInternalId="1" ascendancyInternalId="Witch3" nodes="54447,62797">',
    '<Overrides><AttributeOverride strNodes="" dexNodes="" intNodes="62797"/></Overrides></Spec></Tree>',
    '<Skills activeSkillSet="1"><SkillSet id="1">',
    '<Skill enabled="true" label=""><Gem gemId="Metadata/Items/Gems/SkillGemEssenceDrain" nameSpec="Essence Drain" level="11" enabled="true"/></Skill>',
    '<Skill enabled="true" label=""><Gem gemId="Metadata/Items/Gems/SkillGemContagion" nameSpec="Contagion" level="11" enabled="true"/></Skill>',
    "</SkillSet></Skills>",
    '<Items activeItemSet="1"><Item id="1">Rarity: RARE\nDoom Song\nWithered Wand\n+20 to maximum Mana</Item><ItemSet id="1"><Slot name="Weapon 1" itemId="1"/></ItemSet></Items>',
    '<Config><Input name="enemyLevel" number="70"/></Config>',
    "</PathOfBuilding2>",
  ].join("\n");
  const decoded = readPobXml(xml);
  const imported = profileFromPob(decoded.partial, decoded.warnings, { league: "Estándar", patch: "0.5.5" }).profile;

  it("al importar se guardan el XML, los niveles de gema y los atributos elegidos", () => {
    expect(imported.pobImport?.xml).toBe(trimPobXml(xml));
    expect(imported.skills.map((skill) => skill.level)).toEqual([11, 11]);
    expect(imported.passives.attributeChoices).toEqual({ "62797": "int" });
    expect(imported.pobImport?.itemsDigest).toBe(pobContentDigests(imported).items);
  });

  it("usa el XML original y solo cambia nivel, grupo principal y árbol", () => {
    const changed = { ...imported, level: 45 };
    const built = pobXmlForProfile(changed, data, { mainSkill: "Contagio", passives: ["54447", "62797", "14033"] });
    expect(built.notes.base).toBe("import");
    expect(built.notes.rebuilt).toEqual([]);
    expect(built.xml).toContain('level="45"');
    // El nivel lo fija la web: PoB2 no debe recalcularlo por su cuenta a mitad de cuenta.
    expect(built.xml).toMatch(/<Build\b[^>]*characterLevelAutoMode="false"/);
    expect(built.xml).not.toContain('characterLevelAutoMode="true"');
    expect(built.xml).toContain('mainSocketGroup="2"');
    expect(built.xml).toContain('nodes="54447,62797,14033"');
    // Lo demás, intacto: configuración, objetos y estadísticas guardadas.
    expect(built.xml).toContain('<Input name="enemyLevel" number="70"/>');
    expect(built.xml).toContain("Doom Song");
  });

  it("si el jugador cambió objetos o gemas en la web, esa parte se reescribe", () => {
    const changed = {
      ...imported,
      skills: [...imported.skills, { id: "3", label: "", mainSkill: "Descarga de caos", mainSkillGemId: null, supports: [] }],
    };
    const built = pobXmlForProfile(changed, data);
    expect(built.notes.rebuilt).toEqual(["skills"]);
    expect(built.xml).toContain('nameSpec="Chaos Bolt"');
    expect(built.xml).toContain("Doom Song");
  });

  it("un código incompleto se completa: clase en el árbol, nivel y calidad de gemas, solo el árbol activo", () => {
    const rough = [
      "<PathOfBuilding2>",
      '<Build level="90" className="Ranger" targetVersion="0_1"/>',
      '<Tree activeSpec="2"><Spec id="1" nodes="1"/><Spec id="2" nodes="50459"/></Tree>',
      '<Skills activeSkillSet="1"><SkillSet id="1"><Skill enabled="true"><Gem nameSpec="Poisonburst Arrow" enabled="true"/></Skill></SkillSet></Skills>',
      "</PathOfBuilding2>",
    ].join("\n");
    const read = readPobXml(rough);
    const ranger = profileFromPob(read.partial, read.warnings, { league: "Estándar", patch: "0.5.5" }).profile;
    const built = pobXmlForProfile(ranger, data);
    expect(built.xml).toContain('<Tree activeSpec="1"><Spec id="2" nodes="50459"');
    expect(built.xml).toContain('classInternalId="2"');
    expect(built.xml).toContain(`treeVersion="${data.treeVersion}"`);
    expect(built.xml).not.toContain('<Spec id="1"');
    expect(built.xml).toMatch(/<Gem nameSpec="Poisonburst Arrow" enabled="true" quality="0" level="20"\/>/);
    expect(built.notes.guessedGemLevels).toBe(1);
  });

  it("al guardar se recorta a lo que se calcula: sin estadísticas, otros árboles ni otros sets", () => {
    const big = [
      "<PathOfBuilding2>",
      '<Build level="40" className="Witch"><PlayerStat stat="Life" value="1"/></Build>',
      "<Notes>muchas notas</Notes>",
      '<Tree activeSpec="2"><Spec nodes="1"/><Spec nodes="54447" treeVersion="0_5" classInternalId="1"><Sockets><Socket nodeId="61419" itemId="7"/></Sockets></Spec></Tree>',
      '<Skills activeSkillSet="2"><SkillSet id="1"><Skill enabled="true"><Gem nameSpec="Fireball" level="1"/></Skill></SkillSet><SkillSet id="2"><Skill enabled="true" label="vacío"/><Skill enabled="true"><Gem nameSpec="Contagion" level="5"/></Skill></SkillSet></Skills>',
      '<Items activeItemSet="2"><Item id="1">Rarity: RARE\nViejo\nWithered Wand</Item><Item id="5">Rarity: RARE\nNuevo\nWithered Wand</Item><Item id="7">Rarity: RARE\nJoya\nRuby</Item><ItemSet id="1"><Slot name="Weapon 1" itemId="1"/></ItemSet><ItemSet id="2"><Slot name="Weapon 1" itemId="5"/></ItemSet></Items>',
      '<Config activeConfigSet="1"><ConfigSet id="1"><Input name="enemyLevel" number="70"/></ConfigSet><ConfigSet id="2"/></Config>',
      "</PathOfBuilding2>",
    ].join("\n");
    const trimmed = trimPobXml(big);
    expect(trimmed).not.toContain("PlayerStat");
    expect(trimmed).not.toContain("Notes");
    expect(trimmed).toContain('<Tree activeSpec="1"><Spec nodes="54447"');
    expect(trimmed).not.toContain('nameSpec="Fireball"');
    expect(trimmed).toContain('<Skills activeSkillSet="1"><SkillSet id="1">');
    // El objeto del set activo y la joya del árbol se quedan; el del otro set, no.
    expect(trimmed).toContain("Nuevo");
    expect(trimmed).toContain("Joya");
    expect(trimmed).not.toContain("Viejo");
    expect(trimmed).toContain('<Config activeConfigSet="1"><ConfigSet id="1"><Input name="enemyLevel" number="70"/>');
    // Un grupo vacío (`<Skill …/>`) no descoloca la habilidad principal.
    const read = readPobXml(big);
    const witch = profileFromPob(read.partial, read.warnings, { league: "Estándar", patch: "0.5.5" }).profile;
    expect(pobXmlForProfile(witch, data, { mainSkill: "Contagio" }).mainGroup).toBe(2);
  });

  it("cambiar objetos en la web deja las joyas en su sitio", () => {
    const withJewel = [
      "<PathOfBuilding2>",
      '<Build level="40" className="Witch"/>',
      '<Tree activeSpec="1"><Spec nodes="54447" treeVersion="0_5" classInternalId="1"><Sockets><Socket nodeId="61419" itemId="7"/></Sockets></Spec></Tree>',
      '<Items activeItemSet="1"><Item id="5">Rarity: RARE\nNuevo\nWithered Wand</Item><Item id="7">Rarity: RARE\nJoya\nRuby</Item><ItemSet id="1"><Slot name="Weapon 1" itemId="5"/></ItemSet></Items>',
      "</PathOfBuilding2>",
    ].join("\n");
    const read = readPobXml(withJewel);
    const witch = profileFromPob(read.partial, read.warnings, { league: "Estándar", patch: "0.5.5" }).profile;
    const boots = parseItemText(["Item Class: Boots", "Rarity: Rare", "Golem Tread", "Runeforged Quickslip Shoes", "--------", "+40 to maximum Life"].join("\n")).item;
    const built = pobXmlForProfile({ ...witch, items: [...witch.items, { ...boots, slot: "boots" }] }, data);
    expect(built.notes.rebuilt).toEqual(["items"]);
    expect(built.xml).toContain('<Item id="7">');
    expect(built.xml).toContain('<Socket nodeId="61419" itemId="7"/>');
    expect(built.xml).toMatch(/<Slot name="Boots" itemId="\d+"\/>/);
  });

  it("el orden de las habilidades no cuenta como cambio, y el XML no viaja al servidor", () => {
    const reordered = { ...imported, skills: [...imported.skills].reverse() };
    expect(pobXmlForProfile(reordered, data).notes.rebuilt).toEqual([]);
    expect(withoutPobXml(imported).pobImport?.xml).toBeUndefined();
    expect(withoutPobXml(imported).pobImport?.passiveTreeVersion).toBe(imported.pobImport?.passiveTreeVersion);
  });

  it("el código de exportar es zlib en base64url, como el de PoB2", () => {
    const built = pobXmlForProfile(imported, data);
    const code = pobCodeFromDeflated(new Uint8Array(deflateSync(built.xml)));
    expect(code).not.toMatch(/[+/]/);
    const back = inflateSync(Buffer.from(code.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
    expect(back).toBe(built.xml);
  });
});

describe("objetos en español → inglés", () => {
  it("traduce líneas con números, también con el rango de Ctrl+Alt+C", () => {
    expect(translateModLine("+45 a la vida máxima", translations)).toBe("+45 to maximum Life");
    expect(translateModLine("+233(168-236) a la precisión", translations)).toBe("+233 to Accuracy Rating");
    expect(translateModLine("Daño de hechizos aumentado un 76%", translations)).toBe("76% increased Spell Damage");
    expect(translateModLine("Esto no es un modificador", translations)).toBeNull();
  });

  it("un único lleva su nombre en inglés y «Otorga la habilidad» se traduce con la gema", () => {
    const item: Item = {
      id: "u",
      name: "Ramito de vida",
      baseType: "Varita armonizada",
      slot: "weapon",
      rarity: "unique",
      modifiers: [{ id: "m", text: "Otorga la habilidad: Nivel 10 Descarga de caos", kind: "implicit", values: [10], verified: false }],
      sources: [],
    };
    const english = itemToEnglish(item, translations, data.spanishGems);
    expect(english.text.split("\n").slice(0, 3)).toEqual(["Rarity: UNIQUE", "Lifesprig", "Attuned Wand"]);
    expect(english.text).toContain("Grants Skill: Level 10 Chaos Bolt");
    expect(english.untranslated).toBe(0);
  });

  it("la penalización de resistencias sube con el acto (por nivel)", () => {
    expect(resistancePenaltyFor(5)).toBe(0);
    expect(resistancePenaltyFor(30)).toBe(-20);
    expect(resistancePenaltyFor(80)).toBe(-60);
  });
});

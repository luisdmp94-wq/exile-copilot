/**
 * El motor de Path of Building 2 (Lua 5.2 en WebAssembly) arranca en Node con
 * el paquete de `npm run data:pob` y calcula una build escrita por la web.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../../shared/domain.js";
import { pobXmlForProfile, type PobBuildData, type PobGemInfo } from "../../shared/pobBuild.js";
import { PobEngine, type GlueFactory } from "../../src/pob/pobEngine.js";
import type { PobBundle } from "../../src/pob/pobTypes.js";

const require = createRequire(import.meta.url);
const gluePath = require.resolve("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js");

const gemsFile = JSON.parse(readFileSync("server/data/pob/gems.json", "utf8")) as {
  levelTables: number[][];
  gems: Array<Omit<PobGemInfo, "levels"> & { levels: number[] | number }>;
  spanish: Record<string, string>;
};
const data: PobBuildData = {
  treeVersion: (JSON.parse(readFileSync("server/data/pob/meta.json", "utf8")) as { treeVersion: string }).treeVersion,
  classes: JSON.parse(readFileSync("server/data/pob/classes.json", "utf8")),
  gems: gemsFile.gems.map((gem) => ({ ...gem, levels: Array.isArray(gem.levels) ? gem.levels : gemsFile.levelTables[gem.levels] })),
  spanishGems: gemsFile.spanish,
  itemTranslations: JSON.parse(readFileSync("server/data/pob/item-translations.json", "utf8")),
};

const witch = CharacterProfileSchema.parse({
  id: "bruja",
  name: "Bruja",
  characterClass: "Bruja",
  ascendancy: null,
  level: 30,
  levelSource: "observed",
  league: "Estándar",
  patch: "0.5.5",
  importedAt: "2026-11-22T00:00:00.000Z",
  skills: [
    { id: "1", label: "", mainSkill: "Drenar esencia", supports: [{ name: "Aflicción veloz I" }] },
    { id: "2", label: "", mainSkill: "Contagio", supports: [] },
  ],
  items: [
    {
      id: "varita",
      name: "Canción fatal",
      baseType: "Varita marchita",
      slot: "weapon",
      rarity: "rare",
      modifiers: [
        { id: "a", text: "Daño de hechizos aumentado un 40%", kind: "explicit" },
        { id: "b", text: "+30 a la vida máxima", kind: "explicit" },
      ],
    },
  ],
});

let engine: PobEngine;

beforeAll(async () => {
  const bundle = JSON.parse(gunzipSync(readFileSync("server/data/pob/engine.json.gz")).toString("utf8")) as PobBundle;
  engine = await PobEngine.start({
    glue: require(gluePath) as GlueFactory,
    wasm: { binary: readFileSync(gluePath.replace(/\.js$/, ".wasm")) },
    bundle,
    boot: readFileSync("src/pob/engine/boot.lua", "utf8"),
    commands: readFileSync("src/pob/engine/commands.lua", "utf8"),
  });
}, 120_000);

describe("Path of Building 2 en WebAssembly", () => {
  it("calcula daño, vida y resistencias de una build de la web", () => {
    const built = pobXmlForProfile(witch, data, { mainSkill: "Drenar esencia" });
    const analysis = engine.analyse({ xml: built.xml });
    expect(analysis.skill.name).toBe("Essence Drain");
    expect(analysis.main.dps).toBeGreaterThan(0);
    expect(analysis.main.life).toBeGreaterThan(0);
    expect(analysis.main.resists.fire.max).toBe(75);
    // Penalización del acto por nivel: a nivel 30 (acto 3, −20) se pierde 40 menos que en el final del juego (−60).
    const endgame = engine.analyse({ xml: pobXmlForProfile({ ...witch, level: 80 }, data).xml }).main;
    expect(analysis.main.resists.fire.value - endgame.resists.fire.value).toBe(40);
  });

  it("los objetos en español traducidos cuentan: la vida de la varita suma", () => {
    const withWand = engine.analyse({ xml: pobXmlForProfile(witch, data).xml }).main;
    const withoutWand = engine.analyse({ xml: pobXmlForProfile({ ...witch, items: [] }, data).xml }).main;
    expect(withWand.life).toBeGreaterThan(withoutWand.life);
  });

  it("lo que da un camino y los mejores notables cercanos", () => {
    const built = pobXmlForProfile(witch, data, { mainSkill: "Drenar esencia" });
    const analysis = engine.analyse({ xml: built.xml, candidates: [{ id: "camino", path: ["62797"] }], explore: { maxPoints: 5 } });
    expect(analysis.explore.length).toBeGreaterThan(0);
    for (const entry of analysis.explore) {
      expect(entry.points).toBeLessThanOrEqual(5);
      expect(entry.path).toContain(entry.id);
    }
  });

  it("una build rota da un error, no un cuelgue", () => {
    expect(() => engine.analyse({ xml: "<PathOfBuilding2><Build" })).toThrow();
  });
});

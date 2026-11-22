/**
 * Empaqueta Path of Building 2 para que corra dentro de la web:
 *
 *   server/data/pob/engine.json.gz     los archivos Lua de PoB2 (ya en Lua 5.2)
 *   server/data/pob/meta.json          de qué commit sale, versión, tamaño
 *   server/data/pob/classes.json       clases y ascendencias con sus ids de PoB2
 *   server/data/pob/gems.json          gemas: nombre inglés, id, nivel exigido y
 *                                      los nombres en español de la web → inglés
 *   server/data/pob/LICENSE-PathOfBuilding.md
 *
 * Uso (proceso OFFLINE: nunca se ejecuta al servir la web):
 *
 *   npm run data:pob                        el commit fijado abajo
 *   npm run data:pob -- --latest            lo último de la rama dev de PoB2
 *   npm run data:pob -- --commit <sha>      un commit concreto
 *   npm run data:pob -- --pob <carpeta>     una copia de PoB2 ya descargada
 *
 * Después de empaquetar, el script arranca el motor en Node, comprueba que
 * cada archivo compila en Lua 5.2 y calcula una build de prueba. Si algo falla,
 * no escribe nada.
 *
 * Fuente: PathOfBuildingCommunity/PathOfBuilding-PoE2 (licencia MIT). PoB2 se
 * escribe para su propio LuaJIT; `scripts/lib/luaCompat.ts` lo reescribe a Lua
 * estándar conservando las líneas.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { LuaCompatError, toStandardLua } from "./lib/luaCompat.js";
import { PobEngine, type GlueFactory } from "../src/pob/pobEngine.js";
import type { PobBundle, PobBundleMeta } from "../src/pob/pobTypes.js";
import { spanishGemNames } from "../shared/pobBuild.js";

const REPOSITORY = "PathOfBuildingCommunity/PathOfBuilding-PoE2";
/** Commit fijado: dev del 10-11-2026 (PoB2 0.23.1, árbol 0_5). */
const PINNED_COMMIT = "601768bd105869618c3d6581b883e5d7aeec91b2";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(ROOT, "server/data/pob");
const CACHE_DIR = join(ROOT, ".tmp/pob2");

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message: string): never {
  console.error(`\n[build-pob-engine] ERROR: ${message}\n`);
  process.exit(1);
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Una copia de PoB2 en el commit pedido (se reutiliza entre ejecuciones). */
function checkout(): string {
  const local = arg("--pob");
  if (local) {
    if (!existsSync(join(local, "src/Launch.lua"))) fail(`${local} no parece una copia de PoB2 (falta src/Launch.lua).`);
    return local;
  }
  if (!existsSync(join(CACHE_DIR, ".git"))) {
    mkdirSync(CACHE_DIR, { recursive: true });
    git(CACHE_DIR, "init", "-q");
    git(CACHE_DIR, "remote", "add", "origin", `https://github.com/${REPOSITORY}.git`);
  }
  const wanted = process.argv.includes("--latest") ? "dev" : (arg("--commit") ?? PINNED_COMMIT);
  console.log(`[build-pob-engine] descargando ${REPOSITORY}@${wanted}…`);
  git(CACHE_DIR, "fetch", "-q", "--depth", "1", "origin", wanted);
  git(CACHE_DIR, "checkout", "-q", "--force", "FETCH_HEAD");
  return CACHE_DIR;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => statSync(join(dir, entry)).isFile());
}

function latestTreeVersion(gameVersions: string): string {
  const list = /treeVersionList\s*=\s*\{([^}]*)\}/.exec(gameVersions)?.[1];
  const versions = [...(list ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const latest = versions.at(-1);
  if (!latest) fail("no encuentro treeVersionList en GameVersions.lua.");
  return latest;
}

function collect(pobRoot: string): { files: Record<string, string>; treeVersion: string; rewrites: number } {
  const files: Record<string, string> = {};
  let rewrites = 0;
  const add = (virtualPath: string, content: string) => {
    if (virtualPath.endsWith(".lua")) {
      try {
        const result = toStandardLua(content);
        content = result.code;
        rewrites += result.changes;
      } catch (error) {
        if (error instanceof LuaCompatError) fail(`${virtualPath}: ${error.message}`);
        throw error;
      }
    }
    files[virtualPath] = content;
  };
  const src = join(pobRoot, "src");
  const gameVersions = readFileSync(join(src, "GameVersions.lua"), "utf8");
  const treeVersion = latestTreeVersion(gameVersions);

  for (const name of ["HeadlessWrapper.lua", "_SimpleGraphic.def.lua", "Launch.lua", "GameVersions.lua"]) {
    add(`src/${name}`, readFileSync(join(src, name), "utf8"));
  }
  for (const folder of ["Modules", "Classes", "Data"]) {
    for (const entry of listFiles(join(src, folder))) {
      if (entry.endsWith(".lua")) add(`src/${folder}/${entry}`, readFileSync(join(src, folder, entry), "utf8"));
    }
  }
  // Solo el árbol más nuevo: la web siempre manda builds en esa versión.
  add(`src/TreeData/${treeVersion}/tree.lua`, readFileSync(join(src, "TreeData", treeVersion, "tree.lua"), "utf8"));
  for (const entry of listFiles(join(pobRoot, "runtime/lua"))) {
    // lua53_ops.lua usa operadores de Lua 5.3 y solo se carga en 5.3.
    if (entry.endsWith(".lua") && entry !== "sha1/lua53_ops.lua") {
      add(`runtime/lua/${entry}`, readFileSync(join(pobRoot, "runtime/lua", entry), "utf8"));
    }
  }
  add("src/manifest.xml", readFileSync(join(pobRoot, "manifest.xml"), "utf8"));
  return { files, treeVersion, rewrites };
}

/** Una build mínima para comprobar que el motor calcula. */
function sampleXml(treeVersion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="20" targetVersion="0_1" className="Witch" ascendClassName="None" mainSocketGroup="1" viewMode="TREE" characterLevelAutoMode="false"/>
  <Tree activeSpec="1"><Spec title="test" treeVersion="${treeVersion}" classInternalId="1" ascendancyInternalId="" nodes=""/></Tree>
  <Skills activeSkillSet="1"><SkillSet id="1">
    <Skill enabled="true" label="" mainActiveSkill="1" includeInFullDPS="false">
      <Gem nameSpec="Essence Drain" level="5" quality="0" enabled="true"/>
    </Skill>
  </SkillSet></Skills>
  <Items activeItemSet="1"><ItemSet id="1"/></Items>
  <Config/>
</PathOfBuilding2>`;
}

function webSpanishGemNames(): Record<string, string> {
  type GemFile = { skills: Array<{ slug: string; name: string }>; supports?: Array<{ slug: string; name: string }> };
  const read = (name: string) => JSON.parse(readFileSync(join(ROOT, "server/data", name), "utf8")) as GemFile;
  const es = read("gems.es.json");
  const en = read("gems.en.json");
  return spanishGemNames([...es.skills, ...(es.supports ?? [])], [...en.skills, ...(en.supports ?? [])]);
}

async function main(): Promise<void> {
  const pobRoot = checkout();
  const commit = existsSync(join(pobRoot, ".git")) ? git(pobRoot, "rev-parse", "HEAD") : "local";
  const commitDate = existsSync(join(pobRoot, ".git")) ? git(pobRoot, "log", "-1", "--format=%cI") : new Date().toISOString();
  const manifest = readFileSync(join(pobRoot, "manifest.xml"), "utf8");
  const pobVersion = /<Version number="([^"]+)"/.exec(manifest)?.[1] ?? "?";

  const { files, treeVersion, rewrites } = collect(pobRoot);
  const bytes = Object.values(files).reduce((total, content) => total + content.length, 0);
  const meta: PobBundleMeta = {
    repository: REPOSITORY,
    commit,
    commitDate,
    pobVersion,
    treeVersion,
    generatedAt: new Date().toISOString().slice(0, 10),
    files: Object.keys(files).length,
    bytes,
  };
  console.log(
    `[build-pob-engine] PoB2 ${pobVersion} (${commit.slice(0, 8)}), árbol ${treeVersion}: ` +
      `${meta.files} archivos, ${(bytes / 1e6).toFixed(1)} MB, ${rewrites} reescrituras a Lua 5.2`,
  );

  // Arrancar el motor en Node con lo empaquetado: si no calcula, no se escribe nada.
  const require = createRequire(import.meta.url);
  const gluePath = require.resolve("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js");
  const bundle: PobBundle = { meta, files };
  const started = Date.now();
  const engine = await PobEngine.start({
    glue: require(gluePath) as GlueFactory,
    wasm: { binary: readFileSync(gluePath.replace(/\.js$/, ".wasm")) },
    bundle,
    boot: readFileSync(join(ROOT, "src/pob/engine/boot.lua"), "utf8"),
    commands: readFileSync(join(ROOT, "src/pob/engine/commands.lua"), "utf8"),
  });
  const syntax = engine.syntaxCheck();
  if (syntax.errors.length > 0) fail(`no compilan en Lua 5.2:\n${syntax.errors.join("\n")}`);
  console.log(`[build-pob-engine] arranque en ${Date.now() - started} ms; ${syntax.files} archivos compilan en Lua 5.2`);

  const analysis = engine.analyse({ xml: sampleXml(treeVersion) });
  if (!(analysis.main.life > 0) || !(analysis.main.dps > 0)) {
    fail(`la build de prueba sale sin vida o sin daño: ${JSON.stringify(analysis.main)}`);
  }
  console.log(`[build-pob-engine] build de prueba: ${analysis.skill.name} ${Math.round(analysis.main.dps)} DPS, ${analysis.main.life} vida`);

  const classes = JSON.parse(engine.call("pobClasses")) as Array<{ name: string; integerId: number; ascendancies: unknown[] }>;
  const gems = JSON.parse(engine.call("pobGems")) as Array<{
    gameId: string;
    variantId: string;
    name: string;
    support: boolean;
    levels: number[];
  }>;
  if (classes.length < 8) fail(`solo ${classes.length} clases en el árbol de PoB2.`);
  if (gems.length < 200) fail(`solo ${gems.length} gemas en los datos de PoB2.`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "engine.json.gz"), gzipSync(JSON.stringify(bundle), { level: 9 }));
  writeFileSync(join(OUT_DIR, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, "classes.json"), `${JSON.stringify(classes, null, 2)}\n`);
  // Casi todas las gemas comparten tabla de niveles: las comunes se guardan una
  // vez y cada gema apunta a la suya por su posición.
  const counts = new Map<string, number>();
  for (const gem of gems) counts.set(JSON.stringify(gem.levels), (counts.get(JSON.stringify(gem.levels)) ?? 0) + 1);
  const tables = [...counts.entries()].filter(([, count]) => count >= 10).map(([table]) => table);
  const gemsFile = {
    levelTables: tables.map((table) => JSON.parse(table) as number[]),
    gems: gems.map((gem) => {
      const index = tables.indexOf(JSON.stringify(gem.levels));
      return index >= 0 ? { ...gem, levels: index } : gem;
    }),
    // Los nombres en español de la web (poe2db/sp) → los de PoB2 (inglés).
    spanish: webSpanishGemNames(),
  };
  writeFileSync(join(OUT_DIR, "gems.json"), `${JSON.stringify(gemsFile)}\n`);
  writeFileSync(join(OUT_DIR, "LICENSE-PathOfBuilding.md"), readFileSync(join(pobRoot, "LICENSE.md"), "utf8"));
  const size = statSync(join(OUT_DIR, "engine.json.gz")).size;
  console.log(
    `[build-pob-engine] escrito ${relative(ROOT, OUT_DIR)}: engine.json.gz ${(size / 1e6).toFixed(1)} MB, ` +
      `${classes.length} clases, ${gems.length} gemas`,
  );
}

await main();

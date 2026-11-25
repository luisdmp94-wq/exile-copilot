/**
 * Genera el árbol de pasivas que dibuja la web y con el que el consejero
 * elige los próximos notables:
 *
 *   server/data/passives/tree.json        nodos, posiciones, conexiones,
 *                                         nombres y textos en inglés y español
 *   src/assets/arbol/skills.webp          iconos oficiales (encendidos)
 *   src/assets/arbol/skills-disabled.webp iconos oficiales (apagados)
 *   src/assets/arbol/frame.webp           marcos oficiales de los nodos
 *
 * Uso (proceso OFFLINE: nunca se ejecuta al servir la web):
 *
 *   npm run data:tree                      commit fijado abajo
 *   npm run data:tree -- --latest          el último commit publicado por GGG
 *   npm run data:tree -- --commit <sha>    un commit concreto
 *   npm run data:tree -- --input data.json usa un data.json ya descargado
 *   npm run data:tree -- --label 1.0       la versión que enseña la web, si el
 *                                          mensaje del commit de GGG no la dice
 *
 * Fuentes:
 *  - Árbol, posiciones, iconos y marcos: grindinggear/poe2-skilltree-export
 *    (los datos son de Grinding Gear Games; el repositorio no declara licencia).
 *  - Nombres y textos en español de notables y claves: poe2db.tw/sp (las
 *    páginas Notable, Keystone y Attribute, tres peticiones). El export de GGG solo trae
 *    inglés. Los nodos pequeños se traducen con las mismas frases de los
 *    notables: lo que no tenga traducción se queda en inglés y se cuenta.
 *
 * Cuando GGG publique el árbol de la 1.0: `npm run data:tree -- --latest`,
 * revisar el resumen que imprime y pasar `npx vitest run tests/unit/passiveTree*`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareEntries, describeChanges, readPrevious } from "./lib/dataDiff.js";

const REPOSITORY = "grindinggear/poe2-skilltree-export";
/** Commit fijado: árbol 0.5 publicado por GGG (el mismo que usan las rutas de pasivas). */
const PINNED_COMMIT = "bd87e6512c92b868542eddfb1ba4ea8b6dc2da36";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; exile-copilot-data)" };

const OUT_TREE = fileURLToPath(new URL("../server/data/passives/tree.json", import.meta.url));
const OUT_ASSETS = fileURLToPath(new URL("../src/assets/arbol/", import.meta.url));

interface ExportNode {
  id?: string;
  skill?: number;
  name?: string;
  icon?: string;
  stats?: string[];
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  x?: number;
  y?: number;
  out?: string[];
  in?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isGenericAttribute?: boolean;
  isBlighted?: boolean;
  isFree?: boolean;
  isMultipleChoiceOption?: boolean;
  multipleChoiceParent?: number;
  ascendancyId?: string;
  classStartIndex?: number[];
  unlockConstraint?: unknown;
  grantedPassivePoints?: number;
}
interface ExportGroup {
  x: number;
  y: number;
}
interface TreeExport {
  classes: Array<{
    name: string;
    overridePairs?: Record<string, number> | unknown[];
    ascendancies?: Array<{ id: string; name: string; overridePairs?: Record<string, number> | unknown[] }>;
  }>;
  skillOverrides?: Record<string, { name?: string; icon?: string; stats?: string[] }>;
  groups: Record<string, ExportGroup>;
  nodes: Record<string, ExportNode>;
}
interface SpriteSheet {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { image: string; size: { w: number; h: number } };
}

/** Radio de cada órbita en unidades del árbol, medido sobre el export (0.5). */
const ORBIT_RADII = [0, 82, 162, 335, 493, 662, 846, 251, 1080, 1322];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message: string): never {
  console.error(`\n[build-passive-tree] ERROR: ${message}\n`);
  process.exit(1);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) fail(`${url} devolvió HTTP ${response.status}.`);
  return response.text();
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) fail(`${url} devolvió HTTP ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveCommit(): Promise<{ sha: string; message: string; date: string }> {
  const wanted = process.argv.includes("--latest") ? "HEAD" : (arg("--commit") ?? PINNED_COMMIT);
  const body = JSON.parse(await fetchText(`https://api.github.com/repos/${REPOSITORY}/commits/${wanted}`)) as {
    sha: string;
    commit: { message: string; committer: { date: string } };
  };
  return { sha: body.sha, message: body.commit.message.split("\n")[0].trim(), date: body.commit.committer.date };
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** «[Hit|Hits] against you» → «Hits against you»; «[Chaos]» → «Chaos». */
export function cleanStat(stat: string): string {
  return stat.replace(/\[([^\]|]*\|)?([^\]]*)\]/g, "$2").replace(/\s+/g, " ").trim();
}

function decode(value: string): string {
  return value
    .replace(new RegExp("&nbsp;|" + String.fromCharCode(160), "g"), " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function plain(fragment: string): string {
  return decode(fragment.replace(/<br\s*\/?>/gi, " · ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .replace(/\s+([:,.%])/g, "$1")
    .trim();
}

/** Clave para casar un nombre inglés de GGG con el enlace de poe2db («Dark_Entries»). */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface SpanishNode {
  name: string;
  stats: string[];
  /** Líneas de la versión de una clase («Bruja: …»), por nombre inglés de la clase. */
  byClass: Record<string, string[]>;
}

/** Prefijo de poe2db/sp para la versión de una clase → nombre de la clase en el export. */
const CLASS_PREFIX: Record<string, string> = {
  Bruja: "Witch",
  Hechicera: "Sorceress",
  Guerrero: "Warrior",
  Monje: "Monk",
  Mercenario: "Mercenary",
  Exploradora: "Ranger",
  Cazadora: "Huntress",
  Druida: "Druid",
};

/**
 * Notables o claves de una página de poe2db/sp: cada ficha trae el enlace con
 * el nombre inglés («href="Dark_Entries"»), el nombre en español y sus líneas.
 */
function parsePoe2dbPassives(html: string): Map<string, SpanishNode> {
  const found = new Map<string, SpanishNode>();
  const blocks = html.split(/<div class="col">/);
  for (const block of blocks) {
    const anchor = /class="PassiveSkills"[^>]*href="([^"]+)">([^<]+)<\/a>/.exec(block);
    if (!anchor) continue;
    const key = nameKey(decodeURIComponent(anchor[1]).replace(/_/g, " "));
    const lines = [...block.matchAll(/<div class="(?:implicitMod|explicitMod)">([\s\S]*?)<\/div>/g)]
      .map((match) => plain(match[1]))
      .filter((line) => line.length > 0);
    const stats: string[] = [];
    const byClass: Record<string, string[]> = {};
    for (const line of lines) {
      const prefixed = /^([A-Z][a-z]+): (.+)$/.exec(line);
      const className = prefixed ? CLASS_PREFIX[prefixed[1]] : undefined;
      if (prefixed && className) (byClass[className] ??= []).push(prefixed[2]);
      else stats.push(line);
    }
    if (!found.has(key)) found.set(key, { name: decode(anchor[2]).trim(), stats, byClass });
  }
  return found;
}

const NUMBER = /\d+(?:[.,]\d+)?/g;

/** «20% increased Chaos Damage» → «#% increased Chaos Damage» y los números. */
function template(line: string): { text: string; numbers: string[] } {
  const numbers = line.match(NUMBER) ?? [];
  return { text: line.replace(NUMBER, "#"), numbers };
}

/**
 * Plantillas inglés → español sacadas de los notables (mismo nodo, misma
 * línea). Solo se aceptan si llevan los mismos números: así «#» se rellena
 * con seguridad en los nodos pequeños.
 */
function learnTemplates(pairs: Array<{ en: string[]; es: string[] }>): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const { en, es } of pairs) {
    if (en.length !== es.length) continue;
    en.forEach((line, index) => {
      const source = template(line);
      const target = es[index];
      const targetNumbers = target.match(NUMBER) ?? [];
      if (source.numbers.join("|") !== targetNumbers.join("|")) return;
      const spanish = target.replace(NUMBER, "#");
      const options = votes.get(source.text) ?? new Map<string, number>();
      options.set(spanish, (options.get(spanish) ?? 0) + 1);
      votes.set(source.text, options);
    });
  }
  const chosen = new Map<string, string>();
  for (const [english, options] of votes) {
    const best = [...options.entries()].sort((a, b) => b[1] - a[1])[0];
    chosen.set(english, best[0]);
  }
  return chosen;
}

function translateLine(line: string, templates: Map<string, string>): string | null {
  const { text, numbers } = template(line);
  const spanish = templates.get(text);
  if (spanish === undefined) return null;
  let index = 0;
  return spanish.replace(/#/g, () => numbers[index++] ?? "#");
}

// ---------------------------------------------------------------------------
// Árbol
// ---------------------------------------------------------------------------

type Kind = "small" | "notable" | "keystone" | "jewel" | "start" | "attribute";

export interface TreeFileNode {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  group: number;
  orbit: number;
  icon: string;
  nameEn: string;
  nameEs: string | null;
  statsEn: string[];
  statsEs: string[] | null;
  /** No se puede coger por camino normal (lo abre una ascendencia, un objeto…). */
  locked?: true;
  /** Opción de un nodo de elegir una entre varias (Implantes, Infusiones…). */
  choiceOf?: string;
  /** Clases que empiezan aquí. */
  classes?: string[];
}

export interface TreeFileOverride {
  nameEn: string;
  nameEs: string | null;
  statsEn: string[];
  statsEs: string[] | null;
  icon?: string;
}

function kindOf(node: ExportNode): Kind {
  if (node.classStartIndex) return "start";
  if (node.isKeystone) return "keystone";
  if (node.isNotable) return "notable";
  if (node.isJewelSocket) return "jewel";
  if (node.isGenericAttribute) return "attribute";
  return "small";
}

async function main(): Promise<void> {
  const input = arg("--input");
  const commit = input
    ? { sha: arg("--commit") ?? PINNED_COMMIT, message: "local", date: new Date().toISOString() }
    : await resolveCommit();
  console.log(`[build-passive-tree] árbol de ${REPOSITORY}@${commit.sha.slice(0, 8)} (${commit.message})`);

  const raw = `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`;
  const tree = JSON.parse(input ? readFileSync(input, "utf8") : await fetchText(`${raw}/data.json`)) as TreeExport;

  const [notablePage, keystonePage, attributePage] = await Promise.all([
    fetchText("https://poe2db.tw/sp/Notable"),
    fetchText("https://poe2db.tw/sp/Keystone"),
    fetchText("https://poe2db.tw/sp/Attribute"),
  ]);
  // Los nodos de «+5 a cualquier atributo»: su ficha trae nombre y línea.
  const attributeName = /<title>([^<-]+?)\s*-/.exec(attributePage)?.[1]?.trim() ?? null;
  const attributeLine = /property="og:description" content="([^"]+)"/.exec(attributePage)?.[1] ?? null;
  const spanish = new Map([...parsePoe2dbPassives(notablePage), ...parsePoe2dbPassives(keystonePage)]);
  console.log(`[build-passive-tree] poe2db/sp: ${spanish.size} notables y claves con nombre en español`);

  const nodes: Record<string, TreeFileNode> = {};
  // Los nodos de ascendencia no se dibujan, pero un código de PoB2 los trae:
  // así se distinguen de un nodo que de verdad no casa con este árbol.
  const ascendancyNodes = Object.entries(tree.nodes)
    .filter(([key, node]) => key !== "root" && node.ascendancyId)
    .map(([key]) => key);
  const usedGroups = new Set<number>();
  const pairs: Array<{ en: string[]; es: string[] }> = [];

  for (const [key, node] of Object.entries(tree.nodes)) {
    if (key === "root" || node.ascendancyId || node.isMastery) continue;
    if (node.x === undefined || node.y === undefined || node.group === undefined) continue;
    const kind = kindOf(node);
    const statsEn = (node.stats ?? []).map(cleanStat);
    const es =
      kind === "notable" || kind === "keystone"
        ? spanish.get(nameKey(node.name ?? ""))
        : kind === "attribute" && attributeName && attributeLine
          ? { name: decode(attributeName), stats: [decode(attributeLine)], byClass: {} }
          : undefined;
    if (es) pairs.push({ en: statsEn, es: es.stats });
    const entry: TreeFileNode = {
      id: node.id ?? key,
      kind,
      x: Math.round(node.x),
      y: Math.round(node.y),
      group: node.group,
      orbit: node.orbit ?? 0,
      icon: node.icon ?? "",
      nameEn: node.name ?? "",
      nameEs: es?.name ?? null,
      statsEn,
      statsEs: es && es.stats.length > 0 ? es.stats : null,
    };
    if (node.unlockConstraint !== undefined || node.isBlighted) entry.locked = true;
    if (node.isMultipleChoiceOption && node.multipleChoiceParent !== undefined) {
      entry.choiceOf = String(node.multipleChoiceParent);
    }
    if (node.classStartIndex) {
      entry.classes = node.classStartIndex.map((index) => tree.classes[index]?.name).filter(Boolean);
    }
    nodes[key] = entry;
    usedGroups.add(node.group);
  }

  // Nodos pequeños: las frases de los notables, con sus números.
  const templates = learnTemplates(pairs);
  let lines = 0;
  let translated = 0;
  for (const entry of Object.values(nodes)) {
    if (entry.statsEs !== null || entry.statsEn.length === 0) continue;
    const spanishLines = entry.statsEn.map((line) => translateLine(line, templates));
    lines += spanishLines.length;
    translated += spanishLines.filter((line) => line !== null).length;
    if (spanishLines.every((line): line is string => line !== null)) entry.statsEs = spanishLines;
  }

  // Versiones de una clase o ascendencia: la Bruja ve «Daño de hechizos y de
  // esbirros» donde las demás ven «Daño de hechizos», por ejemplo.
  const overrides: Record<string, Record<string, TreeFileOverride>> = {};
  const addOverrides = (owner: string, pairsOf: TreeExport["classes"][number]["overridePairs"]) => {
    if (!pairsOf || Array.isArray(pairsOf)) return;
    for (const [nodeKey, overrideSkill] of Object.entries(pairsOf)) {
      const base = nodes[nodeKey];
      const source = tree.skillOverrides?.[String(overrideSkill)];
      if (!base || !source) continue;
      const statsEn = (source.stats ?? []).map(cleanStat);
      const classLines =
        base.kind === "notable" || base.kind === "keystone"
          ? spanish.get(nameKey(base.nameEn))?.byClass[owner]
          : undefined;
      const translatedLines = statsEn.map((line) => translateLine(line, templates));
      const statsEs =
        classLines && classLines.length > 0
          ? classLines
          : translatedLines.every((line): line is string => line !== null)
            ? translatedLines
            : null;
      (overrides[owner] ??= {})[nodeKey] = {
        nameEn: source.name ?? base.nameEn,
        nameEs: source.name === base.nameEn ? base.nameEs : null,
        statsEn,
        statsEs,
        ...(source.icon ? { icon: source.icon } : {}),
      };
    }
  };
  for (const characterClass of tree.classes) {
    addOverrides(characterClass.name, characterClass.overridePairs);
    for (const ascendancy of characterClass.ascendancies ?? []) addOverrides(ascendancy.name, ascendancy.overridePairs);
  }
  // Los notables que cambian de nombre tienen su propia ficha en poe2db/sp: el
  // título es el nombre que se busca en el juego.
  for (const byNode of Object.values(overrides)) {
    for (const [nodeKey, override] of Object.entries(byNode)) {
      const kind = nodes[nodeKey].kind;
      if (override.nameEs !== null || (kind !== "notable" && kind !== "keystone")) continue;
      const page = await fetchText(`https://poe2db.tw/sp/${encodeURIComponent(override.nameEn.replace(/ /g, "_"))}`);
      const title = /<title>([^<]+?)\s+-\s+PoE2DB/.exec(page)?.[1];
      override.nameEs = title ? decode(title).trim() : null;
    }
  }

  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [key, node] of Object.entries(tree.nodes)) {
    if (!(key in nodes)) continue;
    for (const other of [...(node.out ?? []), ...(node.in ?? [])]) {
      if (!(other in nodes) || other === key) continue;
      const id = key < other ? `${key}-${other}` : `${other}-${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push(key < other ? [key, other] : [other, key]);
    }
  }

  const groups: Record<string, [number, number]> = {};
  for (const group of usedGroups) {
    const source = tree.groups[String(group)];
    if (source) groups[group] = [Math.round(source.x), Math.round(source.y)];
  }

  // Sprites oficiales: solo las piezas que usan los nodos del árbol principal.
  const sheets = {
    skills: JSON.parse(await fetchText(`${raw}/assets/skills.json`)) as SpriteSheet,
    disabled: JSON.parse(await fetchText(`${raw}/assets/skills-disabled.json`)) as SpriteSheet,
    frame: JSON.parse(await fetchText(`${raw}/assets/frame.json`)) as SpriteSheet,
  };
  const rect = (sheet: SpriteSheet, name: string): [number, number, number, number] | null => {
    const frame = sheet.frames[name]?.frame;
    return frame ? [frame.x, frame.y, frame.w, frame.h] : null;
  };
  const prefix: Record<Kind, string> = {
    small: "normal",
    attribute: "normal",
    jewel: "normal",
    start: "normal",
    notable: "notable",
    keystone: "keystone",
  };
  const icons: Record<string, { on: [number, number, number, number]; off: [number, number, number, number] }> = {};
  let missingIcons = 0;
  const iconUses = [
    ...Object.values(nodes).map((entry) => ({ kind: entry.kind, icon: entry.icon })),
    ...Object.values(overrides).flatMap((byNode) =>
      Object.entries(byNode).flatMap(([nodeKey, override]) =>
        override.icon ? [{ kind: nodes[nodeKey].kind, icon: override.icon }] : [],
      ),
    ),
  ];
  for (const entry of iconUses) {
    const key = `${prefix[entry.kind]}:${entry.icon}`;
    if (key in icons) continue;
    const on = rect(sheets.skills, `${prefix[entry.kind]}Active:${entry.icon}`);
    const off = rect(sheets.disabled, `${prefix[entry.kind]}Inactive:${entry.icon}`);
    if (on && off) icons[key] = { on, off };
    else missingIcons += 1;
  }
  const frames: Record<string, [number, number, number, number]> = {};
  for (const name of Object.keys(sheets.frame.frames)) {
    const short = name.replace(/^frame:/, "");
    if (/^(PSSkillFrame|NotableFrame|KeystoneFrame|JewelFrame)/.test(short)) {
      const value = rect(sheets.frame, name);
      if (value) frames[short] = value;
    }
  }

  const output = {
    version: 1,
    source: {
      repository: REPOSITORY,
      commit: commit.sha,
      // La web enseña esto como versión del árbol («árbol 0.5.5»).
      commitMessage: arg("--label") ?? commit.message,
      commitDate: commit.date,
      spanishFrom: "https://poe2db.tw/sp/Notable",
      generatedAt: new Date().toISOString().slice(0, 10),
      generatedBy: "scripts/build-passive-tree.ts",
    },
    orbitRadii: ORBIT_RADII,
    sheets: {
      skills: sheets.skills.meta.size,
      frame: sheets.frame.meta.size,
    },
    icons,
    frames,
    groups,
    nodes,
    edges,
    ascendancyNodes,
    overrides,
  };

  // Qué ha cambiado frente al árbol que había: el archivo es una sola línea y
  // el `git diff` no se lee. Se comparan nombre y efectos, no la posición.
  type SavedNode = { nameEn: string; nameEs: string | null; statsEn?: string[] | null; statsEs?: string[] | null };
  const previous = readPrevious<{ nodes?: Record<string, SavedNode> }>(OUT_TREE);
  if (previous?.nodes) {
    const text = (node: SavedNode) => JSON.stringify([node.nameEn, node.nameEs, node.statsEn ?? [], node.statsEs ?? []]);
    const table = (list: Record<string, SavedNode>) => new Map(Object.entries(list).map(([key, node]) => [key, text(node)]));
    const savedNodes: Record<string, SavedNode> = nodes;
    const changes = compareEntries(table(previous.nodes), table(savedNodes));
    const name = (key: string) => (savedNodes[key] ?? previous.nodes?.[key])?.nameEn ?? key;
    for (const line of describeChanges("nodos", changes, name)) console.log(`[build-passive-tree] ${line}`);
  }

  mkdirSync(dirname(OUT_TREE), { recursive: true });
  writeFileSync(OUT_TREE, JSON.stringify(output));
  mkdirSync(OUT_ASSETS, { recursive: true });
  for (const [file, name] of [
    ["skills.webp", "skills.webp"],
    ["skills-disabled.webp", "skills-disabled.webp"],
    ["frame.webp", "frame.webp"],
  ] as const) {
    writeFileSync(`${OUT_ASSETS}${name}`, await fetchBytes(`${raw}/assets/${file}`));
  }

  const all = Object.values(nodes);
  const notables = all.filter((node) => node.kind === "notable" || node.kind === "keystone");
  const withoutSpanish = notables.filter((node) => node.nameEs === null);
  console.log(`[build-passive-tree] ${all.length} nodos, ${edges.length} conexiones, ${Object.keys(groups).length} grupos`);
  console.log(`[build-passive-tree] notables y claves sin nombre en español: ${withoutSpanish.length} de ${notables.length}`);
  if (withoutSpanish.length > 0) {
    console.log(`  p. ej.: ${withoutSpanish.slice(0, 12).map((node) => node.nameEn).join(", ")}`);
  }
  console.log(`[build-passive-tree] líneas de nodos pequeños en español: ${translated} de ${lines}`);
  console.log(`[build-passive-tree] iconos sin sprite: ${missingIcons}`);
  console.log(`[build-passive-tree] versiones de clase: ${Object.entries(overrides).map(([owner, byNode]) => `${owner} ${Object.keys(byNode).length}`).join(", ")}`);
  console.log(`[build-passive-tree] escrito ${OUT_TREE} (${Math.round(JSON.stringify(output).length / 1024)} KB)`);
}

void main();

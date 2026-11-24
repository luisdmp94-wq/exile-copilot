/**
 * «¿Por dónde sigo en el árbol?»: los próximos notables de un personaje.
 *
 * Las reglas eligen siempre (nada de IA): cada línea de un nodo se puntúa
 * según lo que usa el personaje (sus habilidades, su arma, si va de vida o de
 * escudo) y cada notable vale lo que dan él y el camino, dividido entre los
 * puntos que cuesta. Se eligen de uno en uno: el segundo ya cuenta con el
 * camino del primero, así el orden que se enseña es el que se puede seguir.
 *
 * Las líneas se leen en inglés (el texto oficial del export de GGG); lo que
 * se enseña al jugador va en su idioma.
 */
import {
  nodeName,
  nodeStats,
  pathTo,
  reachFrom,
  type TreeGraph,
  type TreeNodeData,
} from "./passiveTree.js";

export type TreeLang = "es" | "en";

export type Family =
  | "chaos"
  | "fire"
  | "cold"
  | "lightning"
  | "physical"
  | "spell"
  | "attack"
  | "melee"
  | "projectile"
  | "area"
  | "minion"
  | "dot"
  | "poison"
  | "bleed"
  | "ignite"
  | "curse"
  | "duration"
  | "totem"
  | "companion"
  | "grenade"
  | "herald"
  | "warcry"
  | "banner"
  | "plant"
  | "shapeshift"
  | "offering"
  | "trigger"
  | "spirit";

export type WeaponKind =
  | "wand"
  | "staff"
  | "sceptre"
  | "focus"
  | "shield"
  | "bow"
  | "crossbow"
  | "mace"
  | "sword"
  | "axe"
  | "dagger"
  | "claw"
  | "spear"
  | "flail"
  | "quarterstaff"
  | "talisman";

export type DefenceStyle = "life" | "energyShield" | "hybrid";

/** Una habilidad del personaje, ya con sus etiquetas del juego en español. */
export interface TreeSkill {
  /** Nombre en el idioma de la respuesta. */
  name: string;
  tags: string[];
  /** Descripción y efectos de la gema, en cualquier idioma. */
  description: string;
  main: boolean;
}

export interface TreeAdviceContext {
  skills: TreeSkill[];
  weapons: WeaponKind[];
  /** null = no se sabe: se supone vida, con menos peso. */
  defence: DefenceStyle | null;
  /** Lleva armadura o evasión en el equipo. */
  usesArmour: boolean;
  usesEvasion: boolean;
  lang: TreeLang;
}

export interface TreeSuggestion {
  key: string;
  name: string;
  /** Lo que hay que escribir en «Busca aquí» del árbol del juego. */
  search: string;
  stats: string[];
  /** Puntos nuevos para llegar desde lo anterior (el notable incluido). */
  points: number;
  /** Los nodos que hay que coger, en orden; el último es el notable. */
  path: string[];
  /** Lo que se coge por el camino, agrupado: «4 × 8% de daño de caos aumentado». */
  onTheWay: Array<{ count: number; text: string }>;
  reasons: string[];
  kind: "offence" | "defence";
}

export interface TreeAdvice {
  offence: TreeSuggestion[];
  defence: TreeSuggestion | null;
}

// ---------------------------------------------------------------------------
// Qué usa el personaje
// ---------------------------------------------------------------------------

const TAG_FAMILY: Record<string, Family[]> = {
  caos: ["chaos"],
  fuego: ["fire"],
  hielo: ["cold"],
  rayo: ["lightning"],
  fisico: ["physical"],
  hechizo: ["spell"],
  ataque: ["attack"],
  "cuerpo a cuerpo": ["melee"],
  proyectil: ["projectile"],
  ade: ["area"],
  duracion: ["duration"],
  totem: ["totem"],
  companero: ["companion"],
  granada: ["grenade"],
  heraldo: ["herald"],
  "grito de guerra": ["warcry"],
  estandarte: ["banner"],
  planta: ["plant"],
  transformacion: ["shapeshift"],
  oso: ["shapeshift"],
  lobo: ["shapeshift"],
  guiverno: ["shapeshift"],
};

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export type SkillRole = "damage" | "minion" | "curse" | "reserve";

/** Qué hace la habilidad: daño, esbirros, maldición o algo que se deja puesto. */
export function skillRole(skill: TreeSkill): SkillRole {
  const tags = skill.tags.map(fold);
  if (tags.includes("maldicion")) return "curse";
  if (tags.includes("esbirro")) return "minion";
  const dealsDamage = tags.some((tag) => tag === "ataque" || tag === "hechizo");
  if (!dealsDamage && (tags.includes("persistente") || tags.includes("metahabilidad") || tags.includes("aura"))) {
    return "reserve";
  }
  return "damage";
}

export interface BuildProfile {
  weights: Partial<Record<Family, number>>;
  /** Habilidades que se benefician de cada familia, para explicar el porqué. */
  skillsBy: Partial<Record<Family, string[]>>;
  /** Su daño es sobre todo con el tiempo: los críticos le sirven poco. */
  mostlyDot: boolean;
  ctx: TreeAdviceContext;
}

export function buildProfile(ctx: TreeAdviceContext): BuildProfile {
  const weights: Partial<Record<Family, number>> = {};
  const skillsBy: Partial<Record<Family, string[]>> = {};
  const add = (family: Family, weight: number, skill: string) => {
    weights[family] = Math.max(weights[family] ?? 0, weight);
    const list = skillsBy[family] ?? [];
    if (!list.includes(skill)) list.push(skill);
    skillsBy[family] = list;
  };
  const hasMain = ctx.skills.some((skill) => skill.main && skillRole(skill) === "damage");
  let dotMain = false;
  for (const skill of ctx.skills) {
    const role = skillRole(skill);
    const tags = skill.tags.map(fold);
    const text = fold(`${skill.name} ${skill.description}`);
    if (/ofrenda|offering/.test(fold(skill.name))) add("offering", 1, skill.name);
    // «Lanzar al…» y demás metahabilidades que activan hechizos.
    if (tags.includes("metahabilidad") && /\bactiva|trigger/.test(text)) add("trigger", 0.8, skill.name);
    if (role === "curse") {
      add("curse", 0.8, skill.name);
      continue;
    }
    if (role === "minion") {
      add("minion", skill.main || !hasMain ? 1 : 0.6, skill.name);
      add("spirit", 0.6, skill.name);
      continue;
    }
    if (role === "reserve") {
      add("spirit", 0.6, skill.name);
      continue;
    }
    const weight = skill.main || !hasMain ? 1 : 0.6;
    for (const tag of tags) for (const family of TAG_FAMILY[tag] ?? []) add(family, weight, skill.name);
    const dot = /con el tiempo|por segundo|degenerativ|marchit|envenen|veneno|ignici|sangrad|over time|per second|wither|poison|ignite|bleed/.test(text);
    if (dot) {
      add("dot", weight, skill.name);
      if (skill.main) dotMain = true;
    }
    if (/envenen|veneno|poison/.test(text)) add("poison", weight, skill.name);
    if (/sangrad|bleed/.test(text)) add("bleed", weight, skill.name);
    if (/ignici|ignite/.test(text)) add("ignite", weight, skill.name);
  }
  return { weights, skillsBy, mostlyDot: dotMain, ctx };
}

// ---------------------------------------------------------------------------
// Cuánto vale una línea
// ---------------------------------------------------------------------------

/** Cosas que una línea exige tener para servir de algo. */
const REQUIRES: Array<[RegExp, Family]> = [
  [/\bminions?\b/, "minion"],
  [/\btotems?\b|\bballista/, "totem"],
  [/\bcompanions?\b/, "companion"],
  [/\bgrenades?\b/, "grenade"],
  [/\bheralds?\b/, "herald"],
  [/\bwarcr(y|ies)\b/, "warcry"],
  [/\bbanners?\b|\bglory\b/, "banner"],
  [/\bplant\b/, "plant"],
  [/\btriggered\b/, "trigger"],
  [/\bofferings?\b/, "offering"],
  [/\bshapeshift|\bbear\b|\bwolf\b|\bwyvern\b/, "shapeshift"],
  [/\bpoison/, "poison"],
  [/\bbleed/, "bleed"],
  [/\bignite/, "ignite"],
  [/\battacks?\b|\baccuracy\b/, "attack"],
  [/\bmelee\b|\bstrikes?\b/, "melee"],
  [/\bspells?\b|\bcast speed\b/, "spell"],
  [/\bprojectiles?\b/, "projectile"],
];

const WEAPON_WORDS: Array<[RegExp, WeaponKind]> = [
  [/\bquarterstaff|\bquarterstaves\b/, "quarterstaff"],
  [/\bcrossbows?\b/, "crossbow"],
  [/\bbows?\b/, "bow"],
  [/\bmaces?\b/, "mace"],
  [/\bswords?\b/, "sword"],
  [/\baxes?\b/, "axe"],
  [/\bdaggers?\b/, "dagger"],
  [/\bclaws?\b/, "claw"],
  [/\bspears?\b/, "spear"],
  [/\bflails?\b/, "flail"],
  [/\btalismans?\b/, "talisman"],
  [/\bwands?\b/, "wand"],
  [/\bsceptres?\b/, "sceptre"],
  [/\bfoci\b|\bfocus\b/, "focus"],
  [/\bholding a shield\b|\bwith a shield\b|\bshields? raised\b|\braised shield\b|\bparry|\bblock\b/, "shield"],
];

/** Cosas que el consejero no sabe valorar: no se recomiendan. */
const NEVER =
  /\bthorns\b|\brage\b|\bfrenzy charge|\bpower charge|\bendurance charge|\bdual wield|\bunarmed\b|\btwo handed\b|\bone handed\b|\bvolatility\b|\bincision\b|\binfusion\b|\bremnants?\b|\binvocat|\bherald\b|\bmeta\b|\bpresence\b|\bsurrounded\b|\bstationary\b|\bwhile moving\b|\bcharm|\bcosts? life\b|\blife costs?\b|\bsacrific/;

const ELEMENTS: Array<[RegExp, Family[]]> = [
  [/\bchaos\b/, ["chaos"]],
  [/\bfire\b/, ["fire"]],
  [/\bcold\b/, ["cold"]],
  [/\blightning\b/, ["lightning"]],
  [/\bphysical\b/, ["physical"]],
  [/\belemental\b/, ["fire", "cold", "lightning"]],
];

export interface LineValue {
  offence: number;
  defence: number;
  /** Qué hace por el personaje, para el porqué. */
  reasons: ReasonId[];
}

export type ReasonId =
  | "level"
  | "damage"
  | "curse"
  | "duration"
  | "minion"
  | "area"
  | "castSpeed"
  | "attackSpeed"
  | "crit"
  | "projectile"
  | "life"
  | "energyShield"
  | "resist"
  | "armour"
  | "evasion"
  | "spirit"
  | "mana"
  | "speed";

const NONE: LineValue = { offence: 0, defence: 0, reasons: [] };

export function lineValue(rawLine: string, build: BuildProfile): LineValue {
  const line = rawLine.toLowerCase();
  const { weights, ctx } = build;
  if (NEVER.test(line)) return NONE;

  // Requisitos: si falta alguno, la línea no sirve.
  let requirement = 1;
  for (const [pattern, family] of REQUIRES) {
    if (pattern.test(line)) requirement = Math.min(requirement, weights[family] ?? 0);
  }
  for (const [pattern, weapon] of WEAPON_WORDS) {
    if (pattern.test(line) && !ctx.weapons.includes(weapon)) return NONE;
  }
  const minionLine = /\bminions?\b/.test(line);
  if (requirement === 0) return NONE;
  return signed(line, scaleConditional(line, lineValueCore(line, build, requirement, minionLine)));
}

/**
 * «Velocidad de ataque reducida un 5 %»: lo que resta cuenta en contra y no
 * se usa para explicar el porqué. «Daño recibido reducido» sí suma.
 */
function signed(line: string, value: LineValue): LineValue {
  const harmful = /\b(reduced|less)\b/.test(line) && !/\bdamage taken\b|\bbreak taken\b|\breduced damage\b|\bless damage\b|\bcost|\breservation\b|\benem(y|ies)\b|\bagainst you\b|\bon you\b/.test(line);
  if (!harmful) return value;
  return { offence: -0.5 * Math.abs(value.offence), defence: -0.5 * Math.abs(value.defence), reasons: [] };
}

/** «Mientras tengas la vida llena», «si has matado recientemente»: valen menos. */
function scaleConditional(line: string, value: LineValue): LineValue {
  if (!/\bwhile\b|\bif you\b|\bif you've\b|\brecently\b|\bwhen you\b|\bon kill\b|\bagainst enemies that\b/.test(line)) return value;
  return { ...value, offence: value.offence * 0.55, defence: value.defence * 0.55 };
}

function lineValueCore(line: string, build: BuildProfile, requirement: number, minionLine: boolean): LineValue {
  const { weights, ctx } = build;
  // «Las ofrendas / los tótems / los compañeros tienen más vida»: es su vida,
  // no la tuya. Ayuda un poco a esa habilidad y nada más.
  if (!minionLine && /\b(offerings?|totems?|companions?|allies|ally)\b/.test(line)) {
    return { offence: 0.2 * requirement, defence: 0, reasons: [] };
  }
  // Antes de mirar palabras sueltas: de QUIÉN habla la línea. «Armadura»,
  // «vida», «resistencias» o «maldición» también salen en líneas sobre el
  // enemigo o que te quitan algo, y el «Por qué» decía lo contrario del nodo
  // («Más armadura, que ya llevas» en uno que ROMPE la armadura del enemigo).
  if (!minionLine) {
    // Lo que te quita no es una ventaja: «-7% to Chaos Resistance», «Lose 3% of maximum Life…».
    if (/^-\d/.test(line) || /^lose\b/.test(line)) return NONE;
    // Romper la armadura del enemigo es ataque; aguantar mejor que te la rompan, un poco de defensa.
    if (/\bbreak\b.*\barmour\b|\barmour break\b/.test(line)) {
      return /\btaken\b/.test(line) ? { offence: 0, defence: 0.2, reasons: [] } : { offence: 0.2 * requirement, defence: 0, reasons: [] };
    }
    // La exposición baja las resistencias del enemigo, no sube las tuyas.
    if (/\bexposure\b/.test(line)) return { offence: 0.2 * requirement, defence: 0, reasons: [] };
    // Maldiciones que llevas TÚ encima: nada que ver con las que lanzas.
    if (/\bcurses? on you\b/.test(line)) {
      return /\breduced effect\b/.test(line) ? { offence: 0, defence: 0.15, reasons: [] } : NONE;
    }
    // Umbral de aturdimiento o de estados sacado de tu vida o de tu escudo: da umbral, no vida ni escudo.
    if (/\bthreshold\b/.test(line)) return { offence: 0, defence: 0.35, reasons: [] };
  }
  // Defensas (las de los esbirros cuentan como ayuda a los esbirros).
  if (!minionLine) {
    const defenceStyle = ctx.defence ?? "life";
    const sure = ctx.defence === null ? 0.7 : 1;
    if (/\bresistances?\b/.test(line) && !/\bpenetrat|\benem(y|ies)\b/.test(line)) {
      return { offence: 0, defence: /\bchaos\b/.test(line) ? 0.6 : 0.9, reasons: ["resist"] };
    }
    // «…dealing a tenth of their maximum Life as Fire Damage»: la vida es la del enemigo que explota.
    if (
      /\bmaximum life\b|\blife regeneration\b|\blife recovery\b|\blife recoup|\blife leech|\blife on kill\b|\bto maximum life\b/.test(line) &&
      !/\btheir maximum life\b/.test(line)
    ) {
      const value = defenceStyle === "life" ? 1 * sure : defenceStyle === "hybrid" ? 0.6 : 0.15;
      return { offence: 0, defence: value, reasons: ["life"] };
    }
    if (/\benergy shield\b/.test(line)) {
      const base = defenceStyle === "energyShield" ? 1 : defenceStyle === "hybrid" ? 0.6 : 0.1;
      const value = /\brecharge\b/.test(line) ? base * 0.6 : base;
      return { offence: 0, defence: value, reasons: ["energyShield"] };
    }
    if (/\barmour\b/.test(line)) return { offence: 0, defence: ctx.usesArmour ? 0.7 : 0.15, reasons: ["armour"] };
    if (/\bevasion\b|\bdeflect/.test(line)) return { offence: 0, defence: ctx.usesEvasion ? 0.7 : 0.15, reasons: ["evasion"] };
    if (/\bspirit\b/.test(line)) return { offence: 0, defence: (weights.spirit ?? 0) > 0 ? 0.8 : 0.2, reasons: ["spirit"] };
    // «Los enemigos malditos se mueven más despacio» no es tu velocidad.
    if (/\bmovement speed\b/.test(line) && !/\benem(y|ies)\b/.test(line)) {
      return { offence: 0, defence: 0.4, reasons: ["speed"] };
    }
    if (/\bstun threshold\b|\bailment threshold\b|\bdamage taken\b|\bless damage\b|\breduced damage\b/.test(line)) {
      return { offence: 0, defence: 0.35, reasons: [] };
    }
    if (/\bmana\b/.test(line)) return { offence: (weights.spell ?? 0) > 0 ? 0.25 : 0.05, defence: 0, reasons: ["mana"] };
    if (/\bflask\b|\bstrength\b|\bdexterity\b|\bintelligence\b|\battribute\b/.test(line)) {
      return { offence: 0, defence: 0.12, reasons: [] };
    }
  }

  // Elementos: alguno de los que nombra la línea tiene que usarlo el personaje.
  const elementWeights = ELEMENTS.filter(([pattern]) => pattern.test(line)).map(([, families]) =>
    Math.max(...families.map((family) => weights[family] ?? 0)),
  );
  // Para los esbirros, su elemento no es el del personaje: no se exige.
  const element = minionLine || elementWeights.length === 0 ? 1 : Math.max(...elementWeights);
  if (element === 0) return NONE;
  const scale = requirement * element;

  if (/\bto level of all\b/.test(line)) {
    return { offence: 3 * scale, defence: 0, reasons: [minionLine ? "minion" : "level"] };
  }
  if (minionLine) {
    // Para los esbirros: el daño y la velocidad son su ataque; la vida y las
    // resistencias, que aguanten; revivir o moverse más rápido, poca cosa.
    if (/\blife\b|\bresist|\bdamage taken\b|\breduced damage\b|\benergy shield\b|\barmour\b|\bevasion\b/.test(line)) {
      return { offence: 0.45 * scale, defence: 0.2, reasons: ["minion"] };
    }
    if (/\bdamage\b/.test(line)) return { offence: 0.9 * scale, defence: 0, reasons: ["minion"] };
    if (/\battack\b|\bcast speed\b|\bcritical\b/.test(line)) return { offence: 0.7 * scale, defence: 0, reasons: ["minion"] };
    return { offence: 0.25 * scale, defence: 0, reasons: ["minion"] };
  }
  if (/\bcurses?\b|\bhex/.test(line)) {
    const curse = weights.curse ?? 0;
    if (curse === 0) return NONE;
    // Lo que importa de una maldición es cuánto hace (magnitud) y a cuántos llega.
    const share = /\bduration\b|\bcast speed\b|\bactivation\b/.test(line) ? 0.3 : /\barea\b/.test(line) ? 0.6 : 0.9;
    return { offence: share * curse, defence: 0.1, reasons: ["curse"] };
  }
  if (/\bcritical\b/.test(line)) {
    return { offence: (build.mostlyDot ? 0.15 : 0.6) * scale, defence: 0, reasons: ["crit"] };
  }
  // Un daño con el tiempo que no se acumula no gana mucho lanzándose más rápido.
  if (/\bcast speed\b/.test(line)) return { offence: (build.mostlyDot ? 0.3 : 0.6) * scale, defence: 0, reasons: ["castSpeed"] };
  if (/\battack speed\b/.test(line)) return { offence: 0.8 * scale, defence: 0, reasons: ["attackSpeed"] };
  if (/\bskill effect duration\b|\bduration of skill/.test(line) || (/\bduration\b/.test(line) && !/\bcharge|\bflask|\bailment|\bstun|\bfreeze|\bchill|\bshock|\bslow/.test(line))) {
    return (weights.duration ?? 0) > 0 ? { offence: 0.7 * (weights.duration ?? 0), defence: 0, reasons: ["duration"] } : NONE;
  }
  if (/\barea of effect\b/.test(line)) {
    return (weights.area ?? 0) > 0 ? { offence: 0.6 * (weights.area ?? 0), defence: 0, reasons: ["area"] } : NONE;
  }
  if (/\bprojectile speed\b/.test(line)) return { offence: 0.3 * scale, defence: 0, reasons: ["projectile"] };
  if (/\bdamage over time\b|\bwither/.test(line)) {
    return (weights.dot ?? 0) > 0 ? { offence: 1 * (weights.dot ?? 0) * scale, defence: 0, reasons: ["damage"] } : NONE;
  }
  if (/\bdamage\b|\bpenetrat|\bexposure\b|\bas extra\b/.test(line)) {
    // «Daño aumentado» a secas sirve un poco a todos; con familia, más.
    const specific = elementWeights.length > 0 || REQUIRES.some(([pattern]) => pattern.test(line));
    // Lo que se gana «como daño extra» y la penetración solo valen en impactos.
    const hitOnly = /\bas extra\b|\bpenetrat|\bon hit\b|\bwith hits\b/.test(line) && build.mostlyDot;
    const value = (specific ? 1 : 0.5) * scale * (hitOnly ? 0.35 : 1);
    return { offence: value, defence: 0, reasons: ["damage"] };
  }
  return { offence: 0.05, defence: 0.05, reasons: [] };
}

interface NodeValue {
  offence: number;
  defence: number;
  reasons: ReasonId[];
}

function nodeValue(node: TreeNodeData, build: BuildProfile, cache: Map<TreeNodeData, NodeValue>): NodeValue {
  const known = cache.get(node);
  if (known) return known;
  const total: NodeValue = { offence: 0, defence: 0, reasons: [] };
  // El porqué va en orden de lo que más aporta.
  const weight = new Map<ReasonId, number>();
  for (const line of node.statsEn) {
    const value = lineValue(line, build);
    total.offence += value.offence;
    total.defence += value.defence;
    const size = value.offence + value.defence;
    if (size < 0.2) continue;
    for (const reason of value.reasons) weight.set(reason, Math.max(weight.get(reason) ?? 0, size));
  }
  total.reasons = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([reason]) => reason);
  cache.set(node, total);
  return total;
}

// ---------------------------------------------------------------------------
// Elegir
// ---------------------------------------------------------------------------

/** Lo más lejos que se busca: más de esto ya no es «el siguiente paso». */
const MAX_POINTS_OFFENCE = 14;
const MAX_POINTS_DEFENCE = 12;
const PATH_SHARE = 0.35;

interface Candidate {
  key: string;
  path: string[];
  score: number;
  value: NodeValue;
}

function best(
  graph: TreeGraph,
  allocated: ReadonlySet<string>,
  start: string | null,
  build: BuildProfile,
  kind: "offence" | "defence",
  skip: ReadonlySet<string>,
  cache: Map<TreeNodeData, NodeValue>,
): Candidate | null {
  const reach = reachFrom(graph, allocated, start);
  const limit = kind === "offence" ? MAX_POINTS_OFFENCE : MAX_POINTS_DEFENCE;
  let winner: Candidate | null = null;
  for (const [key, points] of reach.dist) {
    if (points === 0 || points > limit || skip.has(key)) continue;
    const node = graph.data.nodes[key];
    if (node.kind !== "notable") continue;
    const own = nodeValue(node, build, cache);
    const main = kind === "offence" ? own.offence : own.defence;
    if (main < (kind === "offence" ? 0.9 : 0.8)) continue;
    const path = pathTo(reach, key);
    let offence = own.offence;
    let defence = own.defence;
    for (const step of path.slice(0, -1)) {
      const value = nodeValue(graph.data.nodes[step], build, cache);
      offence += PATH_SHARE * value.offence;
      defence += PATH_SHARE * value.defence;
    }
    const gain = kind === "offence" ? offence + 0.25 * defence : defence + 0.25 * offence;
    const score = gain / Math.pow(path.length, 0.85);
    if (winner === null || score > winner.score || (score === winner.score && key < winner.key)) {
      winner = { key, path, score, value: own };
    }
  }
  return winner;
}

const REASON_TEXT: Record<ReasonId, Record<TreeLang, (skills: string) => string>> = {
  level: { es: (s) => `Sube un nivel ${s}.`, en: (s) => `Raises ${s} by one level.` },
  damage: { es: (s) => `Más daño para ${s}.`, en: (s) => `More damage for ${s}.` },
  curse: { es: (s) => `Tus maldiciones (${s}) pegan más fuerte.`, en: (s) => `Your curses (${s}) hit harder.` },
  duration: { es: (s) => `Duran más los efectos de ${s}.`, en: (s) => `The effects of ${s} last longer.` },
  minion: { es: (s) => `Ayuda a tus esbirros (${s}).`, en: (s) => `It helps your minions (${s}).` },
  area: { es: (s) => `Más área para ${s}.`, en: (s) => `More area for ${s}.` },
  castSpeed: { es: () => "Lanzas tus hechizos más rápido.", en: () => "You cast your spells faster." },
  attackSpeed: { es: () => "Atacas más rápido.", en: () => "You attack faster." },
  crit: { es: (s) => `Más críticos para ${s}.`, en: (s) => `More critical hits for ${s}.` },
  projectile: { es: (s) => `Tus proyectiles (${s}) van más rápido.`, en: (s) => `Your projectiles (${s}) fly faster.` },
  life: { es: () => "Más vida, que es tu defensa.", en: () => "More life, which is your defence." },
  energyShield: { es: () => "Más escudo de energía, que es tu defensa.", en: () => "More energy shield, which is your defence." },
  resist: { es: () => "Te acerca al 75 % de resistencias.", en: () => "It brings you closer to 75% resistances." },
  armour: { es: () => "Más armadura, que ya llevas en el equipo.", en: () => "More armour, which your gear already has." },
  evasion: { es: () => "Más evasión, que ya llevas en el equipo.", en: () => "More evasion, which your gear already has." },
  spirit: { es: () => "Más espíritu para tus esbirros y auras.", en: () => "More spirit for your minions and auras." },
  mana: { es: () => "Más maná para lanzar sin parar.", en: () => "More mana to keep casting." },
  speed: { es: () => "Te mueves más rápido.", en: () => "You move faster." },
};

const REASON_FAMILY: Partial<Record<ReasonId, Family[]>> = {
  level: ["chaos", "fire", "cold", "lightning", "physical", "spell", "attack", "projectile", "minion"],
  damage: ["chaos", "fire", "cold", "lightning", "physical", "spell", "attack", "dot"],
  curse: ["curse"],
  duration: ["duration"],
  minion: ["minion"],
  area: ["area"],
  crit: ["spell", "attack"],
  projectile: ["projectile"],
};

function joinNames(names: string[], lang: TreeLang): string {
  const list = names.slice(0, 2);
  if (list.length <= 1) return list[0] ?? "";
  return `${list[0]} ${lang === "es" ? "y" : "and"} ${list[1]}`;
}

/** Las habilidades a las que de verdad toca esta línea (las principales delante). */
function skillsFor(reason: ReasonId, node: TreeNodeData, build: BuildProfile): string[] {
  const families = REASON_FAMILY[reason] ?? [];
  const text = node.statsEn.join(" ").toLowerCase();
  const named = families.filter((family) => {
    if (reason === "level" || reason === "damage") {
      const words: Partial<Record<Family, RegExp>> = {
        chaos: /\bchaos\b/,
        fire: /\bfire\b|\belemental\b/,
        cold: /\bcold\b|\belemental\b/,
        lightning: /\blightning\b|\belemental\b/,
        physical: /\bphysical\b/,
        spell: /\bspells?\b/,
        attack: /\battacks?\b/,
        projectile: /\bprojectiles?\b/,
        minion: /\bminions?\b/,
        dot: /\bover time\b|\bwither/,
      };
      return words[family]?.test(text) ?? false;
    }
    return true;
  });
  const pool = (named.length > 0 ? named : families).flatMap((family) => build.skillsBy[family] ?? []);
  const main = build.ctx.skills.filter((skill) => skill.main).map((skill) => skill.name);
  const unique = [...new Set(pool)];
  return unique.sort((a, b) => Number(main.includes(b)) - Number(main.includes(a)));
}

function reasonsFor(node: TreeNodeData, value: NodeValue, build: BuildProfile, lang: TreeLang): string[] {
  const out: string[] = [];
  for (const reason of value.reasons) {
    const names = skillsFor(reason, node, build);
    const needsNames = REASON_FAMILY[reason] !== undefined;
    if (needsNames && names.length === 0) continue;
    const text = REASON_TEXT[reason][lang](joinNames(names, lang));
    if (!out.includes(text)) out.push(text);
    if (out.length === 2) break;
  }
  if (out.length === 0) out.push(lang === "es" ? "Encaja con lo que usa tu personaje." : "It fits what your character uses.");
  return out;
}

function onTheWay(graph: TreeGraph, path: string[], lang: TreeLang): Array<{ count: number; text: string }> {
  const groups = new Map<string, number>();
  for (const key of path.slice(0, -1)) {
    const text = nodeStats(graph.data.nodes[key], lang).join(" · ");
    if (!text) continue;
    groups.set(text, (groups.get(text) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([text, count]) => ({ count, text }))
    .sort((a, b) => b.count - a.count);
}

function suggestion(
  graph: TreeGraph,
  candidate: Candidate,
  build: BuildProfile,
  kind: "offence" | "defence",
): TreeSuggestion {
  const { lang } = build.ctx;
  const node = graph.data.nodes[candidate.key];
  const name = nodeName(node, lang);
  return {
    key: candidate.key,
    name,
    search: name,
    stats: nodeStats(node, lang),
    points: candidate.path.length,
    path: candidate.path,
    onTheWay: onTheWay(graph, candidate.path, lang),
    reasons: reasonsFor(node, candidate.value, build, lang),
    kind,
  };
}

/**
 * Los próximos notables: hasta tres para el daño, en el orden en que se
 * cogen, y uno de defensa contado desde el árbol de hoy.
 */
export function adviseTree(
  graph: TreeGraph,
  allocated: ReadonlySet<string>,
  start: string | null,
  ctx: TreeAdviceContext,
): TreeAdvice {
  const build = buildProfile(ctx);
  const cache = new Map<TreeNodeData, NodeValue>();
  const offence: TreeSuggestion[] = [];
  const taken = new Set(allocated);
  const chosen = new Set<string>();
  for (let index = 0; index < 3; index += 1) {
    const candidate = best(graph, taken, start, build, "offence", chosen, cache);
    if (candidate === null) break;
    offence.push(suggestion(graph, candidate, build, "offence"));
    chosen.add(candidate.key);
    for (const key of candidate.path) taken.add(key);
  }
  const defenceCandidate = best(graph, allocated, start, build, "defence", chosen, cache);
  return {
    offence,
    defence: defenceCandidate ? suggestion(graph, defenceCandidate, build, "defence") : null,
  };
}

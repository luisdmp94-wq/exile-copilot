import type { CharacterProfile, Item } from "@shared/domain.js";
import { resistancesFromItems } from "./guideCheck";

/**
 * «¿Cuál de estas dos piezas es mejor para mí?»
 *
 * Reglas fijas y a la vista, sin IA: se lee lo que da cada pieza, se agrupa en
 * filas (vida, resistencias, defensa…) y cada fila la gana la pieza con más.
 * Cada fila pesa según el estilo de juego elegido y según por cuánto se gana. No mira el árbol de pasivas
 * ni las gemas: compara lo que pone en los dos objetos, nada más.
 */

export type CompareStyle = "caster" | "melee" | "ranged";
export type CompareLang = "es" | "en";

export const COMPARE_STYLES: Array<{ id: CompareStyle; label: string }> = [
  { id: "caster", label: "Hechizos y esbirros" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "ranged", label: "Arco o ballesta" },
];

type SkillKindWord = "minion" | "spell" | "melee" | "projectile" | "attack" | "all" | "other";
type ResKey = "fire" | "cold" | "lightning" | "chaos";

/** Todo lo que el comparador escribe, en los dos idiomas. */
const WORDS = {
  es: {
    none: "nada",
    decimal: ",",
    percent: " %",
    line: "línea",
    lines: "líneas",
    and: "y",
    rows: {
      skills: "Nivel de habilidades",
      move: "Velocidad de movimiento",
      life: "Vida máxima",
      res: "Resistencias",
      spirit: "Espíritu",
      damageCaster: "Daño de hechizos y esbirros",
      damageAttack: "Daño de ataques",
      es: "Escudo de energía",
      armour: "Armadura",
      evasion: "Evasión",
      mana: "Maná máximo",
      regen: "Vida por segundo",
      attr: "Atributos",
    },
    kinds: { minion: "esbirros", spell: "hechizos", melee: "cuerpo a cuerpo", projectile: "proyectiles", attack: "ataques", all: "todas", other: "otras" } as Record<SkillKindWord, string>,
    res: { fire: "fuego", cold: "hielo", lightning: "rayo", chaos: "caos" } as Record<ResKey, string>,
    pieceA: "la pieza A",
    pieceB: "la pieza B",
    quote: (name: string) => `«${name}»`,
    tie: "Están muy parejas: ninguna gana con claridad.",
    givesMore: (who: string, what: string) => `${who} da más ${what}.`,
    youGetMore: (who: string, what: string) => `${who} te da más ${what}.`,
    youLose: (what: string, who: string) => `Pierdes ${what}, que da ${who}.`,
    slotWarning: "No van en el mismo hueco: puedes llevar las dos a la vez, no hace falta elegir.",
  },
  en: {
    none: "none",
    decimal: ".",
    percent: "%",
    line: "line",
    lines: "lines",
    and: "and",
    rows: {
      skills: "Skill levels",
      move: "Movement speed",
      life: "Maximum life",
      res: "Resistances",
      spirit: "Spirit",
      damageCaster: "Spell and minion damage",
      damageAttack: "Attack damage",
      es: "Energy shield",
      armour: "Armour",
      evasion: "Evasion",
      mana: "Maximum mana",
      regen: "Life per second",
      attr: "Attributes",
    },
    kinds: { minion: "minions", spell: "spells", melee: "melee", projectile: "projectiles", attack: "attacks", all: "all", other: "other" } as Record<SkillKindWord, string>,
    res: { fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" } as Record<ResKey, string>,
    pieceA: "item A",
    pieceB: "item B",
    quote: (name: string) => `“${name}”`,
    tie: "They're very close: neither wins clearly.",
    givesMore: (who: string, what: string) => `${who} gives more ${what}.`,
    youGetMore: (who: string, what: string) => `${who} gives you more ${what}.`,
    youLose: (what: string, who: string) => `You lose ${what}, which ${who} gives.`,
    slotWarning: "They don't go in the same slot: you can wear both, no need to choose.",
  },
} as const;

export type CompareSide = "a" | "b";

export interface CompareRow {
  id: string;
  label: string;
  a: string;
  b: string;
  winner: CompareSide | "tie";
  /** Cuánto pesa esta fila para el estilo elegido (0 = solo informativa). */
  weight: number;
  /** Por cuánto la gana la ganadora, de 0 (empate) a 1 (la otra no da nada). */
  margin: number;
}

export interface CompareResult {
  winner: CompareSide | "tie";
  scoreA: number;
  scoreB: number;
  rows: CompareRow[];
  /** Líneas de cada pieza que no aprovecha el estilo elegido. */
  wasted: Record<CompareSide, string[]>;
  /** Frases cortas que explican el veredicto. */
  reasons: string[];
  /** Aviso cuando las dos piezas no van en el mismo hueco. */
  slotWarning: string | null;
  /**
   * Cómo llamar a cada pieza en una frase: su nombre, o «la pieza A» cuando
   * las dos se llaman igual (dos raros pueden compartir nombre).
   */
  labels: Record<CompareSide, string>;
}

/** El texto avanzado escribe la tirada con su rango: `+28(25-30)%`. */
const ROLL_RANGE = /\((-?\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)/g;

function firstNumber(line: string): number | null {
  const match = /-?\d+(?:[.,]\d+)?/.exec(line.replace(ROLL_RANGE, ""));
  return match ? Number(match[0].replace(",", ".")) : null;
}

function modifierLines(item: Item): string[] {
  return item.modifiers.flatMap((modifier) => modifier.text.split("\n")).map((line) => line.trim()).filter(Boolean);
}

/** Propiedad base del objeto («Armadura: 28 (augmented)»), leída del texto pegado. */
function baseProperty(item: Item, label: RegExp): number {
  for (const line of (item.rawText ?? "").split(/\r\n?|\n/)) {
    const match = /^([^:{]+):\s*(-?\d+(?:[.,]\d+)?)/.exec(line.trim());
    if (match && label.test(match[1].trim())) return Number(match[2].replace(",", "."));
  }
  return 0;
}

function sumLines(lines: string[], test: RegExp, reject?: RegExp): number {
  let total = 0;
  for (const line of lines) {
    if (!test.test(line) || (reject && reject.test(line))) continue;
    total += firstNumber(line) ?? 0;
  }
  return total;
}

const PERCENT = /aumentad|increased|reducid|reduced|\bmás\b|\bmore\b/i;

/**
 * Espíritu que da una pieza: la propiedad de la base de los cetros
 * («Espíritu: 100») más los modificadores planos («+30 al espíritu»).
 */
export function itemSpirit(item: Item): number {
  return (
    baseProperty(item, /^(?:espíritu|spirit)$/i) + sumLines(modifierLines(item), /al espíritu|to spirit/i, PERCENT)
  );
}

const ATTACK_LINE =
  /a los ataques|to attacks|velocidad de ataque|attack speed|daño de ataque|attack damage|daño físico|physical damage|cuerpo a cuerpo|melee|proyectil|projectile|flechas?|arrows?/i;
const SPELL_LINE =
  /hechizos?|spells?|esbirros?|minions?|velocidad de lanzamiento|cast speed|daño de (?:caos|fuego|hielo|rayo)|(?:chaos|fire|cold|lightning) damage|daño elemental|elemental damage/i;
const ACCURACY_LINE = /precisión|accuracy/i;
const ALLY_LINE = /aliados|allies|esbirros|minions/i;
const RESISTANCE_LINE = /resistenc|resistanc/i;
/** «+1 al nivel de todas las habilidades de esbirros», «+2 to Level of all Spell Skills»… */
const SKILL_LEVEL_LINE = /al nivel de (?:todas las )?(?:gemas|habilidades)|to level of all/i;

/**
 * A qué habilidades sube el nivel una línea. «all» es solo la que dice «todas
 * las habilidades» a secas; «other» es un tipo que este comparador no conoce
 * (maldiciones, por ejemplo) y que no se da por bueno para nadie.
 */
type SkillKind = "minion" | "spell" | "melee" | "projectile" | "attack" | "all" | "other";

const SKILL_KINDS: Array<[SkillKind, RegExp]> = [
  ["minion", /esbirros?|minions?/i],
  ["spell", /hechizos?|spells?/i],
  ["melee", /cuerpo a cuerpo|melee/i],
  ["projectile", /proyectil|projectile/i],
  ["attack", /ataques?|attacks?/i],
];

/** «+1 al nivel de todas las habilidades», sin decir de qué tipo. */
const ALL_SKILLS_LINE = /(?:todas las (?:gemas de )?habilidad(?:es)?|all skills?(?: gems)?)\s*$/i;

/** Qué habilidades sube cada estilo de juego. «Todas» sirve a cualquiera. */
const SKILL_KINDS_FOR: Record<CompareStyle, SkillKind[]> = {
  caster: ["minion", "spell", "all"],
  melee: ["melee", "attack", "all"],
  ranged: ["projectile", "attack", "all"],
};

interface SkillLevel {
  kind: SkillKind;
  levels: number;
  line: string;
}

function readSkillLevel(line: string): SkillLevel {
  const found = SKILL_KINDS.find(([, test]) => test.test(line));
  // Sin tipo reconocido solo es «todas» si lo dice; si no, es un tipo que no
  // conocemos y no se cuenta a favor de ningún estilo.
  const text = line.replace(ROLL_RANGE, "").replace(/[.\s]+$/, "");
  return {
    kind: found?.[0] ?? (ALL_SKILLS_LINE.test(text) ? "all" : "other"),
    levels: firstNumber(line) ?? 1,
    line,
  };
}

interface Reading {
  life: number;
  lifeRegen: number;
  mana: number;
  energyShield: number;
  armour: number;
  evasion: number;
  resistances: number;
  resistanceBy: Record<ResKey, number>;
  moveSpeed: number;
  spirit: number;
  attributes: number;
  spellLines: string[];
  attackLines: string[];
  accuracyLines: string[];
  skillLevels: SkillLevel[];
}

const RES_ORDER: ResKey[] = ["fire", "cold", "lightning", "chaos"];

function read(item: Item): Reading {
  const lines = modifierLines(item);
  const totals = resistancesFromItems([item]);
  // El tipo de resistencias admite «desconocido» (null); aquí siempre hay número.
  const res = {
    fire: totals.fire ?? 0,
    cold: totals.cold ?? 0,
    lightning: totals.lightning ?? 0,
    chaos: totals.chaos ?? 0,
  };
  const flat = (test: RegExp) => sumLines(lines, test, PERCENT);
  const baseOrFlat = (property: RegExp, modifier: RegExp) => baseProperty(item, property) || flat(modifier);
  // Subir de nivel las habilidades va en su propia fila: no es «una línea de daño más».
  const damageLines = lines.filter(
    (line) => !RESISTANCE_LINE.test(line) && !ACCURACY_LINE.test(line) && !SKILL_LEVEL_LINE.test(line),
  );
  return {
    life: flat(/a la vida máxima|to maximum life/i),
    lifeRegen: sumLines(lines, /de vida por segundo|life per second|life regeneration/i),
    mana: flat(/al maná máximo|to maximum mana/i),
    energyShield: baseOrFlat(/^(?:escudo de energía|energy shield)$/i, /al escudo de energía máximo|to maximum energy shield/i),
    armour: baseOrFlat(/^(?:armadura|armour|armor)$/i, /a la armadura|to armour|to armor/i),
    evasion: baseOrFlat(/^(?:evasión|evasion rating|evasion)$/i, /a la evasión|to evasion/i),
    resistances: res.fire + res.cold + res.lightning + res.chaos,
    resistanceBy: res,
    moveSpeed: sumLines(lines, /velocidad de movimiento|movement speed/i),
    // En un cetro el espíritu es una propiedad de la base («Espíritu: 100»), no un modificador.
    spirit: itemSpirit(item),
    attributes: flat(/a la (?:fuerza|destreza|inteligencia)|a todos los atributos|to (?:strength|dexterity|intelligence|all attributes)/i),
    // Una línea que habla de ataques es de ataque aunque nombre un elemento.
    // Y una que mejora a los aliados (los esbirros lo son) cuenta para quien
    // lleva esbirros aunque hable de ataques: los que atacan son ellos.
    attackLines: damageLines.filter((line) => ATTACK_LINE.test(line) && !ALLY_LINE.test(line)),
    spellLines: damageLines.filter((line) => ALLY_LINE.test(line) || (!ATTACK_LINE.test(line) && SPELL_LINE.test(line))),
    accuracyLines: lines.filter((line) => ACCURACY_LINE.test(line)),
    skillLevels: lines.filter((line) => SKILL_LEVEL_LINE.test(line)).map(readSkillLevel),
  };
}

const WEIGHTS: Record<CompareStyle, Record<string, number>> = {
  // Un nivel más en las habilidades que usas es de lo mejor que puede tener una pieza.
  caster: { skills: 5, move: 3, life: 3, res: 3, spirit: 2, damage: 2, es: 2, armour: 1, evasion: 1, mana: 1, regen: 1, attr: 1 },
  melee: { skills: 5, move: 3, life: 3, res: 3, spirit: 1, damage: 2, es: 1, armour: 2, evasion: 1, mana: 1, regen: 1, attr: 1 },
  ranged: { skills: 5, move: 3, life: 3, res: 3, spirit: 1, damage: 2, es: 1, armour: 1, evasion: 2, mana: 1, regen: 1, attr: 1 },
};

/**
 * Lo que se sabe del personaje que va a llevar la pieza. Todo es opcional:
 * sin personaje, el comparador funciona igual que siempre.
 */
export interface CompareContext {
  /** Resistencias actuales del personaje (hoja del juego o suma de su equipo). */
  resistances?: Partial<Record<ResKey, number | null>>;
  /**
   * La pieza que lleva ahora en ese mismo hueco. Su resistencia ya está dentro
   * de las actuales: se descuenta para saber desde dónde parte cada candidata.
   */
  equipped?: Item | null;
  /** Usa esbirros: el Espíritu le da más esbirros y pesa como un +1 a sus gemas. */
  minions?: boolean;
}

const MINION_SKILL =
  /esqueleto|skeleton|espectro|spectre|zombi|zombie|exhumar|unearth|esbirro|minion|g[oó]lem|resucitad|revenant|arconte|bind spectre|vincular espectro/i;

/** ¿El personaje lleva esbirros? Lo dicen sus habilidades o su arquetipo. */
export function profileUsesMinions(profile: Pick<CharacterProfile, "skills" | "archetype"> | null | undefined): boolean {
  if (!profile) return false;
  if (profile.archetype && MINION_SKILL.test(profile.archetype)) return true;
  return profile.skills.some((skill) => MINION_SKILL.test(`${skill.mainSkill} ${skill.label}`));
}

/**
 * Contexto del personaje guardado: sus resistencias (las de la hoja si las
 * apuntó, si no la suma de su equipo) y la pieza que lleva en ese hueco.
 */
export function contextFromProfile(
  profile: Pick<CharacterProfile, "resistances" | "items"> | null | undefined,
  slot: Item["slot"] | null,
): Pick<CompareContext, "resistances" | "equipped"> {
  if (!profile) return {};
  const sheet = profile.resistances;
  const fromSheet = RES_ORDER.some((key) => sheet[key] !== null && sheet[key] !== undefined);
  const resistances = fromSheet
    ? sheet
    : profile.items.length > 0
      ? resistancesFromItems(profile.items)
      : undefined;
  // Con anillos no se sabe cuál de los dos se cambia: no se descuenta ninguno.
  const equipped =
    slot && slot !== "ring1" && slot !== "ring2" ? (profile.items.find((item) => item.slot === slot) ?? null) : null;
  return { ...(resistances ? { resistances } : {}), equipped };
}

/** Tope normal de resistencia elemental en PoE2. */
const RESISTANCE_CAP = 75;
/** Con esbirros, el Espíritu es tan valioso como subir de nivel sus gemas. */
const MINION_SPIRIT_WEIGHT = 5;

/**
 * Resistencia que de verdad cambia para el personaje: lo que sube hasta el
 * 75 % cuenta, lo que pasa de ahí no, y lo que la pieza le quita, resta. Sin
 * datos del personaje, cuenta toda.
 */
function usefulResistance(gain: Record<ResKey, number>, base: Record<ResKey, number> | null): number {
  if (base === null) return RES_ORDER.reduce((total, key) => total + gain[key], 0);
  const capped = (value: number) => Math.min(RESISTANCE_CAP, value);
  return RES_ORDER.reduce((total, key) => total + capped(base[key] + gain[key]) - capped(base[key]), 0);
}

function startingResistances(context: CompareContext): Record<ResKey, number> | null {
  const known = context.resistances;
  if (!known || RES_ORDER.every((key) => known[key] === null || known[key] === undefined)) return null;
  const worn = context.equipped ? resistancesFromItems([context.equipped]) : null;
  const base = {} as Record<ResKey, number>;
  for (const key of RES_ORDER) {
    base[key] = (known[key] ?? 0) - (worn?.[key] ?? 0);
  }
  return base;
}

type Words = (typeof WORDS)[CompareLang];

function amount(words: Words, value: number, unit = ""): string {
  if (value === 0) return words.none;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", words.decimal);
  return `${value > 0 ? "+" : ""}${text}${unit}`;
}

function plain(words: Words, value: number): string {
  return value === 0 ? words.none : String(value);
}

function resistanceText(words: Words, res: Record<ResKey, number>): string {
  return RES_ORDER.filter((key) => res[key] !== 0)
    .map((key) => `${res[key] > 0 ? "+" : ""}${res[key]}${words.percent} ${words.res[key]}`)
    .join(", ");
}

/**
 * Quién gana una fila. Si las dos piezas dan casi lo mismo (hasta un 15 % de
 * diferencia), es empate: 22 de escudo frente a 20 no es «perder escudo», y
 * un 9 % de resistencia frente a un 8 % no decide nada.
 */
function winnerOf(a: number, b: number): CompareSide | "tie" {
  if (a === b) return "tie";
  if (a > 0 && b > 0 && Math.abs(a - b) <= 0.15 * Math.max(a, b)) return "tie";
  return a > b ? "a" : "b";
}

/**
 * Por cuánto gana una fila, de 0 a 1: 34 de vida frente a nada es 1; un 10 %
 * de resistencia frente a un 6 % es 0,4. Así ganar por poco cuenta poco.
 */
function marginOf(a: number, b: number): number {
  const top = Math.max(Math.abs(a), Math.abs(b));
  return top === 0 ? 0 : Math.min(1, Math.abs(a - b) / top);
}

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

export function compareItems(
  a: Item,
  b: Item,
  style: CompareStyle,
  lang: CompareLang = "es",
  context: CompareContext = {},
): CompareResult {
  const words = WORDS[lang];
  const ra = read(a);
  const rb = read(b);
  const weights =
    context.minions && style === "caster"
      ? { ...WEIGHTS[style], spirit: MINION_SPIRIT_WEIGHT }
      : WEIGHTS[style];
  const resBase = startingResistances(context);
  const damageA = style === "caster" ? ra.spellLines : ra.attackLines;
  const damageB = style === "caster" ? rb.spellLines : rb.attackLines;

  // Niveles de habilidad: solo cuentan los de las habilidades que usa el estilo.
  const usefulKinds = SKILL_KINDS_FOR[style];
  const usefulSkills = (reading: Reading) => reading.skillLevels.filter((skill) => usefulKinds.includes(skill.kind));
  const skillsA = usefulSkills(ra);
  const skillsB = usefulSkills(rb);
  const skillText = (skills: SkillLevel[]) =>
    skills.length === 0 ? words.none : skills.map((skill) => `+${skill.levels} ${words.kinds[skill.kind]}`).join(", ");
  const levelsOf = (skills: SkillLevel[]) => skills.reduce((total, skill) => total + skill.levels, 0);

  const row = (id: string, label: string, a: string, b: string, valueA: number, valueB: number, weight: number): CompareRow => {
    const winner = winnerOf(valueA, valueB);
    return { id, label, a, b, winner, weight, margin: winner === "tie" ? 0 : marginOf(valueA, valueB) };
  };
  const lineCount = (lines: string[]) =>
    lines.length === 0 ? words.none : `${lines.length} ${lines.length === 1 ? words.line : words.lines}`;

  const candidates: CompareRow[] = [
    row("skills", words.rows.skills, skillText(skillsA), skillText(skillsB), levelsOf(skillsA), levelsOf(skillsB), weights.skills),
    row("move", words.rows.move, amount(words, ra.moveSpeed, words.percent), amount(words, rb.moveSpeed, words.percent), ra.moveSpeed, rb.moveSpeed, weights.move),
    row("life", words.rows.life, amount(words, ra.life), amount(words, rb.life), ra.life, rb.life, weights.life),
    row(
      "res",
      words.rows.res,
      resistanceText(words, ra.resistanceBy) || words.none,
      resistanceText(words, rb.resistanceBy) || words.none,
      usefulResistance(ra.resistanceBy, resBase),
      usefulResistance(rb.resistanceBy, resBase),
      weights.res,
    ),
    row("spirit", words.rows.spirit, amount(words, ra.spirit), amount(words, rb.spirit), ra.spirit, rb.spirit, weights.spirit),
    row(
      "damage",
      style === "caster" ? words.rows.damageCaster : words.rows.damageAttack,
      lineCount(damageA),
      lineCount(damageB),
      damageA.length,
      damageB.length,
      weights.damage,
    ),
    row("es", words.rows.es, plain(words, ra.energyShield), plain(words, rb.energyShield), ra.energyShield, rb.energyShield, weights.es),
    row("armour", words.rows.armour, plain(words, ra.armour), plain(words, rb.armour), ra.armour, rb.armour, weights.armour),
    row("evasion", words.rows.evasion, plain(words, ra.evasion), plain(words, rb.evasion), ra.evasion, rb.evasion, weights.evasion),
    row("mana", words.rows.mana, amount(words, ra.mana), amount(words, rb.mana), ra.mana, rb.mana, weights.mana),
    row("regen", words.rows.regen, amount(words, ra.lifeRegen), amount(words, rb.lifeRegen), ra.lifeRegen, rb.lifeRegen, weights.regen),
    row("attr", words.rows.attr, amount(words, ra.attributes), amount(words, rb.attributes), ra.attributes, rb.attributes, weights.attr),
  ];
  // Solo se enseñan las filas en las que alguna de las dos piezas da algo.
  const rows = candidates.filter((item) => item.a !== words.none || item.b !== words.none);

  // Cada fila suma su peso por cuánto gana: ganar por poco cuenta poco.
  const points = (item: CompareRow) => item.weight * item.margin;
  const score = (side: CompareSide) =>
    Math.round(rows.reduce((total, item) => total + (item.winner === side ? points(item) : 0), 0) * 100) / 100;
  const scoreA = score("a");
  const scoreB = score("b");
  // Un punto de diferencia es una fila menor: no basta para dar un ganador.
  const winner: CompareSide | "tie" = Math.abs(scoreA - scoreB) <= 1 ? "tie" : scoreA > scoreB ? "a" : "b";

  const wastedFor = (reading: Reading) => [
    ...(style === "caster" ? [...reading.attackLines, ...reading.accuracyLines] : reading.spellLines),
    ...reading.skillLevels.filter((skill) => !usefulKinds.includes(skill.kind)).map((skill) => skill.line),
  ];
  const wasted = { a: wastedFor(ra), b: wastedFor(rb) };

  const wonBy = (side: CompareSide) =>
    rows
      .filter((item) => item.winner === side)
      .sort((x, y) => points(y) - points(x))
      .map((item) => item.label.toLocaleLowerCase(lang));
  // Dos objetos raros pueden llamarse igual: entonces el nombre no distingue
  // nada y se habla de «la pieza A» y «la pieza B».
  const sameName = a.name.trim().toLocaleLowerCase("es") === b.name.trim().toLocaleLowerCase("es");
  const labels: Record<CompareSide, string> = sameName
    ? { a: words.pieceA, b: words.pieceB }
    : { a: words.quote(a.name), b: words.quote(b.name) };
  const capital = (text: string) => text.replace(/^./, (first) => first.toLocaleUpperCase(lang));
  const list = (items: string[]) => joinList(items, words.and);
  const reasons: string[] = [];
  if (winner === "tie") {
    reasons.push(words.tie);
    for (const side of ["a", "b"] as const) {
      const won = wonBy(side);
      if (won.length > 0) reasons.push(words.givesMore(capital(labels[side]), list(won)));
    }
  } else {
    const loser: CompareSide = winner === "a" ? "b" : "a";
    reasons.push(words.youGetMore(capital(labels[winner]), list(wonBy(winner))));
    const lost = wonBy(loser);
    if (lost.length > 0) reasons.push(words.youLose(list(lost), labels[loser]));
  }

  const slotOf = (item: Item) => (item.slot === "ring2" ? "ring1" : item.slot);
  const slotWarning = slotOf(a) !== slotOf(b) ? words.slotWarning : null;

  return { winner, scoreA, scoreB, rows, wasted, reasons, slotWarning, labels };
}

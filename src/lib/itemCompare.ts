import type { Item } from "@shared/domain.js";
import { resistancesFromItems } from "./guideCheck";

/**
 * «¿Cuál de estas dos piezas es mejor para mí?»
 *
 * Reglas fijas y a la vista, sin IA: se lee lo que da cada pieza, se agrupa en
 * filas (vida, resistencias, defensa…) y cada fila la gana la pieza con más.
 * Cada fila pesa según el estilo de juego elegido. No mira el árbol de pasivas
 * ni las gemas: compara lo que pone en los dos objetos, nada más.
 */

export type CompareStyle = "caster" | "melee" | "ranged";

export const COMPARE_STYLES: Array<{ id: CompareStyle; label: string }> = [
  { id: "caster", label: "Hechizos y esbirros" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "ranged", label: "Arco o ballesta" },
];

export type CompareSide = "a" | "b";

export interface CompareRow {
  id: string;
  label: string;
  a: string;
  b: string;
  winner: CompareSide | "tie";
  /** Cuánto pesa esta fila para el estilo elegido (0 = solo informativa). */
  weight: number;
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

interface Reading {
  life: number;
  lifeRegen: number;
  mana: number;
  energyShield: number;
  armour: number;
  evasion: number;
  resistances: number;
  resistanceText: string;
  moveSpeed: number;
  spirit: number;
  attributes: number;
  spellLines: string[];
  attackLines: string[];
  accuracyLines: string[];
}

const RES_LABEL: Array<["fire" | "cold" | "lightning" | "chaos", string]> = [
  ["fire", "fuego"],
  ["cold", "hielo"],
  ["lightning", "rayo"],
  ["chaos", "caos"],
];

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
  const damageLines = lines.filter((line) => !RESISTANCE_LINE.test(line) && !ACCURACY_LINE.test(line));
  return {
    life: flat(/a la vida máxima|to maximum life/i),
    lifeRegen: sumLines(lines, /de vida por segundo|life per second|life regeneration/i),
    mana: flat(/al maná máximo|to maximum mana/i),
    energyShield: baseOrFlat(/^(?:escudo de energía|energy shield)$/i, /al escudo de energía máximo|to maximum energy shield/i),
    armour: baseOrFlat(/^(?:armadura|armour|armor)$/i, /a la armadura|to armour|to armor/i),
    evasion: baseOrFlat(/^(?:evasión|evasion rating|evasion)$/i, /a la evasión|to evasion/i),
    resistances: res.fire + res.cold + res.lightning + res.chaos,
    resistanceText: RES_LABEL.filter(([key]) => res[key] !== 0)
      .map(([key, label]) => `${res[key] > 0 ? "+" : ""}${res[key]} % ${label}`)
      .join(", "),
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
  };
}

const WEIGHTS: Record<CompareStyle, Record<string, number>> = {
  caster: { move: 3, life: 3, res: 3, spirit: 2, damage: 2, es: 2, armour: 1, evasion: 1, mana: 1, regen: 1, attr: 1 },
  melee: { move: 3, life: 3, res: 3, spirit: 1, damage: 2, es: 1, armour: 2, evasion: 1, mana: 1, regen: 1, attr: 1 },
  ranged: { move: 3, life: 3, res: 3, spirit: 1, damage: 2, es: 1, armour: 1, evasion: 2, mana: 1, regen: 1, attr: 1 },
};

function amount(value: number, unit = ""): string {
  if (value === 0) return "nada";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  return `${value > 0 ? "+" : ""}${text}${unit}`;
}

function plain(value: number): string {
  return value === 0 ? "nada" : String(value);
}

/**
 * Quién gana una fila. Si las dos piezas dan casi lo mismo (menos de un 10 %
 * de diferencia), es empate: 22 de escudo frente a 20 no es «perder escudo».
 */
function winnerOf(a: number, b: number): CompareSide | "tie" {
  if (a === b) return "tie";
  if (a > 0 && b > 0 && Math.abs(a - b) <= 0.1 * Math.max(a, b)) return "tie";
  return a > b ? "a" : "b";
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function compareItems(a: Item, b: Item, style: CompareStyle): CompareResult {
  const ra = read(a);
  const rb = read(b);
  const weights = WEIGHTS[style];
  const damageA = style === "caster" ? ra.spellLines : ra.attackLines;
  const damageB = style === "caster" ? rb.spellLines : rb.attackLines;

  const candidates: CompareRow[] = [
    { id: "move", label: "Velocidad de movimiento", a: amount(ra.moveSpeed, " %"), b: amount(rb.moveSpeed, " %"), winner: winnerOf(ra.moveSpeed, rb.moveSpeed), weight: weights.move },
    { id: "life", label: "Vida máxima", a: amount(ra.life), b: amount(rb.life), winner: winnerOf(ra.life, rb.life), weight: weights.life },
    { id: "res", label: "Resistencias", a: ra.resistanceText || "nada", b: rb.resistanceText || "nada", winner: winnerOf(ra.resistances, rb.resistances), weight: weights.res },
    { id: "spirit", label: "Espíritu", a: amount(ra.spirit), b: amount(rb.spirit), winner: winnerOf(ra.spirit, rb.spirit), weight: weights.spirit },
    {
      id: "damage",
      label: style === "caster" ? "Daño de hechizos y esbirros" : "Daño de ataques",
      a: damageA.length === 0 ? "nada" : `${damageA.length} ${damageA.length === 1 ? "línea" : "líneas"}`,
      b: damageB.length === 0 ? "nada" : `${damageB.length} ${damageB.length === 1 ? "línea" : "líneas"}`,
      winner: winnerOf(damageA.length, damageB.length),
      weight: weights.damage,
    },
    { id: "es", label: "Escudo de energía", a: plain(ra.energyShield), b: plain(rb.energyShield), winner: winnerOf(ra.energyShield, rb.energyShield), weight: weights.es },
    { id: "armour", label: "Armadura", a: plain(ra.armour), b: plain(rb.armour), winner: winnerOf(ra.armour, rb.armour), weight: weights.armour },
    { id: "evasion", label: "Evasión", a: plain(ra.evasion), b: plain(rb.evasion), winner: winnerOf(ra.evasion, rb.evasion), weight: weights.evasion },
    { id: "mana", label: "Maná máximo", a: amount(ra.mana), b: amount(rb.mana), winner: winnerOf(ra.mana, rb.mana), weight: weights.mana },
    { id: "regen", label: "Vida por segundo", a: amount(ra.lifeRegen), b: amount(rb.lifeRegen), winner: winnerOf(ra.lifeRegen, rb.lifeRegen), weight: weights.regen },
    { id: "attr", label: "Atributos", a: amount(ra.attributes), b: amount(rb.attributes), winner: winnerOf(ra.attributes, rb.attributes), weight: weights.attr },
  ];
  // Solo se enseñan las filas en las que alguna de las dos piezas da algo.
  const rows = candidates.filter((row) => row.a !== "nada" || row.b !== "nada");

  const score = (side: CompareSide) => rows.reduce((total, row) => total + (row.winner === side ? row.weight : 0), 0);
  const scoreA = score("a");
  const scoreB = score("b");
  // Un punto de diferencia es una fila menor: no basta para dar un ganador.
  const winner: CompareSide | "tie" = Math.abs(scoreA - scoreB) <= 1 ? "tie" : scoreA > scoreB ? "a" : "b";

  const wastedFor = (reading: Reading) =>
    style === "caster" ? [...reading.attackLines, ...reading.accuracyLines] : reading.spellLines;
  const wasted = { a: wastedFor(ra), b: wastedFor(rb) };

  const wonBy = (side: CompareSide) =>
    rows
      .filter((row) => row.winner === side)
      .sort((x, y) => y.weight - x.weight)
      .map((row) => row.label.toLocaleLowerCase("es"));
  const name = { a: a.name, b: b.name };
  const reasons: string[] = [];
  if (winner === "tie") {
    reasons.push("Están muy parejas: ninguna gana con claridad.");
    for (const side of ["a", "b"] as const) {
      const won = wonBy(side);
      if (won.length > 0) reasons.push(`«${name[side]}» da más ${joinList(won)}.`);
    }
  } else {
    const loser: CompareSide = winner === "a" ? "b" : "a";
    reasons.push(`«${name[winner]}» te da más ${joinList(wonBy(winner))}.`);
    const lost = wonBy(loser);
    if (lost.length > 0) reasons.push(`Pierdes ${joinList(lost)}, que da «${name[loser]}».`);
  }

  const slotOf = (item: Item) => (item.slot === "ring2" ? "ring1" : item.slot);
  const slotWarning =
    slotOf(a) !== slotOf(b) ? "No van en el mismo hueco: puedes llevar las dos a la vez, no hace falta elegir." : null;

  return { winner, scoreA, scoreB, rows, wasted, reasons, slotWarning };
}

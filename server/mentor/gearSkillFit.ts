/**
 * «¿Le sirve a mi habilidad?» (Mentor de equipo, tarea 18 del plan).
 *
 * El comparador de piezas solo sabe de tres estilos (hechizos, cuerpo a
 * cuerpo, arco). Con los datos de gemas se puede afinar: cada habilidad lleva
 * sus etiquetas del juego (Ataque, Hechizo, Proyectil, Rayo…) y una línea de
 * daño de una pieza dice a qué se aplica («a los ataques», «de hechizos», «de
 * hielo»). Aquí se casan las dos cosas para la habilidad principal del
 * personaje.
 *
 * Solo se afirma lo que el propio texto de la línea deja claro. Una línea que
 * no dice a qué se aplica (o que habla de daño físico, que casi todos los
 * ataques hacen aunque la gema no lleve esa etiqueta) no se juzga: se calla.
 */
import type { Item } from "../../shared/domain.js";

type Lang = "es" | "en";

/** Lo que una línea puede pedirle a la habilidad, con la etiqueta del juego que lo cumple. */
type Need = "Ataque" | "Hechizo" | "Esbirro" | "Proyectil" | "Cuerpo a cuerpo" | "Fuego" | "Hielo" | "Rayo" | "Caos";

const ELEMENTS: ReadonlyArray<{ need: Need; test: RegExp }> = [
  { need: "Fuego", test: /\bfuego\b|\bfire\b/i },
  { need: "Hielo", test: /\bhielo\b|\bfr[ií]o\b|\bcold\b/i },
  { need: "Rayo", test: /\brayo\b|\blightning\b/i },
  { need: "Caos", test: /\bcaos\b|\bchaos\b/i },
];

/** Líneas que hablan de pegar: daño, velocidad, críticos, precisión o nivel de habilidades. */
const OFFENCE_LINE =
  /daño|damage|velocidad de ataque|attack speed|velocidad de lanzamiento|cast speed|cr[ií]tic|precisi[oó]n|accuracy|al nivel de|to level of/i;
/** Lo que protege o no es del jugador no se juzga aquí. */
const NOT_OFFENCE = /resistenc|resistanc|recibid|taken|aliados|allies|presencia|presence/i;
const MINION = /esbirros?|minions?/i;
const ATTACK = /\bataques?\b|\battacks?\b|precisi[oó]n|accuracy/i;
const SPELL = /\bhechizos?\b|\bspells?\b|velocidad de lanzamiento|cast speed/i;
const PROJECTILE = /proyectil|projectile/i;
const MELEE = /cuerpo a cuerpo|melee/i;
/** «Añade de 3 a 7 de daño de fuego a los ataques»: el elemento es lo que se añade, no una condición. */
const ADDED = /^\s*(?:añade|agrega|adds)\b/i;
const ROLL_RANGE = /\((-?\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)/g;

/** Lo que la línea exige de la habilidad para aplicarse. Vacío: no lo dice, o no es de pegar. */
export function lineNeeds(rawLine: string): Need[] {
  const line = rawLine.replace(ROLL_RANGE, "").replace(/\s+/g, " ").trim();
  if (!OFFENCE_LINE.test(line) || NOT_OFFENCE.test(line)) return [];
  // Lo de esbirros es para ellos: da igual que hable de ataques o de fuego.
  if (MINION.test(line)) return ["Esbirro"];
  const needs: Need[] = [];
  if (ATTACK.test(line)) needs.push("Ataque");
  if (SPELL.test(line)) needs.push("Hechizo");
  if (PROJECTILE.test(line)) needs.push("Proyectil");
  if (MELEE.test(line)) needs.push("Cuerpo a cuerpo");
  if (!ADDED.test(line)) {
    for (const element of ELEMENTS) if (element.test.test(line)) needs.push(element.need);
  }
  return needs;
}

const NEED_WORDS: Record<Lang, Record<Need, { kind: string; isNot: string }>> = {
  es: {
    Ataque: { kind: "es para ataques", isNot: "no es un ataque" },
    Hechizo: { kind: "es para hechizos", isNot: "no es un hechizo" },
    Esbirro: { kind: "es para esbirros", isNot: "no es de esbirros" },
    Proyectil: { kind: "es para proyectiles", isNot: "no lanza proyectiles" },
    "Cuerpo a cuerpo": { kind: "es para golpes cuerpo a cuerpo", isNot: "no pega cuerpo a cuerpo" },
    Fuego: { kind: "sube solo lo de fuego", isNot: "no es de fuego" },
    Hielo: { kind: "sube solo lo de hielo", isNot: "no es de hielo" },
    Rayo: { kind: "sube solo lo de rayo", isNot: "no es de rayo" },
    Caos: { kind: "sube solo lo de caos", isNot: "no es de caos" },
  },
  en: {
    Ataque: { kind: "it's for attacks", isNot: "isn't an attack" },
    Hechizo: { kind: "it's for spells", isNot: "isn't a spell" },
    Esbirro: { kind: "it's for minions", isNot: "isn't a minion skill" },
    Proyectil: { kind: "it's for projectiles", isNot: "doesn't fire projectiles" },
    "Cuerpo a cuerpo": { kind: "it's for melee hits", isNot: "isn't melee" },
    Fuego: { kind: "it only raises fire", isNot: "isn't fire" },
    Hielo: { kind: "it only raises cold", isNot: "isn't cold" },
    Rayo: { kind: "it only raises lightning", isNot: "isn't lightning" },
    Caos: { kind: "it only raises chaos", isNot: "isn't chaos" },
  },
};

const WORDS = {
  es: {
    reaches: (skill: string, line: string, where: string) => `A ${skill} sí le llega «${line}», ${where}.`,
    misses: (skill: string, line: string, where: string, kind: string, isNot: string) =>
      `A ${skill} no le llega «${line}», ${where}: ${kind} y ${skill} ${isNot}.`,
    lost: (skill: string, line: string) => `Con el cambio pierdes «${line}», de la que llevas, que a ${skill} sí le llegaba.`,
    found: "de la encontrada",
  },
  en: {
    reaches: (skill: string, line: string, where: string) => `${skill} does get “${line}”, ${where}.`,
    misses: (skill: string, line: string, where: string, kind: string, isNot: string) =>
      `${skill} doesn't get “${line}”, ${where}: ${kind} and ${skill} ${isNot}.`,
    lost: (skill: string, line: string) => `With the swap you lose “${line}”, from the one you wear, which ${skill} did get.`,
    found: "from the found item",
  },
} as const;

export interface SkillFitLine {
  /** De qué pieza es la línea. */
  side: "found" | "worn";
  /** ¿Se le aplica a la habilidad? */
  reaches: boolean;
  texto: string;
}

const ELEMENT_TAGS: ReadonlySet<string> = new Set(["Fuego", "Hielo", "Rayo", "Caos"]);

/**
 * Qué líneas de las dos piezas le llegan a la habilidad y cuáles no. `tags`
 * son las etiquetas de la gema tal como vienen en los datos (en español).
 */
export function skillFitLines(
  skillName: string,
  tags: readonly string[],
  found: Pick<Item, "modifiers">,
  worn: Pick<Item, "modifiers"> | null,
  lang: Lang = "es",
): SkillFitLine[] {
  const words = WORDS[lang];
  const has = new Set(tags);
  // Sin ningún elemento en la gema no se sabe con qué pega: el elemento no se juzga.
  const knowsElement = tags.some((tag) => ELEMENT_TAGS.has(tag));
  const out: SkillFitLine[] = [];
  const seen = new Set<string>();
  const read = (item: Pick<Item, "modifiers">, side: SkillFitLine["side"]) => {
    for (const modifier of item.modifiers) {
      for (const raw of modifier.text.split("\n")) {
        const line = raw.replace(ROLL_RANGE, "").replace(/\s+/g, " ").trim();
        const needs = lineNeeds(line).filter((need) => knowsElement || !ELEMENT_TAGS.has(need));
        if (line.length === 0 || needs.length === 0 || seen.has(`${side}:${line}`)) continue;
        seen.add(`${side}:${line}`);
        const missing = needs.find((need) => !has.has(need));
        // De la que lleva solo importa lo que se va y le servía: perder lo que no le llegaba no es perder.
        if (side === "worn" && missing !== undefined) continue;
        const texto =
          side === "worn"
            ? words.lost(skillName, line)
            : missing === undefined
              ? words.reaches(skillName, line, words.found)
              : words.misses(skillName, line, words.found, NEED_WORDS[lang][missing].kind, NEED_WORDS[lang][missing].isNot);
        out.push({ side, reaches: missing === undefined, texto });
      }
    }
  };
  read(found, "found");
  if (worn) read(worn, "worn");
  return out;
}

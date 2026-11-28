import type { Item, Resistances } from "./domain.js";

/**
 * Resistencias que suman unas piezas PEGADAS desde el juego, leídas de sus
 * mods. Es la lectura de las guías y del comparador de piezas («¿Cuál de estas
 * dos es mejor?», «¿Me sirve lo que he encontrado?»): cuenta cualquier pieza
 * que se le pase, esté puesta o no.
 *
 * No es `itemResistances.ts`: aquella suma solo lo que el personaje lleva
 * EQUIPADO y descarta las auras, para explicarle de dónde sale el número de su
 * hoja. Vive aquí, en `shared`, porque el Mentor de equipo (servidor) compara
 * con las mismas reglas que la web.
 */

const ELEMENTS = ["fire", "cold", "lightning"] as const;
type Element = (typeof ELEMENTS)[number];

/** El texto avanzado escribe la tirada con su rango: `+28(25-30)%`. */
const ROLL_RANGE = /\((-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/g;

/**
 * Elementos a los que afecta una línea de resistencia, o null si la línea no
 * es una resistencia plana. Se ignoran las resistencias MÁXIMAS, que no suman
 * a la resistencia actual.
 */
function resistanceTargets(line: string): Array<Element | "chaos"> | null {
  const text = line.toLocaleLowerCase("es");
  if (!/resistanc|resistencia/.test(text)) return null;
  if (/maximum|máxima|maxima/.test(text)) return null;
  if (/all elemental|todas las resistencias elementales|resistencias elementales/.test(text)) {
    return [...ELEMENTS];
  }
  const found: Array<Element | "chaos"> = [];
  if (/fire|fuego/.test(text)) found.push("fire");
  if (/cold|frío|frio|hielo/.test(text)) found.push("cold");
  if (/lightning|rayo/.test(text)) found.push("lightning");
  if (/chaos|caos/.test(text)) found.push("chaos");
  return found.length > 0 ? found : null;
}

/**
 * Valor plano de una línea `+12% to Fire Resistance` / `+12% a la resistencia
 * al fuego`. Exige el número con `%` al principio para no confundir frases
 * como «penetra un 10% de la resistencia».
 */
function resistanceValue(line: string): number | null {
  const clean = line.replace(ROLL_RANGE, "");
  const match = /^\s*([+-]\d+(?:\.\d+)?)%\s+(?:to|a)\b/i.exec(clean);
  return match ? Number(match[1]) : null;
}

/** Suma de resistencias de las piezas pegadas (solo mods de esas piezas). */
export function resistancesFromPastedItems(items: readonly Item[]): Resistances {
  const totals = { fire: 0, cold: 0, lightning: 0, chaos: 0 };
  for (const item of items) {
    for (const modifier of item.modifiers) {
      for (const line of modifier.text.split("\n")) {
        const targets = resistanceTargets(line);
        if (targets === null) continue;
        const value = resistanceValue(line);
        if (value === null) continue;
        for (const target of targets) totals[target] += value;
      }
    }
  }
  return totals;
}

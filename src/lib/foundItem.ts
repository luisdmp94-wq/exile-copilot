/**
 * «¿Me sirve lo que he encontrado?» (28-11-2026).
 *
 * La idea viene de la versión de septiembre de la web (rama
 * `crafting-real-item-coach`, `QuickEquipmentComparison`): el jugador pega UNA
 * pieza que le ha caído y la web la mide con la que lleva puesta en ese hueco.
 * Allí la respuesta la redactaba una IA y nunca decía cuál era mejor. Aquí
 * decide el comparador por reglas de «¿Cuál de estas dos es mejor?»
 * (`itemCompare.ts`): una respuesta, sin gastar IA.
 *
 * De septiembre se conserva además la comprobación de requisitos: una pieza
 * que pide más nivel o más atributo del que tiene el personaje no se la puede
 * poner, por buena que sea.
 */
import { readCharacterLevel, type CharacterProfile, type Item } from "@shared/domain.js";
import type { CompareResult } from "./itemCompare";

export type FoundLang = "es" | "en";

const GEAR_SLOTS: ReadonlySet<Item["slot"]> = new Set([
  "weapon",
  "offhand",
  "helmet",
  "body",
  "gloves",
  "boots",
  "belt",
  "amulet",
  "ring1",
  "ring2",
]);

const isRing = (slot: Item["slot"]) => slot === "ring1" || slot === "ring2";

/** ¿Es una pieza que se lleva puesta (arma, armadura o joyería)? */
export function isWearable(item: Pick<Item, "slot">): boolean {
  return GEAR_SLOTS.has(item.slot);
}

/** ¿Tiene el personaje alguna pieza puesta con la que comparar? */
export function hasWornGear(profile: Pick<CharacterProfile, "items"> | null | undefined): boolean {
  return profile?.items.some(isWearable) ?? false;
}

/**
 * Las piezas que la encontrada sustituiría. Un anillo puede ir en cualquiera
 * de los dos huecos de anillo: salen los dos. Si solo lleva un anillo, queda
 * un hueco libre y no sustituye a ninguno: lista vacía, como cualquier hueco
 * sin pieza.
 */
export function wornInSlot(profile: Pick<CharacterProfile, "items">, found: Pick<Item, "slot" | "id">): Item[] {
  if (!isWearable(found)) return [];
  if (isRing(found.slot)) {
    const rings = profile.items.filter((item) => item.id !== found.id && isRing(item.slot));
    return rings.length >= 2 ? rings.slice(0, 2) : [];
  }
  return profile.items.filter((item) => item.id !== found.id && item.slot === found.slot);
}

const WORDS = {
  es: {
    level: (need: number, have: number) => `Pide nivel ${need} y eres nivel ${have}.`,
    attribute: (need: number, name: string, have: number) => `Pide ${need} de ${name} y tienes ${have}.`,
    unknownAttribute: (need: number, name: string) => `Pide ${need} de ${name}: mira en el juego si llegas.`,
    str: "fuerza",
    dex: "destreza",
    int: "inteligencia",
  },
  en: {
    level: (need: number, have: number) => `It needs level ${need} and you are level ${have}.`,
    attribute: (need: number, name: string, have: number) => `It needs ${need} ${name} and you have ${have}.`,
    unknownAttribute: (need: number, name: string) => `It needs ${need} ${name}: check in game that you have it.`,
    str: "strength",
    dex: "dexterity",
    int: "intelligence",
  },
} as const;

export interface RequirementCheck {
  /** Lo que el personaje no cumple, con sus números: no se la puede poner. */
  blocked: string[];
  /** Lo que la pieza pide y la web no puede comprobar (atributo sin apuntar). */
  unchecked: string[];
}

/**
 * ¿Puede ponérsela? Solo afirma «no» con los dos números delante: el que pide
 * la pieza y el que tiene el personaje. Un atributo sin apuntar no bloquea.
 */
export function checkRequirements(
  found: Pick<Item, "requirements">,
  profile: Pick<CharacterProfile, "level" | "levelSource" | "attributes">,
  lang: FoundLang = "es",
): RequirementCheck {
  const words = WORDS[lang];
  const blocked: string[] = [];
  const unchecked: string[] = [];
  const requirements = found.requirements;
  if (!requirements) return { blocked, unchecked };
  const level = readCharacterLevel(profile);
  if (requirements.level !== undefined && level.known && requirements.level > level.level) {
    blocked.push(words.level(requirements.level, level.level));
  }
  for (const key of ["str", "dex", "int"] as const) {
    const need = requirements[key];
    if (need === undefined || need <= 0) continue;
    const have = profile.attributes[key];
    if (have === null) unchecked.push(words.unknownAttribute(need, words[key]));
    else if (need > have) blocked.push(words.attribute(need, words[key], have));
  }
  return { blocked, unchecked };
}

export type FoundVerdict =
  /** No cumple los requisitos: da igual lo buena que sea. */
  | "blocked"
  /** No lleva nada en ese hueco: cualquier pieza suma. */
  | "empty"
  | "better"
  | "worse"
  | "tie";

/**
 * La respuesta en una palabra. `result` compara la puesta (A) con la
 * encontrada (B); sin pieza puesta no hay comparación y va `null`.
 */
export function foundVerdict(requirements: RequirementCheck, result: Pick<CompareResult, "winner"> | null): FoundVerdict {
  if (requirements.blocked.length > 0) return "blocked";
  if (result === null) return "empty";
  return result.winner === "b" ? "better" : result.winner === "a" ? "worse" : "tie";
}

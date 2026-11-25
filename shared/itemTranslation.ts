/**
 * Objetos copiados de un cliente en español → el inglés que lee Path of
 * Building 2. Las tablas salen de poe2db (`npm run data:items-en`); aquí solo
 * se aplican. Sin DOM ni Node.
 */
import type { Item } from "./domain.js";

export interface ItemTranslations {
  /** Plantilla en español (minúsculas, números como #) → plantilla en inglés. */
  mods: Record<string, string>;
  bases: Record<string, string>;
  uniques: Record<string, string>;
}

/** Un rango de poe2db «(5—8)» o un número suelto «25», «1.5», «0,5». */
const NUMBER = /\((-?\d+(?:[.,]\d+)?)\s*[—–-]\s*(-?\d+(?:[.,]\d+)?)\)|(\d+(?:[.,]\d+)?)/g;

/**
 * Línea → plantilla: números como «#» (un rango de poe2db cuenta como uno) y,
 * para comparar, en minúsculas y sin espacios dobles.
 */
export function itemTemplate(line: string): { key: string; text: string; numbers: string[] } | null {
  const clean = line.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const numbers: string[] = [];
  const text = clean.replace(NUMBER, (_match, from: string | undefined, to: string | undefined, single: string | undefined) => {
    numbers.push((single ?? `${from}~${to}`).replace(/,/g, "."));
    return "#";
  });
  return { key: text.toLocaleLowerCase("es"), text, numbers };
}

function fill(template: string, values: string[]): string {
  let index = 0;
  return template.replace(/#/g, () => values[index++] ?? "#");
}

/**
 * Lo que el juego añade a una línea y no es parte del modificador: el rango de
 * la tirada con Ctrl+Alt+C («+233(168-236)»), marcas como «(implícito)» o
 * «— Valor fijo». Y dos palabras que a veces se escriben de otra forma.
 */
function normaliseGameLine(line: string): string {
  return line
    .replace(/(\d+(?:[.,]\d+)?)\(\s*-?\d+(?:[.,]\d+)?\s*[-–—]\s*-?\d+(?:[.,]\d+)?\s*\)/g, "$1")
    .replace(/\s*\((?:implícito|implicit|encantado|enchanted|runa|rune|creado|crafted|fracturado|fractured|desecrado|desecrated)\)\s*$/i, "")
    .replace(/\s+(?:—|–|-)\s*(?:valor fijo|fixed)\s*$/i, "")
    .replace(/^Añade de /i, "Agrega de ")
    .replace(/\bfrío\b/gi, "hielo")
    .replace(/\s+/g, " ")
    .trim();
}

/** Una línea de modificador en español → inglés, o null si no hay plantilla. */
export function translateModLine(line: string, translations: ItemTranslations): string | null {
  const clean = normaliseGameLine(line);
  const values: string[] = [];
  const key = clean
    .replace(NUMBER, (_match, from: string | undefined, to: string | undefined, single: string | undefined) => {
      values.push((single ?? from ?? "").replace(",", "."));
      void to;
      return "#";
    })
    .toLocaleLowerCase("es");
  const english = translations.mods[key];
  return english === undefined ? null : fill(english, values);
}

const RARITY_EN: Record<Item["rarity"], string> = {
  normal: "NORMAL",
  magic: "MAGIC",
  rare: "RARE",
  unique: "UNIQUE",
  currency: "NORMAL",
  gem: "NORMAL",
  other: "RARE",
};

export interface TranslatedItem {
  text: string;
  /** Líneas que se quedaron en español (PoB2 no las leerá). */
  untranslated: number;
  /** La base no se pudo traducir: PoB2 no sabrá qué objeto es. */
  unknownBase: boolean;
}

/**
 * La base en inglés. Un objeto mágico lleva los afijos en el nombre («Maza de
 * procesión de victoria»): se busca la base más larga que aparezca dentro.
 */
export function englishBase(item: Pick<Item, "baseType" | "name">, translations: ItemTranslations): string | null {
  const exact = translations.bases[item.baseType] ?? translations.bases[item.name];
  if (exact) return exact;
  const haystack = `${item.baseType} ${item.name}`.toLocaleLowerCase("es");
  let best: string | null = null;
  for (const spanish of Object.keys(translations.bases)) {
    if (spanish.length > (best?.length ?? 0) && haystack.includes(spanish.toLocaleLowerCase("es"))) best = spanish;
  }
  return best ? translations.bases[best] : null;
}

function plainName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Objeto leído de un texto en español → texto en inglés para PoB2. */
export function itemToEnglish(
  item: Item,
  translations: ItemTranslations,
  /** Gemas en español (sin tildes, minúsculas) → inglés, para «Otorga la habilidad». */
  gems: Record<string, string> = {},
): TranslatedItem {
  let untranslated = 0;
  const base = englishBase(item, translations);
  const grantedSkill = (line: string): string | null => {
    const match = /^(?:Otorga la habilidad|Grants Skill)\s*:\s*(?:Nivel|Level)\s+(\d+)\s+(.+)$/i.exec(line.trim());
    if (!match) return null;
    const english = gems[plainName(match[2])];
    return english ? `Grants Skill: Level ${match[1]} ${english}` : null;
  };
  const lines = [`Rarity: ${RARITY_EN[item.rarity]}`];
  if (item.rarity === "unique") lines.push(translations.uniques[item.name] ?? item.name);
  else if (item.rarity === "rare") lines.push(item.name);
  lines.push(base ?? item.baseType);
  if (item.quality) lines.push(`Quality: +${item.quality}%`);
  const translate = (text: string) =>
    text
      .split("\n")
      .map((line) => {
        const english = grantedSkill(line) ?? translateModLine(line, translations);
        if (english === null) untranslated++;
        return english ?? line;
      })
      .join("\n");
  // Runas y encantamientos van con los implícitos, con su marca, como en PoB2.
  const prefix: Partial<Record<string, string>> = { enchant: "{enchant}", rune: "{rune}" };
  const implicit = item.modifiers.filter((modifier) => modifier.kind === "implicit" || modifier.kind === "enchant" || modifier.kind === "rune");
  const explicit = item.modifiers.filter((modifier) => !implicit.includes(modifier) && modifier.kind !== "quality");
  const implicitLines = implicit
    .flatMap((modifier) => translate(modifier.text).split("\n").map((line) => `${prefix[modifier.kind] ?? ""}${line}`))
    .filter((line) => line.replace(/^\{\w+\}/, "").trim().length > 0);
  lines.push(`Implicits: ${implicitLines.length}`, ...implicitLines);
  lines.push(...explicit.map((modifier) => translate(modifier.text)).join("\n").split("\n").filter(Boolean));
  if (item.craftingState?.corrupted) lines.push("Corrupted");
  return { text: lines.join("\n"), untranslated, unknownBase: base === null };
}

// ---------------------------------------------------------------------------
// Inglés → español: lo que trae un código de Path of Building 2
// ---------------------------------------------------------------------------

interface ReverseTables {
  mods: Map<string, string>;
  bases: Map<string, string>;
  uniques: Map<string, string>;
}

const REVERSE = new WeakMap<ItemTranslations, ReverseTables>();

/** Las mismas tablas, al revés. Si dos textos en español dan el mismo inglés, vale el primero. */
function reverseOf(translations: ItemTranslations): ReverseTables {
  const cached = REVERSE.get(translations);
  if (cached) return cached;
  const flip = (table: Record<string, string>, key: (english: string) => string) => {
    const map = new Map<string, string>();
    for (const [spanish, english] of Object.entries(table)) {
      if (!map.has(key(english))) map.set(key(english), spanish);
    }
    return map;
  };
  const tables: ReverseTables = {
    mods: flip(translations.mods, (english) => english.toLowerCase()),
    bases: flip(translations.bases, (english) => english.toLowerCase()),
    uniques: flip(translations.uniques, (english) => english.toLowerCase()),
  };
  REVERSE.set(translations, tables);
  return tables;
}

/** Solo si la línea empieza por letra: «+25% a la resistencia…» va en minúscula, como en el juego. */
const capitalised = (text: string) => text.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("es"));

/** Una línea de modificador en inglés → español, o null si no hay plantilla. */
export function spanishModLine(line: string, translations: ItemTranslations): string | null {
  const values: string[] = [];
  const key = line
    .replace(/\s+/g, " ")
    .trim()
    .replace(NUMBER, (match) => {
      values.push(match);
      return "#";
    })
    .toLowerCase();
  const spanish = reverseOf(translations).mods.get(key);
  // Las plantillas se guardan en minúsculas: la frase empieza con mayúscula.
  return spanish === undefined ? null : capitalised(fill(spanish, values));
}

/**
 * Un objeto leído de un código de PoB2 (siempre en inglés) con la base, el
 * nombre del único y los modificadores en español, como los enseña el cliente
 * en español. Lo que no está en las tablas se queda como venía; el nombre de
 * un objeto raro («Horror Visage») no está en ninguna. `rawText` no se toca:
 * es lo que PoB2 vuelve a leer para calcular.
 */
export function itemToSpanish(
  item: Item,
  translations: ItemTranslations,
  /** Gemas en inglés (minúsculas) → español, para «Grants Skill». */
  gems: Record<string, string> = {},
): Item {
  const tables = reverseOf(translations);
  const base = tables.bases.get(item.baseType.trim().toLowerCase()) ?? null;
  const name =
    item.rarity === "unique"
      ? (tables.uniques.get(item.name.trim().toLowerCase()) ?? item.name)
      : base !== null && item.name.trim().toLowerCase() === item.baseType.trim().toLowerCase()
        ? base
        : item.name;
  const line = (text: string): string => {
    const granted = /^Grants Skill\s*:\s*Level\s+(\d+)\s+(.+)$/i.exec(text.trim());
    if (granted) {
      const spanish = gems[granted[2]!.trim().toLowerCase()];
      return spanish ? `Otorga la habilidad: Nivel ${granted[1]} ${spanish}` : text;
    }
    return spanishModLine(text, translations) ?? text;
  };
  return {
    ...item,
    name,
    baseType: base ?? item.baseType,
    modifiers: item.modifiers.map((modifier) => ({
      ...modifier,
      text: modifier.text.split("\n").map(line).join("\n"),
    })),
  };
}

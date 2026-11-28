import type { Attributes, Item } from "./domain.js";

/**
 * «Si me quito esto, ¿se me cae otra cosa?» (28-11-2026).
 *
 * Viene de la versión de septiembre de la web (rama `crafting-real-item-coach`,
 * `equipmentAttributeSwap.ts`). Una pieza puede dar fuerza, destreza o
 * inteligencia; al cambiarla por otra que da menos, el personaje pierde ese
 * atributo y otra pieza que lleva puesta puede quedarse sin su requisito.
 *
 * Solo habla con todos los números delante: lo que da cada pieza, lo que tiene
 * el personaje y lo que pide la otra pieza. Si una línea de atributos no se
 * sabe leer, o el personaje no tiene apuntado ese atributo, se calla: es un
 * aviso para mirar en el juego, no un cálculo de sus atributos finales (las
 * gemas también piden atributo y la web no sabe cuánto).
 */

export type AttributeKey = "str" | "dex" | "int";
export type SwapLang = "es" | "en";

const KEYS: readonly AttributeKey[] = ["str", "dex", "int"];

const NAMES: Record<AttributeKey, { es: string; en: string; test: RegExp }> = {
  str: { es: "fuerza", en: "strength", test: /fuerza|strength/i },
  dex: { es: "destreza", en: "dexterity", test: /destreza|dexterity/i },
  int: { es: "inteligencia", en: "intelligence", test: /inteligencia|intelligence/i },
};

/** Cualquier línea que hable de atributos del personaje. */
const ATTRIBUTE_LINE = /fuerza|destreza|inteligencia|strength|dexterity|intelligence|atributos|attributes/i;
/** Esta cambia lo que PIDE la pieza, no lo que tiene el personaje. */
const REQUIREMENT_LINE = /requisitos? de atributos?|attribute requirements?/i;
/** «+17(15-20) a la destreza», «+9 to Strength and Intelligence», «+6 a todos los atributos». */
const FLAT_LINE = /^\+(\d+)(?:\([^)]*\))?\s+(?:a|to)\s+(.+?)\.?$/i;
const ALL_ATTRIBUTES = /^(?:todos los atributos|all attributes)$/i;
/** Lo que puede acompañar a los nombres en una línea plana («a la fuerza y a la inteligencia»). */
const FILLER = /\b(?:a|la|el|y|and|e|to)\b|,/gi;

/**
 * Atributo plano que da una pieza. `null` = hay una línea de atributos que no
 * se sabe leer (un porcentaje, una condición): no se supone que sea cero.
 */
export function flatAttribute(item: Pick<Item, "modifiers">, key: AttributeKey): number | null {
  let total = 0;
  for (const modifier of item.modifiers) {
    for (const raw of modifier.text.split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line || !ATTRIBUTE_LINE.test(line) || REQUIREMENT_LINE.test(line)) continue;
      const match = FLAT_LINE.exec(line);
      if (!match) return null;
      const what = (match[2] ?? "").trim();
      if (ALL_ATTRIBUTES.test(what)) {
        total += Number(match[1]);
        continue;
      }
      // Lo que queda tras quitar los nombres tiene que ser nada: si sobra
      // texto («a la fuerza de los aliados»), no es una línea plana tuya.
      const rest = KEYS.reduce((text, name) => text.replace(new RegExp(NAMES[name].test.source, "gi"), ""), what)
        .replace(FILLER, "")
        .trim();
      if (rest !== "") return null;
      if (NAMES[key].test.test(what)) total += Number(match[1]);
    }
  }
  return total;
}

export interface AttributeRisk {
  attribute: AttributeKey;
  /** Lo que tiene ahora el personaje, con la pieza vieja puesta. */
  have: number;
  /** Lo que pierde al cambiar (lo que daba la vieja menos lo que da la nueva). */
  loss: number;
  /** Con lo que se queda. */
  remaining: number;
  /** La pieza que dejaría de cumplir su requisito, y cuánto pide. */
  itemName: string;
  required: number;
  /** true si la que se queda sin requisito es la propia pieza nueva. */
  isFound: boolean;
}

/**
 * Requisitos que el cambio dejaría por debajo. `worn` es la pieza que se
 * quita, `found` la que se pone y `equipped` todo lo que lleva el personaje.
 */
export function attributeSwapRisks(
  worn: Item,
  found: Item,
  equipped: readonly Item[],
  attributes: Attributes,
): AttributeRisk[] {
  const risks: AttributeRisk[] = [];
  for (const attribute of KEYS) {
    const have = attributes[attribute];
    const before = flatAttribute(worn, attribute);
    const after = flatAttribute(found, attribute);
    if (have === null || before === null || after === null) continue;
    const loss = before - after;
    if (loss <= 0) continue;
    const remaining = have - loss;
    const others = equipped.filter((item) => item.id !== worn.id && item.id !== found.id);
    for (const item of [...others, found]) {
      const required = item.requirements?.[attribute];
      // Solo lo que hoy cumple y dejaría de cumplir: lo que ya no cumplía es otro aviso.
      if (required === undefined || required <= remaining || required > have) continue;
      risks.push({ attribute, have, loss, remaining, itemName: item.name, required, isFound: item.id === found.id });
    }
  }
  return risks;
}

/** El aviso en una frase, con sus cuatro números. */
export function attributeRiskText(risk: AttributeRisk, wornName: string, lang: SwapLang = "es"): string {
  const name = NAMES[risk.attribute][lang];
  if (lang === "en") {
    const who = risk.isFound ? "the new item itself" : `“${risk.itemName}”`;
    return `“${wornName}” gives you ${name}: without it you drop from ${risk.have} to ${risk.remaining}, and ${who} needs ${risk.required}. Check it in game before swapping.`;
  }
  const who = risk.isFound ? "la propia pieza nueva" : `«${risk.itemName}»`;
  return `«${wornName}» te da ${name}: sin ella bajas de ${risk.have} a ${risk.remaining}, y ${who} pide ${risk.required}. Míralo en el juego antes de cambiarla.`;
}

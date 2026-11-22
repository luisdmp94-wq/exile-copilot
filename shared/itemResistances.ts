import type { Item, ResistanceKind } from "./domain.js";

/**
 * Resistencias que suman las piezas equipadas, leídas de sus mods (español e
 * inglés del cliente). Es solo lo que da el EQUIPO: el valor del juego
 * (tecla C) añade pasivas y penalizaciones, así que esto nunca sustituye a lo
 * que el jugador ve; sirve para decirle de dónde sale cada número.
 *
 * Los mods de aura («Los aliados que están en tu presencia tienen…») son para
 * los aliados, no para el personaje: no cuentan.
 */
export type GearResistances = Record<ResistanceKind, number> & { found: boolean };

const ES_KIND: Record<string, ResistanceKind> = {
  fuego: "fire",
  hielo: "cold",
  rayo: "lightning",
  caos: "chaos",
};
const EN_KIND: Record<string, ResistanceKind> = {
  fire: "fire",
  cold: "cold",
  lightning: "lightning",
  chaos: "chaos",
};

/** «+14(11-15)%» o «+14%»: el valor que tiene la pieza, sin el rango. */
const VALUE = String.raw`([+-]?\d+)(?:\([^)]*\))?%`;

const ES_SINGLE = new RegExp(String.raw`^${VALUE}\s+a\s+la\s+resistencia\s+al\s+(fuego|hielo|rayo|caos)$`, "i");
const ES_PAIR = new RegExp(
  String.raw`^${VALUE}\s+a\s+las\s+resistencias\s+al\s+(fuego|hielo|rayo)\s+y\s+al\s+(fuego|hielo|rayo)$`,
  "i",
);
const ES_ALL = new RegExp(String.raw`^${VALUE}\s+a\s+todas\s+las\s+resistencias\s+elementales$`, "i");
const EN_SINGLE = new RegExp(String.raw`^${VALUE}\s+to\s+(fire|cold|lightning|chaos)\s+resistance$`, "i");
const EN_PAIR = new RegExp(String.raw`^${VALUE}\s+to\s+(fire|cold|lightning)\s+and\s+(fire|cold|lightning)\s+resistances$`, "i");
const EN_ALL = new RegExp(String.raw`^${VALUE}\s+to\s+all\s+elemental\s+resistances$`, "i");

/** Los mods de aura o de esbirros no protegen al personaje. */
const NOT_FOR_YOU = /aliad|esbirro|presencia|all(?:y|ies)|minion|presence/i;

const EQUIPPED_SLOTS = new Set<Item["slot"]>([
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

export function resistancesFromItems(items: readonly Item[]): GearResistances {
  const total: GearResistances = { fire: 0, cold: 0, lightning: 0, chaos: 0, found: false };
  const add = (kind: ResistanceKind | undefined, value: string | undefined) => {
    if (!kind || value === undefined) return;
    total[kind] += Number.parseInt(value, 10);
    total.found = true;
  };

  for (const item of items) {
    if (!EQUIPPED_SLOTS.has(item.slot)) continue;
    for (const modifier of item.modifiers) {
      for (const rawLine of modifier.text.split("\n")) {
        const line = rawLine.trim();
        if (!line || NOT_FOR_YOU.test(line)) continue;
        let match = ES_SINGLE.exec(line);
        if (match) {
          add(ES_KIND[match[2]!.toLowerCase()], match[1]);
          continue;
        }
        match = EN_SINGLE.exec(line);
        if (match) {
          add(EN_KIND[match[2]!.toLowerCase()], match[1]);
          continue;
        }
        match = ES_PAIR.exec(line);
        if (match) {
          add(ES_KIND[match[2]!.toLowerCase()], match[1]);
          add(ES_KIND[match[3]!.toLowerCase()], match[1]);
          continue;
        }
        match = EN_PAIR.exec(line);
        if (match) {
          add(EN_KIND[match[2]!.toLowerCase()], match[1]);
          add(EN_KIND[match[3]!.toLowerCase()], match[1]);
          continue;
        }
        match = ES_ALL.exec(line) ?? EN_ALL.exec(line);
        if (match) {
          add("fire", match[1]);
          add("cold", match[1]);
          add("lightning", match[1]);
        }
      }
    }
  }
  return total;
}

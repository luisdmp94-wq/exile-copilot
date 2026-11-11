import type { CharacterProfile, Item, ItemSlot, Resistances } from "@shared/domain.js";

/**
 * Comprobación «¿está listo tu personaje?» de las guías por acto.
 *
 * Dos entradas posibles: piezas pegadas una a una desde el juego (Ctrl+C) o un
 * personaje completo (código PoB o expediente). Con piezas sueltas solo vemos
 * lo que el jugador pega: las resistencias salen de SUMAR los mods de esas
 * piezas, sin pasivas ni otras fuentes, y la página lo dice así.
 */

export type GuideCheckSource = "items" | "profile";

export type GuideCheckTone = "danger" | "warn" | "ok";

export interface GuideCheckLine {
  id: string;
  tone: GuideCheckTone;
  text: string;
}

export interface GuideCheckInput {
  source: GuideCheckSource;
  /** null = sin dato (perfil sin resistencias); con piezas siempre hay suma. */
  resistances: Resistances;
  /** Huecos ocupados; los anillos cuentan dos veces si hay dos. */
  filledSlots: ItemSlot[];
}

/** Lo mínimo que la guía pide para la campaña; viene del texto de la guía. */
export interface GuideCheckTargets {
  /** Resistencia elemental orientativa para el siguiente acto. */
  elemental: number;
  /** Nombre del acto siguiente, para redactar los avisos. */
  nextAct: string;
  /** Resistencia que el jefe del acto castiga: su aviso va primero y explica por qué. */
  focus?: { element: "fire" | "cold" | "lightning"; minimum: number; note: string };
}

const ELEMENTS = ["fire", "cold", "lightning"] as const;
type Element = (typeof ELEMENTS)[number];

const ELEMENT_LABELS: Record<Element | "chaos", string> = {
  fire: "fuego",
  cold: "hielo",
  lightning: "rayo",
  chaos: "caos",
};

/** Huecos que la guía revisa. La mano secundaria depende del arma y no se exige. */
export const GUIDE_SLOTS: Array<{ slot: ItemSlot; label: string }> = [
  { slot: "weapon", label: "arma" },
  { slot: "helmet", label: "casco" },
  { slot: "body", label: "armadura" },
  { slot: "gloves", label: "guantes" },
  { slot: "boots", label: "botas" },
  { slot: "belt", label: "cinturón" },
  { slot: "amulet", label: "amuleto" },
  { slot: "ring1", label: "anillo" },
  { slot: "ring2", label: "segundo anillo" },
];

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

/** Cada objeto copiado del juego empieza por esta línea, en inglés o en español. */
const ITEM_START = /^(?:Item Class|Clase de objeto):/;

/** ¿Lo pegado trae al menos la cabecera de un objeto copiado del juego? */
export function looksLikeItemText(text: string): boolean {
  return text.split(/\r\n?|\n/).some((line) => ITEM_START.test(line.trim()));
}

/**
 * Separa un pegado con varias piezas seguidas en un texto por pieza. Si no
 * encuentra la cabecera, devuelve el texto entero: el servidor decidirá si es
 * un objeto y explicará el error.
 */
export function splitPastedItems(text: string): string[] {
  const lines = text.split(/\r\n?|\n/);
  const starts = lines.flatMap((line, index) => (ITEM_START.test(line.trim()) ? [index] : []));
  if (starts.length <= 1) return text.trim() ? [text.trim()] : [];
  return starts
    .map((start, i) => lines.slice(start, starts[i + 1] ?? lines.length).join("\n").trim())
    .filter((chunk) => chunk.length > 0);
}

/** Suma de resistencias de las piezas pegadas (solo mods de esas piezas). */
export function resistancesFromItems(items: Item[]): Resistances {
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

/**
 * Coloca una pieza nueva en la lista. El lector marca todos los anillos como
 * `ring1`: el primero ocupa ese hueco, el segundo pasa a `ring2` y un tercero
 * sustituye al más antiguo. Cualquier otro hueco repetido sustituye al
 * anterior (el jugador ha cambiado de casco, no lleva dos).
 */
export function placePastedItem(items: Item[], incoming: Item): { items: Item[]; replaced: Item | null } {
  if (incoming.slot === "other" || incoming.slot === "flask") {
    return { items: [...items, incoming], replaced: null };
  }
  if (incoming.slot === "ring1" || incoming.slot === "ring2") {
    const rings = items.filter((item) => item.slot === "ring1" || item.slot === "ring2");
    if (rings.length < 2) {
      const slot: ItemSlot = rings.some((item) => item.slot === "ring1") ? "ring2" : "ring1";
      return { items: [...items, { ...incoming, slot }], replaced: null };
    }
    const oldest = rings[0];
    return {
      items: [...items.filter((item) => item !== oldest), { ...incoming, slot: oldest.slot }],
      replaced: oldest,
    };
  }
  const previous = items.find((item) => item.slot === incoming.slot) ?? null;
  return {
    items: [...items.filter((item) => item !== previous), incoming],
    replaced: previous,
  };
}

export function guideInputFromItems(items: Item[]): GuideCheckInput {
  return {
    source: "items",
    resistances: resistancesFromItems(items),
    filledSlots: items.map((item) => item.slot),
  };
}

export function guideInputFromProfile(profile: CharacterProfile): GuideCheckInput {
  return {
    source: "profile",
    resistances: profile.resistances,
    filledSlots: profile.items.map((item) => item.slot),
  };
}

function joinSpanish(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

/**
 * Avisos de la guía, del más grave al más leve. No inventa nada que no venga
 * de la entrada: sin dato de una resistencia, lo dice en vez de suponer 0.
 */
export function checkForGuide(input: GuideCheckInput, targets: GuideCheckTargets): GuideCheckLine[] {
  const lines: GuideCheckLine[] = [];
  const fromItems = input.source === "items";

  const unknown: string[] = [];
  const low: Array<{ element: Element; value: number }> = [];
  for (const element of ELEMENTS) {
    const value = input.resistances[element];
    if (value === null) unknown.push(ELEMENT_LABELS[element]);
    else if (value < targets.elemental) low.push({ element, value });
  }

  const focus = targets.focus;
  const isFocus = (element: Element, value: number) =>
    focus !== undefined && focus.element === element && value < focus.minimum;
  low.sort((a, b) => {
    const byFocus = Number(isFocus(b.element, b.value)) - Number(isFocus(a.element, a.value));
    return byFocus !== 0 ? byFocus : a.value - b.value;
  });
  for (const { element, value } of low) {
    const focused = isFocus(element, value);
    lines.push({
      id: `res-${element}`,
      tone: focused || value < targets.elemental / 2 ? "danger" : "warn",
      text: `Resistencia al ${ELEMENT_LABELS[element]}: ${value}%. Para el ${targets.nextAct} conviene llegar al menos al ${targets.elemental}%: te faltan ${targets.elemental - value} puntos.${focused ? ` ${focus!.note}` : ""}`,
    });
  }

  const ringCount = input.filledSlots.filter((slot) => slot === "ring1" || slot === "ring2").length;
  const missing = GUIDE_SLOTS.filter(({ slot }) => {
    if (slot === "ring1") return ringCount < 1;
    if (slot === "ring2") return ringCount < 2;
    return !input.filledSlots.includes(slot);
  }).map(({ label }) => label);
  if (missing.length > 0) {
    lines.push({
      id: "slots",
      tone: missing.includes("arma") ? "danger" : "warn",
      text: fromItems
        ? `No has pegado: ${joinSpanish(missing)}. Si llevas algo en esos huecos, pégalo también; si están vacíos, cualquier pieza es mejor que nada.`
        : `Huecos vacíos: ${joinSpanish(missing)}. Cualquier pieza es mejor que nada, y puede traer la resistencia que te falta.`,
    });
  }

  if (unknown.length > 0) {
    lines.push({
      id: "res-unknown",
      tone: "warn",
      text: `No sé tu resistencia al ${joinSpanish(unknown)}: tu código no la trae. Mírala en la hoja del personaje del juego (tecla C).`,
    });
  }

  const goodElements = ELEMENTS.filter((element) => {
    const value = input.resistances[element];
    return value !== null && value >= targets.elemental;
  });
  if (goodElements.length === ELEMENTS.length) {
    lines.push({
      id: "res-ok",
      tone: "ok",
      text: `Fuego, hielo y rayo al ${targets.elemental}% o más: vas bien para el ${targets.nextAct}.`,
    });
  } else if (goodElements.length > 0) {
    lines.push({
      id: "res-ok",
      tone: "ok",
      text: `${joinSpanish(goodElements.map((element) => ELEMENT_LABELS[element]))}: ya llegas al ${targets.elemental}%.`.replace(/^./, (c) => c.toUpperCase()),
    });
  }

  const chaos = input.resistances.chaos;
  if (chaos !== null && chaos < 0) {
    lines.push({
      id: "res-chaos",
      tone: "warn",
      text: `Resistencia al caos negativa (${chaos}%): recibes más daño de caos del normal. Apúntalo para más adelante.`,
    });
  }

  return lines;
}

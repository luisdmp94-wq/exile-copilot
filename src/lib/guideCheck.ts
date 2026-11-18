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
export type GuideCheckLang = "es" | "en";

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

const ELEMENT_LABELS_BY_LANG: Record<GuideCheckLang, Record<Element | "chaos", string>> = {
  es: { fire: "fuego", cold: "hielo", lightning: "rayo", chaos: "caos" },
  en: { fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" },
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

const SLOT_LABELS_EN: Partial<Record<ItemSlot, string>> = {
  weapon: "weapon",
  helmet: "helmet",
  body: "body armour",
  gloves: "gloves",
  boots: "boots",
  belt: "belt",
  amulet: "amulet",
  ring1: "ring",
  ring2: "second ring",
};

/** Nombre del hueco en el idioma pedido. */
export function guideSlotLabel(slot: ItemSlot, lang: GuideCheckLang = "es"): string {
  const spanish = GUIDE_SLOTS.find((item) => item.slot === slot)?.label ?? slot;
  return lang === "en" ? (SLOT_LABELS_EN[slot] ?? spanish) : spanish;
}

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
  if (incoming.slot === "other" || incoming.slot === "flask" || incoming.slot === "charm") {
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

function joinList(parts: string[], lang: GuideCheckLang): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "y"} ${parts.at(-1)}`;
}

const CHECK_WORDS = {
  es: {
    low: (element: string, value: number, nextAct: string, target: number) =>
      `Resistencia al ${element}: ${value}%. Para el ${nextAct} conviene llegar al menos al ${target}%: te faltan ${target - value} puntos.`,
    notPasted: (slots: string) =>
      `No has pegado: ${slots}. Si llevas algo en esos huecos, pégalo también; si están vacíos, cualquier pieza es mejor que nada.`,
    empty: (slots: string) =>
      `Huecos vacíos: ${slots}. Cualquier pieza es mejor que nada, y puede traer la resistencia que te falta.`,
    unknown: (elements: string) =>
      `No sé tu resistencia al ${elements}: tu código no la trae. Mírala en la hoja del personaje del juego (tecla C).`,
    allGood: (target: number, nextAct: string) => `Fuego, hielo y rayo al ${target}% o más: vas bien para el ${nextAct}.`,
    someGood: (elements: string, target: number) => `${elements}: ya llegas al ${target}%.`,
    chaos: (value: number) =>
      `Resistencia al caos negativa (${value}%): recibes más daño de caos del normal. Apúntalo para más adelante.`,
  },
  en: {
    low: (element: string, value: number, nextAct: string, target: number) =>
      `${element.replace(/^./, (c) => c.toUpperCase())} resistance: ${value}%. For ${nextAct} you should have at least ${target}%: you're ${target - value} points short.`,
    notPasted: (slots: string) =>
      `You haven't pasted: ${slots}. If you have something in those slots, paste it too; if they're empty, any item beats nothing.`,
    empty: (slots: string) => `Empty slots: ${slots}. Any item beats nothing, and it may bring the resistance you're missing.`,
    unknown: (elements: string) =>
      `I don't know your ${elements} resistance: your code doesn't include it. Check it on the in-game character sheet (C key).`,
    allGood: (target: number, nextAct: string) => `Fire, cold and lightning at ${target}% or more: you're fine for ${nextAct}.`,
    someGood: (elements: string, target: number) => `${elements}: already at ${target}%.`,
    chaos: (value: number) =>
      `Negative chaos resistance (${value}%): you take more chaos damage than normal. Keep it in mind for later.`,
  },
} as const;

/**
 * Avisos de la guía, del más grave al más leve. No inventa nada que no venga
 * de la entrada: sin dato de una resistencia, lo dice en vez de suponer 0.
 */
export function checkForGuide(
  input: GuideCheckInput,
  targets: GuideCheckTargets,
  lang: GuideCheckLang = "es",
): GuideCheckLine[] {
  const ELEMENT_LABELS = ELEMENT_LABELS_BY_LANG[lang];
  const words = CHECK_WORDS[lang];
  const joinSpanish = (parts: string[]) => joinList(parts, lang);
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
      text: `${words.low(ELEMENT_LABELS[element], value, targets.nextAct, targets.elemental)}${focused ? ` ${focus!.note}` : ""}`,
    });
  }

  const ringCount = input.filledSlots.filter((slot) => slot === "ring1" || slot === "ring2").length;
  const missingSlots = GUIDE_SLOTS.filter(({ slot }) => {
    if (slot === "ring1") return ringCount < 1;
    if (slot === "ring2") return ringCount < 2;
    return !input.filledSlots.includes(slot);
  }).map(({ slot }) => slot);
  const missing = missingSlots.map((slot) => guideSlotLabel(slot, lang));
  if (missing.length > 0) {
    lines.push({
      id: "slots",
      tone: missingSlots.includes("weapon") ? "danger" : "warn",
      text: fromItems ? words.notPasted(joinSpanish(missing)) : words.empty(joinSpanish(missing)),
    });
  }

  if (unknown.length > 0) {
    lines.push({
      id: "res-unknown",
      tone: "warn",
      text: words.unknown(joinSpanish(unknown)),
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
      text: words.allGood(targets.elemental, targets.nextAct),
    });
  } else if (goodElements.length > 0) {
    lines.push({
      id: "res-ok",
      tone: "ok",
      text: words.someGood(joinSpanish(goodElements.map((element) => ELEMENT_LABELS[element])), targets.elemental).replace(/^./, (c) => c.toUpperCase()),
    });
  }

  const chaos = input.resistances.chaos;
  if (chaos !== null && chaos < 0) {
    lines.push({
      id: "res-chaos",
      tone: "warn",
      text: words.chaos(chaos),
    });
  }

  return lines;
}

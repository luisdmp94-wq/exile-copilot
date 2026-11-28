import type { Item, Modifier } from "./domain.js";

/**
 * Lo que comparten los planificadores de crafteo avanzado de la tarea 19
 * (previsión, sacrificio, emociones y flujos). Cada uno lee la pieza pegada y
 * contesta primero: si la moneda se puede usar y qué va a pasar. Ninguno crea
 * sesión ni toca el formato guardado.
 *
 * Regla de la casa: «No se puede» solo cuando el texto del objeto o un estado
 * de la pieza lo impiden sin duda. Lo que el texto no dice queda en «Faltan
 * datos» y se dice tal cual; no se rellena con lo que parece lógico.
 */

export type PlannerLang = "es" | "en";
export type PlannerStatus = "compatible" | "blocked" | "needs-data";

export interface PlannerVerdict {
  status: PlannerStatus;
  /** La respuesta, en una frase. */
  reason: string;
  /** Frases cortas sobre lo que va a pasar, para enseñar bajo el veredicto. */
  outlook: string[];
}

/** De dónde sale una regla: el texto del objeto en el juego y cuándo se leyó. */
export interface PlannerSource {
  name: Record<PlannerLang, string>;
  /** Las líneas de la descripción, tal como las publica poe2db. */
  text: Record<PlannerLang, readonly string[]>;
  url: Record<PlannerLang, string>;
  readAt: string;
  patch: string;
  official: { title: string; url: string };
}

/** Las reglas se leyeron con el parche 0.5.5: valen para la serie 0.5 y nada más. */
export const PLANNER_RULES_PATCH = "0.5.5";
export const PLANNER_RULES_READ_AT = "2026-11-28";

export const readOnPatchSeries = (patch: string): boolean => /^0\.5(?:\.|$|[a-z])/i.test(patch);

export const pick = (lang: PlannerLang) => (es: string, en: string): string => (lang === "en" ? en : es);

export const percent = (part: number, whole: number): number => Math.round((part / whole) * 100);

export const explicitModifiers = (item: Item): Modifier[] => item.modifiers.filter((modifier) => modifier.kind === "explicit");

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Cómo se dice la rareza de una pieza de equipo. Lo que no es equipo (una moneda, una gema) no tiene. */
const RARITY_WORDS: Record<PlannerLang, Partial<Record<Item["rarity"], string>>> = {
  es: { normal: "normal", magic: "mágica", rare: "rara", unique: "única" },
  en: { normal: "normal", magic: "magic", rare: "rare", unique: "unique" },
};

export const rarityWord = (item: Item, lang: PlannerLang): string | undefined => RARITY_WORDS[lang][item.rarity];

// ---------------------------------------------------------------------------
// Joyas
// ---------------------------------------------------------------------------

export type JewelBase = "ruby" | "sapphire" | "emerald" | "diamond";

export const JEWEL_NAMES: Record<JewelBase, Record<PlannerLang, string>> = {
  ruby: { es: "rubí", en: "Ruby" },
  sapphire: { es: "zafiro", en: "Sapphire" },
  emerald: { es: "esmeralda", en: "Emerald" },
  diamond: { es: "diamante", en: "Diamond" },
};

const JEWEL_WORDS: Array<[RegExp, JewelBase]> = [
  [/\b(?:ruby|rubi)\b/, "ruby"],
  [/\b(?:sapphire|zafiro)\b/, "sapphire"],
  [/\b(?:emerald|esmeralda)\b/, "emerald"],
  [/\b(?:diamond|diamante)\b/, "diamond"],
];
const TIME_LOST = /\btime-?lost\b|\bperdid[oa] en el tiempo\b/;
/** Sin clase de objeto, solo cuenta una base que sea la joya y nada más («Anillo de rubí» no lo es). */
const BARE_JEWEL = /^(?:time-?lost )?(?:ruby|sapphire|emerald|diamond)$|^(?:rubi|zafiro|esmeralda|diamante)(?: perdid[oa] en el tiempo)?$/;

export interface JewelIdentity {
  /** Null si es una joya pero la base no es una de las cuatro básicas. */
  base: JewelBase | null;
  timeLost: boolean;
}

/** ¿Es una joya? Manda la clase de objeto que declara el texto pegado. */
export function jewelOf(item: Item): JewelIdentity | null {
  const itemClass = normalized(item.itemClass ?? "");
  const baseType = normalized(item.baseType);
  const declaredJewel = /\bjewels?\b|\bjoyas?\b/.test(itemClass);
  if (!declaredJewel && (itemClass.length > 0 || !BARE_JEWEL.test(baseType))) return null;
  const base = JEWEL_WORDS.find(([word]) => word.test(baseType))?.[1] ?? null;
  return { base, timeLost: TIME_LOST.test(`${baseType} ${normalized(item.name)}`) };
}

// ---------------------------------------------------------------------------
// Estados de la pieza
// ---------------------------------------------------------------------------

/**
 * Lo que impide o deja en duda cualquier moneda normal. `allowCorrupted` es
 * para los Orbes de sacrificio, que se usan justo en piezas corruptas.
 * Devuelve null si la pieza está limpia.
 */
export function stateVerdict(
  item: Item,
  currency: string,
  lang: PlannerLang,
  options: { allowCorrupted?: boolean } = {},
): PlannerVerdict | null {
  const t = pick(lang);
  const state = item.craftingState;
  const verdict = (status: PlannerStatus, reason: string): PlannerVerdict => ({ status, reason, outlook: [] });

  if (state === undefined) {
    return verdict(
      "needs-data",
      t(
        "El texto pegado no dice si la pieza está corrupta, reflejada o fracturada. Cópiala otra vez con Ctrl+Alt+C.",
        "The pasted text doesn't say whether the item is corrupted, mirrored or fractured. Copy it again with Ctrl+Alt+C.",
      ),
    );
  }
  if (state.mirrored) {
    return verdict("blocked", t("La pieza está reflejada: no se puede modificar.", "The item is mirrored: it can't be modified."));
  }
  if (state.unmodifiable) {
    return verdict("blocked", t("La pieza dice que no se puede modificar.", "The item says it can't be modified."));
  }
  if ((state.corrupted || state.doubleCorrupted) && !options.allowCorrupted) {
    return verdict("blocked", t("La pieza está corrupta: ya no admite esta moneda.", "The item is corrupted: it no longer takes this currency."));
  }
  if (
    state.doubleCorrupted ||
    state.sanctified ||
    state.unmodifiableExceptChaos ||
    state.mutated ||
    state.desecrated ||
    state.split ||
    state.unidentified
  ) {
    return verdict(
      "needs-data",
      t(
        `La pieza tiene un estado especial y no sé cómo se lleva con «${currency}». Pon la moneda encima en el juego: si no te deja, no vale.`,
        `The item has a special state and I don't know how it interacts with ${currency}. Hover the currency over it in game: if it won't let you, it doesn't work.`,
      ),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// «Elimina un modificador aleatorio»
// ---------------------------------------------------------------------------

export interface RandomRemoval {
  /** Explícitos de la pieza: entre ellos se sortea el que desaparece. */
  explicitModifierCount: number;
  /** De los que el jugador quiere conservar, cuántos hay en el sorteo. Null si no se puede calcular. */
  lossOdds: { wanted: number; of: number } | null;
  lines: string[];
}

/**
 * Qué puede pasar cuando una moneda «elimina un modificador aleatorio». Con un
 * modificador fracturado no se dan probabilidades: está fijo, y el texto de
 * estas monedas no dice si entra en el sorteo.
 */
export function randomRemoval(item: Item, protectedModifierIds: readonly string[], lang: PlannerLang): RandomRemoval {
  const t = pick(lang);
  const explicit = explicitModifiers(item);
  const count = explicit.length;
  if (count === 0) {
    return {
      explicitModifierCount: 0,
      lossOdds: null,
      lines: [
        t(
          "No veo modificadores explícitos en la pieza. El texto dice que elimina uno al azar y no sé qué hace si no hay ninguno.",
          "I can't see any explicit modifiers on the item. The text says it removes a random one and I don't know what it does when there are none.",
        ),
      ],
    };
  }
  if (explicit.some((modifier) => modifier.fractured)) {
    return {
      explicitModifierCount: count,
      lossOdds: null,
      lines: [
        t(
          `Eliminará al azar 1 modificador. La pieza tiene uno fracturado (fijo) y no sé si entra en el sorteo: no te doy probabilidades.`,
          `It will remove 1 random modifier. The item has a fractured (locked) one and I don't know whether it can be picked: no odds from me.`,
        ),
      ],
    };
  }
  const wanted = explicit.filter((modifier) => protectedModifierIds.includes(modifier.id)).length;
  const lines = [
    t(
      `Eliminará al azar 1 de los ${count} modificadores explícitos: cada uno tiene 1 de ${count} (${percent(1, count)} %) de desaparecer.`,
      `It will remove 1 of the ${count} explicit modifiers at random: each has a 1 in ${count} (${percent(1, count)}%) chance of going.`,
    ),
  ];
  if (wanted > 0 && wanted < count) {
    lines.push(
      t(
        `De los que quieres conservar: ${wanted} de ${count} (${percent(wanted, count)} %) de perder uno de ellos, y ${count - wanted} de ${count} (${percent(count - wanted, count)} %) de que se lleve uno que no habías marcado.`,
        `Of the ones you want to keep: ${wanted} in ${count} (${percent(wanted, count)}%) of losing one of them, and ${count - wanted} in ${count} (${percent(count - wanted, count)}%) that it takes one you hadn't marked.`,
      ),
    );
  } else if (wanted === count) {
    lines.push(
      t(
        "Has marcado todos como «quiero conservar»: caiga donde caiga, pierdes uno que querías.",
        "You marked them all as must-keep: wherever it lands, you lose one you wanted.",
      ),
    );
  } else {
    lines.push(
      t(
        "No has marcado qué modificadores quieres conservar. Márcalos y te digo la probabilidad de perder uno de ellos.",
        "You haven't marked which modifiers you want to keep. Mark them and I'll tell you the odds of losing one of them.",
      ),
    );
  }
  return { explicitModifierCount: count, lossOdds: wanted > 0 ? { wanted, of: count } : null, lines };
}

/** La regla se leyó en 0.5.5: para otro parche no se da por buena. */
export function patchVerdict(patch: string, currency: string, lang: PlannerLang): PlannerVerdict | null {
  if (readOnPatchSeries(patch)) return null;
  return {
    status: "needs-data",
    reason: pick(lang)(
      `La regla de «${currency}» se leyó con el parche ${PLANNER_RULES_PATCH}. No está revisada para ${patch}: lee su descripción en el juego antes de gastarla.`,
      `The rule for ${currency} was read on patch ${PLANNER_RULES_PATCH}. It hasn't been reviewed for ${patch}: read its description in game before spending it.`,
    ),
    outlook: [],
  };
}

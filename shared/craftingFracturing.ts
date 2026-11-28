import { z } from "zod";
import type { Item } from "./domain.js";

/**
 * Planificador del Orbe fracturante (tarea 19 del plan, 28-11-2026).
 *
 * Viene de la versión de septiembre de la web (rama `crafting-real-item-coach`,
 * `shared/craftingFracturing.ts`). Allí el jugador tenía que copiar el nombre y
 * la descripción del orbe y marcar tres casillas antes de ver nada, porque la
 * regla nunca se había comprobado en el juego. Aquí la regla sale del texto del
 * propio objeto, leído el 28-11-2026 (`FRACTURING_ORB_SOURCE`), y la tarjeta
 * contesta sola con la pieza delante: si se puede usar, qué va a pasar y qué
 * probabilidad hay de que el modificador que se quede fijo sea uno de los que
 * el jugador quiere conservar.
 *
 * Solo lee: no crea sesión ni toca el formato guardado de las decisiones.
 */

/** El texto del objeto en el juego, tal como lo publica poe2db en los dos idiomas. */
export const FRACTURING_ORB_SOURCE = {
  name: { es: "Orbe fracturante", en: "Fracturing Orb" },
  text: {
    es: "Fractura un modificador aleatorio de un objeto raro que tenga al menos 4 modificadores y lo bloquea en su lugar.",
    en: "Fracture a random modifier on a rare item with at least 4 modifiers, locking it in place.",
  },
  restriction: {
    es: "No se puede usar en objetos fracturados.",
    en: "Cannot be used on Fractured items.",
  },
  url: { es: "https://poe2db.tw/sp/Fracturing_Orb", en: "https://poe2db.tw/us/Fracturing_Orb" },
  /** Cuándo se leyó y con qué parche en la web: la regla no se da por buena para otro. */
  readAt: "2026-11-28",
  patch: "0.5.5",
  /** Dónde lo presentó GGG. */
  official: {
    title: "Content Update 0.2.0 — Dawn of the Hunt",
    url: "https://www.pathofexile.com/forum/view-thread/3740562",
  },
} as const;

/** Lo mínimo que pide el texto del orbe. */
export const FRACTURING_MINIMUM_MODIFIERS = 4;

export const FracturingPlanInputSchema = z.object({
  /** El parche del personaje: la regla se leyó en 0.5.5. */
  patch: z.string().trim().min(1).max(50),
  /** Los modificadores que el jugador ha marcado como «quiero conservar». */
  protectedModifierIds: z.array(z.string().min(1).max(200)).max(40),
});
export type FracturingPlanInput = z.infer<typeof FracturingPlanInputSchema>;

export type FracturingStatus = "compatible" | "blocked" | "needs-data";

export interface FracturingEvaluation {
  status: FracturingStatus;
  reason: string;
  /** Modificadores explícitos de la pieza: entre ellos elige el orbe. */
  explicitModifierCount: number;
  /**
   * De los explícitos, cuántos quiere conservar el jugador. Si el orbe se puede
   * usar, `wanted` de `of` es la probabilidad de que el fijo sea uno de esos.
   * Null si no ha marcado ninguno o el orbe no se puede usar.
   */
  wantedOdds: { wanted: number; of: number } | null;
  /** Frases cortas sobre lo que va a pasar, para enseñar bajo el veredicto. */
  outlook: string[];
  /** Un modificador fracturado no se puede cambiar ni quitar después. */
  irreversible: true;
}

/** Cómo se dice la rareza de una pieza de equipo. Lo que no es equipo (una moneda, una gema) no tiene. */
const RARITY_WORDS: Record<"es" | "en", Partial<Record<Item["rarity"], string>>> = {
  es: { normal: "normal", magic: "mágica", rare: "rara", unique: "única" },
  en: { normal: "normal", magic: "magic", rare: "rare", unique: "unique" },
};

const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

/**
 * ¿Se puede usar el Orbe fracturante en esta pieza, y qué pasará? Conservador:
 * «bloqueada» solo cuando el texto del orbe o un estado de la pieza lo impiden
 * sin duda; lo que no se sabe leer queda en «faltan datos».
 */
export function evaluateFracturingPlan(
  item: Item,
  input: FracturingPlanInput,
  lang: "es" | "en" = "es",
): FracturingEvaluation {
  const plan = FracturingPlanInputSchema.parse(input);
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
  const name = FRACTURING_ORB_SOURCE.name[lang];
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const state = item.craftingState;
  const result = (status: FracturingStatus, reason: string, extra: Partial<FracturingEvaluation> = {}): FracturingEvaluation => ({
    status,
    reason,
    explicitModifierCount: explicit.length,
    wantedOdds: null,
    outlook: [],
    irreversible: true,
    ...extra,
  });

  if (!/^0\.5(?:\.|$|[a-z])/i.test(plan.patch)) {
    return result(
      "needs-data",
      t(
        `La regla del ${name} se leyó con el parche ${FRACTURING_ORB_SOURCE.patch}. No está revisada para ${plan.patch}: lee la descripción del orbe en el juego antes de gastarlo.`,
        `The ${name} rule was read on patch ${FRACTURING_ORB_SOURCE.patch}. It hasn't been reviewed for ${plan.patch}: read the orb's description in game before spending it.`,
      ),
    );
  }
  if (item.rarity !== "rare") {
    const rarity = RARITY_WORDS[lang][item.rarity];
    return result(
      "blocked",
      rarity
        ? t(`El ${name} solo vale en objetos raros, y esta pieza es ${rarity}.`, `The ${name} only works on rare items, and this one is ${rarity}.`)
        : t(`El ${name} solo vale en objetos raros, y esto no lo es.`, `The ${name} only works on rare items, and this isn't one.`),
    );
  }
  if (state === undefined) {
    return result(
      "needs-data",
      t(
        "El texto pegado no dice si la pieza está corrupta, reflejada o ya fracturada. Cópiala otra vez con Ctrl+Alt+C.",
        "The pasted text doesn't say whether the item is corrupted, mirrored or already fractured. Copy it again with Ctrl+Alt+C.",
      ),
    );
  }
  if (state.fractured || item.modifiers.some((modifier) => modifier.fractured)) {
    return result(
      "blocked",
      t(
        `Esta pieza ya tiene un modificador fracturado, y el ${name} no se puede usar en objetos fracturados.`,
        `This item already has a fractured modifier, and the ${name} can't be used on fractured items.`,
      ),
    );
  }
  if (state.corrupted || state.doubleCorrupted) {
    return result("blocked", t("La pieza está corrupta: ya no admite orbes.", "The item is corrupted: it no longer takes orbs."));
  }
  if (state.mirrored) {
    return result("blocked", t("La pieza está reflejada: no se puede modificar.", "The item is mirrored: it can't be modified."));
  }
  if (state.unmodifiable) {
    return result("blocked", t("La pieza dice que no se puede modificar.", "The item says it can't be modified."));
  }
  if (state.sanctified || state.unmodifiableExceptChaos || state.mutated || state.desecrated || state.split || state.unidentified) {
    return result(
      "needs-data",
      t(
        `La pieza tiene un estado especial y no sé cómo se lleva con el ${name}. Pon el orbe encima en el juego: si no te deja, no vale.`,
        `The item has a special state and I don't know how it interacts with the ${name}. Hover the orb over it in game: if it won't let you, it doesn't work.`,
      ),
    );
  }
  if (explicit.length < FRACTURING_MINIMUM_MODIFIERS) {
    // El texto dice «al menos 4 modificadores» sin más. Con menos de cuatro
    // explícitos pero cuatro líneas contando implícitos y runas, no se afirma.
    const countsOthers = item.modifiers.length >= FRACTURING_MINIMUM_MODIFIERS;
    return result(
      countsOthers ? "needs-data" : "blocked",
      countsOthers
        ? t(
            `El ${name} pide al menos ${FRACTURING_MINIMUM_MODIFIERS} modificadores y esta pieza tiene ${explicit.length} explícitos. No sé si el juego cuenta también los implícitos: pon el orbe encima y mira si te deja.`,
            `The ${name} needs at least ${FRACTURING_MINIMUM_MODIFIERS} modifiers and this item has ${explicit.length} explicit ones. I don't know whether the game also counts implicits: hover the orb over it and see if it lets you.`,
          )
        : t(
            `El ${name} pide al menos ${FRACTURING_MINIMUM_MODIFIERS} modificadores y esta pieza tiene ${explicit.length}. Súbela antes a ${FRACTURING_MINIMUM_MODIFIERS} o más.`,
            `The ${name} needs at least ${FRACTURING_MINIMUM_MODIFIERS} modifiers and this item has ${explicit.length}. Get it to ${FRACTURING_MINIMUM_MODIFIERS} or more first.`,
          ),
    );
  }

  const count = explicit.length;
  const wanted = explicit.filter((modifier) => plan.protectedModifierIds.includes(modifier.id)).length;
  const outlook: string[] = [
    t(
      `Cada uno de los ${count} modificadores tiene la misma probabilidad de quedarse fijo: 1 de ${count} (${percent(1, count)} %).`,
      `Each of the ${count} modifiers is equally likely to be locked: 1 in ${count} (${percent(1, count)}%).`,
    ),
  ];
  if (wanted > 0 && wanted < count) {
    outlook.push(
      t(
        `De los que quieres conservar: ${wanted} de ${count} (${percent(wanted, count)} %) de que el fijo sea uno de ellos, y ${count - wanted} de ${count} (${percent(count - wanted, count)} %) de que se quede fijo uno que no querías.`,
        `Of the ones you want to keep: ${wanted} in ${count} (${percent(wanted, count)}%) that the locked one is one of them, and ${count - wanted} in ${count} (${percent(count - wanted, count)}%) that it locks one you didn't want.`,
      ),
    );
  } else if (wanted === count) {
    outlook.push(
      t(
        "Has marcado todos como «quiero conservar»: caiga donde caiga, se queda fijo uno que querías.",
        "You marked them all as must-keep: wherever it lands, it locks one you wanted.",
      ),
    );
  } else {
    outlook.push(
      t(
        "No has marcado qué modificadores quieres conservar. Márcalos y te digo la probabilidad de que el fijo sea uno de ellos.",
        "You haven't marked which modifiers you want to keep. Mark them and I'll tell you the odds that the locked one is one of them.",
      ),
    );
  }
  outlook.push(
    t(
      "No tiene vuelta atrás: el modificador fracturado ya no se puede cambiar ni quitar, y la pieza no admite otro orbe de estos.",
      "There's no going back: the fractured modifier can't be changed or removed any more, and the item won't take another of these orbs.",
    ),
  );

  return result(
    "compatible",
    t(
      `Se puede usar: el ${name} dejará fijo, al azar, 1 de los ${count} modificadores explícitos de esta pieza.`,
      `You can use it: the ${name} will lock, at random, 1 of this item's ${count} explicit modifiers.`,
    ),
    { wantedOdds: wanted > 0 ? { wanted, of: count } : null, outlook },
  );
}

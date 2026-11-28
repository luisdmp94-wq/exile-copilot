import { z } from "zod";
import type { Item } from "./domain.js";
import { EMOTION_DATA, EMOTION_DATA_READ_AT } from "./craftingEmotionData.js";
import {
  JEWEL_NAMES,
  PLANNER_RULES_PATCH,
  jewelOf,
  patchVerdict,
  pick,
  randomRemoval,
  rarityWord,
  stateVerdict,
  type JewelBase,
  type PlannerLang,
  type PlannerVerdict,
} from "./craftingPlannerRules.js";

/**
 * Planificador de emociones líquidas (tarea 19 del plan).
 *
 * Una emoción «elimina un modificador aleatorio y mejora una joya rara con un
 * nuevo modificador de fabricación garantizado». Cuál, depende de la emoción y
 * de la joya (rubí, zafiro, esmeralda o diamante). Las normales van en joyas
 * básicas; las «antiguas», en joyas perdidas en el tiempo.
 *
 * En septiembre (`shared/craftingEmotions.ts` de la rama
 * `crafting-real-item-coach`) el jugador copiaba el nombre, la descripción y
 * el efecto de la emoción. Aquí todo eso sale de `craftingEmotionData.ts`
 * (26 emociones, texto del juego en los dos idiomas): la tarjeta mira la joya
 * y dice qué le pondría cada emoción y qué probabilidad hay de perder un
 * modificador que se quería conservar.
 */

export interface EmotionOutcomeData {
  jewel: JewelBase;
  affix: "prefix" | "suffix";
  text: Record<PlannerLang, string>;
}

export interface EmotionData {
  id: string;
  name: Record<PlannerLang, string>;
  /** «basic» = joya básica rara; «time-lost» = joya rara perdida en el tiempo. */
  target: "basic" | "time-lost";
  outcomes: EmotionOutcomeData[];
}

export const EMOTION_SOURCE = {
  /** La frase que comparten todas, tal como la da el juego. */
  text: {
    basic: {
      es: "Elimina un modificador aleatorio y mejora una joya básica rara con un nuevo modificador de fabricación garantizado",
      en: "Removes a random modifer and Augments a Rare Basic Jewel with a new guaranteed Crafted modifier",
    },
    "time-lost": {
      es: "Elimina un modificador aleatorio y mejora una joya rara perdida en el tiempo con un nuevo modificador de fabricación garantizado",
      en: "Removes a random modifer and Augments a Rare Time-Lost Jewel with a new guaranteed Crafted modifier",
    },
  },
  url: { es: "https://poe2db.tw/sp/Stackable_Currency", en: "https://poe2db.tw/us/Stackable_Currency" },
  readAt: EMOTION_DATA_READ_AT,
  patch: PLANNER_RULES_PATCH,
  official: {
    title: "Content Update 0.5.0",
    url: "https://www.pathofexile.com/forum/view-thread/3932540",
  },
} as const;

export const EmotionPlanInputSchema = z.object({
  patch: z.string().trim().min(1).max(50),
  /** Los modificadores que el jugador ha marcado como «quiero conservar». */
  protectedModifierIds: z.array(z.string().min(1).max(200)).max(40),
  /** La emoción que el jugador tiene en la mano. Null = todavía no ha elegido. */
  emotionId: z.string().max(80).nullable().default(null),
});
export type EmotionPlanInput = z.input<typeof EmotionPlanInputSchema>;

/** Lo que una emoción le pone a ESTA joya. */
export interface EmotionOption {
  id: string;
  name: string;
  /** Vacío si la emoción no nombra esta joya (p. ej. no dice nada para diamantes). */
  outcomes: Array<{ affix: "prefix" | "suffix"; text: string }>;
}

export interface EmotionEvaluation extends PlannerVerdict {
  jewel: { base: JewelBase | null; timeLost: boolean } | null;
  /** Las emociones que valen para esta joya, con lo que le pondría cada una. */
  options: EmotionOption[];
  /** La elegida, si la hay y vale para esta joya. */
  selected: EmotionOption | null;
  explicitModifierCount: number;
  lossOdds: { wanted: number; of: number } | null;
  irreversible: true;
}

const AFFIX_WORD: Record<PlannerLang, Record<"prefix" | "suffix", string>> = {
  es: { prefix: "prefijo", suffix: "sufijo" },
  en: { prefix: "prefix", suffix: "suffix" },
};

export const emotionAffixWord = (affix: "prefix" | "suffix", lang: PlannerLang): string => AFFIX_WORD[lang][affix];

/** ¿Se puede usar una emoción líquida en esta joya, y qué le pondría? */
export function evaluateEmotionPlan(item: Item, input: EmotionPlanInput, lang: PlannerLang = "es"): EmotionEvaluation {
  const plan = EmotionPlanInputSchema.parse(input);
  const t = pick(lang);
  const jewel = jewelOf(item);
  const family = t("las emociones líquidas", "liquid emotions");
  const explicitModifierCount = item.modifiers.filter((modifier) => modifier.kind === "explicit").length;
  const done = (verdict: PlannerVerdict, extra: Partial<EmotionEvaluation> = {}): EmotionEvaluation => ({
    ...verdict,
    jewel,
    options: [],
    selected: null,
    explicitModifierCount,
    lossOdds: null,
    irreversible: true,
    ...extra,
  });
  const verdict = (status: PlannerVerdict["status"], reason: string): PlannerVerdict => ({ status, reason, outlook: [] });

  const patch = patchVerdict(plan.patch, family, lang);
  if (patch) return done(patch);
  if (!jewel) {
    return done(
      verdict(
        "blocked",
        t(
          "Las emociones líquidas solo valen en joyas raras (rubí, zafiro, esmeralda o diamante), y esta pieza no es una joya.",
          "Liquid emotions only work on rare jewels (Ruby, Sapphire, Emerald or Diamond), and this item isn't a jewel.",
        ),
      ),
    );
  }
  if (item.rarity !== "rare") {
    const rarity = rarityWord(item, lang);
    return done(
      verdict(
        "blocked",
        rarity
          ? t(`Las emociones líquidas solo valen en joyas raras, y esta es ${rarity}.`, `Liquid emotions only work on rare jewels, and this one is ${rarity}.`)
          : t("Las emociones líquidas solo valen en joyas raras, y esta no lo es.", "Liquid emotions only work on rare jewels, and this isn't one."),
      ),
    );
  }
  const blockedByState = stateVerdict(item, family, lang);
  if (blockedByState) return done(blockedByState);
  if (jewel.base === null) {
    return done(
      verdict(
        "needs-data",
        t(
          "Es una joya, pero no reconozco si es rubí, zafiro, esmeralda o diamante: de eso depende lo que pone cada emoción. Lee la descripción de la emoción en el juego.",
          "It's a jewel, but I can't tell whether it's a Ruby, Sapphire, Emerald or Diamond: what each emotion adds depends on that. Read the emotion's description in game.",
        ),
      ),
    );
  }

  const base = jewel.base;
  const target = jewel.timeLost ? "time-lost" : "basic";
  const options: EmotionOption[] = EMOTION_DATA.filter((emotion) => emotion.target === target).map((emotion) => ({
    id: emotion.id,
    name: emotion.name[lang],
    outcomes: emotion.outcomes
      .filter((outcome) => outcome.jewel === base)
      .map((outcome) => ({ affix: outcome.affix, text: outcome.text[lang] })),
  }));
  const selected = options.find((option) => option.id === plan.emotionId) ?? null;
  const removal = randomRemoval(item, plan.protectedModifierIds, lang);
  const jewelName = JEWEL_NAMES[base][lang];

  const outlook: string[] = [];
  if (selected && selected.outcomes.length === 0) {
    return done(
      verdict(
        "blocked",
        t(
          `${selected.name} no dice nada para joyas de base ${jewelName}: su descripción solo nombra otras joyas.`,
          `${selected.name} says nothing for ${jewelName} jewels: its description only names other jewels.`,
        ),
      ),
      { options, selected },
    );
  }
  if (selected) {
    outlook.push(
      selected.outcomes.length === 1
        ? t(
            `Le pondrá este ${AFFIX_WORD.es[selected.outcomes[0]!.affix]}: «${selected.outcomes[0]!.text}».`,
            `It will add this ${AFFIX_WORD.en[selected.outcomes[0]!.affix]}: "${selected.outcomes[0]!.text}".`,
          )
        : t(
            `Le pondrá uno de estos (su descripción nombra los dos): ${selected.outcomes.map((outcome) => `${AFFIX_WORD.es[outcome.affix]} «${outcome.text}»`).join(" o ")}.`,
            `It will add one of these (its description names both): ${selected.outcomes.map((outcome) => `${AFFIX_WORD.en[outcome.affix]} "${outcome.text}"`).join(" or ")}.`,
          ),
    );
  } else {
    outlook.push(
      t(
        "Elige abajo la emoción que tienes y te digo qué modificador le pondría a esta joya.",
        "Pick the emotion you have below and I'll tell you which modifier it would add to this jewel.",
      ),
    );
  }
  outlook.push(...removal.lines);
  if (item.modifiers.some((modifier) => modifier.crafted)) {
    outlook.push(
      t(
        "La joya ya tiene un modificador de fabricación. No sé si admite otro: pon la emoción encima en el juego y mira si te deja.",
        "The jewel already has a crafted modifier. I don't know whether it takes another: hover the emotion over it in game and see if it lets you.",
      ),
    );
  }
  outlook.push(
    t(
      "No tiene vuelta atrás: el modificador que se va no vuelve.",
      "There's no going back: the modifier that goes won't return.",
    ),
  );

  return done(
    {
      status: removal.explicitModifierCount === 0 ? "needs-data" : "compatible",
      reason: jewel.timeLost
        ? t(
            `Se puede usar una emoción antigua: la joya es rara, perdida en el tiempo y de base ${jewelName}. Le quita un modificador al azar y le pone uno fijo.`,
            `You can use an Ancient emotion: this jewel is a rare Time-Lost ${jewelName}. It removes one random modifier and adds a fixed one.`,
          )
        : t(
            `Se puede usar una emoción líquida: la joya es rara y de base ${jewelName}. Le quita un modificador al azar y le pone uno fijo.`,
            `You can use a liquid emotion: this jewel is a rare ${jewelName}. It removes one random modifier and adds a fixed one.`,
          ),
      outlook,
    },
    { options, selected, lossOdds: removal.lossOdds },
  );
}

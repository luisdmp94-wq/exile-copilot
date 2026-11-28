import { z } from "zod";
import type { Item, Modifier } from "./domain.js";
import {
  PLANNER_RULES_PATCH,
  PLANNER_RULES_READ_AT,
  jewelOf,
  pick,
  randomRemoval,
  rarityWord,
  stateVerdict,
  type PlannerLang,
  type PlannerVerdict,
} from "./craftingPlannerRules.js";

/**
 * Planificador de los Orbes de sacrificio (tarea 19 del plan).
 *
 * Son cuatro, uno por tipo de pieza. Cada uno «mejora un encantamiento
 * corrupto» de una pieza rara y «elimina un modificador aleatorio». En
 * septiembre (`shared/craftingSacrifice.ts` de la rama
 * `crafting-real-item-coach`) el jugador copiaba el nombre y la descripción
 * del orbe y elegía el encantamiento. Aquí la tarjeta mira la pieza y dice
 * cuál de los cuatro le toca, si se puede usar y qué probabilidad hay de
 * perder un modificador que quería conservar.
 *
 * Lo que NO se sabe y se dice: en qué se convierte cada encantamiento (poe2db
 * lista 190 mejoras, sin decir de cuál sale cada una).
 */

export type SacrificeOrbId = "yaomac" | "kopec" | "kamasa" | "yugul";

export interface SacrificeOrb {
  id: SacrificeOrbId;
  name: Record<PlannerLang, string>;
  /** Las dos líneas del objeto en el juego. */
  text: Record<PlannerLang, readonly string[]>;
  /** Para qué piezas es, dicho en claro. */
  target: Record<PlannerLang, string>;
  url: Record<PlannerLang, string>;
}

const REMOVES = { es: "Y elimina un modificador aleatorio", en: "and removes a random Modifier" } as const;

export const SACRIFICE_ORBS: Record<SacrificeOrbId, SacrificeOrb> = {
  yaomac: {
    id: "yaomac",
    name: { es: "Orbe de sacrificio de Yaomac", en: "Yaomac's Orb of Sacrifice" },
    text: {
      es: ["Mejora un encantamiento corrupto de un arma o un carcaj raros", REMOVES.es],
      en: ["Upgrades a Corruption Enchantment on a Rare Weapon or Quiver", REMOVES.en],
    },
    target: { es: "armas y carcajes", en: "weapons and quivers" },
    url: { es: "https://poe2db.tw/sp/Yaomacs_Orb_of_Sacrifice", en: "https://poe2db.tw/us/Yaomacs_Orb_of_Sacrifice" },
  },
  kopec: {
    id: "kopec",
    name: { es: "Orbe de sacrificio de Kopec", en: "Kopec's Orb of Sacrifice" },
    text: {
      es: ["Mejora un encantamiento corrupto de una armadura rara", REMOVES.es],
      en: ["Upgrades a Corruption Enchantment on a Rare Armour", REMOVES.en],
    },
    target: { es: "armaduras", en: "armour" },
    url: { es: "https://poe2db.tw/sp/Kopecs_Orb_of_Sacrifice", en: "https://poe2db.tw/us/Kopecs_Orb_of_Sacrifice" },
  },
  kamasa: {
    id: "kamasa",
    name: { es: "Orbe de sacrificio de Kamasa", en: "Kamasa's Orb of Sacrifice" },
    text: {
      es: ["Mejora un encantamiento corrupto de un amuleto, un anillo o un cinturón raros", REMOVES.es],
      en: ["Upgrades a Corruption Enchantment on a Rare Amulet, Ring or Belt", REMOVES.en],
    },
    target: { es: "amuletos, anillos y cinturones", en: "amulets, rings and belts" },
    url: { es: "https://poe2db.tw/sp/Kamasas_Orb_of_Sacrifice", en: "https://poe2db.tw/us/Kamasas_Orb_of_Sacrifice" },
  },
  yugul: {
    id: "yugul",
    name: { es: "Orbe de sacrificio de Yugul", en: "Yugul's Orb of Sacrifice" },
    text: {
      // El 28-11-2026 el texto en español del juego repite el de Kopec
      // («una armadura rara»); el inglés dice «Rare Jewel». Se enseña el
      // español tal cual y la tarjeta avisa (`translationNote`).
      es: ["Mejora un encantamiento corrupto de una armadura rara", REMOVES.es],
      en: ["Upgrades a Corruption Enchantment on a Rare Jewel", REMOVES.en],
    },
    target: { es: "joyas", en: "jewels" },
    url: { es: "https://poe2db.tw/sp/Yuguls_Orb_of_Sacrifice", en: "https://poe2db.tw/us/Yuguls_Orb_of_Sacrifice" },
  },
};

export const SACRIFICE_SOURCE = {
  readAt: PLANNER_RULES_READ_AT,
  patch: PLANNER_RULES_PATCH,
  /** Los cuatro se aplican igual: «clic izquierdo en un objeto corrupto». */
  usedOn: {
    es: "Haz clic derecho en este objeto y luego clic izquierdo en un objeto corrupto para aplicarlo.",
    en: "Right click this item then left click on a corrupted item to apply it.",
  },
  official: {
    title: "Path of Exile 2 — 0.5.4 Patch Notes",
    url: "https://www.pathofexile.com/forum/view-thread/3975218",
  },
} as const;

/** Los orbes llegaron con 0.5.4: antes no existían. */
const SINCE_0_5_4 = /^0\.5\.(?:[4-9]|\d{2,})(?:[a-z]|\.\d+)?$/i;

export const SacrificePlanInputSchema = z.object({
  patch: z.string().trim().min(1).max(50),
  /** Los modificadores que el jugador ha marcado como «quiero conservar». */
  protectedModifierIds: z.array(z.string().min(1).max(200)).max(40),
});
export type SacrificePlanInput = z.infer<typeof SacrificePlanInputSchema>;

export interface SacrificeEvaluation extends PlannerVerdict {
  /** El orbe que le toca a esta pieza. Null si ninguno de los cuatro la nombra o no se sabe. */
  orb: SacrificeOrb | null;
  /** Los encantamientos que el texto pegado declara. */
  enchantments: Modifier[];
  explicitModifierCount: number;
  /** De los explícitos, cuántos quiere conservar: `wanted` de `of` es la probabilidad de perder uno. */
  lossOdds: { wanted: number; of: number } | null;
  /** Aviso cuando el texto del orbe en español no coincide con el inglés. */
  translationNote: string | null;
  irreversible: true;
}

type OrbChoice = { orb: SacrificeOrb } | { unknown: string } | { none: string };

/** Cuál de los cuatro orbes nombra a esta pieza. */
function orbFor(item: Item, lang: PlannerLang): OrbChoice {
  const t = pick(lang);
  if (jewelOf(item)) return { orb: SACRIFICE_ORBS.yugul };
  switch (item.slot) {
    case "weapon":
      return { orb: SACRIFICE_ORBS.yaomac };
    case "helmet":
    case "body":
    case "gloves":
    case "boots":
      return { orb: SACRIFICE_ORBS.kopec };
    case "amulet":
    case "ring1":
    case "ring2":
    case "belt":
      return { orb: SACRIFICE_ORBS.kamasa };
    case "offhand":
      if (/quiver|carcaj/i.test(`${item.itemClass ?? ""} ${item.baseType}`)) return { orb: SACRIFICE_ORBS.yaomac };
      return {
        unknown: t(
          `Para un escudo, un broquel o un foco no sé cuál toca: el ${SACRIFICE_ORBS.kopec.name.es} dice «armadura» y no sé si el juego cuenta esta pieza como tal. Pon el orbe encima: si no te deja, no vale.`,
          `For a shield, buckler or focus I don't know which one applies: ${SACRIFICE_ORBS.kopec.name.en} says "Armour" and I don't know whether the game counts this item as one. Hover the orb over it: if it won't let you, it doesn't work.`,
        ),
      };
    default:
      return {
        none: t(
          "Ninguno de los cuatro Orbes de sacrificio nombra este tipo de pieza: son para armas y carcajes, armaduras, amuletos, anillos y cinturones, y joyas.",
          "None of the four Orbs of Sacrifice names this kind of item: they're for weapons and quivers, armour, amulets, rings and belts, and jewels.",
        ),
      };
  }
}

/** ¿Se puede usar un Orbe de sacrificio en esta pieza, cuál, y qué pasará? */
export function evaluateSacrificePlan(item: Item, input: SacrificePlanInput, lang: PlannerLang = "es"): SacrificeEvaluation {
  const plan = SacrificePlanInputSchema.parse(input);
  const t = pick(lang);
  const enchantments = item.modifiers.filter((modifier) => modifier.kind === "enchant");
  const explicitModifierCount = item.modifiers.filter((modifier) => modifier.kind === "explicit").length;
  const choice = orbFor(item, lang);
  const orb = "orb" in choice ? choice.orb : null;
  const family = t("los Orbes de sacrificio", "the Orbs of Sacrifice");
  const done = (verdict: PlannerVerdict, extra: Partial<SacrificeEvaluation> = {}): SacrificeEvaluation => ({
    ...verdict,
    orb,
    enchantments,
    explicitModifierCount,
    lossOdds: null,
    translationNote:
      orb?.id === "yugul" && lang === "es"
        ? "Ojo: en el juego en español este orbe dice «armadura rara», igual que el de Kopec. En inglés dice «joya rara» (Rare Jewel). Me fío del inglés; compruébalo poniendo el orbe encima de la joya."
        : null,
    irreversible: true,
    ...extra,
  });
  const verdict = (status: PlannerVerdict["status"], reason: string): PlannerVerdict => ({ status, reason, outlook: [] });

  if (!SINCE_0_5_4.test(plan.patch)) {
    return done(
      verdict(
        "needs-data",
        t(
          `Los Orbes de sacrificio existen desde el parche 0.5.4 y su regla se leyó con ${SACRIFICE_SOURCE.patch}. No está revisada para ${plan.patch}: lee la descripción del orbe en el juego antes de gastarlo.`,
          `The Orbs of Sacrifice exist since patch 0.5.4 and their rule was read on ${SACRIFICE_SOURCE.patch}. It hasn't been reviewed for ${plan.patch}: read the orb's description in game before spending it.`,
        ),
      ),
    );
  }
  if ("none" in choice) return done(verdict("blocked", choice.none));
  if (item.rarity !== "rare") {
    const rarity = rarityWord(item, lang);
    return done(
      verdict(
        "blocked",
        rarity
          ? t(`Los Orbes de sacrificio solo valen en piezas raras, y esta es ${rarity}.`, `The Orbs of Sacrifice only work on rare items, and this one is ${rarity}.`)
          : t("Los Orbes de sacrificio solo valen en piezas raras, y esto no lo es.", "The Orbs of Sacrifice only work on rare items, and this isn't one."),
      ),
    );
  }
  const state = item.craftingState;
  if (state && !state.corrupted && !state.doubleCorrupted && !state.mirrored && !state.unmodifiable) {
    return done(
      verdict(
        "blocked",
        t(
          "Esta pieza no está corrupta. Los Orbes de sacrificio mejoran un encantamiento corrupto: solo se aplican a piezas corruptas.",
          "This item isn't corrupted. The Orbs of Sacrifice upgrade a corruption enchantment: they only apply to corrupted items.",
        ),
      ),
    );
  }
  const blockedByState = stateVerdict(item, family, lang, { allowCorrupted: true });
  if (blockedByState) return done(blockedByState);
  if (enchantments.length === 0) {
    return done(
      verdict(
        "blocked",
        t(
          "La pieza está corrupta pero no veo ningún encantamiento en el texto pegado. Sin encantamiento corrupto no hay nada que mejorar.",
          "The item is corrupted but I can't see any enchantment in the pasted text. With no corruption enchantment there's nothing to upgrade.",
        ),
      ),
    );
  }
  if ("unknown" in choice) return done(verdict("needs-data", choice.unknown));

  const removal = randomRemoval(item, plan.protectedModifierIds, lang);
  const outlook = [
    enchantments.length === 1
      ? t(
          "Mejorará el encantamiento de la pieza. No sé en qué se convierte: ese dato no lo tengo.",
          "It will upgrade the item's enchantment. I don't know what it turns into: I don't have that data.",
        )
      : t(
          `La pieza tiene ${enchantments.length} encantamientos y el texto dice que mejora uno. No sé cuál ni en qué se convierte.`,
          `The item has ${enchantments.length} enchantments and the text says it upgrades one. I don't know which, or what it turns into.`,
        ),
    ...removal.lines,
    t(
      "No tiene vuelta atrás: la pieza está corrupta y el modificador que se va no vuelve.",
      "There's no going back: the item is corrupted and the modifier that goes won't return.",
    ),
  ];

  return done(
    {
      status: removal.explicitModifierCount === 0 ? "needs-data" : "compatible",
      reason: t(
        `A esta pieza le toca el ${choice.orb.name.es}: mejora su encantamiento corrupto y, a cambio, le quita un modificador al azar.`,
        `This item takes ${choice.orb.name.en}: it upgrades its corruption enchantment and, in exchange, removes one random modifier.`,
      ),
      outlook,
    },
    { lossOdds: removal.lossOdds },
  );
}

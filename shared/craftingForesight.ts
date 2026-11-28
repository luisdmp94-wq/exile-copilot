import { z } from "zod";
import type { Item } from "./domain.js";
import {
  PLANNER_RULES_PATCH,
  PLANNER_RULES_READ_AT,
  explicitModifiers,
  patchVerdict,
  pick,
  stateVerdict,
  type PlannerLang,
  type PlannerSource,
  type PlannerVerdict,
} from "./craftingPlannerRules.js";

/**
 * Planificador de previsión: el Mechón de Hinekora (tarea 19 del plan).
 *
 * En septiembre (`shared/craftingForesight.ts` de la rama
 * `crafting-real-item-coach`) el jugador copiaba el nombre y la descripción
 * del objeto y de la moneda que quería prever, y marcaba tres casillas. Aquí
 * el texto sale del propio objeto, leído el 28-11-2026 en poe2db: la tarjeta
 * dice si se le puede poner a la pieza y para qué le sirve.
 *
 * En el juego en español se llama «Mechón de Hinekora» (no «Cierre»).
 * No calcula ni adivina el resultado previsto: eso lo enseña el juego.
 */
export const HINEKORA_LOCK_SOURCE: PlannerSource = {
  name: { es: "Mechón de Hinekora", en: "Hinekora's Lock" },
  text: {
    es: [
      "Permite que un objeto anticipe el resultado del próximo objeto monetario que se va a usar sobre él",
      "Si modificas el objeto de alguna forma, se pierde la capacidad de anticipación",
    ],
    en: [
      "Allows an item to foresee the result of the next Currency item used on it",
      "Modifying the item in any way removes the ability to foresee",
    ],
  },
  url: { es: "https://poe2db.tw/sp/Hinekoras_Lock", en: "https://poe2db.tw/us/Hinekoras_Lock" },
  readAt: PLANNER_RULES_READ_AT,
  patch: PLANNER_RULES_PATCH,
  official: {
    title: "Content Update 0.3.0 — The Third Edict",
    url: "https://www.pathofexile.com/forum/view-thread/3826682",
  },
};

export const ForesightPlanInputSchema = z.object({
  patch: z.string().trim().min(1).max(50),
  /** Los modificadores que el jugador ha marcado como «quiero conservar». */
  protectedModifierIds: z.array(z.string().min(1).max(200)).max(40),
});
export type ForesightPlanInput = z.infer<typeof ForesightPlanInputSchema>;

export interface ForesightEvaluation extends PlannerVerdict {
  /** El Mechón no cambia la pieza: solo deja ver lo que haría la siguiente moneda. */
  changesItem: false;
  /** Explícitos marcados para conservar que hay en la pieza. */
  wantedModifierCount: number;
}

/** ¿Se le puede poner el Mechón de Hinekora a esta pieza, y para qué sirve? */
export function evaluateForesightPlan(item: Item, input: ForesightPlanInput, lang: PlannerLang = "es"): ForesightEvaluation {
  const plan = ForesightPlanInputSchema.parse(input);
  const t = pick(lang);
  const name = HINEKORA_LOCK_SOURCE.name[lang];
  const explicit = explicitModifiers(item);
  const wanted = explicit.filter((modifier) => plan.protectedModifierIds.includes(modifier.id)).length;
  const done = (verdict: PlannerVerdict): ForesightEvaluation => ({ ...verdict, changesItem: false, wantedModifierCount: wanted });

  const patch = patchVerdict(plan.patch, name, lang);
  if (patch) return done(patch);

  const state = item.craftingState;
  if (state && (state.corrupted || state.doubleCorrupted) && !state.mirrored && !state.unmodifiable) {
    // Hay monedas que se usan en piezas corruptas (los Orbes de sacrificio),
    // pero el texto del Mechón no dice si él mismo se puede poner en una.
    return done({
      status: "needs-data",
      reason: t(
        `La pieza está corrupta y el texto del ${name} no dice si se puede poner en una pieza corrupta. Ponlo encima en el juego: si no te deja, no vale.`,
        `The item is corrupted and the ${name} text doesn't say whether it can go on a corrupted item. Hover it over the item in game: if it won't let you, it doesn't work.`,
      ),
      outlook: [],
    });
  }
  const blockedByState = stateVerdict(item, name, lang);
  if (blockedByState) return done(blockedByState);

  const outlook = [
    t(
      "Después de ponerlo, el juego te enseña qué haría la siguiente moneda antes de gastarla.",
      "Once it's on, the game shows you what the next currency would do before you spend it.",
    ),
    t(
      "Vale para una sola moneda: en cuanto la pieza cambie de cualquier forma, se pierde.",
      "It covers a single currency: as soon as the item changes in any way, it's gone.",
    ),
  ];
  if (item.rarity === "rare" && wanted > 0) {
    outlook.push(
      t(
        `Tienes ${wanted} ${wanted === 1 ? "modificador marcado" : "modificadores marcados"} para conservar. Te sirve antes de una moneda que quita o fija uno al azar (Orbe de caos, Orbe de anulación, Orbe fracturante): ves dónde cae antes de gastarla.`,
        `You have ${wanted} ${wanted === 1 ? "modifier" : "modifiers"} marked to keep. It pays off before a currency that removes or locks one at random (Chaos Orb, Orb of Annulment, Fracturing Orb): you see where it lands before spending it.`,
      ),
    );
  } else {
    outlook.push(
      t(
        "Guárdalo para una moneda cara o sin vuelta atrás: en una barata no compensa.",
        "Save it for an expensive or irreversible currency: on a cheap one it isn't worth it.",
      ),
    );
  }
  outlook.push(
    t(
      "El texto no dice qué pasa si el resultado no te gusta y miras otra moneda distinta. No lo doy por hecho: léelo en el juego.",
      "The text doesn't say what happens if you dislike the result and check a different currency. I won't assume it: read it in game.",
    ),
  );

  return done({
    status: "compatible",
    reason: t(
      `Se puede usar: el ${name} no cambia la pieza. Le deja ver el resultado de la próxima moneda antes de gastarla.`,
      `You can use it: ${name} doesn't change the item. It lets it foresee the result of the next currency before you spend it.`,
    ),
    outlook,
  });
}

import { z } from "zod";
import type { Item } from "./domain.js";
import {
  PLANNER_RULES_PATCH,
  PLANNER_RULES_READ_AT,
  patchVerdict,
  pick,
  rarityWord,
  stateVerdict,
  type PlannerLang,
  type PlannerVerdict,
} from "./craftingPlannerRules.js";

/**
 * Planificador de flujos (tarea 19 del plan).
 *
 * Hay cuatro flujos de resistencias: tres pasan las resistencias elementales
 * de una pieza a un solo elemento (fuego, hielo o rayo) y el cuarto las pasa a
 * caos. En septiembre (`shared/craftingFluxes.ts` de la rama
 * `crafting-real-item-coach`) el jugador copiaba el nombre y la descripción
 * del flujo, elegía los dos elementos y marcaba las líneas afectadas. Aquí la
 * tarjeta lee las líneas de resistencia de la pieza y dice, para cada flujo,
 * cuáles cambian y en qué se quedan, con la tabla de equivalencias del juego.
 *
 * No son flujos de resistencias el «Flujo taumatúrgico» (sube gemas
 * kalguranas) ni el «Flujo perfecto» (sube las habilidades de un objeto).
 *
 * Lo que NO se sabe y se dice: si conserva el número exacto de la línea, qué
 * pasa cuando quedan dos líneas del mismo elemento, y si toca implícitos o
 * runas. La línea de «todas las resistencias elementales» no sale en la tabla.
 */

export type FluxId = "blazing" | "chilling" | "crackling" | "void";
export type FluxElement = "fire" | "cold" | "lightning" | "chaos";

export interface Flux {
  id: FluxId;
  name: Record<PlannerLang, string>;
  /** El texto del objeto en el juego, tal como lo publica poe2db. */
  text: Record<PlannerLang, string>;
  from: readonly FluxElement[];
  to: FluxElement;
  url: Record<PlannerLang, string>;
}

export const FLUXES: readonly Flux[] = [
  {
    id: "blazing",
    name: { es: "Flujo ardiente", en: "Blazing Flux" },
    text: {
      es: "Transforma todos los modificadores de resistencia de hielo y rayo de un objeto en modificadores equivalentes de resistencia al fuego",
      en: "Transforms all Cold and Lightning Resistance modifiers on an item to equivalent Fire Resistance modifiers",
    },
    from: ["cold", "lightning"],
    to: "fire",
    url: { es: "https://poe2db.tw/sp/Blazing_Flux", en: "https://poe2db.tw/us/Blazing_Flux" },
  },
  {
    id: "chilling",
    name: { es: "Flujo escarchante", en: "Chilling Flux" },
    text: {
      es: "Transforma todos los modificadores de resistencia de fuego y rayo de un objeto en modificadores equivalentes de resistencia al hielo",
      en: "Transforms all Fire and Lightning Resistance modifiers on an item to equivalent Cold Resistance modifiers",
    },
    from: ["fire", "lightning"],
    to: "cold",
    url: { es: "https://poe2db.tw/sp/Chilling_Flux", en: "https://poe2db.tw/us/Chilling_Flux" },
  },
  {
    id: "crackling",
    name: { es: "Flujo electrizante", en: "Crackling Flux" },
    text: {
      // El texto en español del juego nombra también el rayo como origen; el
      // inglés dice «Fire and Cold». Se enseña cada uno tal cual.
      es: "Transforma todos los modificadores de resistencia de fuego, hielo y rayo de un objeto en modificadores equivalentes de resistencia al rayo",
      en: "Transforms all Fire and Cold Resistance modifiers on an item to equivalent Lightning Resistance modifiers",
    },
    from: ["fire", "cold"],
    to: "lightning",
    url: { es: "https://poe2db.tw/sp/Crackling_Flux", en: "https://poe2db.tw/us/Crackling_Flux" },
  },
  {
    id: "void",
    name: { es: "Flujo del vacío", en: "Void Flux" },
    text: {
      es: "Transforma todos los modificadores de resistencias de fuego, hielo y rayo de un objeto en modificadores equivalentes de resistencia al caos",
      en: "Transforms all Fire, Cold and Lightning Resistance modifiers on an item to equivalent Chaos resistance modifiers",
    },
    from: ["fire", "cold", "lightning"],
    to: "chaos",
    url: { es: "https://poe2db.tw/sp/Void_Flux", en: "https://poe2db.tw/us/Void_Flux" },
  },
];

export const FLUX_SOURCE = {
  readAt: PLANNER_RULES_READ_AT,
  patch: PLANNER_RULES_PATCH,
  /** Los cuatro se aplican igual. */
  usedOn: {
    es: "Haz clic derecho en este objeto y luego clic izquierdo en un objeto mágico o raro para aplicarlo.",
    en: "Right click this item then left click on a magic or rare item to apply it.",
  },
  /** La tabla «Mod Equivalencies» de la página de cada flujo. */
  equivalencesUrl: { es: "https://poe2db.tw/sp/Void_Flux", en: "https://poe2db.tw/us/Void_Flux" },
  official: {
    title: "Content Update 0.5.0",
    url: "https://www.pathofexile.com/forum/view-thread/3932540",
  },
} as const;

/**
 * Tabla de equivalencias del juego para una resistencia sola: el rango de
 * fuego, hielo o rayo y el rango de caos que le corresponde. Entre los tres
 * elementos el rango no cambia.
 */
export const FLUX_SINGLE_TO_CHAOS: ReadonlyArray<{ elemental: readonly [number, number]; chaos: readonly [number, number] }> = [
  { elemental: [6, 10], chaos: [4, 7] },
  { elemental: [11, 15], chaos: [8, 11] },
  { elemental: [16, 20], chaos: [12, 15] },
  { elemental: [21, 25], chaos: [16, 19] },
  { elemental: [26, 30], chaos: [16, 19] },
  { elemental: [31, 35], chaos: [20, 23] },
  { elemental: [36, 40], chaos: [20, 23] },
  { elemental: [41, 45], chaos: [24, 27] },
];
/** «+X% a las resistencias al fuego y al caos»: dos filas de la tabla, según el rango. */
export const FLUX_WITH_CHAOS_TO_CHAOS: ReadonlyArray<{ elemental: readonly [number, number]; chaos: readonly [number, number] }> = [
  { elemental: [13, 17], chaos: [24, 27] },
  { elemental: [3, 31], chaos: [3, 41] },
];
/** «Las pasivas notables dentro del radio también otorgan…» (joyas): (5—7) % pasa a (4—5) % de caos. */
export const FLUX_RADIUS_TO_CHAOS = { elemental: [5, 7], chaos: [4, 5] } as const;

type LineShape = "single" | "maximum" | "with-chaos" | "radius";

interface ResistanceLine {
  modifierId: string;
  /** La línea sin el rango de la tirada: «+14% a la resistencia al fuego». */
  text: string;
  shape: LineShape;
  element: FluxElement;
  value: number;
  /** El rango que enseña el texto avanzado, si lo hay. */
  range: readonly [number, number] | null;
  fractured: boolean;
}

const ELEMENT_WORDS: Record<string, FluxElement> = {
  fuego: "fire",
  hielo: "cold",
  rayo: "lightning",
  caos: "chaos",
  fire: "fire",
  cold: "cold",
  lightning: "lightning",
  chaos: "chaos",
};

export const FLUX_ELEMENT_NAMES: Record<FluxElement, Record<PlannerLang, string>> = {
  fire: { es: "fuego", en: "Fire" },
  cold: { es: "hielo", en: "Cold" },
  lightning: { es: "rayo", en: "Lightning" },
  chaos: { es: "caos", en: "Chaos" },
};

const ROLL = String.raw`\+?(\d+)(?:\((\d+)-(\d+)\))?%`;
const EL = "(fuego|hielo|rayo|caos|fire|cold|lightning|chaos)";
const EL3 = "(fuego|hielo|rayo|fire|cold|lightning)";
const SHAPES: Array<[RegExp, LineShape]> = [
  [new RegExp(String.raw`^${ROLL} a la resistencia al ${EL}$`), "single"],
  [new RegExp(String.raw`^${ROLL} to ${EL} resistance$`), "single"],
  [new RegExp(String.raw`^${ROLL} a la resistencia al ${EL} maxima$`), "maximum"],
  [new RegExp(String.raw`^${ROLL} to maximum ${EL} resistance$`), "maximum"],
  [new RegExp(String.raw`^${ROLL} a las resistencias al ${EL3} y al caos$`), "with-chaos"],
  [new RegExp(String.raw`^${ROLL} to ${EL3} and chaos resistances$`), "with-chaos"],
  [new RegExp(String.raw`^las habilidades pasivas notables dentro del radio tambien otorgan ${ROLL} a la resistencia al ${EL}$`), "radius"],
  [new RegExp(String.raw`^notable passive skills in radius also grant ${ROLL} to ${EL} resistance$`), "radius"],
];
const MENTIONS_RESISTANCE = /resistenc|resistanc/;
const ROLL_RANGE = /\((-?\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)/g;

const normalized = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function readLine(raw: string): Omit<ResistanceLine, "modifierId" | "fractured"> | "unknown" | null {
  const line = normalized(raw);
  if (!MENTIONS_RESISTANCE.test(line)) return null;
  for (const [pattern, shape] of SHAPES) {
    const match = pattern.exec(line);
    if (!match) continue;
    const element = ELEMENT_WORDS[match[4] ?? ""];
    if (!element) return "unknown";
    const range = match[2] !== undefined && match[3] !== undefined ? ([Number(match[2]), Number(match[3])] as const) : null;
    return { text: raw.replace(ROLL_RANGE, "").trim(), shape, element, value: Number(match[1]), range };
  }
  return "unknown";
}

export const FluxPlanInputSchema = z.object({
  patch: z.string().trim().min(1).max(50),
});
export type FluxPlanInput = z.infer<typeof FluxPlanInputSchema>;

export interface FluxChange {
  modifierId: string;
  /** La línea de hoy. */
  from: string;
  /** En qué se queda, en palabras. */
  to: string;
}

export interface FluxOption {
  id: FluxId;
  name: string;
  /** El elemento al que lo pasa todo. */
  target: string;
  changes: FluxChange[];
  /** Avisos de este flujo en esta pieza (dos líneas iguales, una fracturada…). */
  warnings: string[];
}

export interface FluxEvaluation extends PlannerVerdict {
  /** Qué haría cada uno de los cuatro flujos en esta pieza. Vacío si no se puede usar ninguno. */
  options: FluxOption[];
  /** Líneas de resistencia explícitas que la tabla del juego nombra. */
  resistanceLineCount: number;
  /** Líneas que hablan de resistencias y que no sé si un flujo cambia. */
  unknownLines: string[];
  irreversible: true;
}

function bucket(
  line: Pick<ResistanceLine, "value" | "range">,
  rows: ReadonlyArray<{ elemental: readonly [number, number]; chaos: readonly [number, number] }>,
  options: { exactOnly: boolean },
): readonly [number, number] | null {
  if (line.range) {
    const exact = rows.find((row) => row.elemental[0] === line.range![0] && row.elemental[1] === line.range![1]);
    if (exact) return exact.chaos;
  }
  if (options.exactOnly) return null;
  const byValue = rows.filter((row) => line.value >= row.elemental[0] && line.value <= row.elemental[1]);
  return byValue.length === 1 ? byValue[0]!.chaos : null;
}

function changeText(line: ResistanceLine, flux: Flux, lang: PlannerLang): string {
  const t = pick(lang);
  const to = FLUX_ELEMENT_NAMES[flux.to][lang];
  if (flux.to !== "chaos") {
    switch (line.shape) {
      case "single":
        return t(`resistencia al ${to}, mismo rango`, `${to} Resistance, same range`);
      case "maximum":
        return t(`+${line.value}% a la resistencia al ${to} máxima`, `+${line.value}% to Maximum ${to} Resistance`);
      case "with-chaos":
        return t(`resistencias al ${to} y al caos, mismo rango`, `${to} and Chaos Resistances, same range`);
      case "radius":
        return t(`resistencia al ${to} en las pasivas notables del radio, mismo rango`, `${to} Resistance on Notable passives in radius, same range`);
    }
  }
  const range = (chaos: readonly [number, number] | null, tail: Record<PlannerLang, string>): string =>
    chaos
      ? t(`+(${chaos[0]}—${chaos[1]})% a la resistencia al caos${tail.es}`, `+(${chaos[0]}—${chaos[1]})% to Chaos Resistance${tail.en}`)
      : t(
          `resistencia al caos${tail.es}; no encuentro su rango en la tabla del juego`,
          `Chaos Resistance${tail.en}; I can't find its range in the game's table`,
        );
  switch (line.shape) {
    case "single":
      return range(bucket(line, FLUX_SINGLE_TO_CHAOS, { exactOnly: false }), { es: "", en: "" });
    case "maximum":
      return t(`+${line.value}% a la resistencia al caos máxima`, `+${line.value}% to Maximum Chaos Resistance`);
    case "with-chaos":
      return range(bucket(line, FLUX_WITH_CHAOS_TO_CHAOS, { exactOnly: true }), { es: " (una sola línea)", en: " (a single line)" });
    case "radius":
      return range(FLUX_RADIUS_TO_CHAOS.chaos, { es: " en las pasivas notables del radio", en: " on Notable passives in radius" });
  }
}

/** ¿Se puede usar un flujo en esta pieza, y qué haría cada uno? */
export function evaluateFluxPlan(item: Item, input: FluxPlanInput, lang: PlannerLang = "es"): FluxEvaluation {
  const plan = FluxPlanInputSchema.parse(input);
  const t = pick(lang);
  const family = t("los flujos", "fluxes");
  const lines: ResistanceLine[] = [];
  const unknownLines: string[] = [];
  let otherKinds = 0;
  for (const modifier of item.modifiers) {
    for (const raw of modifier.text.split("\n")) {
      const read = readLine(raw.trim());
      if (read === null) continue;
      if (modifier.kind !== "explicit") {
        if (modifier.kind !== "quality") otherKinds += 1;
        continue;
      }
      if (read === "unknown") unknownLines.push(raw.replace(ROLL_RANGE, "").trim());
      else lines.push({ ...read, modifierId: modifier.id, fractured: modifier.fractured === true });
    }
  }
  const done = (verdict: PlannerVerdict, options: FluxOption[] = []): FluxEvaluation => ({
    ...verdict,
    options,
    resistanceLineCount: lines.length,
    unknownLines,
    irreversible: true,
  });
  const verdict = (status: PlannerVerdict["status"], reason: string): PlannerVerdict => ({ status, reason, outlook: [] });

  const patch = patchVerdict(plan.patch, family, lang);
  if (patch) return done(patch);
  if (item.rarity !== "magic" && item.rarity !== "rare") {
    const rarity = rarityWord(item, lang);
    return done(
      verdict(
        "blocked",
        rarity
          ? t(`Los flujos solo valen en piezas mágicas o raras, y esta es ${rarity}.`, `Fluxes only work on magic or rare items, and this one is ${rarity}.`)
          : t("Los flujos solo valen en piezas mágicas o raras, y esto no lo es.", "Fluxes only work on magic or rare items, and this isn't one."),
      ),
    );
  }
  const blockedByState = stateVerdict(item, family, lang);
  if (blockedByState) return done(blockedByState);

  const elemental = lines.filter((line) => line.element !== "chaos");
  if (elemental.length === 0) {
    if (unknownLines.length > 0 || otherKinds > 0) {
      return done(
        verdict(
          "needs-data",
          unknownLines.length > 0
            ? t(
                "La pieza habla de resistencias, pero no con una línea de las que nombra la tabla de equivalencias del juego. No sé si un flujo la cambia.",
                "The item mentions resistances, but not with a line the game's equivalence table names. I don't know whether a flux changes it.",
              )
            : t(
                "La resistencia de esta pieza no es un modificador explícito (es implícita o de una runa). No sé si un flujo la cambia.",
                "This item's resistance isn't an explicit modifier (it's an implicit or a rune). I don't know whether a flux changes it.",
              ),
        ),
      );
    }
    return done(
      verdict(
        "blocked",
        t(
          "No veo modificadores de resistencia al fuego, al hielo ni al rayo en esta pieza: ningún flujo le cambiaría nada.",
          "I can't see any Fire, Cold or Lightning Resistance modifiers on this item: no flux would change anything.",
        ),
      ),
    );
  }

  const options: FluxOption[] = FLUXES.map((flux) => {
    const changing = elemental.filter((line) => flux.from.includes(line.element));
    const warnings: string[] = [];
    const target = FLUX_ELEMENT_NAMES[flux.to][lang];
    // Dos líneas de la misma forma acabarían en el mismo elemento.
    const landing = lines.filter((line) => line.element === flux.to || changing.includes(line));
    // Hacia caos, «fuego y caos» se queda en una línea sola de caos.
    const shapes = new Set(landing.map((line) => (flux.to === "chaos" && line.shape === "with-chaos" ? "single" : line.shape)));
    if (changing.length > 0 && shapes.size < landing.length) {
      warnings.push(
        t(
          `Quedarían dos líneas iguales de resistencia al ${target}. El texto no dice qué pasa entonces: míralo en el juego antes de gastarlo.`,
          `You'd end up with two identical ${target} Resistance lines. The text doesn't say what happens then: check in game before spending it.`,
        ),
      );
    }
    if (changing.some((line) => line.fractured)) {
      warnings.push(
        t(
          "Una de esas líneas está fracturada (fija). No sé si el flujo la cambia.",
          "One of those lines is fractured (locked). I don't know whether the flux changes it.",
        ),
      );
    }
    return {
      id: flux.id,
      name: flux.name[lang],
      target,
      changes: changing.map((line) => ({ modifierId: line.modifierId, from: line.text, to: changeText(line, flux, lang) })),
      warnings,
    };
  });

  const outlook = [
    t(
      "El juego dice «equivalentes»: la línea cambia de elemento y, según su tabla, conserva el rango (hacia caos el rango baja). No sé si conserva el número exacto que tienes ahora.",
      "The game says \"equivalent\": the line changes element and, per its table, keeps its range (towards Chaos the range drops). I don't know whether it keeps the exact number you have now.",
    ),
    t(
      "Entre fuego, hielo y rayo se puede volver a cambiar con otro flujo. Lo que pase a caos ya no vuelve: ningún flujo transforma la resistencia al caos.",
      "Between Fire, Cold and Lightning you can change it again with another flux. Whatever goes to Chaos stays: no flux transforms Chaos Resistance.",
    ),
  ];
  if (unknownLines.length > 0) {
    outlook.push(
      t(
        `Hay ${unknownLines.length === 1 ? "una línea de resistencias que no sale" : `${unknownLines.length} líneas de resistencias que no salen`} en la tabla del juego (${unknownLines.map((line) => `«${line}»`).join(", ")}). No sé si un flujo la${unknownLines.length === 1 ? "" : "s"} cambia.`,
        `There ${unknownLines.length === 1 ? "is a resistance line that isn't" : `are ${unknownLines.length} resistance lines that aren't`} in the game's table (${unknownLines.map((line) => `"${line}"`).join(", ")}). I don't know whether a flux changes ${unknownLines.length === 1 ? "it" : "them"}.`,
      ),
    );
  }
  if (otherKinds > 0) {
    outlook.push(
      t(
        "La pieza tiene además resistencia implícita o de runa. No sé si un flujo la toca.",
        "The item also has implicit or rune resistance. I don't know whether a flux touches it.",
      ),
    );
  }

  return done(
    {
      status: "compatible",
      reason: t(
        `Se puede usar un flujo: esta pieza tiene ${elemental.length} ${elemental.length === 1 ? "modificador de resistencia elemental que puede" : "modificadores de resistencia elemental que pueden"} cambiar de elemento.`,
        `You can use a flux: this item has ${elemental.length} elemental resistance ${elemental.length === 1 ? "modifier that can" : "modifiers that can"} change element.`,
      ),
      outlook,
    },
    options,
  );
}

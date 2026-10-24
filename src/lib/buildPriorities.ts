import type { CharacterProfile, ItemSlot, Resistances } from "@shared/domain.js";
import { CHECK_TEXT, type CheckLang, type CheckText } from "./checkText";

/**
 * Prioridades del chequeo de build: qué arreglar primero, en lenguaje claro.
 *
 * Solo se incluyen comprobaciones que se pueden justificar con el dato leído
 * y aritmética, sin umbrales inventados:
 *  - resistencias elementales por debajo del máximo por defecto (75%);
 *  - resistencia al caos negativa;
 *  - huecos de equipo vacíos.
 * El daño recibido de un tipo es proporcional a (100 − resistencia), así que
 * comparar ese factor con el del objetivo da el «cuánto más daño recibes».
 *
 * En campaña el 75% sigue siendo el objetivo, pero cada acto resta un 10% y
 * llegar a él pronto es casi imposible: la gravedad se suaviza (ver
 * `elementalSeverity`) y se explica la penalización en vez de alarmar.
 */

/** Dónde está el personaje: lo elige el jugador, no se deduce del nivel. */
export type CheckStage = "campaign" | "maps";

export type PrioritySeverity = "alta" | "media" | "baja";

/**
 * Lo único que necesitan las reglas. Sale de un código PoB2 o del formulario
 * manual, así que ambos caminos dan exactamente las mismas prioridades.
 */
export interface BuildCheckInput {
  resistances: Resistances;
  /** Huecos con objeto. null = no se sabe (p. ej. un código PoB2 sin equipo). */
  equippedSlots: ItemSlot[] | null;
}

export interface BuildPriority {
  id: "resistencias-elementales" | "huecos-equipo" | "resistencia-caos";
  severity: PrioritySeverity;
  title: string;
  /** Una línea por dato leído, p. ej. «Fuego 52% · te faltan 23 puntos». */
  facts: string[];
  why: string;
}

/** Máximo por defecto de las resistencias elementales en PoE2. */
export const ELEMENTAL_RESISTANCE_TARGET = 75;
/** Mínimo razonable para el caos: por debajo de 0 se recibe daño extra. */
export const CHAOS_RESISTANCE_TARGET = 0;
/**
 * Referencia para la campaña. No es un dato de GGG: es la recomendación de las
 * guías de la comunidad (Maxroll, PoE Vault: «al menos un 30% en campaña»), y
 * la página la presenta como tal.
 */
export const CAMPAIGN_RESISTANCE_GUIDE = 30;

const ELEMENTS = ["fire", "cold", "lightning"] as const;

/** Huecos que toda build lleva ocupados; la mano secundaria depende del arma. */
export const REQUIRED_SLOTS: ItemSlot[] = [
  "weapon",
  "helmet",
  "body",
  "gloves",
  "boots",
  "belt",
  "amulet",
  "ring1",
  "ring2",
];

const SEVERITY_ORDER: Record<PrioritySeverity, number> = { alta: 0, media: 1, baja: 2 };

/** «un 92% más» o «6 veces más» de daño recibido frente al objetivo. */
export function extraDamageTaken(resistance: number, target: number, lang: CheckLang): string {
  const text = CHECK_TEXT[lang];
  const ratio = (100 - resistance) / (100 - target);
  if (ratio >= 2) {
    const times = Math.round(ratio * 10) / 10;
    return text.priorities.extraDamage(null, times.toLocaleString(text.locale));
  }
  return text.priorities.extraDamage(Math.round((ratio - 1) * 100), null);
}

function formatResistance(value: number): string {
  return `${value < 0 ? "−" : ""}${Math.abs(value)}%`;
}

/**
 * En mapas manda la distancia al 75%. En campaña: por debajo de 0 se recibe más
 * daño que sin resistencia (urgente), por debajo de la referencia de las guías
 * es importante y por encima solo queda seguir subiendo.
 */
function elementalSeverity(worst: number, stage: CheckStage): PrioritySeverity {
  if (stage === "campaign") {
    return worst < 0 ? "alta" : worst < CAMPAIGN_RESISTANCE_GUIDE ? "media" : "baja";
  }
  const gap = ELEMENTAL_RESISTANCE_TARGET - worst;
  return gap >= 20 ? "alta" : gap >= 8 ? "media" : "baja";
}

function elementalPriority(
  input: BuildCheckInput,
  text: CheckText,
  lang: CheckLang,
  stage: CheckStage,
): BuildPriority | null {
  const low = ELEMENTS.flatMap((key) => {
    const value = input.resistances[key];
    return value !== null && value < ELEMENTAL_RESISTANCE_TARGET ? [{ key, value }] : [];
  });
  if (low.length === 0) return null;

  const worst = low.reduce((a, b) => (b.value < a.value ? b : a));
  const why = text.priorities.elementalWhy(
    text.damageNames[worst.key],
    formatResistance(worst.value),
    extraDamageTaken(worst.value, ELEMENTAL_RESISTANCE_TARGET, lang),
  );
  return {
    id: "resistencias-elementales",
    severity: elementalSeverity(worst.value, stage),
    title: stage === "campaign" ? text.priorities.elementalTitleCampaign : text.priorities.elementalTitle,
    facts: low.map(({ key, value }) =>
      text.priorities.elementalFact(
        text.resistanceLabels[key],
        formatResistance(value),
        ELEMENTAL_RESISTANCE_TARGET - value,
      ),
    ),
    why: stage === "campaign" ? `${why} ${text.priorities.campaignNote(CAMPAIGN_RESISTANCE_GUIDE)}` : why,
  };
}

function chaosPriority(
  input: BuildCheckInput,
  text: CheckText,
  lang: CheckLang,
  stage: CheckStage,
): BuildPriority | null {
  const chaos = input.resistances.chaos;
  if (chaos === null || chaos >= CHAOS_RESISTANCE_TARGET) return null;
  return {
    id: "resistencia-caos",
    // En campaña el caos pesa poco frente a las elementales: nunca pasa por delante.
    severity: stage === "maps" && chaos <= -20 ? "media" : "baja",
    title: text.priorities.chaosTitle,
    facts: [text.priorities.chaosFact(formatResistance(chaos), -chaos)],
    why: text.priorities.chaosWhy(
      formatResistance(chaos),
      extraDamageTaken(chaos, CHAOS_RESISTANCE_TARGET, lang),
    ),
  };
}

function emptySlotsPriority(input: BuildCheckInput, text: CheckText): BuildPriority | null {
  if (input.equippedSlots === null) return null;
  const occupied = new Set(input.equippedSlots);
  const empty = REQUIRED_SLOTS.filter((slot) => !occupied.has(slot));
  if (empty.length === 0) return null;

  const missingCore = empty.some((slot) => slot === "weapon" || slot === "body");
  return {
    id: "huecos-equipo",
    severity: missingCore || empty.length >= 3 ? "alta" : "media",
    title: text.priorities.slotsTitle(empty.length),
    facts: [text.priorities.slotsFact(empty.map((slot) => text.slots[slot]).join(", "))],
    why: text.priorities.slotsWhy,
  };
}

/** Entrada de las reglas a partir de un personaje importado de PoB2. */
export function checkInputFromProfile(profile: CharacterProfile): BuildCheckInput {
  return {
    resistances: profile.resistances,
    // Un código sin ningún objeto es un árbol sin equipo, no nueve huecos vacíos.
    equippedSlots: profile.items.length === 0 ? null : profile.items.map((item) => item.slot),
  };
}

/** Hasta 3 prioridades, de la más grave a la menos. Lista vacía = nada urgente. */
export function prioritiesForInput(
  input: BuildCheckInput,
  lang: CheckLang,
  stage: CheckStage,
): BuildPriority[] {
  const text = CHECK_TEXT[lang];
  return [
    elementalPriority(input, text, lang, stage),
    emptySlotsPriority(input, text),
    chaosPriority(input, text, lang, stage),
  ]
    .filter((priority): priority is BuildPriority => priority !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);
}

export function findBuildPriorities(
  profile: CharacterProfile,
  lang: CheckLang,
  stage: CheckStage,
): BuildPriority[] {
  return prioritiesForInput(checkInputFromProfile(profile), lang, stage);
}

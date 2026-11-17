import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
  type CraftingActionId,
} from "./craftingActions.js";
import {
  LOW_ELEMENTAL_RESISTANCE,
  evaluateCraftingCharacterContext,
  hasCraftingCharacterContext,
} from "./craftingCharacterContext.js";
import { EXPECTED_RESULT_RARITY, type CraftingComparison } from "./craftingComparison.js";
import { diagnoseCraftingItem, type CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import { assessCraftingImportIssue } from "./craftingImportReport.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
  type CraftingGoalSignal,
} from "./craftingGoal.js";
import {
  COACH_FOCUS_DIRECTION,
  COACH_FOCUS_LABELS,
  COACH_FOCUS_LABELS_EN,
  evaluateCoachFocus,
  inferCoachFocus,
  type CoachFocus,
} from "./craftingFocus.js";
import {
  decideCraftingNextStep,
  type CraftingNextDecisionKind,
} from "./craftingNextDecision.js";
import {
  assessObservedModifierRoll,
  type ObservedRollBand,
} from "./craftingRollQuality.js";
import {
  evaluateCraftingWeaponPerformance,
  type CraftingWeaponPerformance,
} from "./craftingWeaponPerformance.js";
import {
  RESISTANCE_LABELS,
  type BuildTarget,
  type CharacterProfile,
  type GoalKind,
  type Item,
  type ItemRarity,
} from "./domain.js";

/**
 * GUÍA DE CRAFTING CON UNA PIEZA REAL.
 *
 * Capa PURA: traduce a lenguaje corriente lo que los motores ya demuestran
 * (`diagnoseCraftingItem`, `evaluateObservedCraftingActions`,
 * `compareCraftingResult`, `evaluateCraftingGoalSignal`). No duplica el motor
 * de legalidad. Solo puede situar una tirada dentro del rango visible que
 * imprime el juego; no inventa mods, pools, pesos, probabilidades ni precios.
 *
 * Todo lo que afirma procede de la evidencia local observada el 22/08/2026.
 */

// ---------------------------------------------------------------------------
// Qué objeto estamos mirando
// ---------------------------------------------------------------------------

export type CoachDirection = "damage" | "defence";

/**
 * Alcance real de lo que el jugador está pidiendo. Una mejora incremental se
 * puede resolver con el recorrido de una moneda cada vez. Un único o una pieza
 * de endgame son proyectos distintos y nunca deben degradarse silenciosamente
 * a «elige daño o defensa».
 */
export type CoachGoalIntent =
  | "incremental"
  | "unique-acquisition"
  | "endgame-project";

const RARITY_WORD: Partial<Record<ItemRarity, string>> = {
  normal: "normal",
  magic: "mágico",
  rare: "raro",
};

const RARITY_WORD_EN: Partial<Record<ItemRarity, string>> = {
  normal: "normal",
  magic: "magic",
  rare: "rare",
};

type CoachLang = "es" | "en";

function rarityWordFor(rarity: ItemRarity, lang: CoachLang): string | undefined {
  return (lang === "en" ? RARITY_WORD_EN : RARITY_WORD)[rarity];
}

/**
 * Nombres oficiales en inglés de las monedas observadas. El catálogo
 * `OBSERVED_CRAFTING_ACTIONS` está redactado en español; aquí solo se
 * traduce por id, sin tocar el catálogo ni su evidencia.
 */
const ACTION_LABEL_EN: Record<CraftingActionId, string> = {
  transmutation: "Orb of Transmutation",
  augmentation: "Orb of Augmentation",
  regal: "Regal Orb",
  exalted: "Exalted Orb",
};

const ACTION_EFFECT_EN: Record<CraftingActionId, string> = {
  transmutation: "Turns a normal item into a magic item with 1 modifier.",
  augmentation: "Adds 1 random modifier to a magic item.",
  regal: "Turns a magic item into a rare item, keeps its modifiers and adds 1.",
  exalted: "Adds 1 random modifier to a rare item.",
};

const RESISTANCE_LABEL_EN: Record<"fire" | "cold" | "lightning", string> = {
  fire: "fire resistance",
  cold: "cold resistance",
  lightning: "lightning resistance",
};

function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase("en") + value.slice(1);
}

function focusLabelFor(focus: CoachFocus, lang: CoachLang): string {
  return lang === "en" ? COACH_FOCUS_LABELS_EN[focus] : COACH_FOCUS_LABELS[focus];
}

export interface CoachItemReading {
  rarityWord: string;
  explicitCount: number;
  prefixCount: number;
  suffixCount: number;
  observedTotalLimit: number | null;
  openSlots: number | null;
  /** Una frase, sin jerga: qué es y qué le cabe. */
  sentence: string;
  /** Qué se conserva pase lo que pase con una moneda que solo añade. */
  keepsSentence: string;
  readable: boolean;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Resumen del objeto en lenguaje natural, sin contadores sueltos ni enums. */
export function readItemInPlainWords(item: Item, lang: "es" | "en" = "es"): CoachItemReading {
  if (lang === "en") return readItemInPlainWordsEn(item);
  const diagnosis = diagnoseCraftingItem(item);
  const rarityWord = RARITY_WORD[item.rarity] ?? "de un tipo que todavía no sé leer";
  const {
    prefixCount,
    suffixCount,
    unclassifiedExplicitCount,
    explicitCount,
    observedTotalLimit,
    observedOpenSlots,
  } = diagnosis;

  const prefijos = `${prefixCount} ${plural(prefixCount, "prefijo", "prefijos")}`;
  const sufijos = `${suffixCount} ${plural(suffixCount, "sufijo", "sufijos")}`;
  const estructura =
    prefixCount === 0 && suffixCount === 0
      ? "no tiene prefijos ni sufijos"
      : prefixCount === 0
        ? `no tiene prefijos y tiene ${sufijos}`
        : suffixCount === 0
          ? `tiene ${prefijos} y no tiene sufijos`
          : `tiene ${prefijos} y ${sufijos}`;
  // Si alguna línea explícita no está clasificada, el total permite conocer
  // cuántas líneas leyó el parser, pero no dibujar huecos de prefijo/sufijo con
  // seguridad. Presentarlo como «0 prefijos + 1 sufijo = lleno» contradice los
  // propios datos y empuja al jugador a tomar una decisión falsa.
  const presentableOpenSlots = unclassifiedExplicitCount > 0 ? null : observedOpenSlots;

  let sentence: string;
  if (item.rarity === "normal" && explicitCount === 0) {
    const assignedPassives = item.modifiers.filter(
      (modifier) =>
        modifier.kind === "enchant" && /^(?:asigna|allocates?)\s+/iu.test(modifier.text),
    ).length;
    const implicitCount = item.modifiers.filter((modifier) => modifier.kind === "implicit").length;
    const fixedEffects = [
      assignedPassives > 0
        ? `${assignedPassives} ${plural(assignedPassives, "pasiva asignada", "pasivas asignadas")}`
        : null,
      implicitCount > 0
        ? `${implicitCount} ${plural(implicitCount, "implícito", "implícitos")}`
        : null,
    ].filter((value): value is string => value !== null);
    sentence = "Es una pieza normal: todavía no tiene afijos explícitos.";
    if (fixedEffects.length > 0) {
      sentence += ` Sus efectos fijos (${fixedEffects.join(" y ")}) no ocupan prefijos ni sufijos.`;
    }
  } else if (unclassifiedExplicitCount > 0) {
    sentence =
      `Es ${rarityWord} y he leído ${explicitCount} ${plural(explicitCount, "modificador", "modificadores")}: ` +
      `${estructura}, pero ${unclassifiedExplicitCount} ${plural(unclassifiedExplicitCount, "línea sigue", "líneas siguen")} sin clasificar. ` +
      "No puedo confirmar los huecos hasta volver a copiarlo con Ctrl+Alt+C.";
  } else if (presentableOpenSlots === null) {
    sentence = `Es ${rarityWord} y tiene ${explicitCount} ${plural(explicitCount, "modificador", "modificadores")}.`;
  } else if (presentableOpenSlots === 0) {
    sentence = `Es ${rarityWord}: ${estructura}. Está lleno: no cabe nada más.`;
  } else {
    sentence =
      `Es ${rarityWord}: ${estructura}. Todavía ` +
      `${plural(presentableOpenSlots, "cabe uno más", `caben ${presentableOpenSlots} más`)}.`;
  }

  return {
    rarityWord,
    explicitCount,
    prefixCount,
    suffixCount,
    observedTotalLimit,
    openSlots: presentableOpenSlots,
    sentence,
    keepsSentence:
      explicitCount === 0
        ? "Todavía no hay nada que conservar."
        : `Lo que ya tiene se conserva: estas monedas solo añaden, nunca quitan.`,
    readable: diagnosis.state === "complete",
  };
}

/** Misma lectura que `readItemInPlainWords`, redactada en inglés. */
function readItemInPlainWordsEn(item: Item): CoachItemReading {
  const diagnosis = diagnoseCraftingItem(item);
  const rarityWord = RARITY_WORD_EN[item.rarity] ?? "of a kind I can't read yet";
  const {
    prefixCount,
    suffixCount,
    unclassifiedExplicitCount,
    explicitCount,
    observedTotalLimit,
    observedOpenSlots,
  } = diagnosis;

  const prefixes = `${prefixCount} ${plural(prefixCount, "prefix", "prefixes")}`;
  const suffixes = `${suffixCount} ${plural(suffixCount, "suffix", "suffixes")}`;
  const structure =
    prefixCount === 0 && suffixCount === 0
      ? "it has no prefixes or suffixes"
      : prefixCount === 0
        ? `it has no prefixes and ${suffixes}`
        : suffixCount === 0
          ? `it has ${prefixes} and no suffixes`
          : `it has ${prefixes} and ${suffixes}`;
  const presentableOpenSlots = unclassifiedExplicitCount > 0 ? null : observedOpenSlots;
  const itemWord = RARITY_WORD_EN[item.rarity] === undefined
    ? `an item ${rarityWord}`
    : `a ${rarityWord} item`;

  let sentence: string;
  if (item.rarity === "normal" && explicitCount === 0) {
    const assignedPassives = item.modifiers.filter(
      (modifier) =>
        modifier.kind === "enchant" && /^(?:asigna|allocates?)\s+/iu.test(modifier.text),
    ).length;
    const implicitCount = item.modifiers.filter((modifier) => modifier.kind === "implicit").length;
    const fixedEffects = [
      assignedPassives > 0
        ? `${assignedPassives} ${plural(assignedPassives, "allocated passive", "allocated passives")}`
        : null,
      implicitCount > 0
        ? `${implicitCount} ${plural(implicitCount, "implicit", "implicits")}`
        : null,
    ].filter((value): value is string => value !== null);
    sentence = "It's a normal item: it has no explicit affixes yet.";
    if (fixedEffects.length > 0) {
      sentence += ` Its fixed effects (${fixedEffects.join(" and ")}) don't take up prefixes or suffixes.`;
    }
  } else if (unclassifiedExplicitCount > 0) {
    sentence =
      `It's ${itemWord} and I read ${explicitCount} ${plural(explicitCount, "modifier", "modifiers")}: ` +
      `${structure}, but ${unclassifiedExplicitCount} ${plural(unclassifiedExplicitCount, "line is", "lines are")} still unclassified. ` +
      "I can't confirm the open slots until you copy it again with Ctrl+Alt+C.";
  } else if (presentableOpenSlots === null) {
    sentence = `It's ${itemWord} with ${explicitCount} ${plural(explicitCount, "modifier", "modifiers")}.`;
  } else if (presentableOpenSlots === 0) {
    sentence = `It's ${itemWord}: ${structure}. It's full: nothing else fits.`;
  } else {
    sentence =
      `It's ${itemWord}: ${structure}. ` +
      `${plural(presentableOpenSlots, "One more fits", `${presentableOpenSlots} more fit`)}.`;
  }

  return {
    rarityWord,
    explicitCount,
    prefixCount,
    suffixCount,
    observedTotalLimit,
    openSlots: presentableOpenSlots,
    sentence,
    keepsSentence:
      explicitCount === 0
        ? "There's nothing to keep yet."
        : "What it already has stays: these orbs only add, they never remove.",
    readable: diagnosis.state === "complete",
  };
}

// ---------------------------------------------------------------------------
// Qué quiere el jugador
// ---------------------------------------------------------------------------

export interface CoachDirectionGuess {
  direction: CoachDirection | null;
  /** Por qué se pudo (o no) deducir. Siempre se enseña al jugador. */
  reason: string;
}

export interface CoachGoalInterpretation {
  intent: CoachGoalIntent;
  direction: CoachDirection | null;
  /** Objetivo observable exacto. null = «daño/defensa» aún es demasiado amplio. */
  focus: CoachFocus | null;
  /** Texto breve y honesto que explica qué entendió —o qué falta aclarar—. */
  reason: string;
  /** Líneas reales del snapshot que coinciden literalmente con «no perder…». */
  protectedModifiers: Array<{ id: string; text: string }>;
  /** Peticiones de protección que no pudieron vincularse a ninguna línea. */
  unresolvedProtections: string[];
}

const DAMAGE_GOAL_WORDS = [
  "dano",
  "dps",
  "ataque",
  "critico",
  "precision",
  "proyectil",
  "proyectiles",
  "flecha",
  "flechas",
  "velocidad de ataque",
] as const;

const DEFENCE_GOAL_WORDS = [
  "defensa",
  "defensivo",
  "vida",
  "armadura",
  "evasion",
  "escudo de energia",
  "resistencia",
  "resistencias",
  "aguantar",
  "supervivencia",
  "tanque",
] as const;

/**
 * Las mismas direcciones escritas en inglés. Van como palabras completas
 * (\b…\b) porque varias son lo bastante cortas para aparecer dentro de una
 * palabra española («crit» en «escrito»). Se reconocen en los dos idiomas:
 * un jugador puede escribir en inglés aunque tenga la web en español.
 */
const DAMAGE_GOAL_WORDS_EN =
  /\b(?:damage|dps|attacks?|attack speed|crits?|critical|accuracy|projectiles?|arrows?|offen[cs]e|offensive)\b/;

const DEFENCE_GOAL_WORDS_EN =
  /\b(?:defen[cs]e|defensive|life|hp|armou?r|evasion|energy shield|resists?|resistances?|res|survive|survival|survivability|tank|tanky)\b/;

function normalizeGoalText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

const PROTECTION_MARKER =
  /\b(?:sin\s+(?:perder|sacrificar)|(?:no\s+)?quiero\s+perder|manteniendo|mantener|conservando|conservar|protegiendo|proteger|without\s+(?:losing|sacrificing)|(?:(?:do\s+not|don'?t)\s+)?want\s+to\s+lose|keeping|keep|protecting|protect)\b/i;

const PROTECTION_STOP_WORDS = new Set([
  "a",
  "actual",
  "actuales",
  "al",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "linea",
  "lineas",
  "los",
  "mi",
  "mis",
  "mod",
  "mods",
  "modificador",
  "modificadores",
  "que",
  "un",
  "una",
  "y",
  // Inglés: mismas palabras de relleno.
  "and",
  "current",
  "line",
  "lines",
  "modifier",
  "modifiers",
  "the",
  "this",
  "with",
]);

const CANONICAL_PROTECTION_TOKEN: Record<string, string> = {
  habilidades: "habilidad",
  proyectiles: "proyectil",
  resistencias: "resistencia",
  ataques: "ataque",
  atributos: "atributo",
  skills: "skill",
  projectiles: "projectile",
  resistances: "resistance",
  attacks: "attack",
  attributes: "attribute",
};

function protectionTokens(value: string): string[] {
  return normalizeGoalText(value)
    .replace(/[^a-z0-9ñ]+/g, " ")
    .split(" ")
    .map((token) => CANONICAL_PROTECTION_TOKEN[token] ?? token)
    .filter((token) => token.length >= 3 && !PROTECTION_STOP_WORDS.has(token));
}

function protectionSegments(value: string): { primary: string; requested: string[] } {
  const normalized = normalizeGoalText(value);
  const match = PROTECTION_MARKER.exec(normalized);
  if (match?.index === undefined) return { primary: normalized, requested: [] };
  const primary = normalized.slice(0, match.index).trim();
  const tail = normalized.slice(match.index + match[0].length).trim();
  return {
    primary,
    requested: tail
      .split(/\s+(?:y|ni|and|or|nor)\s+|[,;]/)
      .map((segment) => segment.trim())
      .filter(Boolean),
  };
}

function matchProtectedModifiers(
  requested: readonly string[],
  item: Pick<Item, "modifiers"> | undefined,
): Pick<CoachGoalInterpretation, "protectedModifiers" | "unresolvedProtections"> {
  if (requested.length === 0) {
    return { protectedModifiers: [], unresolvedProtections: [] };
  }
  if (item === undefined) {
    return { protectedModifiers: [], unresolvedProtections: [...requested] };
  }

  const protectedById = new Map<string, { id: string; text: string }>();
  const unresolvedProtections: string[] = [];
  for (const request of requested) {
    const wanted = protectionTokens(request);
    if (wanted.length === 0) {
      unresolvedProtections.push(request);
      continue;
    }
    const matches = item.modifiers.filter((modifier) => {
      if (modifier.kind !== "explicit") return false;
      const observed = new Set(
        protectionTokens(
          [modifier.text, modifier.name, ...(modifier.tags ?? [])].filter(Boolean).join(" "),
        ),
      );
      return wanted.every((token) => observed.has(token));
    });
    if (matches.length === 0) {
      unresolvedProtections.push(request);
      continue;
    }
    for (const modifier of matches) {
      protectedById.set(modifier.id, { id: modifier.id, text: modifier.text });
    }
  }
  return {
    protectedModifiers: [...protectedById.values()],
    unresolvedProtections,
  };
}

/**
 * Preguntas sobre el PERSONAJE, no sobre la pieza abierta: «¿por qué no hago
 * daño?», «me matan los jefes», «¿qué gemas uso?». Crafting no puede
 * responderlas y debe mandar al Mentor en vez de forzar «daño o defensa».
 * «Quiero más daño de caos» sigue siendo un objetivo de crafting válido.
 */
const CHARACTER_PROBLEM_PATTERNS: readonly RegExp[] = [
  /\bno hago (?:nada de |mucho |suficiente |casi )?dano\b/,
  /\bhago (?:muy )?poco dano\b/,
  /\bme falta dano\b/,
  /\bvoy (?:muy )?(?:por detras|flojo|corto) (?:en|de) dano\b/,
  /\bme (?:matan|mata|revientan)\b/,
  /\b(?:muero|me muero|morir) (?:mucho|siempre|todo el rato|en)\b/,
  /\bno (?:mato|puedo matar|consigo matar)\b/,
  /\bpor ?que (?:no |me |muero|hago)/,
  /\b(?:que|cuales) (?:gemas?|habilidades|pasivas|apoyos|build)\b/,
  /\b(?:arbol de pasivas|ascendencia|mis pasivas|mis gemas|mi build)\b/,
  /\bwhy (?:do|am|can|don'?t|is) i\b/,
  /\b(?:low|no|not enough) damage\b/,
  /\bi (?:keep )?(?:die|dying)\b/,
  /\b(?:which|what) (?:gems?|skills|passives|supports|build)\b/,
  /\b(?:passive tree|ascendancy|my passives|my gems|my build)\b/,
];

export function looksLikeCharacterQuestion(value: string): boolean {
  const normalized = normalizeGoalText(value).replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ");
  if (normalized === "") return false;
  return CHARACTER_PROBLEM_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Interpreta únicamente la DIRECCIÓN general escrita por el jugador.
 *
 * No convierte texto libre en una receta ni adivina mods. Si aparecen dos
 * direcciones o ninguna señal reconocible, devuelve `null` para que la
 * interfaz pida una aclaración antes de recomendar un gasto.
 */
export function interpretCoachGoal(
  value: string,
  item?: Pick<Item, "modifiers">,
  lang: "es" | "en" = "es",
): CoachGoalInterpretation {
  const en = lang === "en";
  const normalized = normalizeGoalText(value);
  const { primary, requested } = protectionSegments(value);
  const protections = matchProtectedModifiers(requested, item);
  if (normalized === "") {
    return {
      intent: "incremental",
      direction: null,
      focus: null,
      reason: en
        ? "Tell me what you'd like to get out of this item."
        : "Cuéntame qué te gustaría conseguir con esta pieza.",
      ...protections,
    };
  }

  const asksForUnique = /\b(?:unic[oa]s?|unique)\b/.test(primary);
  const asksForEndgame =
    /\b(?:endgame|definitiv[oa]s?|perfect[oa]s?|bis|best in slot|mirror(?: tier)?|god(?: tier)?|toch[a-z]*)\b/.test(
      primary,
    );

  // Buscar o evaluar un único no es el mismo problema que mejorar el objeto
  // abierto. La interfaz debe sacar al jugador del bucle de monedas antes de
  // preguntarle por una estadística.
  if (asksForUnique) {
    return {
      intent: "unique-acquisition",
      direction: null,
      focus: null,
      reason: en
        ? "You asked for a unique item, not a step-by-step upgrade of this item. First I need to know which unique you're after and compare it with your character; don't spend orbs on this item just out of habit."
        : "Has pedido un objeto único, no una mejora incremental de esta pieza. Primero necesito saber qué único concreto buscas y compararlo con tu personaje; no gastes monedas en esta pieza por inercia.",
      ...protections,
    };
  }

  const intent: CoachGoalIntent = asksForEndgame ? "endgame-project" : "incremental";

  const damage =
    DAMAGE_GOAL_WORDS.some((word) => primary.includes(word)) || DAMAGE_GOAL_WORDS_EN.test(primary);
  const defence =
    DEFENCE_GOAL_WORDS.some((word) => primary.includes(word)) || DEFENCE_GOAL_WORDS_EN.test(primary);
  const explicitFocus = inferCoachFocus(primary);
  const explicitDirection = explicitFocus === null ? null : COACH_FOCUS_DIRECTION[explicitFocus];
  const asksForDamage = damage || explicitDirection === "damage";
  const asksForDefence = defence || explicitDirection === "defence";

  if (asksForDamage && asksForDefence) {
    return {
      intent,
      direction: null,
      focus: null,
      reason: en
        ? "I see a damage goal and a defence goal. Pick which one you want to work on first."
        : "Veo un objetivo de daño y otro de defensa. Elige cuál quieres trabajar primero.",
      ...protections,
    };
  }
  if (asksForDamage) {
    const focus = explicitFocus;
    return {
      intent,
      direction: "damage",
      focus,
      reason: en
        ? focus === null
          ? "I know you want damage, but I need to know which kind to judge each result."
          : `Got it: first you want ${COACH_FOCUS_LABELS_EN[focus]}.`
        : focus === null
          ? "Sé que buscas daño, pero necesito saber qué tipo para juzgar cada resultado."
          : `He entendido que primero buscas ${COACH_FOCUS_LABELS[focus]}.`,
      ...protections,
    };
  }
  if (asksForDefence) {
    const focus = explicitFocus;
    return {
      intent,
      direction: "defence",
      focus,
      reason: en
        ? focus === null
          ? "I know you want defence, but I need to know which kind to judge each result."
          : `Got it: first you want ${COACH_FOCUS_LABELS_EN[focus]}.`
        : focus === null
          ? "Sé que buscas defensa, pero necesito saber cuál para juzgar cada resultado."
          : `He entendido que primero buscas ${COACH_FOCUS_LABELS[focus]}.`,
      ...protections,
    };
  }
  return {
    intent,
    direction: null,
    focus: null,
    reason: en
      ? intent === "endgame-project"
        ? "You asked for an endgame project. One matching affix isn't enough to call it finished: I need the character, the equipped item, the budget and the full list of requirements."
        : "I understand your words, but I can't safely turn them into a crafting direction. Let's first settle whether you want damage or defence."
      : intent === "endgame-project"
        ? "Has pedido un proyecto de endgame. Un afijo que coincida no basta para darlo por terminado: necesito el personaje, la pieza equipada, el presupuesto y la lista completa de requisitos."
        : "Entiendo tus palabras, pero no puedo convertirlas con seguridad en una dirección de crafting. Aclaremos primero si buscas daño o defensa.",
    ...protections,
  };
}

const DIRECTION_CATEGORY: Record<CoachDirection, CraftingGoalCategory> = {
  damage: "damage",
  defence: "defence",
};

/** Con artículo: «Buscas mejorar el daño». */
export const COACH_DIRECTION_LABELS: Record<CoachDirection, string> = {
  damage: "el daño",
  defence: "la defensa",
};

/** Sin artículo: «etiquetas de daño». */
export const COACH_DIRECTION_NOUNS: Record<CoachDirection, string> = {
  damage: "daño",
  defence: "defensa",
};

/** Versión inglesa de `COACH_DIRECTION_LABELS` («You want to improve damage»). */
export const COACH_DIRECTION_LABELS_EN: Record<CoachDirection, string> = {
  damage: "damage",
  defence: "defence",
};

/** Versión inglesa de `COACH_DIRECTION_NOUNS` («damage tags»). */
export const COACH_DIRECTION_NOUNS_EN: Record<CoachDirection, string> = {
  damage: "damage",
  defence: "defence",
};

export function coachDirectionLabel(direction: CoachDirection, lang: "es" | "en" = "es"): string {
  return (lang === "en" ? COACH_DIRECTION_LABELS_EN : COACH_DIRECTION_LABELS)[direction];
}

export function coachDirectionNoun(direction: CoachDirection, lang: "es" | "en" = "es"): string {
  return (lang === "en" ? COACH_DIRECTION_NOUNS_EN : COACH_DIRECTION_NOUNS)[direction];
}

/**
 * «No sé qué necesita».
 *
 * NO se deduce de la pieza. Que un objeto lleve modificadores de daño no
 * demuestra que necesite más daño: eso sería confundir lo que hay con lo que
 * falta. Solo se responde cuando el EXPEDIENTE declara una carencia concreta y
 * comprobable, y entonces se cita el dato exacto.
 *
 * Hoy la única carencia que el repositorio sabe leer así es una resistencia
 * elemental por debajo del umbral que ya usa el expediente.
 */
export function suggestDirectionFromCharacter(
  profile: Pick<CharacterProfile, "resistances"> | null,
  lang: "es" | "en" = "es",
): CoachDirectionGuess {
  const en = lang === "en";
  const cannotDecide = en
    ? "I can't decide that by looking at this item alone."
    : "No puedo decidirlo mirando solo esta pieza.";
  if (profile === null) {
    return {
      direction: null,
      reason: cannotDecide,
    };
  }

  const bajas = (["fire", "cold", "lightning"] as const)
    .map((kind) => ({ kind, value: profile.resistances[kind] }))
    .filter((entry): entry is { kind: "fire" | "cold" | "lightning"; value: number } =>
      entry.value !== null && entry.value < LOW_ELEMENTAL_RESISTANCE,
    );

  if (bajas.length === 0) {
    return {
      direction: null,
      reason: cannotDecide,
    };
  }

  const detalle = bajas
    .map((entry) => `${(en ? RESISTANCE_LABEL_EN : RESISTANCE_LABELS)[entry.kind]} ${entry.value}%`)
    .join(", ");
  return {
    direction: "defence",
    reason: en
      ? `Your character file shows ${detalle}, below ${LOW_ELEMENTAL_RESISTANCE}%.`
      : `Tu expediente declara ${detalle}, por debajo de ${LOW_ELEMENTAL_RESISTANCE}%.`,
  };
}

// ---------------------------------------------------------------------------
// Cuál es la única siguiente acción razonable
// ---------------------------------------------------------------------------

export interface CoachAlternative {
  actionId: CraftingActionId;
  label: string;
  /** Qué cambia respecto de la acción principal, en una frase. */
  difference: string;
}

/**
 * TRES EJES INDEPENDIENTES. Mezclarlos es lo que hace parecer a una interfaz
 * más lista de lo que es.
 *
 *  - `legality`   ¿la moneda puede aplicarse sobre esta pieza? Lo decide la
 *                 estructura (rareza, huecos, estados), nada más.
 *  - `steering`   ¿puede dirigirse el resultado hacia algo concreto? Con las
 *                 cuatro monedas observadas, NO.
 *  - `goalFit`    ¿encaja con lo que el jugador busca? Antes de craftear no es
 *                 confirmable; después se lee del resultado real.
 */
export type CoachLegality = "legal" | "blocked" | "needs-data";

export type CoachSteering =
  /** Reservado: hoy ninguna moneda básica observada dirige el resultado. */
  | "directed"
  /** El efecto observado declara literalmente que el modificador es aleatorio. */
  | "random-declared"
  /** El tooltip observado no dice cuál aparece: no puede anticiparse. */
  | "undeclared";

export type CoachGoalFit = "confirmed" | "not-confirmed" | "not-evaluable";

/** Umbral elegido por el jugador sobre el rango que imprime el tooltip. */
export type CoachRollMinimum = "any" | "middle" | "high";

export type CoachRollMinimumStatus =
  | "fulfilled"
  | "below"
  | "unverifiable"
  | "not-applicable";

export interface CoachRollMinimumAssessment {
  status: CoachRollMinimumStatus;
  minimum: CoachRollMinimum;
  label: string;
}

export const COACH_ROLL_MINIMUM_LABELS: Record<CoachRollMinimum, string> = {
  any: "cualquier tirada",
  middle: "tirada media o alta",
  high: "tirada alta",
};

export const COACH_ROLL_MINIMUM_LABELS_EN: Record<CoachRollMinimum, string> = {
  any: "any roll",
  middle: "a middle or high roll",
  high: "a high roll",
};

export function coachRollMinimumLabel(minimum: CoachRollMinimum, lang: "es" | "en" = "es"): string {
  return (lang === "en" ? COACH_ROLL_MINIMUM_LABELS_EN : COACH_ROLL_MINIMUM_LABELS)[minimum];
}

/**
 * Compara exclusivamente la posición dentro del rango visible del tooltip.
 * No convierte el porcentaje observado en probabilidad ni lo compara con el
 * pool global, que la aplicación no conoce.
 */
export function assessCoachRollMinimum(
  minimum: CoachRollMinimum,
  modifiers: readonly import("./domain.js").Modifier[],
  focus: CoachFocus | null,
  lang: "es" | "en" = "es",
): CoachRollMinimumAssessment {
  const en = lang === "en";
  const matching = modifiers.filter(
    (modifier) => evaluateCoachFocus(focus, [modifier]).status === "direct",
  );
  if (matching.length === 0) {
    return {
      status: "not-applicable",
      minimum,
      label: en
        ? "The result has no affix that matches the goal."
        : "El resultado no contiene un afijo que coincida con el objetivo.",
    };
  }
  if (minimum === "any") {
    return {
      status: "fulfilled",
      minimum,
      label: en
        ? "The affix matches; you accepted any roll you can see."
        : "El afijo coincide; aceptaste cualquier tirada observable.",
    };
  }

  const bands = matching.map((modifier) => assessObservedModifierRoll(modifier).band);
  const comparable = bands.filter(
    (band): band is "low" | "middle" | "high" =>
      band === "low" || band === "middle" || band === "high",
  );
  if (comparable.length === 0) {
    return {
      status: "unverifiable",
      minimum,
      label: en
        ? "The tooltip doesn't show a range to check your minimum roll against."
        : "El tooltip no muestra un rango con el que comprobar tu tirada mínima.",
    };
  }
  const fulfilled = comparable.some(
    (band) => band === "high" || (minimum === "middle" && band === "middle"),
  );
  return {
    status: fulfilled ? "fulfilled" : "below",
    minimum,
    label: en
      ? fulfilled
        ? `The roll reaches your minimum: ${COACH_ROLL_MINIMUM_LABELS_EN[minimum]}.`
        : `The affix matches, but it doesn't reach your minimum: ${COACH_ROLL_MINIMUM_LABELS_EN[minimum]}.`
      : fulfilled
        ? `La tirada alcanza tu mínimo: ${COACH_ROLL_MINIMUM_LABELS[minimum]}.`
        : `El afijo coincide, pero no alcanza tu mínimo: ${COACH_ROLL_MINIMUM_LABELS[minimum]}.`,
  };
}

export type CoachNextStep =
  | {
      kind: "needs-data";
      legality: "needs-data";
      headline: string;
      instruction: string;
      why: string;
      /** Todo lo que falta, sin esconder los demás bloqueos tras el primero. */
      missingEvidence: string[];
    }
  | {
      kind: "use-currency";
      legality: "legal";
      steering: CoachSteering;
      goalFit: CoachGoalFit;
      actionId: CraftingActionId;
      label: string;
      /** Qué usar y sobre qué objeto. */
      instruction: string;
      why: string;
      /** Aleatoriedad. SIEMPRE visible: nunca se pliega dentro del detalle. */
      randomnessNotice: string;
      /** Qué NO puede hacer esta moneda por la dirección elegida. Visible. */
      directionNotice: string | null;
      /** Solo cuando hay una consecuencia estructural real. */
      warning: string | null;
      /** Qué puede ocurrir, sin prometer nada. Va plegado. */
      whatCanHappen: string[];
      alternatives: CoachAlternative[];
      evidence: string[];
    }
  | {
      kind: "stop";
      legality: "blocked";
      headline: string;
      instruction: string;
      why: string;
      /** La parada pide revisar esta pieza real en el expediente antes de gastar. */
      reviewInExpediente: boolean;
      /** Herramientas que exigen reemplazar; viven en el banco avanzado. */
      needsAdvancedTools: boolean;
      evidence: string[];
    };

const ACTION_BY_ID = new Map(OBSERVED_CRAFTING_ACTIONS.map((action) => [action.id, action]));

function actionLabel(actionId: CraftingActionId, lang: CoachLang = "es"): string {
  if (lang === "en") return ACTION_LABEL_EN[actionId] ?? actionId;
  return ACTION_BY_ID.get(actionId)?.label ?? actionId;
}

/**
 * Desempate entre varias monedas compatibles.
 *
 * NO es un juicio de calidad: el motor de rutas se niega expresamente a
 * ordenarlas como mejor o peor y esta capa lo respeta. La regla es estructural
 * y comprobable: se propone primero la acción que NO cambia la rareza, porque
 * la que sí la cambia seguirá disponible después y la otra no.
 */
function preferredAction(item: Item, compatible: readonly CraftingActionId[]): CraftingActionId {
  const keepsRarity = compatible.filter(
    (actionId) => EXPECTED_RESULT_RARITY[actionId] === item.rarity,
  );
  return keepsRarity[0] ?? compatible[0]!;
}

/**
 * Orientación de una moneda, leída de su efecto OBSERVADO.
 *
 * Aumento y Exaltado declaran «modificador aleatorio». Transmutación y Regio no
 * dicen cuál aparece, y «no mostrado» nunca significa «dirigible». Ninguna de
 * las cuatro permite apuntar a una categoría, así que ninguna se etiqueta como
 * dirigida.
 */
function steeringOf(actionId: CraftingActionId): CoachSteering {
  const effect = ACTION_BY_ID.get(actionId)?.effect ?? "";
  return /aleatorio/i.test(effect) ? "random-declared" : "undeclared";
}

const RANDOMNESS_NOTICE: Record<Exclude<CoachSteering, "directed">, string> = {
  "random-declared": "El modificador que añade es aleatorio.",
  "undeclared": "No se puede saber qué modificador añadirá.",
};

const RANDOMNESS_NOTICE_EN: Record<Exclude<CoachSteering, "directed">, string> = {
  "random-declared": "The modifier it adds is random.",
  "undeclared": "There's no way to know which modifier it will add.",
};

function whatCanHappen(item: Item, actionId: CraftingActionId, lang: CoachLang = "es"): string[] {
  const en = lang === "en";
  const lines = en
    ? [
        "The modifier you get is random: there's no way to know which one before using the orb.",
        "Exile Copilot has no verified list of what can appear, so it won't tell you which one is more likely.",
      ]
    : [
        "El modificador que salga es aleatorio: no se puede saber cuál antes de usar la moneda.",
        "Exile Copilot no tiene una lista verificada de lo que puede aparecer, así que no te dirá cuál es más probable.",
      ];
  const resultRarity = EXPECTED_RESULT_RARITY[actionId];
  if (resultRarity !== item.rarity) {
    lines.push(
      en
        ? `The item will go from ${RARITY_WORD_EN[item.rarity] ?? item.rarity} to ${RARITY_WORD_EN[resultRarity] ?? resultRarity}.`
        : `La pieza pasará de ${RARITY_WORD[item.rarity] ?? item.rarity} a ${RARITY_WORD[resultRarity] ?? resultRarity}.`,
    );
  }
  lines.push(
    en
      ? "What it already has stays: this action adds, it doesn't replace."
      : "Lo que ya tiene seguirá ahí: esta acción añade, no reemplaza.",
  );
  return lines;
}

/** Aviso solo cuando la estructura demuestra una consecuencia real. */
function structuralWarning(
  item: Item,
  actionId: CraftingActionId,
  diagnosis: CraftingItemDiagnosis,
  lang: CoachLang = "es",
): string | null {
  const en = lang === "en";
  const resultRarity = EXPECTED_RESULT_RARITY[actionId];
  if (resultRarity !== item.rarity) {
    const lost = OBSERVED_CRAFTING_ACTIONS.filter(
      (action) => action.targetRarity === item.rarity && action.id !== actionId,
    ).map((action) => actionLabel(action.id, lang));
    if (lost.length > 0) {
      return en
        ? `Once the rarity changes, you won't be able to use ${lost.join(" or ")} on this item anymore.`
        : `Al cambiar de rareza dejarás de poder usar ${lost.join(" y ")} sobre esta pieza.`;
    }
  }
  if (
    diagnosis.observedOpenSlots !== null &&
    diagnosis.observedTotalLimit !== null &&
    diagnosis.observedOpenSlots === 1 &&
    resultRarity === item.rarity
  ) {
    return en
      ? `This takes you to the observed limit of ${diagnosis.observedTotalLimit}. After that, nothing else will fit.`
      : `Con esto llegas al límite observado de ${diagnosis.observedTotalLimit}. Después no cabrá nada más.`;
  }
  return null;
}

/**
 * Reduce todo el banco a UNA decisión: usar una moneda concreta, conseguir el
 * dato que falta, o parar. La dirección elegida por el jugador NO cambia qué es
 * legal —eso lo decide la estructura— y el guía lo dice sin disfrazarlo.
 */
export function chooseNextStep(
  item: Item,
  /** Lo que el jugador busca. NO cambia qué es legal; solo qué se le advierte. */
  direction: CoachDirection | null = null,
  lang: "es" | "en" = "es",
): CoachNextStep {
  const en = lang === "en";
  const diagnosis = diagnoseCraftingItem(item, lang);
  const evaluations = evaluateObservedCraftingActions(item, undefined, lang);
  const compatible = evaluations
    .filter((entry) => entry.status === "compatible")
    .map((entry) => entry.action.id);

  if (diagnosis.state !== "complete") {
    const importIssue = assessCraftingImportIssue(item, diagnosis, lang);
    return {
      kind: "needs-data",
      legality: "needs-data",
      headline: importIssue.title,
      instruction: diagnosis.nextAction,
      why: importIssue.summary,
      missingEvidence: diagnosis.blockers,
    };
  }

  if (compatible.length === 0) {
    const full = item.rarity === "rare" && diagnosis.observedOpenSlots === 0;
    if (en) {
      return {
        kind: "stop",
        legality: "blocked",
        headline: full ? "Stop: this item is already full" : "Stop: no compatible action",
        instruction: full
          ? "Keep it and try it on your character. These four orbs can't add anything else."
          : "Don't spend any orb on this item yet.",
        why: full
          ? `It has the ${diagnosis.observedTotalLimit} modifiers of the observed limit. Adding another would mean replacing one, which is a different operation and carries risk.`
          : evaluations.find((entry) => entry.status !== "compatible")?.reason ??
            "None of the observed orbs fits the item's current state.",
        reviewInExpediente: false,
        needsAdvancedTools: full,
        evidence: evaluations.map((entry) => `${actionLabel(entry.action.id, lang)}: ${entry.reason}`),
      };
    }
    return {
      kind: "stop",
      legality: "blocked",
      headline: full ? "Para: esta pieza ya está llena" : "Para: no hay ninguna acción compatible",
      instruction: full
        ? "Consérvala y pruébala en el personaje. Estas cuatro monedas ya no pueden añadir nada."
        : "No gastes ninguna moneda todavía sobre esta pieza.",
      why: full
        ? `Tiene los ${diagnosis.observedTotalLimit} modificadores del límite observado. Añadir otro exigiría reemplazar uno, que es otra operación y tiene riesgo.`
        : evaluations.find((entry) => entry.status !== "compatible")?.reason ??
          "Ninguna de las monedas observadas encaja con el estado actual del objeto.",
      reviewInExpediente: false,
      needsAdvancedTools: full,
      evidence: evaluations.map((entry) => `${entry.action.label}: ${entry.reason}`),
    };
  }

  const actionId = preferredAction(item, compatible);
  const action = ACTION_BY_ID.get(actionId)!;
  const alternatives: CoachAlternative[] = compatible
    .filter((candidate) => candidate !== actionId)
    .map((candidate) => {
      const resultRarity = EXPECTED_RESULT_RARITY[candidate];
      return {
        actionId: candidate,
        label: actionLabel(candidate, lang),
        difference: en
          ? resultRarity === item.rarity
            ? "Keeps the current rarity and adds a modifier."
            : `Besides adding, it turns the item ${RARITY_WORD_EN[resultRarity] ?? resultRarity}.`
          : resultRarity === item.rarity
            ? "Mantiene la rareza actual y añade un modificador."
            : `Además de añadir, convierte la pieza en ${RARITY_WORD[resultRarity] ?? resultRarity}.`,
      };
    });

  const steering = steeringOf(actionId);
  if (en) {
    const labelEn = actionLabel(actionId, lang);
    const rarityEn = rarityWordFor(item.rarity, lang) ?? item.rarity;
    return {
      kind: "use-currency",
      legality: "legal",
      steering,
      goalFit: direction === null ? "not-evaluable" : "not-confirmed",
      actionId,
      label: labelEn,
      instruction: `Use one ${labelEn} on "${item.name}".`,
      why:
        alternatives.length > 0
          ? `It's the only one you can use while the item stays ${rarityEn}. The other option will still be there afterwards.`
          : "It's the only one that fits the item right now.",
      randomnessNotice: RANDOMNESS_NOTICE_EN[steering === "directed" ? "undeclared" : steering],
      directionNotice:
        direction === null
          ? null
          : `This orb can add a modifier, but I can't steer it towards ${COACH_DIRECTION_NOUNS_EN[direction]}.`,
      warning: structuralWarning(item, actionId, diagnosis, lang),
      whatCanHappen: whatCanHappen(item, actionId, lang),
      alternatives,
      evidence: [
        `${labelEn}: ${ACTION_EFFECT_EN[actionId] ?? action.effect}`,
        action.evidence,
        ...(diagnosis.observedTotalLimit === null
          ? []
          : [`Observed total limit for this rarity: ${diagnosis.observedTotalLimit}.`]),
      ],
    };
  }
  return {
    kind: "use-currency",
    // Legal significa «se puede aplicar», no «conviene» ni «sirve para tu
    // objetivo». Esos son los otros dos ejes.
    legality: "legal",
    steering,
    goalFit: direction === null ? "not-evaluable" : "not-confirmed",
    actionId,
    label: action.label,
    instruction: `Usa un ${action.label.toLocaleLowerCase("es")} sobre «${item.name}».`,
    why:
      alternatives.length > 0
        ? `Es la única que puedes usar mientras el objeto siga siendo ${RARITY_WORD[item.rarity] ?? item.rarity}. La otra vía seguirá disponible después.`
        : "Es la única compatible con la pieza ahora mismo.",
    randomnessNotice: RANDOMNESS_NOTICE[steering === "directed" ? "undeclared" : steering],
    directionNotice:
      direction === null
        ? null
        : `Esta moneda puede añadir un modificador, pero no puedo dirigirlo hacia ${COACH_DIRECTION_NOUNS[direction]}.`,
    warning: structuralWarning(item, actionId, diagnosis),
    whatCanHappen: whatCanHappen(item, actionId),
    alternatives,
    evidence: [
      `${action.label}: ${action.effect}`,
      action.evidence,
      ...(diagnosis.observedTotalLimit === null
        ? []
        : [`Límite total observado para esta rareza: ${diagnosis.observedTotalLimit}.`]),
    ],
  };
}

// ---------------------------------------------------------------------------
// ¿Merece la pena trabajar esta base para ESTE objetivo?
// ---------------------------------------------------------------------------

export type CoachBaseAssessmentStatus =
  | "already-satisfied"
  | "review-current"
  | "aligned"
  | "controlled-attempt"
  | "change-base"
  | "needs-data";

export type CoachGoalSource = "player" | "context";

export interface CoachBaseAssessment {
  status: CoachBaseAssessmentStatus;
  title: string;
  summary: string;
  /** Relación demostrable entre el expediente y la pieza; no interpreta la build. */
  characterContext: "linked" | "known-unlinked" | "missing";
  characterLabel: string;
  targetLabel: string;
  decisionLabel: string;
  nextStep: CoachNextStep;
}

function stopForSatisfiedGoal(
  item: Item,
  focus: CoachFocus,
  why: string,
  lang: CoachLang = "es",
): Extract<CoachNextStep, { kind: "stop" }> {
  if (lang === "en") {
    return {
      kind: "stop",
      legality: "blocked",
      headline: "Stop: the item already has the goal",
      instruction: `Don't add another orb to "${item.name || item.baseType}" until you check the current roll and decide whether you already accept it.`,
      why,
      reviewInExpediente: true,
      needsAdvancedTools: false,
      evidence: [`The item already has a line that matches ${COACH_FOCUS_LABELS_EN[focus]}.`],
    };
  }
  return {
    kind: "stop",
    legality: "blocked",
    headline: "Detente: la pieza ya contiene el objetivo",
    instruction: `No añadas otra moneda a «${item.name || item.baseType}» hasta revisar la tirada actual y decidir si ya la aceptas.`,
    why,
    reviewInExpediente: true,
    needsAdvancedTools: false,
    evidence: [`La pieza ya contiene una línea que coincide con ${COACH_FOCUS_LABELS[focus]}.`],
  };
}

function stopForProjectDefinition(
  item: Item,
  intent: Exclude<CoachGoalIntent, "incremental">,
  lang: CoachLang = "es",
): Extract<CoachNextStep, { kind: "stop" }> {
  const unique = intent === "unique-acquisition";
  if (lang === "en") {
    const name = item.name || item.baseType;
    return {
      kind: "stop",
      legality: "blocked",
      headline: unique ? "First, identify the unique" : "First, define the whole project",
      instruction: unique
        ? `Don't spend orbs on "${name}" chasing a unique you haven't identified and compared.`
        : `Don't call "${name}" finished because of a single affix; first list every requirement for the endgame item.`,
      why: unique
        ? "Looking for or judging a unique item isn't a step-by-step upgrade of the open item."
        : "An endgame item is judged as a whole and against your character, not because it shares one tag.",
      reviewInExpediente: false,
      needsAdvancedTools: !unique,
      evidence: [
        unique
          ? "The written goal asks for unique rarity."
          : "The written goal asks for an endgame or final item.",
      ],
    };
  }
  return {
    kind: "stop",
    legality: "blocked",
    headline: unique ? "Primero identifica el único" : "Primero define el proyecto completo",
    instruction: unique
      ? `No gastes monedas en «${item.name || item.baseType}» para perseguir un único sin identificarlo y compararlo.`
      : `No declares terminada «${item.name || item.baseType}» por un solo afijo; define antes todos los requisitos de la pieza de endgame.`,
    why: unique
      ? "Buscar o evaluar un objeto único no es una mejora incremental de la pieza abierta."
      : "Una pieza de endgame se juzga como conjunto y contra el personaje, no por compartir una sola etiqueta.",
    reviewInExpediente: false,
    needsAdvancedTools: !unique,
    evidence: [
      unique
        ? "El objetivo escrito pide rareza única."
        : "El objetivo escrito pide una pieza de endgame o definitiva.",
    ],
  };
}

function stopForUnverifiedContextGoal(
  item: Item,
  focus: CoachFocus,
  lang: CoachLang = "es",
): Extract<CoachNextStep, { kind: "stop" }> {
  if (lang === "en") {
    const focusLabelEn = COACH_FOCUS_LABELS_EN[focus];
    return {
      kind: "stop",
      legality: "blocked",
      headline: "Don't spend blindly on this item",
      instruction: `Your character file says your character needs ${focusLabelEn}, but "${item.name || item.baseType}" shows no line I recognise for that goal. Switch items or check a suitable base inside PoE2 before using any orb.`,
      why: "A gap in your character doesn't prove this item can fill it. Without verified mod pools or odds, recommending an orb would turn a suggestion into a gamble you didn't ask for.",
      reviewInExpediente: false,
      needsAdvancedTools: false,
      evidence: [
        `Your character's context points to ${focusLabelEn}.`,
        `The copied item has no line I recognise as ${focusLabelEn}.`,
        "There are no verified mod pools or odds to steer the next result.",
      ],
    };
  }
  const focusLabel = COACH_FOCUS_LABELS[focus];
  return {
    kind: "stop",
    legality: "blocked",
    headline: "No gastes a ciegas en esta pieza",
    instruction: `El expediente señala que tu personaje necesita ${focusLabel}, pero «${item.name || item.baseType}» no muestra una línea reconocible de ese objetivo. Cambia de pieza o comprueba dentro de PoE2 una base adecuada antes de usar moneda.`,
    why: "Una carencia del personaje no demuestra que esta pieza pueda resolverla. Sin pools ni probabilidades verificadas, recomendar una moneda convertiría una sugerencia contextual en una apuesta no solicitada.",
    reviewInExpediente: false,
    needsAdvancedTools: false,
    evidence: [
      `El contexto del personaje señala ${focusLabel}.`,
      `La pieza copiada no contiene una línea reconocible de ${focusLabel}.`,
      "No hay pools ni probabilidades verificadas que permitan dirigir el siguiente resultado.",
    ],
  };
}

/**
 * Añade propósito a la legalidad sin inventar pools ni probabilidades.
 * `chooseNextStep` sigue siendo la autoridad sobre qué moneda puede usarse;
 * esta capa decide si el contrato ya obliga a parar o si el gasto solo puede
 * presentarse como un intento aleatorio y limitado.
 */
export function assessPurposefulCraftBase(input: {
  item: Item;
  direction: CoachDirection | null;
  focus: CoachFocus | null;
  profile: CharacterProfile | null;
  rollMinimum?: CoachRollMinimum;
  goalIntent?: CoachGoalIntent;
  /**
   * `context` significa que la aplicación propuso el objetivo a partir del
   * expediente o del plan. Esa sugerencia nunca autoriza por sí sola una
   * apuesta aleatoria sobre la pieza abierta.
   */
  goalSource?: CoachGoalSource;
}, lang: "es" | "en" = "es"): CoachBaseAssessment {
  const en = lang === "en";
  const {
    item,
    direction,
    focus,
    profile,
    rollMinimum = "middle",
    goalIntent = "incremental",
    goalSource = "player",
  } = input;
  const structuralStep = chooseNextStep(item, direction, lang);
  const hasCharacter = hasCraftingCharacterContext(profile);
  const linked = Boolean(
    hasCharacter &&
      profile &&
      item.slot !== "other" &&
      profile.items.some((candidate) => candidate.id === item.id && candidate.slot === item.slot),
  );
  const characterContext: CoachBaseAssessment["characterContext"] = linked
    ? "linked"
    : hasCharacter
      ? "known-unlinked"
      : "missing";
  const characterLabel = en
    ? linked
      ? `Linked to ${profile?.name ?? "your character"}'s character file.`
      : hasCharacter
        ? `${profile?.name ?? "Your character"} is loaded; this item isn't equipped.`
        : "No character file: I'll only use the goal you wrote."
    : linked
      ? `Vinculada al expediente de ${profile?.name ?? "tu personaje"}.`
      : hasCharacter
        ? `${profile?.name ?? "Tu personaje"} está cargado; esta pieza no está equipada.`
        : "Sin expediente: usaré solo el objetivo que has escrito.";

  if (goalIntent !== "incremental") {
    const unique = goalIntent === "unique-acquisition";
    if (en) {
      return {
        status: "needs-data",
        title: unique ? "This isn't a step-by-step craft" : "This is an endgame project",
        summary: unique
          ? "First identify the unique item and compare it with your character. The open item doesn't prove that's where it's headed."
          : "One matching affix doesn't prove the weapon is finished. You need to check the whole item against your character, their current weapon, the budget and every requirement you listed.",
        characterContext,
        characterLabel,
        targetLabel: unique
          ? "Missing: the exact unique and its comparison."
          : "Missing: the full plan for the endgame item.",
        decisionLabel: unique ? "Go to search and compare." : "Open the Advanced workshop.",
        nextStep: stopForProjectDefinition(item, goalIntent, lang),
      };
    }
    return {
      status: "needs-data",
      title: unique ? "Esto no es un craft incremental" : "Esto es un proyecto de endgame",
      summary: unique
        ? "Primero identifica el objeto único y compáralo con el personaje. La pieza abierta no demuestra ese destino."
        : "Un afijo coincidente no demuestra que el arma esté terminada. Hace falta contrastar la pieza completa con el personaje, su arma actual, el presupuesto y todos los requisitos declarados.",
      characterContext,
      characterLabel,
      targetLabel: unique
        ? "Falta el único concreto y su comparación."
        : "Falta el contrato completo de la pieza de endgame.",
      decisionLabel: unique ? "Ir a búsqueda y comparación." : "Abrir el Taller avanzado.",
      nextStep: stopForProjectDefinition(item, goalIntent),
    };
  }

  if (focus === null || direction === null) {
    return {
      status: "needs-data",
      title: en ? "The goal still needs to be specific" : "Falta concretar el objetivo",
      summary: en
        ? "Pick one property you can see on the item before deciding whether this base is worth an orb."
        : "Elige una sola propiedad observable antes de decidir si esta base merece una moneda.",
      characterContext,
      characterLabel,
      targetLabel: en ? "Goal not specific yet." : "Objetivo todavía sin concretar.",
      decisionLabel: en ? "Don't spend." : "No gastar.",
      nextStep: structuralStep,
    };
  }

  const focusLabel = focusLabelFor(focus, lang);
  const rollMinimumLabel = coachRollMinimumLabel(rollMinimum, lang);
  const explicitModifiers = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const signal = evaluateCoachFocus(focus, explicitModifiers);
  const targetLabel = en
    ? signal.status === "direct"
      ? `It already has a ${focusLabel} line.`
      : signal.status === "no-direct-signal" || explicitModifiers.length === 0
        ? `It doesn't have a ${focusLabel} line I recognise yet.`
        : `I can't check yet whether it has ${focusLabel}.`
    : signal.status === "direct"
      ? `Ya contiene una línea de ${focusLabel}.`
      : signal.status === "no-direct-signal" || explicitModifiers.length === 0
        ? `Aún no contiene una línea reconocible de ${focusLabel}.`
        : `No puedo comprobar todavía si contiene ${focusLabel}.`;

  if (structuralStep.kind === "needs-data") {
    const importIssue = assessCraftingImportIssue(item, undefined, lang);
    return {
      status: "needs-data",
      title: importIssue.title,
      summary: importIssue.summary,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en
        ? importIssue.retryCopy
          ? "Copy it again with Ctrl+Alt+C."
          : "Don't spend orbs on this item."
        : importIssue.retryCopy
          ? "Volver a copiar con Ctrl+Alt+C."
          : "No gastar moneda sobre esta pieza.",
      nextStep: structuralStep,
    };
  }

  const currentRoll = assessCoachRollMinimum(rollMinimum, explicitModifiers, focus, lang);
  if (signal.status === "direct" && currentRoll.status === "fulfilled") {
    const why = en
      ? `The item already gives ${focusLabel} and reaches ${rollMinimumLabel} within the visible range.`
      : `La pieza ya aporta ${focusLabel} y alcanza ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]} dentro del rango visible.`;
    return {
      status: "already-satisfied",
      title: en ? "Your stop point is already met" : "Tu parada ya se cumple",
      summary: en
        ? `${why} Before risking another slot, check the current roll in your character file.`
        : `${why} Antes de arriesgar otro hueco, revisa la tirada actual en tu expediente.`,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en ? "Stop and check." : "Parar y revisar.",
      nextStep: stopForSatisfiedGoal(item, focus, why, lang),
    };
  }

  if (signal.status === "direct" && currentRoll.status === "unverifiable") {
    const why = en
      ? `The item already gives ${focusLabel}, but the text doesn't let me check the minimum roll you picked.`
      : `La pieza ya aporta ${focusLabel}, pero el texto no permite comprobar la tirada mínima elegida.`;
    return {
      status: "review-current",
      title: en ? "First check what you already have" : "Revisa primero lo que ya tienes",
      summary: en
        ? `${why} Don't spend to chase a line you might already accept.`
        : `${why} No gastes para buscar una línea que quizá ya aceptarías.`,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en ? "Check the current roll." : "Revisar la tirada actual.",
      nextStep: stopForSatisfiedGoal(item, focus, why, lang),
    };
  }

  if (structuralStep.kind === "stop") {
    return {
      status: "change-base",
      title: en
        ? signal.status === "direct" ? "This base can't take another basic step" : "Don't invest more in this base"
        : signal.status === "direct" ? "Esta base no admite otro paso básico" : "No inviertas más en esta base",
      summary: en
        ? signal.status === "direct"
          ? `The item points to ${focusLabel}, but the observed basic orbs can't add anything else.`
          : `The item doesn't show ${focusLabel} and the observed basic orbs can't add anything else. Look for another base.`
        : signal.status === "direct"
          ? `La pieza apunta a ${focusLabel}, pero las monedas básicas observadas ya no pueden añadir nada.`
          : `La pieza no muestra ${focusLabel} y las monedas básicas observadas ya no pueden añadir nada. Busca otra base.`,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en ? "Switch to another base." : "Cambiar de base.",
      nextStep: structuralStep,
    };
  }

  if (goalSource === "context" && signal.status !== "direct") {
    return {
      status: "change-base",
      title: en ? "This need doesn't make this item the right one" : "Esta necesidad no valida esta pieza",
      summary: en
        ? `Your character needs ${focusLabel}, but this item doesn't show that goal. Don't turn a general gap into a random spend.`
        : `El personaje necesita ${focusLabel}, pero la pieza no demuestra ese objetivo. No conviertas una carencia global en un gasto aleatorio.`,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en ? "Switch items without spending." : "Cambiar de pieza sin gastar.",
      nextStep: stopForUnverifiedContextGoal(item, focus, lang),
    };
  }

  if (signal.status === "direct") {
    return {
      status: "aligned",
      title: en ? `The base already points to ${focusLabel}` : `La base ya apunta a ${focusLabel}`,
      summary: en
        ? "The line is there, but it doesn't meet your stop point yet. The next spend is still random and must stay within your limit."
        : `La línea existe, pero todavía no cumple tu parada. El siguiente gasto sigue siendo aleatorio y debe respetar tu límite.`,
      characterContext,
      characterLabel,
      targetLabel,
      decisionLabel: en
        ? `At most, ${structuralStep.label} within your plan.`
        : `Como máximo, ${structuralStep.label} dentro del contrato.`,
      nextStep: structuralStep,
    };
  }

  return {
    status: "controlled-attempt",
    title: en ? "Only worth one controlled try" : "Solo merece un intento controlado",
    summary: en
      ? `The base doesn't show ${focusLabel} yet. The next orb can be used, but it can't be steered towards that goal.`
      : `La base todavía no demuestra ${focusLabel}. La siguiente moneda es legal, pero no puede dirigirse hacia ese objetivo.`,
    characterContext,
    characterLabel,
    targetLabel,
    decisionLabel: en
      ? `${structuralStep.label}: a limited gamble, not a recipe.`
      : `${structuralStep.label}: una apuesta limitada, no una receta.`,
    nextStep: structuralStep,
  };
}

// ---------------------------------------------------------------------------
// Qué resultado obtuvo el jugador
// ---------------------------------------------------------------------------

export interface CoachResultReading {
  /** «confirmado», «no cuadra» o «no concluyente», ya en palabras. */
  headline: string;
  changed: string[];
  kept: string;
  /** Continuar o parar, con su motivo. */
  verdict: "continue" | "stop" | "unclear";
  /** Decisión de ruta conservada para que la interfaz ofrezca una salida concreta. */
  decisionKind: CraftingNextDecisionKind | null;
  verdictText: string;
  /** Siguiente acción SOLO si vuelve a poder demostrarse. */
  nextStep: CoachNextStep | null;
  /**
   * Relación del resultado con lo que el jugador buscaba. `confirmed` significa
   * «comparte etiqueta», NUNCA «es una mejora»: eso exigiría comparar la pieza
   * completa en el personaje, y eso no se puede demostrar aquí.
   */
  goalFit: CoachGoalFit;
  directionNote: string | null;
  /** Aclaración que acompaña siempre a `directionNote`. */
  improvementCaveat: string | null;
  observedAffixes: Array<{
    id: string;
    text: string;
    tier: number | null;
    rollBand: ObservedRollBand;
    rollPositionPercent: number | null;
    rollLabel: string;
    goalFit: CoachGoalFit;
  }>;
  /** Comparación conservadora basada solo en las cifras visibles del tooltip. */
  weaponPerformance: CraftingWeaponPerformance | null;
  /** Resultado del umbral que el jugador congeló antes de gastar. */
  rollMinimumAssessment?: CoachRollMinimumAssessment;
  /** Paso confirmado dentro del límite elegido para esta base. */
  attemptProgress?: { current: number; limit: number; remaining: number };
}

export type CoachContextSuggestionSource = "target" | "resistances" | "none";

export interface CoachContextSuggestion {
  source: CoachContextSuggestionSource;
  focuses: CoachFocus[];
  reason: string;
  evidence: string[];
}

/**
 * Busca prioridades SOLO en datos que el jugador ya declaró: los mods
 * deseados de su plan o una carencia elemental medible del expediente.
 *
 * Puede devolver varias prioridades. En ese caso la interfaz debe pedir que
 * el jugador elija; el orden del texto nunca se convierte en un ranking.
 */
export function suggestCraftingFocusFromContext(
  profile: Pick<CharacterProfile, "resistances"> | null,
  target: Pick<BuildTarget, "name" | "desiredMods"> | null | undefined,
  lang: "es" | "en" = "es",
): CoachContextSuggestion {
  const en = lang === "en";
  const declared = (target?.desiredMods ?? [])
    .map((line) => ({ line: line.trim(), focus: inferCoachFocus(line) }))
    .filter(
      (entry): entry is { line: string; focus: CoachFocus } =>
        entry.line.length > 0 && entry.focus !== null,
    );
  const targetFocuses = [...new Set(declared.map((entry) => entry.focus))];
  if (targetFocuses.length > 0) {
    return {
      source: "target",
      focuses: targetFocuses,
      reason: en
        ? targetFocuses.length === 1
          ? `Your plan "${target?.name || "Target build"}" lists one priority I recognise.`
          : `Your plan "${target?.name || "Target build"}" lists several priorities. Pick which one to work on first.`
        : targetFocuses.length === 1
          ? `Tu plan «${target?.name || "Build objetivo"}» declara una prioridad reconocible.`
          : `Tu plan «${target?.name || "Build objetivo"}» declara varias prioridades. Elige cuál trabajar primero.`,
      evidence: declared.map((entry) => entry.line),
    };
  }

  const direction = suggestDirectionFromCharacter(profile, lang);
  if (direction.direction === "defence") {
    return {
      source: "resistances",
      focuses: ["resistances"],
      reason: direction.reason,
      evidence: [direction.reason],
    };
  }

  return {
    source: "none",
    focuses: [],
    reason: en
      ? target && target.desiredMods.length === 0
        ? `Your plan "${target.name || "Target build"}" doesn't list any wanted mods yet that I can link to this item.`
        : "I can't find a clear priority in your plan or a measurable gap in your character file."
      : target && target.desiredMods.length === 0
        ? `Tu plan «${target.name || "Build objetivo"}» todavía no declara mods deseados que pueda relacionar con esta pieza.`
        : "No encuentro una prioridad concreta en tu plan ni una carencia medible en el expediente.",
    evidence: [],
  };
}

function readObservedAffixes(
  modifiers: readonly import("./domain.js").Modifier[],
  fit: (modifier: import("./domain.js").Modifier) => CraftingGoalSignal["status"],
  lang: CoachLang = "es",
): CoachResultReading["observedAffixes"] {
  return modifiers.map((modifier) => {
    const roll = assessObservedModifierRoll(modifier, lang);
    const signal = fit(modifier);
    return {
      id: modifier.id,
      text: modifier.text,
      tier: modifier.tier ?? null,
      rollBand: roll.band,
      rollPositionPercent: roll.positionPercent,
      rollLabel: roll.label,
      goalFit:
        signal === "direct"
          ? "confirmed"
          : signal === "no-direct-signal"
            ? "not-confirmed"
            : "not-evaluable",
    };
  });
}

/**
 * Traduce una comparación ya calculada. No vuelve a juzgar el objeto ni
 * convierte un cambio en «mejora»: eso lo decide quien juega.
 */
export function readCraftResult(input: {
  comparison: CraftingComparison;
  resultItem: Item;
  direction: CoachDirection | null;
}, lang: "es" | "en" = "es"): CoachResultReading {
  const en = lang === "en";
  const { comparison, resultItem, direction } = input;

  if (comparison.status !== "confirmed") {
    const reason = comparison.summary.trim();
    return {
      headline: en
        ? comparison.status === "mismatch"
          ? "This doesn't match the previous item"
          : "I can't confirm the change yet"
        : comparison.status === "mismatch"
          ? "Esto no cuadra con la pieza anterior"
          : "Todavía no puedo confirmar el cambio",
      changed: [],
      kept: "",
      verdict: "stop",
      decisionKind: "stop",
      verdictText: en
        ? `${reason} Don't spend another orb. Check the pasted text and compare again.`
        : `${reason} No gastes otra moneda. Revisa el texto pegado y vuelve a comprobarlo.`,
      nextStep: null,
      goalFit: "not-evaluable",
      directionNote: null,
      improvementCaveat: null,
      observedAffixes: [],
      weaponPerformance: null,
    };
  }

  const changed = comparison.addedModifiers.map((modifier) => modifier.text);
  const observedAffixes = readObservedAffixes(
    comparison.addedModifiers,
    (modifier) =>
      direction === null
        ? "unknown"
        : evaluateCraftingGoalSignal(DIRECTION_CATEGORY[direction], [modifier]).status,
    lang,
  );
  const removed = comparison.removedModifiers.length;
  const nextStep = chooseNextStep(resultItem, direction, lang);

  let directionNote: string | null = null;
  let goalFit: CoachGoalFit = "not-evaluable";
  let improvementCaveat: string | null = null;
  if (direction !== null && comparison.addedModifiers.length > 0) {
    const signal: CraftingGoalSignal = evaluateCraftingGoalSignal(
      DIRECTION_CATEGORY[direction],
      comparison.addedModifiers,
    );
    const noun = coachDirectionNoun(direction, lang);
    if (signal.status === "direct") {
      goalFit = "confirmed";
      directionNote = en
        ? `The new modifier is related to ${noun}.`
        : `El nuevo modificador está relacionado con ${noun}.`;
    } else if (signal.status === "no-direct-signal") {
      goalFit = "not-confirmed";
      directionNote = en
        ? `The new modifier isn't related to ${noun}.`
        : `El nuevo modificador no está relacionado con ${noun}.`;
    } else {
      goalFit = "not-evaluable";
      directionNote = en
        ? `The text has no ${noun} tags I can compare.`
        : `El texto no trae etiquetas de ${noun} que yo pueda comparar.`;
    }
    // Compartir etiqueta no es una mejora demostrada, en ningún caso.
    improvementCaveat = en
      ? "This doesn't prove yet that the whole item is better for your character. Try it or compare it on your character."
      : "Esto no demuestra todavía que la pieza completa sea mejor para tu personaje. Pruébala o compárala en el personaje.";
  }

  const protectedLineLost = comparison.protectionStatus === "lost";
  const verdict: CoachResultReading["verdict"] = protectedLineLost
    ? "stop"
    : nextStep.kind === "use-currency"
      ? "continue"
      : nextStep.kind === "stop"
        ? "stop"
        : "unclear";

  if (en) {
    return {
      headline:
        changed.length === 0
          ? "The change is confirmed, but I don't see any new modifier"
          : plural(changed.length, "A new modifier appeared", `${changed.length} new modifiers appeared`),
      changed,
      kept: protectedLineLost
        ? `A line you asked to keep is gone: ${comparison.lostProtectedModifiers.map((modifier) => modifier.text).join(" · ")}.`
        : removed === 0
          ? "Nothing you already had was lost."
          : `${removed} ${plural(removed, "modifier is", "modifiers are")} gone. Check it before going on.`,
      verdict,
      decisionKind:
        protectedLineLost || verdict === "stop"
          ? "stop"
          : verdict === "continue"
            ? "continue"
            : null,
      verdictText:
        protectedLineLost
          ? "Stop: the result lost something you marked as untouchable. Don't spend another orb."
          : verdict === "continue"
          ? "You can keep going if you want, one orb at a time."
          : verdict === "stop"
            ? nextStep.kind === "stop"
              ? nextStep.instruction
              : "Stop and get the missing information."
            : "Get the missing information before spending again.",
      nextStep,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance: null,
    };
  }

  return {
    headline:
      changed.length === 0
        ? "El cambio está confirmado, pero no veo ningún modificador nuevo"
        : `Ha aparecido ${plural(changed.length, "un modificador nuevo", `${changed.length} modificadores nuevos`)}`,
    changed,
    kept: protectedLineLost
      ? `Se ha perdido una línea que pediste conservar: ${comparison.lostProtectedModifiers.map((modifier) => modifier.text).join(" · ")}.`
      : removed === 0
        ? "No se ha perdido nada de lo que ya tenías."
        : `Han desaparecido ${removed} ${plural(removed, "modificador", "modificadores")}. Revísalo antes de seguir.`,
    verdict,
    decisionKind:
      protectedLineLost || verdict === "stop"
        ? "stop"
        : verdict === "continue"
          ? "continue"
          : null,
    verdictText:
      protectedLineLost
        ? "Para: el resultado ha perdido algo que marcaste como intocable. No gastes otra moneda."
        : verdict === "continue"
        ? "Puedes seguir si quieres, de una moneda en una."
        : verdict === "stop"
          ? nextStep.kind === "stop"
            ? nextStep.instruction
            : "Para y consigue el dato que falta."
          : "Consigue el dato que falta antes de gastar otra vez.",
    nextStep,
    goalFit,
    directionNote,
    improvementCaveat,
    observedAffixes,
    weaponPerformance: null,
  };
}

/**
 * Lectura usada por «Ayúdame con mi objeto». Añade tres frenos que la lectura
 * estructural no puede decidir por sí sola: objetivo exacto, expediente real y
 * decisión contextual de continuar/parar.
 */
export function readPurposefulCraftResult(input: {
  comparison: CraftingComparison;
  originalItem: Item;
  resultItem: Item;
  direction: CoachDirection | null;
  focus: CoachFocus | null;
  profile: CharacterProfile | null;
  profileGoal: GoalKind;
  rollMinimum?: CoachRollMinimum;
  attemptNumber?: number;
  attemptLimit?: number;
}, lang: "es" | "en" = "es"): CoachResultReading {
  const en = lang === "en";
  const {
    comparison,
    originalItem,
    resultItem,
    direction,
    focus,
    profile,
    profileGoal,
    rollMinimum = "middle",
    attemptNumber = 1,
    attemptLimit = 1,
  } = input;
  const base = readCraftResult({ comparison, resultItem, direction }, lang);
  if (comparison.status !== "confirmed" || comparison.protectionStatus === "lost") {
    return base;
  }

  const weaponPerformance = evaluateCraftingWeaponPerformance({
    originalItem,
    resultItem,
    profile,
    focus,
  }, lang);

  const signal = evaluateCoachFocus(focus, comparison.addedModifiers, lang);
  const focusLabel = focus === null ? null : focusLabelFor(focus, lang);
  const rollMinimumLabel = coachRollMinimumLabel(rollMinimum, lang);
  const goalFit: CoachGoalFit = signal.status === "direct"
    ? "confirmed"
    : signal.status === "no-direct-signal"
      ? "not-confirmed"
      : "not-evaluable";
  const directionNote = en
    ? focusLabel === null
      ? "You haven't said yet which result you're after."
      : signal.status === "direct"
        ? `The new modifier matches your goal: ${focusLabel}.`
        : signal.status === "no-direct-signal"
          ? `The new modifier doesn't match your main goal: ${focusLabel}.`
          : `I can't check whether the new modifier gives ${focusLabel}.`
    : focusLabel === null
      ? "Todavía no has concretado qué resultado buscas."
      : signal.status === "direct"
        ? `El nuevo modificador coincide con tu objetivo: ${focusLabel}.`
        : signal.status === "no-direct-signal"
          ? `El nuevo modificador no coincide con tu objetivo principal: ${focusLabel}.`
          : `No puedo comprobar si el nuevo modificador aporta ${focusLabel}.`;
  const improvementCaveat = en
    ? "The tier and range only describe this affix; on their own they don't prove the whole item makes your character better."
    : "El grado y el rango solo describen este afijo; esto no demuestra por sí solo que la pieza completa mejore tu personaje.";
  const observedAffixes = readObservedAffixes(
    comparison.addedModifiers,
    (modifier) => evaluateCoachFocus(focus, [modifier]).status,
    lang,
  );
  const rollMinimumAssessment = assessCoachRollMinimum(
    rollMinimum,
    comparison.addedModifiers,
    focus,
    lang,
  );
  const safeAttemptLimit = Math.max(1, Math.floor(attemptLimit));
  const safeAttemptNumber = Math.max(1, Math.min(Math.floor(attemptNumber), safeAttemptLimit));
  const attemptProgress = {
    current: safeAttemptNumber,
    limit: safeAttemptLimit,
    remaining: Math.max(0, safeAttemptLimit - safeAttemptNumber),
  };

  if (focus === null || direction === null) {
    return {
      ...base,
      verdict: "stop",
      decisionKind: "stop",
      verdictText: en
        ? "Don't spend another orb: first decide exactly what the next affix has to give."
        : "No gastes otra moneda: concreta primero el objetivo que debe cumplir el siguiente afijo.",
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
      rollMinimumAssessment,
      attemptProgress,
    };
  }

  if (!hasCraftingCharacterContext(profile)) {
    if (signal.status === "direct") {
      if (rollMinimumAssessment.status === "below") {
        return {
          ...base,
          verdict: "stop",
          decisionKind: attemptProgress.remaining === 0 ? "restart" : "stop",
          verdictText: en
            ? attemptProgress.remaining === 0
              ? `Limit reached: ${focusLabel} appeared, but it doesn't reach ${rollMinimumLabel}. Even for a loose item, your written plan is enough to close this try; switch bases or knowingly accept the roll.`
              : `${capitalizeFirst(focusLabel ?? "")} appeared, but it doesn't reach ${rollMinimumLabel}. Since it's a loose item I can't compare it with your gear; decide whether you accept the roll before spending another orb.`
            : attemptProgress.remaining === 0
              ? `Límite alcanzado: apareció ${focusLabel}, pero no llega a ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. Aunque es un objeto suelto, el contrato escrito basta para cerrar este intento; cambia de base o acepta conscientemente la tirada.`
              : `Apareció ${focusLabel}, pero no llega a ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. Como es un objeto suelto no puedo compararlo con tu equipo; decide si aceptas la tirada antes de gastar otra moneda.`,
          nextStep: null,
          goalFit,
          directionNote,
          improvementCaveat,
          observedAffixes,
          weaponPerformance,
          rollMinimumAssessment,
          attemptProgress,
        };
      }
      if (rollMinimumAssessment.status === "unverifiable") {
        return {
          ...base,
          verdict: "stop",
          decisionKind: "stop",
          verdictText: en
            ? `The result matches ${focusLabel}, but the tooltip doesn't let me check ${rollMinimumLabel}. Since it's a loose item, stop and decide whether you accept the value before spending another orb.`
            : `El resultado coincide con ${focusLabel}, pero el tooltip no permite comprobar ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. Como es un objeto suelto, detente y decide si aceptas el valor antes de gastar otra moneda.`,
          nextStep: null,
          goalFit,
          directionNote,
          improvementCaveat,
          observedAffixes,
          weaponPerformance,
          rollMinimumAssessment,
          attemptProgress,
        };
      }
      return {
        ...base,
        verdict: "stop",
        decisionKind: "stop",
        verdictText: en
          ? `Stop point reached: ${focusLabel} appeared with ${rollMinimumLabel}. Stop spending. Since it's a loose item, you still need to compare it with your gear before calling it an upgrade.`
          : `Punto de parada alcanzado: apareció ${focusLabel} con ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. Detén el gasto. Como es un objeto suelto, todavía falta compararlo con tu equipo antes de llamarlo mejora.`,
        nextStep: null,
        goalFit,
        directionNote,
        improvementCaveat,
        observedAffixes,
        weaponPerformance,
        rollMinimumAssessment,
        attemptProgress,
      };
    }

    if (attemptProgress.remaining > 0 && base.nextStep?.kind === "use-currency") {
      return {
        ...base,
        verdict: "continue",
        decisionKind: "continue",
        verdictText: en
          ? `The result doesn't give ${focusLabel}. Since it's a loose item I can't judge how it fits your build, but your written plan allows ${attemptProgress.remaining === 1 ? "1 more step" : `${attemptProgress.remaining} more steps`}. Check the next allowed action; don't repeat it on autopilot.`
          : `El resultado no aporta ${focusLabel}. Como es un objeto suelto no puedo juzgar su encaje con la build, pero el contrato escrito permite ${attemptProgress.remaining === 1 ? "1 paso más" : `${attemptProgress.remaining} pasos más`}. Revisa la siguiente acción legal; no la repitas automáticamente.`,
        nextStep: base.nextStep,
        goalFit,
        directionNote,
        improvementCaveat,
        observedAffixes,
        weaponPerformance,
        rollMinimumAssessment,
        attemptProgress,
      };
    }

    return {
      ...base,
      verdict: "stop",
      decisionKind: "restart",
      verdictText: en
        ? `Limit reached: the result doesn't give ${focusLabel}. Even for a loose item, your written goal is enough to close this try. Don't spend another orb out of habit: try another base or rethink your plan.`
        : `Límite alcanzado: el resultado no aporta ${focusLabel}. Aunque es un objeto suelto, el objetivo escrito basta para cerrar este intento. No gastes otra moneda por inercia: prueba otra base o redefine el contrato.`,
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
      rollMinimumAssessment,
      attemptProgress,
    };
  }

  const category = DIRECTION_CATEGORY[direction];
  const characterContext = evaluateCraftingCharacterContext({
    profile: profile!,
    profileGoal,
    originalItem,
    resultItem,
    comparison,
    goalCategory: category,
    goalSignal: signal,
  }, lang);
  const decision = decideCraftingNextStep({
    resultItem,
    comparison,
    characterContext,
    addedGoalSignal: signal,
    goalCategory: category,
    addedRollQuality:
      rollMinimum === "any" || comparison.addedModifiers[0] === undefined
        ? null
        : assessObservedModifierRoll(comparison.addedModifiers[0], lang),
    successAssessment:
      signal.status === "direct" && rollMinimumAssessment.status === "fulfilled"
        ? {
            status: "fulfilled",
            title: en ? "Step goal seen" : "Objetivo del paso observado",
            summary: en
              ? `The new modifier matches ${focusLabel}.`
              : `El modificador nuevo coincide con ${focusLabel}.`,
            entries: [],
          }
        : null,
  }, lang);

  const focusComparison = weaponPerformance?.focusComparison ?? null;
  const visibleComparisonText = focusComparison === null
    ? ""
    : en
      ? focusComparison.outcome === "higher"
        ? ` In visible numbers, ${focusComparison.label} goes up from ${focusComparison.before} to ${focusComparison.after}.`
        : focusComparison.outcome === "lower"
          ? ` In visible numbers, ${focusComparison.label} goes down from ${focusComparison.before} to ${focusComparison.after}.`
          : ` In visible numbers, ${focusComparison.label} doesn't improve: it stays at ${focusComparison.after}.`
      : focusComparison.outcome === "higher"
        ? ` En cifras visibles, ${focusComparison.label} sube de ${focusComparison.before} a ${focusComparison.after}.`
        : focusComparison.outcome === "lower"
          ? ` En cifras visibles, ${focusComparison.label} baja de ${focusComparison.before} a ${focusComparison.after}.`
          : ` En cifras visibles, ${focusComparison.label} no mejora: sigue en ${focusComparison.after}.`;
  const visibleGoalFailed =
    weaponPerformance?.comparedToEquipped === true &&
    focusComparison !== null &&
    focusComparison.outcome !== "higher";
  // Un requisito incumplido o una protección perdida es un bloqueo más fuerte
  // que el rendimiento del arma y debe seguir siendo el motivo principal.
  const visibleBlocksContinuation =
    visibleGoalFailed && characterContext.verdict !== "stop";

  const contractBlocked = characterContext.verdict === "stop" || visibleBlocksContinuation;
  if (!contractBlocked && signal.status === "direct") {
    if (rollMinimumAssessment.status === "below") {
      const limitReached = attemptProgress.remaining === 0;
      return {
        ...base,
        verdict: "stop",
        decisionKind: limitReached ? "restart" : "stop",
        verdictText: en
          ? limitReached
            ? `Limit reached: the line matches, but it doesn't reach ${rollMinimumLabel}. Close this try and switch bases or rethink the goal.`
            : `The line matches, but it doesn't reach ${rollMinimumLabel}. Don't spend another orb on autopilot: decide whether you accept the roll or switch bases.`
          : limitReached
            ? `Límite alcanzado: la línea coincide, pero no llega a ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. Cierra este intento y cambia de base o redefine el objetivo.`
            : `La línea coincide, pero no llega a ${COACH_ROLL_MINIMUM_LABELS[rollMinimum]}. No gastes otra moneda automáticamente: decide si aceptas la tirada o cambias de base.`,
        nextStep: null,
        goalFit,
        directionNote,
        improvementCaveat,
        observedAffixes,
        weaponPerformance,
        rollMinimumAssessment,
        attemptProgress,
      };
    }
    if (rollMinimumAssessment.status === "unverifiable") {
      return {
        ...base,
        verdict: "stop",
        decisionKind: "stop",
        verdictText: en
          ? "The affix matches, but the tooltip doesn't let me check the minimum roll you picked. Don't spend another orb until you decide whether you accept that value without comparing it."
          : "El afijo coincide, pero el tooltip no permite comprobar la tirada mínima que elegiste. No gastes otra moneda hasta decidir si aceptas ese valor sin compararlo.",
        nextStep: null,
        goalFit,
        directionNote,
        improvementCaveat,
        observedAffixes,
        weaponPerformance,
        rollMinimumAssessment,
        attemptProgress,
      };
    }
  }

  if (
    !contractBlocked &&
    signal.status !== "direct" &&
    attemptProgress.remaining === 0
  ) {
    return {
      ...base,
      verdict: "stop",
      decisionKind: "restart",
      verdictText: en
        ? "Limit reached: this result doesn't meet the goal. Close the try and switch bases or rethink your plan; don't add another orb out of habit."
        : "Límite alcanzado: este resultado no cumple el objetivo. Cierra el intento y cambia de base o redefine el contrato; no añadas otra moneda por inercia.",
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
      rollMinimumAssessment,
      attemptProgress,
    };
  }

  if (
    !contractBlocked &&
    signal.status !== "direct" &&
    attemptProgress.remaining > 0 &&
    base.nextStep?.kind === "use-currency"
  ) {
    return {
      ...base,
      verdict: "continue",
      decisionKind: "continue",
      verdictText: en
        ? `This step doesn't meet the goal. You have ${attemptProgress.remaining === 1 ? "1 step" : `${attemptProgress.remaining} steps`} left within your limit: check the next allowed action again and decide; don't repeat it on autopilot.`
        : `El paso no cumple el objetivo. Te ${attemptProgress.remaining === 1 ? "queda 1 paso" : `quedan ${attemptProgress.remaining} pasos`} dentro del límite: vuelve a comprobar la siguiente acción legal y decide; no la repitas automáticamente.`,
      nextStep: base.nextStep,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
      rollMinimumAssessment,
      attemptProgress,
    };
  }

  return {
    ...base,
    verdict: visibleBlocksContinuation ? "stop" : decision.kind === "continue" ? "continue" : "stop",
    decisionKind: visibleBlocksContinuation ? "stop" : decision.kind,
    verdictText: visibleBlocksContinuation
      ? en
        ? `Stop here: it doesn't beat ${weaponPerformance.baselineLabel} in ${focusComparison.label}.${visibleComparisonText}`
        : `Para aquí: no supera ${weaponPerformance.baselineLabel} en ${focusComparison.label}.${visibleComparisonText}`
      : `${decision.title}. ${decision.summary} ${decision.nextAction}${visibleComparisonText}`,
    nextStep:
      !visibleBlocksContinuation && decision.kind === "continue" ? base.nextStep : null,
    goalFit,
    directionNote,
    improvementCaveat,
    observedAffixes,
    weaponPerformance,
    rollMinimumAssessment,
    attemptProgress,
  };
}

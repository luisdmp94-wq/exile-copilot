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
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
  type CraftingGoalSignal,
} from "./craftingGoal.js";
import {
  COACH_FOCUS_LABELS,
  evaluateCoachFocus,
  inferCoachFocus,
  type CoachFocus,
} from "./craftingFocus.js";
import { decideCraftingNextStep } from "./craftingNextDecision.js";
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

const RARITY_WORD: Partial<Record<ItemRarity, string>> = {
  normal: "normal",
  magic: "mágico",
  rare: "raro",
};

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
export function readItemInPlainWords(item: Item): CoachItemReading {
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
    sentence = "Es una pieza normal: todavía no tiene ningún modificador.";
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

// ---------------------------------------------------------------------------
// Qué quiere el jugador
// ---------------------------------------------------------------------------

export interface CoachDirectionGuess {
  direction: CoachDirection | null;
  /** Por qué se pudo (o no) deducir. Siempre se enseña al jugador. */
  reason: string;
}

export interface CoachGoalInterpretation {
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

function normalizeGoalText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

const PROTECTION_MARKER =
  /\b(?:sin\s+(?:perder|sacrificar)|(?:no\s+)?quiero\s+perder|manteniendo|mantener|conservando|conservar|protegiendo|proteger)\b/i;

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
]);

const CANONICAL_PROTECTION_TOKEN: Record<string, string> = {
  habilidades: "habilidad",
  proyectiles: "proyectil",
  resistencias: "resistencia",
  ataques: "ataque",
  atributos: "atributo",
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
      .split(/\s+(?:y|ni)\s+|[,;]/)
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
 * Interpreta únicamente la DIRECCIÓN general escrita por el jugador.
 *
 * No convierte texto libre en una receta ni adivina mods. Si aparecen dos
 * direcciones o ninguna señal reconocible, devuelve `null` para que la
 * interfaz pida una aclaración antes de recomendar un gasto.
 */
export function interpretCoachGoal(
  value: string,
  item?: Pick<Item, "modifiers">,
): CoachGoalInterpretation {
  const normalized = normalizeGoalText(value);
  const { primary, requested } = protectionSegments(value);
  const protections = matchProtectedModifiers(requested, item);
  if (normalized === "") {
    return {
      direction: null,
      focus: null,
      reason: "Cuéntame qué te gustaría conseguir con esta pieza.",
      ...protections,
    };
  }

  const damage = DAMAGE_GOAL_WORDS.some((word) => primary.includes(word));
  const defence = DEFENCE_GOAL_WORDS.some((word) => primary.includes(word));

  if (damage && defence) {
    return {
      direction: null,
      focus: null,
      reason: "Veo un objetivo de daño y otro de defensa. Elige cuál quieres trabajar primero.",
      ...protections,
    };
  }
  if (damage) {
    const focus = inferCoachFocus(primary);
    return {
      direction: "damage",
      focus,
      reason: focus === null
        ? "Sé que buscas daño, pero necesito saber qué tipo para juzgar cada resultado."
        : `He entendido que primero buscas ${COACH_FOCUS_LABELS[focus]}.`,
      ...protections,
    };
  }
  if (defence) {
    const focus = inferCoachFocus(primary);
    return {
      direction: "defence",
      focus,
      reason: focus === null
        ? "Sé que buscas defensa, pero necesito saber cuál para juzgar cada resultado."
        : `He entendido que primero buscas ${COACH_FOCUS_LABELS[focus]}.`,
      ...protections,
    };
  }
  return {
    direction: null,
    focus: null,
    reason:
      "Entiendo tus palabras, pero no puedo convertirlas con seguridad en una dirección de crafting. Aclaremos primero si buscas daño o defensa.",
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
): CoachDirectionGuess {
  if (profile === null) {
    return {
      direction: null,
      reason: "No puedo decidirlo mirando solo esta pieza.",
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
      reason: "No puedo decidirlo mirando solo esta pieza.",
    };
  }

  const detalle = bajas
    .map((entry) => `${RESISTANCE_LABELS[entry.kind]} ${entry.value}%`)
    .join(", ");
  return {
    direction: "defence",
    reason: `Tu expediente declara ${detalle}, por debajo de ${LOW_ELEMENTAL_RESISTANCE}%.`,
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
      /** Herramientas que exigen reemplazar; viven en el banco avanzado. */
      needsAdvancedTools: boolean;
      evidence: string[];
    };

const ACTION_BY_ID = new Map(OBSERVED_CRAFTING_ACTIONS.map((action) => [action.id, action]));

function actionLabel(actionId: CraftingActionId): string {
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

function whatCanHappen(item: Item, actionId: CraftingActionId): string[] {
  const lines = [
    "El modificador que salga es aleatorio: no se puede saber cuál antes de usar la moneda.",
    "Exile Copilot no tiene una lista verificada de lo que puede aparecer, así que no te dirá cuál es más probable.",
  ];
  const resultRarity = EXPECTED_RESULT_RARITY[actionId];
  if (resultRarity !== item.rarity) {
    lines.push(`La pieza pasará de ${RARITY_WORD[item.rarity] ?? item.rarity} a ${RARITY_WORD[resultRarity] ?? resultRarity}.`);
  }
  lines.push("Lo que ya tiene seguirá ahí: esta acción añade, no reemplaza.");
  return lines;
}

/** Aviso solo cuando la estructura demuestra una consecuencia real. */
function structuralWarning(
  item: Item,
  actionId: CraftingActionId,
  diagnosis: CraftingItemDiagnosis,
): string | null {
  const resultRarity = EXPECTED_RESULT_RARITY[actionId];
  if (resultRarity !== item.rarity) {
    const lost = OBSERVED_CRAFTING_ACTIONS.filter(
      (action) => action.targetRarity === item.rarity && action.id !== actionId,
    ).map((action) => action.label);
    if (lost.length > 0) {
      return `Al cambiar de rareza dejarás de poder usar ${lost.join(" y ")} sobre esta pieza.`;
    }
  }
  if (
    diagnosis.observedOpenSlots !== null &&
    diagnosis.observedTotalLimit !== null &&
    diagnosis.observedOpenSlots === 1 &&
    resultRarity === item.rarity
  ) {
    return `Con esto llegas al límite observado de ${diagnosis.observedTotalLimit}. Después no cabrá nada más.`;
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
): CoachNextStep {
  const diagnosis = diagnoseCraftingItem(item);
  const evaluations = evaluateObservedCraftingActions(item);
  const compatible = evaluations
    .filter((entry) => entry.status === "compatible")
    .map((entry) => entry.action.id);

  if (diagnosis.state !== "complete") {
    return {
      kind: "needs-data",
      legality: "needs-data",
      headline: "Me falta ver bien la pieza",
      instruction: diagnosis.nextAction,
      why:
        diagnosis.blockers[0] ??
        "Con lo que hay copiado no puedo afirmar que ninguna moneda sea legal sobre este objeto.",
      missingEvidence: diagnosis.blockers,
    };
  }

  if (compatible.length === 0) {
    const full = item.rarity === "rare" && diagnosis.observedOpenSlots === 0;
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
        label: actionLabel(candidate),
        difference:
          resultRarity === item.rarity
            ? "Mantiene la rareza actual y añade un modificador."
            : `Además de añadir, convierte la pieza en ${RARITY_WORD[resultRarity] ?? resultRarity}.`,
      };
    });

  const steering = steeringOf(actionId);
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
// Qué resultado obtuvo el jugador
// ---------------------------------------------------------------------------

export interface CoachResultReading {
  /** «confirmado», «no cuadra» o «no concluyente», ya en palabras. */
  headline: string;
  changed: string[];
  kept: string;
  /** Continuar o parar, con su motivo. */
  verdict: "continue" | "stop" | "unclear";
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
}

function readObservedAffixes(
  modifiers: readonly import("./domain.js").Modifier[],
  fit: (modifier: import("./domain.js").Modifier) => CraftingGoalSignal["status"],
): CoachResultReading["observedAffixes"] {
  return modifiers.map((modifier) => {
    const roll = assessObservedModifierRoll(modifier);
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
}): CoachResultReading {
  const { comparison, resultItem, direction } = input;

  if (comparison.status !== "confirmed") {
    const reason = comparison.summary.trim();
    return {
      headline:
        comparison.status === "mismatch"
          ? "Esto no cuadra con la pieza anterior"
          : "Todavía no puedo confirmar el cambio",
      changed: [],
      kept: "",
      verdict: "stop",
      verdictText:
        `${reason} No gastes otra moneda. Revisa el texto pegado y vuelve a comprobarlo.`,
      nextStep: null,
      goalFit: "not-evaluable",
      directionNote: null,
      improvementCaveat: null,
      observedAffixes: [],
      weaponPerformance: null,
    };
  }

  const changed = comparison.addedModifiers.map((modifier) => modifier.text);
  const observedAffixes = readObservedAffixes(comparison.addedModifiers, (modifier) =>
    direction === null
      ? "unknown"
      : evaluateCraftingGoalSignal(DIRECTION_CATEGORY[direction], [modifier]).status,
  );
  const removed = comparison.removedModifiers.length;
  const nextStep = chooseNextStep(resultItem, direction);

  let directionNote: string | null = null;
  let goalFit: CoachGoalFit = "not-evaluable";
  let improvementCaveat: string | null = null;
  if (direction !== null && comparison.addedModifiers.length > 0) {
    const signal: CraftingGoalSignal = evaluateCraftingGoalSignal(
      DIRECTION_CATEGORY[direction],
      comparison.addedModifiers,
    );
    const noun = COACH_DIRECTION_NOUNS[direction];
    if (signal.status === "direct") {
      goalFit = "confirmed";
      directionNote = `El nuevo modificador está relacionado con ${noun}.`;
    } else if (signal.status === "no-direct-signal") {
      goalFit = "not-confirmed";
      directionNote = `El nuevo modificador no está relacionado con ${noun}.`;
    } else {
      goalFit = "not-evaluable";
      directionNote = `El texto no trae etiquetas de ${noun} que yo pueda comparar.`;
    }
    // Compartir etiqueta no es una mejora demostrada, en ningún caso.
    improvementCaveat =
      "Esto no demuestra todavía que la pieza completa sea mejor para tu personaje. Pruébala o compárala en el personaje.";
  }

  const protectedLineLost = comparison.protectionStatus === "lost";
  const verdict: CoachResultReading["verdict"] = protectedLineLost
    ? "stop"
    : nextStep.kind === "use-currency"
      ? "continue"
      : nextStep.kind === "stop"
        ? "stop"
        : "unclear";

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
}): CoachResultReading {
  const {
    comparison,
    originalItem,
    resultItem,
    direction,
    focus,
    profile,
    profileGoal,
  } = input;
  const base = readCraftResult({ comparison, resultItem, direction });
  if (comparison.status !== "confirmed" || comparison.protectionStatus === "lost") {
    return base;
  }

  const weaponPerformance = evaluateCraftingWeaponPerformance({
    originalItem,
    resultItem,
    profile,
    focus,
  });

  const signal = evaluateCoachFocus(focus, comparison.addedModifiers);
  const focusLabel = focus === null ? null : COACH_FOCUS_LABELS[focus];
  const goalFit: CoachGoalFit = signal.status === "direct"
    ? "confirmed"
    : signal.status === "no-direct-signal"
      ? "not-confirmed"
      : "not-evaluable";
  const directionNote = focusLabel === null
    ? "Todavía no has concretado qué resultado buscas."
    : signal.status === "direct"
      ? `El nuevo modificador coincide con tu objetivo: ${focusLabel}.`
      : signal.status === "no-direct-signal"
        ? `El nuevo modificador no coincide con tu objetivo principal: ${focusLabel}.`
        : `No puedo comprobar si el nuevo modificador aporta ${focusLabel}.`;
  const improvementCaveat =
    "El grado y el rango solo describen este afijo; esto no demuestra por sí solo que la pieza completa mejore tu personaje.";
  const observedAffixes = readObservedAffixes(comparison.addedModifiers, (modifier) =>
    evaluateCoachFocus(focus, [modifier]).status,
  );

  if (focus === null || direction === null) {
    return {
      ...base,
      verdict: "stop",
      verdictText: "No gastes otra moneda: concreta primero el objetivo que debe cumplir el siguiente afijo.",
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
    };
  }

  if (signal.status !== "direct") {
    return {
      ...base,
      verdict: "stop",
      verdictText:
        "Para aquí. Tener huecos libres no basta: este cambio no aporta una señal directa de tu objetivo.",
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
    };
  }

  if (!hasCraftingCharacterContext(profile)) {
    return {
      ...base,
      verdict: "stop",
      verdictText:
        "Resultado registrado. Como solo tengo un objeto suelto, no voy a recomendar otra moneda como si conociera tu build. Vincula el personaje o úsalo como ejercicio.",
      nextStep: null,
      goalFit,
      directionNote,
      improvementCaveat,
      observedAffixes,
      weaponPerformance,
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
  });
  const decision = decideCraftingNextStep({
    resultItem,
    comparison,
    characterContext,
    addedGoalSignal: signal,
    goalCategory: category,
    addedRollQuality:
      comparison.addedModifiers[0] === undefined
        ? null
        : assessObservedModifierRoll(comparison.addedModifiers[0]),
  });

  const focusComparison = weaponPerformance?.focusComparison ?? null;
  const visibleComparisonText = focusComparison === null
    ? ""
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
  const visibleBlocksContinuation = visibleGoalFailed && decision.kind === "continue";

  return {
    ...base,
    verdict: visibleBlocksContinuation ? "stop" : decision.kind === "continue" ? "continue" : "stop",
    verdictText: visibleBlocksContinuation
      ? `Para aquí: no supera ${weaponPerformance.baselineLabel} en ${focusComparison.label}.${visibleComparisonText}`
      : `${decision.title}. ${decision.summary} ${decision.nextAction}${visibleComparisonText}`,
    nextStep:
      !visibleBlocksContinuation && decision.kind === "continue" ? base.nextStep : null,
    goalFit,
    directionNote,
    improvementCaveat,
    observedAffixes,
    weaponPerformance,
  };
}

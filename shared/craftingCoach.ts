import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
  type CraftingActionId,
} from "./craftingActions.js";
import { LOW_ELEMENTAL_RESISTANCE } from "./craftingCharacterContext.js";
import { EXPECTED_RESULT_RARITY, type CraftingComparison } from "./craftingComparison.js";
import { diagnoseCraftingItem, type CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
  type CraftingGoalSignal,
} from "./craftingGoal.js";
import {
  RESISTANCE_LABELS,
  type CharacterProfile,
  type Item,
  type ItemRarity,
} from "./domain.js";

/**
 * GUÍA DE CRAFTING CON UNA PIEZA REAL.
 *
 * Capa PURA: traduce a lenguaje corriente lo que los motores ya demuestran
 * (`diagnoseCraftingItem`, `evaluateObservedCraftingActions`,
 * `compareCraftingResult`, `evaluateCraftingGoalSignal`). No duplica el motor
 * de legalidad, no ordena resultados por calidad y no inventa mods, pools,
 * pesos, probabilidades ni precios.
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
  const { prefixCount, suffixCount, explicitCount, observedTotalLimit, observedOpenSlots } =
    diagnosis;

  const familia = (count: number, one: string, many: string) =>
    count === 0 ? `sin ${many}` : `${count} ${plural(count, one, many)}`;
  const estructura = `${familia(prefixCount, "prefijo", "prefijos")} y ${familia(suffixCount, "sufijo", "sufijos")}`;

  let sentence: string;
  if (item.rarity === "normal" && explicitCount === 0) {
    sentence = "Es una pieza normal: todavía no tiene ningún modificador.";
  } else if (observedOpenSlots === null) {
    sentence = `Es ${rarityWord} y tiene ${explicitCount} ${plural(explicitCount, "modificador", "modificadores")}.`;
  } else if (observedOpenSlots === 0) {
    sentence = `Es ${rarityWord}, con ${estructura}. Está lleno: no cabe nada más.`;
  } else {
    sentence =
      `Es ${rarityWord}, con ${estructura}. Todavía ` +
      `${plural(observedOpenSlots, "cabe uno más", `caben ${observedOpenSlots} más`)}.`;
  }

  return {
    rarityWord,
    explicitCount,
    prefixCount,
    suffixCount,
    observedTotalLimit,
    openSlots: observedOpenSlots,
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
    return {
      headline:
        comparison.status === "mismatch"
          ? "Esto no cuadra con la pieza anterior"
          : "Todavía no puedo confirmar el cambio",
      changed: [],
      kept: "",
      verdict: "stop",
      verdictText:
        "No gastes otra moneda. Vuelve a copiar el objeto del juego y pégalo otra vez.",
      nextStep: null,
      goalFit: "not-evaluable",
      directionNote: null,
      improvementCaveat: null,
    };
  }

  const changed = comparison.addedModifiers.map((modifier) => modifier.text);
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

  const verdict: CoachResultReading["verdict"] =
    nextStep.kind === "use-currency" ? "continue" : nextStep.kind === "stop" ? "stop" : "unclear";

  return {
    headline:
      changed.length === 0
        ? "El cambio está confirmado, pero no veo ningún modificador nuevo"
        : `Ha aparecido ${plural(changed.length, "un modificador nuevo", `${changed.length} modificadores nuevos`)}`,
    changed,
    kept:
      removed === 0
        ? "No se ha perdido nada de lo que ya tenías."
        : `Han desaparecido ${removed} ${plural(removed, "modificador", "modificadores")}. Revísalo antes de seguir.`,
    verdict,
    verdictText:
      verdict === "continue"
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
  };
}

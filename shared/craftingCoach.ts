import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
  type CraftingActionId,
} from "./craftingActions.js";
import { EXPECTED_RESULT_RARITY, type CraftingComparison } from "./craftingComparison.js";
import { diagnoseCraftingItem, type CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
  type CraftingGoalSignal,
} from "./craftingGoal.js";
import type { Item, ItemRarity } from "./domain.js";

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
 * Deduce la dirección SOLO a partir de las etiquetas que el propio objeto ya
 * muestra. Si no hay datos o apuntan a las dos direcciones, no elige: decirlo
 * es más útil que inventar una preferencia.
 */
export function guessDirectionFromItem(item: Item): CoachDirectionGuess {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  if (explicit.length === 0) {
    return {
      direction: null,
      reason: "Esta pieza todavía no tiene modificadores, así que no puedo deducir hacia dónde va.",
    };
  }

  const counts: Record<CoachDirection, number> = { damage: 0, defence: 0 };
  for (const modifier of explicit) {
    for (const direction of ["damage", "defence"] as const) {
      const signal = evaluateCraftingGoalSignal(DIRECTION_CATEGORY[direction], [modifier]);
      if (signal.status === "direct") counts[direction] += 1;
    }
  }

  if (counts.damage === 0 && counts.defence === 0) {
    return {
      direction: null,
      reason: "Sus modificadores no llevan etiquetas de daño ni de defensa que yo pueda leer.",
    };
  }
  if (counts.damage === counts.defence) {
    return {
      direction: null,
      reason: `Lleva ${counts.damage} de daño y ${counts.defence} de defensa: está empatado y elegir por ti sería inventar.`,
    };
  }

  const direction: CoachDirection = counts.damage > counts.defence ? "damage" : "defence";
  const winner = counts[direction];
  return {
    direction,
    reason:
      `Esta pieza ya lleva ${winner} ${plural(winner, "modificador", "modificadores")} ` +
      `con etiquetas de ${COACH_DIRECTION_NOUNS[direction]}.`,
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

export type CoachNextStep =
  | {
      kind: "needs-data";
      headline: string;
      instruction: string;
      why: string;
    }
  | {
      kind: "use-currency";
      actionId: CraftingActionId;
      label: string;
      /** Qué usar y sobre qué objeto. */
      instruction: string;
      why: string;
      /** Solo cuando hay una consecuencia estructural real. */
      warning: string | null;
      /** Qué puede ocurrir, sin prometer nada. Va plegado. */
      whatCanHappen: string[];
      alternatives: CoachAlternative[];
      evidence: string[];
    }
  | {
      kind: "stop";
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
export function chooseNextStep(item: Item): CoachNextStep {
  const diagnosis = diagnoseCraftingItem(item);
  const evaluations = evaluateObservedCraftingActions(item);
  const compatible = evaluations
    .filter((entry) => entry.status === "compatible")
    .map((entry) => entry.action.id);

  if (diagnosis.state !== "complete") {
    return {
      kind: "needs-data",
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

  return {
    kind: "use-currency",
    actionId,
    label: action.label,
    instruction: `Usa un ${action.label.toLocaleLowerCase("es")} sobre «${item.name}».`,
    why:
      alternatives.length > 0
        ? `Es la única que puedes usar mientras el objeto siga siendo ${RARITY_WORD[item.rarity] ?? item.rarity}. La otra vía seguirá disponible después.`
        : "Es la única acción compatible con la pieza tal y como está ahora.",
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
  directionNote: string | null;
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
      directionNote: null,
    };
  }

  const changed = comparison.addedModifiers.map((modifier) => modifier.text);
  const removed = comparison.removedModifiers.length;
  const nextStep = chooseNextStep(resultItem);

  let directionNote: string | null = null;
  if (direction !== null && comparison.addedModifiers.length > 0) {
    const signal: CraftingGoalSignal = evaluateCraftingGoalSignal(
      DIRECTION_CATEGORY[direction],
      comparison.addedModifiers,
    );
    directionNote =
      signal.status === "direct"
        ? `Lo que ha salido lleva etiquetas de ${COACH_DIRECTION_NOUNS[direction]}, que es lo que buscabas. Tú decides si la cantidad te sirve.`
        : signal.status === "no-direct-signal"
          ? `Lo que ha salido no lleva etiquetas de ${COACH_DIRECTION_NOUNS[direction]}. Eso no lo hace inútil, pero no es lo que pediste.`
          : `El texto no trae etiquetas de ${COACH_DIRECTION_NOUNS[direction]} que yo pueda comparar.`;
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
    directionNote,
  };
}

import type { CraftingCharacterContext } from "./craftingCharacterContext.js";
import type { CraftingComparison } from "./craftingComparison.js";
import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
  type CraftingGoalSignal,
} from "./craftingGoal.js";
import type { Item } from "./domain.js";
import type { CraftingSuccessAssessment } from "./craftingSuccessCriteria.js";
import type { ObservedModifierRollQuality } from "./craftingRollQuality.js";

export type CraftingNextDecisionKind = "continue" | "stop" | "restart";
export type CraftingNextDecisionTone = "positive" | "caution" | "danger";

export interface CraftingNextDecision {
  kind: CraftingNextDecisionKind;
  tone: CraftingNextDecisionTone;
  title: string;
  summary: string;
  nextAction: string;
  observedOpenSlots: number | null;
  resultGoalSignal: CraftingGoalSignal;
}

/**
 * Convierte hechos YA observados en una decisión prudente. No estima DPS,
 * precio, pesos ni probabilidad. «Reiniciar» significa replantear la ruta;
 * nunca ordena destruir o vender el objeto.
 */
export function decideCraftingNextStep(input: {
  resultItem: Item;
  comparison: CraftingComparison;
  characterContext: CraftingCharacterContext;
  addedGoalSignal: CraftingGoalSignal;
  goalCategory: CraftingGoalCategory | undefined;
  successAssessment?: CraftingSuccessAssessment | null;
  addedRollQuality?: ObservedModifierRollQuality | null;
}, lang: "es" | "en" = "es"): CraftingNextDecision {
  const en = lang === "en";
  const {
    resultItem,
    comparison,
    characterContext,
    addedGoalSignal,
    goalCategory,
    successAssessment,
    addedRollQuality,
  } = input;
  const diagnosis = diagnoseCraftingItem(resultItem, lang);
  const explicitModifiers = resultItem.modifiers.filter(
    (modifier) => modifier.kind === "explicit",
  );
  const resultGoalSignal = evaluateCraftingGoalSignal(goalCategory, explicitModifiers);
  const observedOpenSlots = diagnosis.observedOpenSlots;

  if (comparison.status !== "confirmed") {
    return {
      kind: "stop",
      tone: "danger",
      title: en ? "Stop: the result isn't confirmed" : "Detente: el resultado no está confirmado",
      summary: en
        ? "The comparison doesn't prove yet that it's the same item with the expected change."
        : "La comparación todavía no demuestra que sea el mismo objeto con el cambio esperado.",
      nextAction: en
        ? "Don't spend another orb. Copy the item again and confirm it's the same one."
        : "No gastes otra moneda. Repite la copia del objeto y confirma su identidad.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (characterContext.verdict === "stop") {
    return {
      kind: "stop",
      tone: "danger",
      title: characterContext.title,
      summary: characterContext.summary,
      nextAction: en
        ? "Don't spend another orb until the block above is solved."
        : "No gastes otra moneda hasta resolver el bloqueo indicado.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (diagnosis.state !== "complete") {
    return {
      kind: "stop",
      tone: "danger",
      title: en
        ? "Stop: the new item can't be read in full"
        : "Detente: la nueva pieza no se puede leer completa",
      summary: diagnosis.summary,
      nextAction: diagnosis.nextAction,
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (addedGoalSignal.status === "direct" && addedRollQuality?.band === "low") {
    return {
      kind: "stop",
      tone: "caution",
      title: en ? "It matches, but the roll is low" : "Coincide, pero la tirada observada es baja",
      summary: en
        ? "The modifier points at your goal, but its values sit in the low part of the range the game shows."
        : "El afijo apunta al objetivo, pero sus valores están en el tramo bajo del rango que muestra el juego.",
      nextAction: en
        ? "Don't chain another orb yet: decide whether this roll meets your stop condition."
        : "No encadenes otra moneda todavía: decide si esta tirada cumple tu condición de parada.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (successAssessment?.status === "fulfilled") {
    return {
      kind: "stop",
      tone: "positive",
      title: en ? "Stop point reached" : "Punto de parada alcanzado",
      summary: en
        ? "The result meets the visible conditions you picked before spending."
        : "El resultado cumple las condiciones observables que elegiste antes de gastar.",
      nextAction: en
        ? "Keep this result and check the item on your character before starting another goal."
        : "Conserva este resultado y reevalúa la pieza en el personaje antes de iniciar otro objetivo.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (addedGoalSignal.status === "direct" && (observedOpenSlots ?? 0) > 0) {
    return {
      kind: "continue",
      tone: "positive",
      title: en ? "You can keep going, one at a time" : "Puedes continuar, de uno en uno",
      summary: en
        ? "The change points at your goal and the item still has room. This doesn't prove the modifier value is good enough."
        : "El cambio apunta al objetivo y la estructura observada aún conserva espacio. Esto no demuestra que el valor del afijo sea suficiente.",
      nextAction: en
        ? "Save this result and go back to the bench to check the next allowed action."
        : "Guarda este resultado y vuelve al banco para ver el siguiente paso.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (addedGoalSignal.status === "direct") {
    return {
      kind: "stop",
      tone: "positive",
      title: en ? "Stop and keep this result" : "Para y conserva este resultado",
      summary: en
        ? "The change points at your goal and the item is full. Going on would need a replacing operation that risks what's already there."
        : "El cambio apunta al objetivo y la pieza está llena. Seguir exigiría una operación de reemplazo con riesgo para lo que ya existe.",
      nextAction: en
        ? "Try it on your character before considering a verified Essence or Alloy."
        : "Pruébala en el personaje antes de considerar una Essence o un Alloy verificados.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (resultGoalSignal.status === "direct") {
    return {
      kind: "stop",
      tone: "caution",
      title: en ? "Don't spend another orb yet" : "No gastes otra moneda todavía",
      summary: en
        ? "The item still shows signs of your goal, but the new change doesn't add a direct one. The app can't call it progress based on size or interactions."
        : "La pieza conserva señales de tu objetivo, pero el cambio nuevo no aporta una señal directa. La app no puede declarar progreso por su magnitud o interacción.",
      nextAction: en
        ? "Decide whether the new modifier helps you in game before keeping or dropping this route."
        : "Decide si el nuevo afijo te sirve en juego antes de aceptar o abandonar esta ruta.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (observedOpenSlots === 0) {
    return {
      kind: "restart",
      tone: "caution",
      title: en ? "Rethink this route" : "Replantea esta ruta",
      summary: en
        ? "The item is full and its explicit tags show no direct link to the goal you picked."
        : "La pieza está llena y sus etiquetas explícitas no muestran una relación directa con el objetivo elegido.",
      nextAction: en
        ? "Don't destroy anything on autopilot: compare another base or a replacing tool whose tooltip you've checked."
        : "No destruyas nada automáticamente: compara otra base o una herramienta de reemplazo cuyo tooltip hayas verificado.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  return {
    kind: "stop",
    tone: "caution",
    title: en ? "Don't spend another orb yet" : "No gastes otra moneda todavía",
    summary: en
      ? "The new change shows no direct link to your goal. Having free room doesn't prove it's worth going on."
      : "El cambio nuevo no muestra una relación directa con el objetivo. Tener hueco libre no demuestra que continuar compense.",
    nextAction: en
      ? "Try the result or rethink your goal before picking another orb."
      : "Prueba el resultado o redefine el objetivo antes de elegir otra moneda.",
    observedOpenSlots,
    resultGoalSignal,
  };
}

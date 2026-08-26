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
}): CraftingNextDecision {
  const {
    resultItem,
    comparison,
    characterContext,
    addedGoalSignal,
    goalCategory,
    successAssessment,
    addedRollQuality,
  } = input;
  const diagnosis = diagnoseCraftingItem(resultItem);
  const explicitModifiers = resultItem.modifiers.filter(
    (modifier) => modifier.kind === "explicit",
  );
  const resultGoalSignal = evaluateCraftingGoalSignal(goalCategory, explicitModifiers);
  const observedOpenSlots = diagnosis.observedOpenSlots;

  if (comparison.status !== "confirmed") {
    return {
      kind: "stop",
      tone: "danger",
      title: "Detente: el resultado no está confirmado",
      summary: "La comparación todavía no demuestra que sea el mismo objeto con el cambio esperado.",
      nextAction: "No gastes otra moneda. Repite la copia del objeto y confirma su identidad.",
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
      nextAction: "No gastes otra moneda hasta resolver el bloqueo indicado.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (diagnosis.state !== "complete") {
    return {
      kind: "stop",
      tone: "danger",
      title: "Detente: la nueva pieza no se puede leer completa",
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
      title: "Coincide, pero la tirada observada es baja",
      summary:
        "El afijo apunta al objetivo, pero sus valores están en el tramo bajo del rango que muestra el juego.",
      nextAction:
        "No encadenes otra moneda todavía: decide si esta tirada cumple tu condición de parada.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (successAssessment?.status === "fulfilled") {
    return {
      kind: "stop",
      tone: "positive",
      title: "Punto de parada alcanzado",
      summary:
        "El resultado cumple las condiciones observables que elegiste antes de gastar.",
      nextAction:
        "Conserva este resultado y reevalúa la pieza en el personaje antes de iniciar otro objetivo.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (addedGoalSignal.status === "direct" && (observedOpenSlots ?? 0) > 0) {
    return {
      kind: "continue",
      tone: "positive",
      title: "Puedes continuar, de uno en uno",
      summary:
        "El cambio apunta al objetivo y la estructura observada aún conserva espacio. Esto no demuestra que el valor del afijo sea suficiente.",
      nextAction: "Guarda este resultado y vuelve al banco para comprobar la siguiente acción legal.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (addedGoalSignal.status === "direct") {
    return {
      kind: "stop",
      tone: "positive",
      title: "Para y conserva este resultado",
      summary:
        "El cambio apunta al objetivo y la pieza está llena. Seguir exigiría una operación de reemplazo con riesgo para lo que ya existe.",
      nextAction: "Pruébala en el personaje antes de considerar una Essence o un Alloy verificados.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (resultGoalSignal.status === "direct") {
    return {
      kind: "stop",
      tone: "caution",
      title: "No gastes otra moneda todavía",
      summary:
        "La pieza conserva señales de tu objetivo, pero el cambio nuevo no aporta una señal directa. La app no puede declarar progreso por su magnitud o interacción.",
      nextAction: "Decide si el nuevo afijo te sirve en juego antes de aceptar o abandonar esta ruta.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  if (observedOpenSlots === 0) {
    return {
      kind: "restart",
      tone: "caution",
      title: "Replantea esta ruta",
      summary:
        "La pieza está llena y sus etiquetas explícitas no muestran una relación directa con el objetivo elegido.",
      nextAction:
        "No destruyas nada automáticamente: compara otra base o una herramienta de reemplazo cuyo tooltip hayas verificado.",
      observedOpenSlots,
      resultGoalSignal,
    };
  }

  return {
    kind: "stop",
    tone: "caution",
    title: "No gastes otra moneda todavía",
    summary:
      "El cambio nuevo no muestra una relación directa con el objetivo. Tener hueco libre no demuestra que continuar compense.",
    nextAction: "Prueba el resultado o redefine el objetivo antes de elegir otra moneda.",
    observedOpenSlots,
    resultGoalSignal,
  };
}

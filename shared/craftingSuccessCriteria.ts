import { z } from "zod";
import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import {
  CRAFTING_GOAL_LABELS,
  CraftingGoalCategorySchema,
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "./craftingGoal.js";
import type { Item } from "./domain.js";

const ObservableGoalCategorySchema = CraftingGoalCategorySchema.exclude(["other"]);

/**
 * Condiciones que el jugador puede comprobar en el texto avanzado resultante.
 * Ninguna depende de interpretar el objetivo libre ni de atribuir valor a un afijo.
 */
export const CraftingSuccessCriterionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("goal-affix-count"),
    category: ObservableGoalCategorySchema,
    minimumCount: z.number().int().min(1).max(6),
  }),
  z.object({
    kind: z.literal("exact-modifier-text"),
    text: z.string().trim().min(3).max(500),
  }),
  z.object({
    kind: z.literal("explicit-count"),
    minimumCount: z.number().int().min(1).max(6),
  }),
]);
export type CraftingSuccessCriterion = z.infer<typeof CraftingSuccessCriterionSchema>;

export const CraftingSuccessCriteriaSchema = z
  .array(CraftingSuccessCriterionSchema)
  .max(3)
  .default([])
  .superRefine((criteria, context) => {
    const kinds = criteria.map((criterion) => criterion.kind);
    if (new Set(kinds).size !== kinds.length) {
      context.addIssue({
        code: "custom",
        message: "Cada condición de éxito solo puede aparecer una vez.",
      });
    }
  });

export type CraftingSuccessCriterionStatus = "fulfilled" | "not-seen" | "unknown";
export type CraftingSuccessAssessmentStatus =
  | "fulfilled"
  | "not-fulfilled"
  | "unknown"
  | "not-defined";

export interface CraftingSuccessCriterionAssessment {
  criterion: CraftingSuccessCriterion;
  status: CraftingSuccessCriterionStatus;
  label: string;
  detail: string;
}

export interface CraftingSuccessAssessment {
  status: CraftingSuccessAssessmentStatus;
  title: string;
  summary: string;
  entries: CraftingSuccessCriterionAssessment[];
}

/**
 * Propone el siguiente umbral observable sin decidir si el afijo sería bueno.
 * Solo cuenta etiquetas literales ya presentes y pide una coincidencia adicional.
 */
export function recommendCraftingSuccessCriterion(
  item: Item,
  category: CraftingGoalCategory,
): Extract<CraftingSuccessCriterion, { kind: "goal-affix-count" }> | null {
  if (category === "other") return null;

  const currentCount = item.modifiers.filter(
    (modifier) =>
      modifier.kind === "explicit" &&
      evaluateCraftingGoalSignal(category, [modifier]).status === "direct",
  ).length;
  if (currentCount >= 6) return null;

  return {
    kind: "goal-affix-count",
    category,
    minimumCount: currentCount + 1,
  };
}

export function craftingSuccessCriterionLabel(criterion: CraftingSuccessCriterion): string {
  if (criterion.kind === "goal-affix-count") {
    return `Al menos ${criterion.minimumCount} afijo${
      criterion.minimumCount === 1 ? "" : "s"
    } de ${CRAFTING_GOAL_LABELS[criterion.category].toLocaleLowerCase("es")}`;
  }
  if (criterion.kind === "exact-modifier-text") {
    return `Que aparezca: ${criterion.text}`;
  }
  return `Llegar a ${criterion.minimumCount} afijo${
    criterion.minimumCount === 1 ? "" : "s"
  } explícito${criterion.minimumCount === 1 ? "" : "s"}`;
}

function explicitModifiers(item: Item) {
  return item.modifiers.filter((modifier) => modifier.kind === "explicit");
}

function assessGoalCount(
  criterion: Extract<CraftingSuccessCriterion, { kind: "goal-affix-count" }>,
  resultItem: Item,
): CraftingSuccessCriterionAssessment {
  const explicit = explicitModifiers(resultItem);
  const matched = explicit.filter(
    (modifier) => evaluateCraftingGoalSignal(criterion.category, [modifier]).status === "direct",
  ).length;
  const label = craftingSuccessCriterionLabel(criterion);

  if (matched >= criterion.minimumCount) {
    return {
      criterion,
      status: "fulfilled",
      label,
      detail: `${matched} afijo${matched === 1 ? "" : "s"} contiene${
        matched === 1 ? "" : "n"
      } etiquetas observadas de esa categoría.`,
    };
  }

  if (explicit.some((modifier) => (modifier.tags?.length ?? 0) === 0)) {
    return {
      criterion,
      status: "unknown",
      label,
      detail: `Solo se observan ${matched}; hay afijos sin etiquetas y no se puede descartar una coincidencia.`,
    };
  }

  return {
    criterion,
    status: "not-seen",
    label,
    detail: `Se observan ${matched}; la condición pedía ${criterion.minimumCount}.`,
  };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function assessExactText(
  criterion: Extract<CraftingSuccessCriterion, { kind: "exact-modifier-text" }>,
  resultItem: Item,
): CraftingSuccessCriterionAssessment {
  const label = craftingSuccessCriterionLabel(criterion);
  const diagnosis = diagnoseCraftingItem(resultItem);
  const found = explicitModifiers(resultItem).some(
    (modifier) => normalized(modifier.text) === normalized(criterion.text),
  );
  if (found) {
    return {
      criterion,
      status: "fulfilled",
      label,
      detail: "La línea exacta indicada por el jugador aparece en el resultado.",
    };
  }
  if (diagnosis.state === "complete") {
    return {
      criterion,
      status: "not-seen",
      label,
      detail: "La línea exacta indicada no aparece entre los afijos explícitos.",
    };
  }
  return {
    criterion,
    status: "unknown",
    label,
    detail: "La estructura del objeto no se puede leer completa.",
  };
}

function assessExplicitCount(
  criterion: Extract<CraftingSuccessCriterion, { kind: "explicit-count" }>,
  resultItem: Item,
): CraftingSuccessCriterionAssessment {
  const diagnosis = diagnoseCraftingItem(resultItem);
  const count = explicitModifiers(resultItem).length;
  const label = craftingSuccessCriterionLabel(criterion);

  if (diagnosis.state !== "complete") {
    return {
      criterion,
      status: "unknown",
      label,
      detail: "La estructura del objeto no se puede leer completa.",
    };
  }
  return count >= criterion.minimumCount
    ? {
        criterion,
        status: "fulfilled",
        label,
        detail: `El resultado contiene ${count} afijo${count === 1 ? "" : "s"} explícito${
          count === 1 ? "" : "s"
        }.`,
      }
    : {
        criterion,
        status: "not-seen",
        label,
        detail: `El resultado contiene ${count}; la condición pedía ${criterion.minimumCount}.`,
      };
}

/** Evalúa únicamente condiciones estructuradas elegidas por el jugador. */
export function evaluateCraftingSuccessCriteria(input: {
  criteria: readonly CraftingSuccessCriterion[];
  resultItem: Item;
}): CraftingSuccessAssessment {
  const { criteria, resultItem } = input;
  if (criteria.length === 0) {
    return {
      status: "not-defined",
      title: "Sin condición de parada registrada",
      summary: "Esta sesión antigua conserva su comportamiento anterior.",
      entries: [],
    };
  }

  const entries = criteria.map((criterion): CraftingSuccessCriterionAssessment => {
    if (criterion.kind === "goal-affix-count") return assessGoalCount(criterion, resultItem);
    if (criterion.kind === "exact-modifier-text") return assessExactText(criterion, resultItem);
    return assessExplicitCount(criterion, resultItem);
  });
  const fulfilled = entries.filter((entry) => entry.status === "fulfilled").length;
  const unknown = entries.filter((entry) => entry.status === "unknown").length;

  if (fulfilled === entries.length) {
    return {
      status: "fulfilled",
      title: "Has llegado a tu punto de parada",
      summary: "Todas las condiciones observables que elegiste aparecen en el resultado.",
      entries,
    };
  }
  if (unknown > 0) {
    return {
      status: "unknown",
      title: "Aún no se puede confirmar el final",
      summary: `${fulfilled}/${entries.length} condiciones confirmadas; ${unknown} siguen sin poder comprobarse.`,
      entries,
    };
  }
  return {
    status: "not-fulfilled",
    title: "Todavía no se cumplen todas tus condiciones",
    summary: `${fulfilled}/${entries.length} condiciones confirmadas en el resultado.`,
    entries,
  };
}

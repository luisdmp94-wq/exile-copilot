import { z } from "zod";
import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import {
  CRAFTING_GOAL_LABELS,
  CRAFTING_GOAL_LABELS_EN,
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
    /**
     * En PoE2 un número de grado menor representa un afijo mejor. Por eso el
     * límite guardado es el peor grado aceptable: 3 significa «grado 3 o mejor».
     * `undefined` conserva las sesiones antiguas y exige solo la línea exacta.
     */
    maximumTier: z.number().int().min(1).max(20).optional(),
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
    const singletonKinds = criteria
      .filter((criterion) => criterion.kind !== "exact-modifier-text")
      .map((criterion) => criterion.kind);
    if (new Set(singletonKinds).size !== singletonKinds.length) {
      context.addIssue({
        code: "custom",
        message: "Las condiciones de cantidad solo pueden aparecer una vez.",
      });
    }
    const exactTexts = criteria
      .filter((criterion) => criterion.kind === "exact-modifier-text")
      .map((criterion) => normalized(criterion.text));
    if (new Set(exactTexts).size !== exactTexts.length) {
      context.addIssue({
        code: "custom",
        message: "No se puede repetir la misma línea objetivo.",
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

export function craftingSuccessCriterionLabel(
  criterion: CraftingSuccessCriterion,
  lang: "es" | "en" = "es",
): string {
  if (lang === "en") {
    if (criterion.kind === "goal-affix-count") {
      return `At least ${criterion.minimumCount} ${
        CRAFTING_GOAL_LABELS_EN[criterion.category].toLocaleLowerCase("en")
      } modifier${criterion.minimumCount === 1 ? "" : "s"}`;
    }
    if (criterion.kind === "exact-modifier-text") {
      return `Must show: ${criterion.text}${
        criterion.maximumTier === undefined ? "" : ` (tier ${criterion.maximumTier} or better)`
      }`;
    }
    return `Reach ${criterion.minimumCount} explicit modifier${criterion.minimumCount === 1 ? "" : "s"}`;
  }
  if (criterion.kind === "goal-affix-count") {
    return `Al menos ${criterion.minimumCount} afijo${
      criterion.minimumCount === 1 ? "" : "s"
    } de ${CRAFTING_GOAL_LABELS[criterion.category].toLocaleLowerCase("es")}`;
  }
  if (criterion.kind === "exact-modifier-text") {
    return `Que aparezca: ${criterion.text}${
      criterion.maximumTier === undefined ? "" : ` (grado ${criterion.maximumTier} o mejor)`
    }`;
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
  lang: "es" | "en",
): CraftingSuccessCriterionAssessment {
  const en = lang === "en";
  const explicit = explicitModifiers(resultItem);
  const matched = explicit.filter(
    (modifier) => evaluateCraftingGoalSignal(criterion.category, [modifier]).status === "direct",
  ).length;
  const label = craftingSuccessCriterionLabel(criterion, lang);

  if (matched >= criterion.minimumCount) {
    return {
      criterion,
      status: "fulfilled",
      label,
      detail: en
        ? `${matched} modifier${matched === 1 ? " has" : "s have"} tags from that category.`
        : `${matched} afijo${matched === 1 ? "" : "s"} contiene${
            matched === 1 ? "" : "n"
          } etiquetas observadas de esa categoría.`,
    };
  }

  if (explicit.some((modifier) => (modifier.tags?.length ?? 0) === 0)) {
    return {
      criterion,
      status: "unknown",
      label,
      detail: en
        ? `Only ${matched} seen; some modifiers have no tags, so a match can't be ruled out.`
        : `Solo se observan ${matched}; hay afijos sin etiquetas y no se puede descartar una coincidencia.`,
    };
  }

  return {
    criterion,
    status: "not-seen",
    label,
    detail: en
      ? `${matched} seen; the condition asked for ${criterion.minimumCount}.`
      : `Se observan ${matched}; la condición pedía ${criterion.minimumCount}.`,
  };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function assessExactText(
  criterion: Extract<CraftingSuccessCriterion, { kind: "exact-modifier-text" }>,
  resultItem: Item,
  lang: "es" | "en",
): CraftingSuccessCriterionAssessment {
  const en = lang === "en";
  const label = craftingSuccessCriterionLabel(criterion, lang);
  const diagnosis = diagnoseCraftingItem(resultItem);
  const found = explicitModifiers(resultItem).find(
    (modifier) => normalized(modifier.text) === normalized(criterion.text),
  );
  if (found && criterion.maximumTier === undefined) {
    return {
      criterion,
      status: "fulfilled",
      label,
      detail: en
        ? "The exact line you chose appears in the result."
        : "La línea exacta indicada por el jugador aparece en el resultado.",
    };
  }
  if (found && found.tier === undefined) {
    return {
      criterion,
      status: "unknown",
      label,
      detail: en
        ? "The line appears, but the pasted text doesn't show its tier."
        : "La línea aparece, pero el texto pegado no permite comprobar su grado.",
    };
  }
  if (found && found.tier !== undefined && criterion.maximumTier !== undefined) {
    return found.tier <= criterion.maximumTier
      ? {
          criterion,
          status: "fulfilled",
          label,
          detail: en
            ? `The line appears at tier ${found.tier}; it meets the minimum of tier ${criterion.maximumTier} or better.`
            : `La línea aparece en grado ${found.tier}; cumple el mínimo de grado ${criterion.maximumTier} o mejor.`,
        }
      : {
          criterion,
          status: "not-seen",
          label,
          detail: en
            ? `The line appears at tier ${found.tier}; the plan needs tier ${criterion.maximumTier} or better.`
            : `La línea aparece en grado ${found.tier}; el plan exige grado ${criterion.maximumTier} o mejor.`,
        };
  }
  if (diagnosis.state === "complete") {
    return {
      criterion,
      status: "not-seen",
      label,
      detail: en
        ? "The exact line you chose is not among the explicit modifiers."
        : "La línea exacta indicada no aparece entre los afijos explícitos.",
    };
  }
  return {
    criterion,
    status: "unknown",
    label,
    detail: en
      ? "The item's structure can't be fully read."
      : "La estructura del objeto no se puede leer completa.",
  };
}

function assessExplicitCount(
  criterion: Extract<CraftingSuccessCriterion, { kind: "explicit-count" }>,
  resultItem: Item,
  lang: "es" | "en",
): CraftingSuccessCriterionAssessment {
  const en = lang === "en";
  const diagnosis = diagnoseCraftingItem(resultItem);
  const count = explicitModifiers(resultItem).length;
  const label = craftingSuccessCriterionLabel(criterion, lang);

  if (diagnosis.state !== "complete") {
    return {
      criterion,
      status: "unknown",
      label,
      detail: en
        ? "The item's structure can't be fully read."
        : "La estructura del objeto no se puede leer completa.",
    };
  }
  return count >= criterion.minimumCount
    ? {
        criterion,
        status: "fulfilled",
        label,
        detail: en
          ? `The result has ${count} explicit modifier${count === 1 ? "" : "s"}.`
          : `El resultado contiene ${count} afijo${count === 1 ? "" : "s"} explícito${
              count === 1 ? "" : "s"
            }.`,
      }
    : {
        criterion,
        status: "not-seen",
        label,
        detail: en
          ? `The result has ${count}; the condition asked for ${criterion.minimumCount}.`
          : `El resultado contiene ${count}; la condición pedía ${criterion.minimumCount}.`,
      };
}

/** Evalúa únicamente condiciones estructuradas elegidas por el jugador. */
export function evaluateCraftingSuccessCriteria(input: {
  criteria: readonly CraftingSuccessCriterion[];
  resultItem: Item;
}, lang: "es" | "en" = "es"): CraftingSuccessAssessment {
  const en = lang === "en";
  const { criteria, resultItem } = input;
  if (criteria.length === 0) {
    return {
      status: "not-defined",
      title: en ? "No stop condition saved" : "Sin condición de parada registrada",
      summary: en
        ? "This older session keeps its previous behaviour."
        : "Esta sesión antigua conserva su comportamiento anterior.",
      entries: [],
    };
  }

  const entries = criteria.map((criterion): CraftingSuccessCriterionAssessment => {
    if (criterion.kind === "goal-affix-count") return assessGoalCount(criterion, resultItem, lang);
    if (criterion.kind === "exact-modifier-text") return assessExactText(criterion, resultItem, lang);
    return assessExplicitCount(criterion, resultItem, lang);
  });
  const fulfilled = entries.filter((entry) => entry.status === "fulfilled").length;
  const unknown = entries.filter((entry) => entry.status === "unknown").length;

  if (fulfilled === entries.length) {
    return {
      status: "fulfilled",
      title: en ? "You've reached your stop point" : "Has llegado a tu punto de parada",
      summary: en
        ? "Every condition you chose shows up in the result."
        : "Todas las condiciones observables que elegiste aparecen en el resultado.",
      entries,
    };
  }
  if (unknown > 0) {
    return {
      status: "unknown",
      title: en ? "The finish can't be confirmed yet" : "Aún no se puede confirmar el final",
      summary: en
        ? `${fulfilled}/${entries.length} conditions confirmed; ${unknown} still can't be checked.`
        : `${fulfilled}/${entries.length} condiciones confirmadas; ${unknown} siguen sin poder comprobarse.`,
      entries,
    };
  }
  return {
    status: "not-fulfilled",
    title: en ? "Not all your conditions are met yet" : "Todavía no se cumplen todas tus condiciones",
    summary: en
      ? `${fulfilled}/${entries.length} conditions confirmed in the result.`
      : `${fulfilled}/${entries.length} condiciones confirmadas en el resultado.`,
    entries,
  };
}

import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "./craftingGoal.js";
import {
  evaluateCraftingSuccessCriteria,
  type CraftingSuccessCriterion,
} from "./craftingSuccessCriteria.js";
import type { Item, Modifier } from "./domain.js";

export type CraftingTargetEvidenceStatus =
  | "target-on-current"
  | "target-observed-locally"
  | "partial-local-evidence"
  | "unobserved";

export type CraftingModPoolCoverage =
  | "available-complete"
  | "available-partial"
  | "unavailable"
  | "unknown";

export interface CraftingTargetObservation {
  itemId: string;
  itemName: string;
  baseType: string;
  itemLevel: number | null;
  modifierText: string;
  tier: number | null;
  relation: "exact" | "category";
  source: "current" | "peer";
}

export interface CraftingTargetEvidence {
  status: CraftingTargetEvidenceStatus;
  headline: string;
  summary: string;
  comparableItemCount: number;
  fulfilledItemIds: string[];
  observations: CraftingTargetObservation[];
  modPoolCoverage: CraftingModPoolCoverage;
  limitations: string[];
}

export interface CraftingObservedTargetSuggestion {
  text: string;
  maximumTier: number | undefined;
  itemName: string;
  itemLevel: number | null;
  source: "current" | "peer";
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function comparableItems(selectedItem: Item, items: readonly Item[]): Item[] {
  const selectedClass = selectedItem.itemClass?.trim();
  return items.filter((candidate) => {
    if (candidate.id === selectedItem.id) return true;
    if (selectedClass) {
      return candidate.itemClass !== undefined &&
        normalized(candidate.itemClass) === normalized(selectedClass);
    }
    return candidate.slot === selectedItem.slot;
  });
}

function exactTargetTexts(criteria: readonly CraftingSuccessCriterion[]): Set<string> {
  return new Set(
    criteria
      .filter(
        (criterion): criterion is Extract<
          CraftingSuccessCriterion,
          { kind: "exact-modifier-text" }
        > => criterion.kind === "exact-modifier-text",
      )
      .map((criterion) => normalized(criterion.text)),
  );
}

/** Convierte observaciones literales en atajos; no agrupa familias ni infiere ids. */
export function suggestObservedCraftingTargets(input: {
  observations: readonly CraftingTargetObservation[];
  criteria: readonly CraftingSuccessCriterion[];
  limit?: number;
}): CraftingObservedTargetSuggestion[] {
  const selected = exactTargetTexts(input.criteria);
  const seen = new Set<string>();
  return [...input.observations]
    .sort((left, right) =>
      Number(left.source === "current") - Number(right.source === "current") ||
      (left.tier ?? Number.MAX_SAFE_INTEGER) - (right.tier ?? Number.MAX_SAFE_INTEGER) ||
      left.modifierText.localeCompare(right.modifierText, "es"),
    )
    .flatMap((observation): CraftingObservedTargetSuggestion[] => {
      const key = normalized(observation.modifierText);
      if (selected.has(key) || seen.has(key)) return [];
      seen.add(key);
      return [{
        text: observation.modifierText,
        maximumTier: observation.tier ?? undefined,
        itemName: observation.itemName,
        itemLevel: observation.itemLevel,
        source: observation.source,
      }];
    })
    .slice(0, input.limit ?? 6);
}

function modifierRelation(
  modifier: Modifier,
  exactTargets: Set<string>,
  goalCategory: CraftingGoalCategory,
): CraftingTargetObservation["relation"] | null {
  if (exactTargets.has(normalized(modifier.text))) return "exact";
  if (
    goalCategory !== "other" &&
    evaluateCraftingGoalSignal(goalCategory, [modifier]).status === "direct"
  ) {
    return "category";
  }
  return null;
}

/**
 * Reutiliza exclusivamente objetos que el jugador ya importó. Una observación
 * local demuestra que una línea apareció en ese objeto, nunca que el pool sea
 * exhaustivo, que la base actual pueda obtenerla o que exista una probabilidad.
 */
export function buildCraftingTargetEvidence(input: {
  selectedItem: Item;
  items: readonly Item[];
  goalCategory: CraftingGoalCategory;
  successCriteria: readonly CraftingSuccessCriterion[];
  modPoolCoverage: CraftingModPoolCoverage;
}): CraftingTargetEvidence {
  const {
    selectedItem,
    items,
    goalCategory,
    successCriteria,
    modPoolCoverage,
  } = input;
  const comparable = comparableItems(selectedItem, items);
  const exactTargets = exactTargetTexts(successCriteria);
  const fulfilledItemIds = successCriteria.length === 0
    ? []
    : comparable
        .filter(
          (candidate) =>
            evaluateCraftingSuccessCriteria({
              criteria: successCriteria,
              resultItem: candidate,
            }).status === "fulfilled",
        )
        .map((candidate) => candidate.id);

  const observations = comparable.flatMap((candidate) => {
    if (diagnoseCraftingItem(candidate).state === "blocked") return [];
    return candidate.modifiers
      .filter((modifier) => modifier.kind === "explicit")
      .flatMap((modifier): CraftingTargetObservation[] => {
        const relation = modifierRelation(modifier, exactTargets, goalCategory);
        if (relation === null) return [];
        return [{
          itemId: candidate.id,
          itemName: candidate.name,
          baseType: candidate.baseType,
          itemLevel: candidate.itemLevel ?? null,
          modifierText: modifier.text,
          tier: modifier.tier ?? null,
          relation,
          source: candidate.id === selectedItem.id ? "current" : "peer",
        }];
      });
  });

  let status: CraftingTargetEvidenceStatus;
  if (fulfilledItemIds.includes(selectedItem.id)) status = "target-on-current";
  else if (fulfilledItemIds.length > 0) status = "target-observed-locally";
  else if (observations.length > 0) status = "partial-local-evidence";
  else status = "unobserved";

  const copy: Record<
    CraftingTargetEvidenceStatus,
    Pick<CraftingTargetEvidence, "headline" | "summary">
  > = {
    "target-on-current": {
      headline: "El objetivo ya aparece en esta base",
      summary: "La pieza actual cumple las condiciones observables del proyecto. Consérvala antes de plantear otro gasto.",
    },
    "target-observed-locally": {
      headline: "Tu evidencia local ya muestra este objetivo",
      summary: "Otra pieza importada de la misma clase cumple el contrato. Sirve como referencia observable, no como receta para reproducirlo.",
    },
    "partial-local-evidence": {
      headline: "Hay señales, pero no el objetivo completo",
      summary: "Tus objetos importados contienen líneas de la categoría elegida. Todavía no demuestran que el contrato completo sea alcanzable en esta base.",
    },
    unobserved: {
      headline: "El objetivo todavía no está demostrado",
      summary: "Ninguna pieza comparable importada aporta una coincidencia observable. El taller solo puede autorizar pruebas estructurales controladas.",
    },
  };

  return {
    status,
    ...copy[status],
    comparableItemCount: comparable.length,
    fulfilledItemIds,
    observations,
    modPoolCoverage,
    limitations: [
      "Una línea observada no demuestra el pool completo ni su peso de aparición.",
      "El ilvl observado describe esa pieza; no se presenta como nivel mínimo del modificador.",
      modPoolCoverage === "available-complete"
        ? "La cobertura del pool es completa, pero esta lectura local no identifica candidatos por un nombre visible."
        : modPoolCoverage === "available-partial"
          ? "El pool disponible es parcial y no permite normalizar probabilidades."
          : modPoolCoverage === "unknown"
            ? "La cobertura del pool todavía se está consultando."
            : "No hay un pool autorizado disponible para calcular acceso ni probabilidades.",
    ],
  };
}

import { diagnoseCraftingItem, type CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import {
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "./craftingGoal.js";
import {
  readCharacterLevel,
  type CharacterProfile,
  type Item,
} from "./domain.js";

export type CraftingBaseRequirementStatus =
  | "met"
  | "unmet"
  | "unknown"
  | "not-declared";

export interface CraftingBaseCandidate {
  item: Item;
  diagnosis: CraftingItemDiagnosis;
  directGoalModifierCount: number;
  directGoalModifierTexts: string[];
  requirementStatus: CraftingBaseRequirementStatus;
  requirementLabel: string;
  status: "ready" | "review" | "hold";
  statusLabel: string;
  structuralLabel: string;
  hasMostDirectSignals: boolean;
}

export interface CraftingBaseComparison {
  candidates: CraftingBaseCandidate[];
  comparableBy: "item-class" | "slot";
  comparisonLabel: string;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function requirementReading(
  item: Item,
  profile: CharacterProfile | null,
): Pick<CraftingBaseCandidate, "requirementStatus" | "requirementLabel"> {
  const requirements = item.requirements;
  if (!requirements || Object.keys(requirements).length === 0) {
    return {
      requirementStatus: "not-declared",
      requirementLabel: "Sin requisitos declarados",
    };
  }
  if (profile === null) {
    return {
      requirementStatus: "unknown",
      requirementLabel: "Falta el personaje",
    };
  }

  const missing: string[] = [];
  const unknown: string[] = [];
  if (requirements.level !== undefined) {
    const level = readCharacterLevel(profile);
    if (!level.known) unknown.push("nivel");
    else if (level.level < requirements.level) {
      missing.push(`nivel ${level.level}/${requirements.level}`);
    }
  }

  const attributes = [
    ["Fue", requirements.str, profile.attributes.str],
    ["Des", requirements.dex, profile.attributes.dex],
    ["Int", requirements.int, profile.attributes.int],
  ] as const;
  for (const [label, required, current] of attributes) {
    if (required === undefined) continue;
    if (current === null) unknown.push(label);
    else if (current < required) missing.push(`${label} ${current}/${required}`);
  }

  if (missing.length > 0) {
    return {
      requirementStatus: "unmet",
      requirementLabel: `No cumple: ${missing.join(" · ")}`,
    };
  }
  if (unknown.length > 0) {
    return {
      requirementStatus: "unknown",
      requirementLabel: `Sin comprobar: ${unknown.join(" · ")}`,
    };
  }
  return {
    requirementStatus: "met",
    requirementLabel: "Requisitos cumplidos",
  };
}

function structuralLabel(diagnosis: CraftingItemDiagnosis): string {
  if (diagnosis.state !== "complete") return diagnosis.label;
  if (diagnosis.observedOpenSlots === null) return "Huecos no comprobables";
  if (diagnosis.observedOpenSlots === 0) return "Sin huecos observados";
  return `${diagnosis.observedOpenSlots} hueco${diagnosis.observedOpenSlots === 1 ? "" : "s"} observado${diagnosis.observedOpenSlots === 1 ? "" : "s"}`;
}

/**
 * Compara únicamente hechos presentes en los objetos y el expediente.
 * No estima pools, pesos, probabilidades, coste ni potencia final de una base.
 */
export function compareCraftingBases(input: {
  selectedItem: Item;
  items: readonly Item[];
  profile: CharacterProfile | null;
  goalCategory: CraftingGoalCategory;
}): CraftingBaseComparison {
  const { selectedItem, items, profile, goalCategory } = input;
  const selectedClass = selectedItem.itemClass?.trim();
  const comparableBy = selectedClass ? "item-class" : "slot";
  const comparable = items.filter((candidate) => {
    if (candidate.id === selectedItem.id) return true;
    if (selectedClass) {
      return candidate.itemClass !== undefined &&
        normalize(candidate.itemClass) === normalize(selectedClass);
    }
    return candidate.slot === selectedItem.slot;
  });

  const readings = comparable.map((item) => {
    const diagnosis = diagnoseCraftingItem(item);
    const directGoalModifierTexts = goalCategory === "other"
      ? []
      : item.modifiers
          .filter((modifier) => modifier.kind === "explicit")
          .filter(
            (modifier) =>
              evaluateCraftingGoalSignal(goalCategory, [modifier]).status === "direct",
          )
          .map((modifier) => modifier.text);
    const requirements = requirementReading(item, profile);
    const status = diagnosis.state !== "complete" || requirements.requirementStatus === "unmet"
      ? "hold"
      : diagnosis.observedOpenSlots === 0 && directGoalModifierTexts.length === 0
        ? "review"
        : "ready";
    return {
      item,
      diagnosis,
      directGoalModifierCount: directGoalModifierTexts.length,
      directGoalModifierTexts,
      ...requirements,
      status,
      statusLabel:
        status === "ready"
          ? "Candidata comparable"
          : status === "review"
            ? "Exige reemplazo o cambio"
            : diagnosis.state !== "complete"
              ? "Lectura pendiente"
              : "Requisitos no cumplidos",
      structuralLabel: structuralLabel(diagnosis),
      hasMostDirectSignals: false,
    } satisfies CraftingBaseCandidate;
  });

  const maxDirectSignals = Math.max(0, ...readings.map((candidate) => candidate.directGoalModifierCount));
  const candidates = readings.map((candidate) => ({
    ...candidate,
    hasMostDirectSignals:
      maxDirectSignals > 0 && candidate.directGoalModifierCount === maxDirectSignals,
  }));

  return {
    candidates,
    comparableBy,
    comparisonLabel: selectedClass
      ? `Misma clase: ${selectedClass}`
      : "Misma ranura; la clase del objeto no está declarada",
  };
}

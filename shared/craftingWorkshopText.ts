import {
  craftingCurrencyLabel,
  type CraftingActionId,
  type CraftingCurrencyVariant,
  type ObservedCraftingAction,
} from "./craftingActions.js";
import type { CraftingBaseCandidate, CraftingBaseComparison } from "./craftingBaseComparison.js";
import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import { readCharacterLevel, type CharacterProfile, type Item } from "./domain.js";

/**
 * Textos del Taller avanzado en inglés que dependen de módulos con catálogo en
 * español (acciones observadas, comparación de bases). Se traduce por id o por
 * estado; en español se devuelve siempre el texto original sin tocarlo.
 */
type Lang = "es" | "en";

/** Nombres oficiales de PoE2 en inglés para las monedas observadas. */
export const CRAFTING_ACTION_LABELS_EN: Record<CraftingActionId, string> = {
  transmutation: "Orb of Transmutation",
  augmentation: "Orb of Augmentation",
  regal: "Regal Orb",
  exalted: "Exalted Orb",
};

export const CRAFTING_ACTION_EFFECTS_EN: Record<CraftingActionId, string> = {
  transmutation: "Upgrades a normal item to magic and gives it 1 modifier.",
  augmentation: "Adds 1 random modifier to a magic item.",
  regal: "Upgrades a magic item to rare and adds 1 modifier; its current modifiers stay.",
  exalted: "Adds 1 random modifier to a rare item.",
};

export const CRAFTING_VARIANT_LABELS_EN: Record<CraftingCurrencyVariant["id"], string> = {
  base: "Base",
  greater: "Greater",
  perfect: "Perfect",
};

export function craftingActionLabel(
  action: Pick<ObservedCraftingAction, "id" | "label">,
  lang: Lang = "es",
): string {
  return lang === "en" ? CRAFTING_ACTION_LABELS_EN[action.id] ?? action.label : action.label;
}

export function craftingActionEffect(
  action: Pick<ObservedCraftingAction, "id" | "effect">,
  lang: Lang = "es",
): string {
  return lang === "en" ? CRAFTING_ACTION_EFFECTS_EN[action.id] ?? action.effect : action.effect;
}

export function craftingVariantLabel(
  variant: Pick<CraftingCurrencyVariant, "id" | "label">,
  lang: Lang = "es",
): string {
  return lang === "en" ? CRAFTING_VARIANT_LABELS_EN[variant.id] ?? variant.label : variant.label;
}

/** «Greater Orb of Augmentation», como lo escribe el juego en inglés. */
export function craftingCurrencyLabelFor(
  action: ObservedCraftingAction,
  variant: CraftingCurrencyVariant,
  lang: Lang = "es",
): string {
  if (lang !== "en") return craftingCurrencyLabel(action, variant);
  const label = craftingActionLabel(action, lang);
  return variant.id === "base" ? label : `${craftingVariantLabel(variant, lang)} ${label}`;
}

/** La evidencia cita el nombre del archivo observado; solo cambia la etiqueta. */
export function craftingActionEvidence(
  action: Pick<ObservedCraftingAction, "evidence">,
  lang: Lang = "es",
): string {
  return lang === "en"
    ? action.evidence.replace(/^Tooltip observado:/, "Observed tooltip:")
    : action.evidence;
}

export interface CraftingBaseCandidateText {
  statusLabel: string;
  structuralLabel: string;
  requirementLabel: string;
}

function requirementLabelEn(item: Item, profile: CharacterProfile | null): string {
  const requirements = item.requirements;
  if (!requirements || Object.keys(requirements).length === 0) return "No requirements stated";
  if (profile === null) return "Character missing";

  const missing: string[] = [];
  const unknown: string[] = [];
  if (requirements.level !== undefined) {
    const level = readCharacterLevel(profile);
    if (!level.known) unknown.push("level");
    else if (level.level < requirements.level) {
      missing.push(`level ${level.level}/${requirements.level}`);
    }
  }
  const attributes = [
    ["Str", requirements.str, profile.attributes.str],
    ["Dex", requirements.dex, profile.attributes.dex],
    ["Int", requirements.int, profile.attributes.int],
  ] as const;
  for (const [label, required, current] of attributes) {
    if (required === undefined) continue;
    if (current === null) unknown.push(label);
    else if (current < required) missing.push(`${label} ${current}/${required}`);
  }
  if (missing.length > 0) return `Not met: ${missing.join(" · ")}`;
  if (unknown.length > 0) return `Not checked: ${unknown.join(" · ")}`;
  return "Requirements met";
}

/**
 * Etiquetas de una base candidata en el idioma pedido. Repite en inglés las
 * mismas reglas de `compareCraftingBases`, sin cambiar estados ni conteos.
 */
export function craftingBaseCandidateText(
  candidate: CraftingBaseCandidate,
  profile: CharacterProfile | null,
  lang: Lang = "es",
): CraftingBaseCandidateText {
  if (lang !== "en") {
    return {
      statusLabel: candidate.statusLabel,
      structuralLabel: candidate.structuralLabel,
      requirementLabel: candidate.requirementLabel,
    };
  }
  const { diagnosis } = candidate;
  const structuralLabel =
    diagnosis.state !== "complete"
      ? diagnoseCraftingItem(candidate.item, "en").label
      : diagnosis.observedOpenSlots === null
        ? "Open slots can't be checked"
        : diagnosis.observedOpenSlots === 0
          ? "No open slots seen"
          : `${diagnosis.observedOpenSlots} open slot${diagnosis.observedOpenSlots === 1 ? "" : "s"} seen`;
  return {
    statusLabel:
      candidate.status === "ready"
        ? "Comparable candidate"
        : candidate.status === "review"
          ? "Needs a replacement or change"
          : diagnosis.state !== "complete"
            ? "Reading pending"
            : "Requirements not met",
    structuralLabel,
    requirementLabel: requirementLabelEn(candidate.item, profile),
  };
}

export function craftingBaseComparisonLabel(
  comparison: CraftingBaseComparison,
  selectedItem: Item,
  lang: Lang = "es",
): string {
  if (lang !== "en") return comparison.comparisonLabel;
  const selectedClass = selectedItem.itemClass?.trim();
  return selectedClass
    ? `Same class: ${selectedClass}`
    : "Same slot; the item class isn't stated";
}

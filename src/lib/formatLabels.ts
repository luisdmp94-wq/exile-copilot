import type {
  ConfidenceLevel,
  CurrencyKind,
  EvidenceSourceKind,
  GoalKind,
  ItemRarity,
  ItemSlot,
  ModifierKind,
  RiskLevel,
} from "@shared/domain.js";
import {
  CONFIDENCE_LABELS,
  CURRENCY_LABELS,
  GOAL_LABELS,
  MAGNITUDE_LABELS,
  MODIFIER_KIND_LABELS,
  RARITY_LABELS,
  RISK_LABELS,
  SLOT_LABELS,
  SOURCE_KIND_LABELS,
} from "./format";
import { useLang, type Lang } from "@/i18n/lang";

/**
 * Las etiquetas de `format.ts` en los dos idiomas. Las españolas siguen
 * viviendo en `format.ts` (las usa medio proyecto); aquí se añaden las
 * inglesas y una forma de pedir las del idioma activo.
 */
export interface FormatLabels {
  slot: Record<ItemSlot, string>;
  rarity: Record<ItemRarity, string>;
  modifierKind: Record<ModifierKind, string>;
  sourceKind: Record<EvidenceSourceKind, string>;
  risk: Record<RiskLevel, string>;
  confidence: Record<ConfidenceLevel, string>;
  magnitude: Record<"low" | "medium" | "high", string>;
  goal: Record<GoalKind, string>;
  currency: Record<CurrencyKind, string>;
}

const SPANISH: FormatLabels = {
  slot: SLOT_LABELS,
  rarity: RARITY_LABELS,
  modifierKind: MODIFIER_KIND_LABELS,
  sourceKind: SOURCE_KIND_LABELS,
  risk: RISK_LABELS,
  confidence: CONFIDENCE_LABELS,
  magnitude: MAGNITUDE_LABELS,
  goal: GOAL_LABELS,
  currency: CURRENCY_LABELS,
};

const ENGLISH: FormatLabels = {
  slot: {
    weapon: "Weapon",
    offhand: "Off-hand",
    helmet: "Helmet",
    body: "Body armour",
    gloves: "Gloves",
    boots: "Boots",
    belt: "Belt",
    amulet: "Amulet",
    ring1: "Ring 1",
    ring2: "Ring 2",
    flask: "Flask",
    other: "Other",
  },
  rarity: {
    normal: "Normal",
    magic: "Magic",
    rare: "Rare",
    unique: "Unique",
    currency: "Currency",
    gem: "Gem",
    other: "Other",
  },
  modifierKind: {
    implicit: "Implicit",
    explicit: "Explicit",
    enchant: "Enchant",
    rune: "Runes",
    quality: "Quality",
  },
  sourceKind: {
    ggg: "Official GGG data",
    internal: "Our own verified data",
    calculation: "Engine calculation",
    "poe.ninja": "Economy (poe.ninja)",
    community: "Community reference",
    user: "Data you gave us",
  },
  risk: { low: "Low", medium: "Medium", high: "High" },
  confidence: { low: "Low", medium: "Medium", high: "High" },
  magnitude: { low: "Low", medium: "Medium", high: "High" },
  goal: {
    damage: "Damage",
    survival: "Survival",
    mapping: "Mapping",
    bossing: "Bossing",
    balanced: "Balanced",
  },
  currency: {
    chaos: "Chaos",
    exalted: "Exalted",
    divine: "Divine",
    gold: "Gold",
  },
};

export function formatLabels(lang: Lang): FormatLabels {
  return lang === "en" ? ENGLISH : SPANISH;
}

/** Las etiquetas del idioma activo. */
export function useFormatLabels(): FormatLabels {
  return formatLabels(useLang().lang);
}

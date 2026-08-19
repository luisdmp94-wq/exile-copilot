import type {
  ConfidenceLevel,
  CurrencyKind,
  GoalKind,
  ItemRarity,
  ItemSlot,
  RiskLevel,
} from "@shared/domain.js";

/** Etiquetas en español y formato de fechas para la interfaz. */

export const CURRENCY_LABELS: Record<CurrencyKind, string> = {
  chaos: "Caos",
  exalted: "Exaltado",
  divine: "Divino",
  gold: "Oro",
};

export const GOAL_LABELS: Record<GoalKind, string> = {
  damage: "Daño",
  survival: "Supervivencia",
  mapping: "Mapas",
  bossing: "Jefes",
  balanced: "Equilibrio",
};

export const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: "Arma",
  offhand: "Mano secundaria",
  helmet: "Casco",
  body: "Pecho",
  gloves: "Guantes",
  boots: "Botas",
  belt: "Cinturón",
  amulet: "Amuleto",
  ring1: "Anillo 1",
  ring2: "Anillo 2",
  flask: "Frasco",
  other: "Otro",
};

export const RARITY_LABELS: Record<ItemRarity, string> = {
  normal: "Normal",
  magic: "Mágico",
  rare: "Raro",
  unique: "Único",
  currency: "Moneda",
  gem: "Gema",
  other: "Otro",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const MAGNITUDE_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

/** Clases de color (Tailwind) para badges de riesgo / confianza / magnitud. */
export const LEVEL_BADGE_CLASSES: Record<"low" | "medium" | "high", string> = {
  low: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  medium: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  high: "border-red-500/40 bg-red-500/15 text-red-300",
};

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

/** "50 Exaltado" → texto legible de coste con moneda. */
export function formatCost(
  min: number | null,
  max: number | null,
  currency: CurrencyKind,
  known: boolean,
): string {
  const label = CURRENCY_LABELS[currency];
  if (min === null && max === null) return "No verificado";
  const range =
    min !== null && max !== null && min !== max
      ? `${formatNumber(min)}–${formatNumber(max)}`
      : formatNumber(min ?? max ?? 0);
  const suffix = known ? "" : " (estimado)";
  return `${range} ${label}${suffix}`;
}

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

/** Tipos de modificador del dominio, en español. */
export const MODIFIER_KIND_LABELS: Record<ModifierKind, string> = {
  implicit: "Implícitos",
  explicit: "Explícitos",
  enchant: "Encantamiento",
  rune: "Runas",
  quality: "Calidad",
};

/**
 * Tipos de fuente del dominio, en español. Los identificadores internos
 * (`calculation`, `user`, …) nunca se muestran crudos en la interfaz.
 */
export const SOURCE_KIND_LABELS: Record<EvidenceSourceKind, string> = {
  ggg: "Datos oficiales de GGG",
  internal: "Datos propios verificados",
  calculation: "Cálculo del motor",
  "poe.ninja": "Economía (poe.ninja)",
  community: "Referencia de la comunidad",
  user: "Dato que nos diste tú",
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

/**
 * Paleta de los badges de nivel. Riesgo y confianza comparten los mismos
 * valores estructurados (`low`/`medium`/`high`) pero NO la misma semántica
 * visual, así que tienen mapas distintos: en riesgo lo alto es malo (rojo) y en
 * confianza lo alto es bueno (verde). Compartir un único mapa pintaba
 * «Confianza Alta» de rojo, como si fuese una alarma.
 */
const NIVEL_POSITIVO = "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
const NIVEL_INTERMEDIO = "border-amber-500/40 bg-amber-500/15 text-amber-300";
const NIVEL_NEGATIVO = "border-red-500/40 bg-red-500/15 text-red-300";

/** Riesgo: bajo verde, medio ámbar, alto rojo. */
export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  low: NIVEL_POSITIVO,
  medium: NIVEL_INTERMEDIO,
  high: NIVEL_NEGATIVO,
};

/** Confianza: alta verde, media ámbar, baja roja (escala invertida). */
export const CONFIDENCE_BADGE_CLASSES: Record<ConfidenceLevel, string> = {
  high: NIVEL_POSITIVO,
  medium: NIVEL_INTERMEDIO,
  low: NIVEL_NEGATIVO,
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

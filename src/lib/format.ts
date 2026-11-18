import type {
  CharacterProfile,
  ConfidenceLevel,
  CurrencyKind,
  EvidenceSourceKind,
  GoalKind,
  ItemRarity,
  ItemSlot,
  ModifierKind,
  RiskLevel,
} from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import { pageLang } from "../i18n/lang";

/** Etiquetas en español y formato de fechas para la interfaz. */

/**
 * Valores por defecto que la web guarda en español («Nuevo personaje»,
 * «Desconocida»…). Se guardan así a propósito: son marcas internas. Solo se
 * traducen al enseñarlos; lo que escribió el jugador se muestra tal cual.
 */
const DEFAULT_VALUES_EN: Record<string, string> = {
  "Nuevo personaje": "New character",
  "Expediente provisional": "Draft character",
  "Personaje importado desde PoB": "Character imported from PoB",
  Desconocida: "Unknown",
  Desconocido: "Unknown",
  desconocida: "unknown",
  desconocido: "unknown",
};

/** Nombre, clase o liga para enseñar: traduce solo los valores por defecto. */
/**
 * En español casi todo se enseña tal cual. La excepción es la marca del
 * borrador que nace al pegar un objeto: se guarda como «Expediente
 * provisional» (así la reconocen los datos ya guardados) y se enseña como
 * «Personaje provisional».
 */
const DEFAULT_VALUES_ES_DISPLAY: Record<string, string> = {
  "Expediente provisional": "Personaje provisional",
};

export function displayProfileValue(value: string): string {
  return pageLang() === "en"
    ? englishProfileValue(value)
    : (DEFAULT_VALUES_ES_DISPLAY[value.trim()] ?? value);
}

/** Lo mismo, pero siempre en inglés (para textos que ya son ingleses). */
export function englishProfileValue(value: string): string {
  return DEFAULT_VALUES_EN[value.trim()] ?? value;
}

const DEFAULT_VALUES_ES = new Map(Object.entries(DEFAULT_VALUES_EN).map(([es, en]) => [en, es]));
// «Unknown» vale para «Desconocida» y «Desconocido»: al guardar gana la primera.
DEFAULT_VALUES_ES.set("Unknown", "Desconocida");

/**
 * Lo contrario, para los campos del editor: si en inglés queda escrito el
 * valor por defecto («New character»), se guarda la marca interna de siempre.
 */
export function storeProfileValue(value: string): string {
  if (pageLang() === "en") return DEFAULT_VALUES_ES.get(value) ?? value;
  return value === "Personaje provisional" ? "Expediente provisional" : value;
}

/**
 * Procedencias que la web guarda en español junto a cada objeto. Igual que los
 * valores por defecto: se guardan así y solo se traducen al enseñarlas.
 */
const SOURCE_LABELS_EN: Record<string, string> = {
  "Build de demostración": "Example build",
  "Texto de objeto copiado desde el juego": "Item text copied from the game",
  "Objeto importado desde Path of Building 2": "Item imported from Path of Building 2",
  "Archivo .build usado como borrador de personaje": ".build file used as a character draft",
  "Decisión guiada por el jugador": "Decision guided by the player",
  "Ejercicio de aprendizaje de la Academia (objeto sintético)": "Academy learning exercise (made-up item)",
};
const POB_SNAPSHOT_ES = "Instantánea importada desde Path of Building 2";

/** Procedencia de un dato para enseñar: traduce solo las que guarda la web. */
export function displaySourceLabel(label: string): string {
  if (pageLang() !== "en") return label;
  if (label.startsWith(POB_SNAPSHOT_ES)) {
    return `Snapshot imported from Path of Building 2${label.slice(POB_SNAPSHOT_ES.length)}`;
  }
  return SOURCE_LABELS_EN[label.trim()] ?? label;
}

export function formatCharacterLevel(profile: CharacterProfile): string {
  const reading = readCharacterLevel(profile);
  return reading.known ? String(reading.level) : pageLang() === "en" ? "unknown" : "desconocido";
}

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
  charm: "Vial",
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
  return new Intl.DateTimeFormat(pageLang() === "en" ? "en-GB" : "es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(pageLang() === "en" ? "en-GB" : "es-ES").format(value);
}

const CURRENCY_LABELS_EN: Record<CurrencyKind, string> = {
  chaos: "Chaos",
  exalted: "Exalted",
  divine: "Divine",
  gold: "Gold",
};

/** "50 Exaltado" → texto legible de coste con moneda. */
export function formatCost(
  min: number | null,
  max: number | null,
  currency: CurrencyKind,
  known: boolean,
): string {
  const en = pageLang() === "en";
  const label = en ? CURRENCY_LABELS_EN[currency] : CURRENCY_LABELS[currency];
  if (min === null && max === null) return en ? "Not verified" : "No verificado";
  const range =
    min !== null && max !== null && min !== max
      ? `${formatNumber(min)}–${formatNumber(max)}`
      : formatNumber(min ?? max ?? 0);
  const suffix = known ? "" : en ? " (estimated)" : " (estimado)";
  return `${range} ${label}${suffix}`;
}

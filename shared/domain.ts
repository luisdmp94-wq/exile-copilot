import { z } from "zod";
import { BuildTargetPlanSchema } from "./gggBuildPlanner.js";

/**
 * Modelo de dominio normalizado de Exile Copilot.
 * Compartido entre backend (server/) y frontend (src/).
 */

// ---------------------------------------------------------------------------
// Fuentes y evidencia
// ---------------------------------------------------------------------------

export const EvidenceSourceKind = z.enum([
  "ggg", // datos oficiales de GGG
  "internal", // datos propios versionados y verificados
  "calculation", // cálculos deterministas
  "poe.ninja", // economía
  "community", // builds/guías comunitarias (referencia, nunca verdad absoluta)
  "user", // proporcionado por el usuario
]);
export type EvidenceSourceKind = z.infer<typeof EvidenceSourceKind>;

export const SourceEvidenceSchema = z.object({
  kind: EvidenceSourceKind,
  label: z.string(),
  url: z.string().optional(),
  retrievedAt: z.string(), // ISO 8601
  patch: z.string().optional(),
});
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;

export const PatchVersionSchema = z.object({
  id: z.string(), // p. ej. "0.5.0"
  label: z.string(),
  /** Versión de contenido (p. ej. "0.5.0") y hotfix (p. ej. "f") por separado. */
  content: z.string().optional(),
  hotfix: z.string().nullable().optional(),
  /** Fecha y fuente del dato; nunca etiquetar una versión hardcodeada como "actual". */
  asOf: z.string().optional(),
  source: z.string().optional(),
});
export type PatchVersion = z.infer<typeof PatchVersionSchema>;

// ---------------------------------------------------------------------------
// Objetos y modificadores
// ---------------------------------------------------------------------------

export const ModifierKind = z.enum([
  "explicit",
  "implicit",
  "enchant",
  "rune",
  "quality",
]);
export type ModifierKind = z.infer<typeof ModifierKind>;

export const ModifierSchema = z.object({
  id: z.string(),
  text: z.string(), // p. ej. "+45% increased Physical Damage"
  kind: ModifierKind.default("explicit"),
  values: z.array(z.number()).default([]),
  verified: z.boolean().default(false),
});
export type Modifier = z.infer<typeof ModifierSchema>;

export const ItemSlot = z.enum([
  "weapon",
  "offhand",
  "helmet",
  "body",
  "gloves",
  "boots",
  "belt",
  "amulet",
  "ring1",
  "ring2",
  "flask",
  "other",
]);
export type ItemSlot = z.infer<typeof ItemSlot>;

export const ItemRarity = z.enum([
  "normal",
  "magic",
  "rare",
  "unique",
  "currency",
  "gem",
  "other",
]);
export type ItemRarity = z.infer<typeof ItemRarity>;

export const ItemRequirementsSchema = z.object({
  level: z.number().int().optional(),
  str: z.number().int().optional(),
  dex: z.number().int().optional(),
  int: z.number().int().optional(),
});
export type ItemRequirements = z.infer<typeof ItemRequirementsSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseType: z.string(),
  slot: ItemSlot.default("other"),
  rarity: ItemRarity.default("rare"),
  itemLevel: z.number().int().optional(),
  quality: z.number().int().optional(),
  modifiers: z.array(ModifierSchema).default([]),
  requirements: ItemRequirementsSchema.optional(),
  rawText: z.string().optional(),
  sources: z.array(SourceEvidenceSchema).default([]),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------------------------------------------------------------------------
// Skills y pasivas
// ---------------------------------------------------------------------------

export const SupportGemSchema = z.object({
  name: z.string(),
  /** Id oficial de BaseItemTypes (p. ej. "Metadata/Items/Gems/SupportGemMomentum"). null = no verificado. */
  gemId: z.string().nullable().default(null),
});
export type SupportGem = z.infer<typeof SupportGemSchema>;

export const SkillSetupSchema = z.object({
  id: z.string(),
  label: z.string(),
  mainSkill: z.string(),
  /** Id oficial de BaseItemTypes de la gema principal. null = no verificado. */
  mainSkillGemId: z.string().nullable().default(null),
  supports: z.array(SupportGemSchema).default([]),
});
export type SkillSetup = z.infer<typeof SkillSetupSchema>;

/** Nodo de pasiva: puede ser un id oficial de PassiveSkills o un nombre no verificado. */
export const PassiveNodeSchema = z.object({
  ref: z.string(),
  /** true si `ref` es un id oficial de la tabla PassiveSkills (exportable); false si es solo un nombre. */
  isOfficialId: z.boolean().default(false),
  additionalText: z.string().optional(),
});
export type PassiveNode = z.infer<typeof PassiveNodeSchema>;

export const PassiveSelectionSchema = z.object({
  allocated: z.array(PassiveNodeSchema).default([]),
});
export type PassiveSelection = z.infer<typeof PassiveSelectionSchema>;

// ---------------------------------------------------------------------------
// Presupuesto y objetivo
// ---------------------------------------------------------------------------

export const CurrencyKind = z.enum(["chaos", "exalted", "divine", "gold"]);
export type CurrencyKind = z.infer<typeof CurrencyKind>;

export const BudgetSchema = z.object({
  amount: z.number().nonnegative(),
  currency: CurrencyKind.default("exalted"),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const GoalKind = z.enum([
  "damage",
  "survival",
  "mapping",
  "bossing",
  "balanced",
]);
export type GoalKind = z.infer<typeof GoalKind>;

export const GoalSchema = z.object({
  kind: GoalKind,
  note: z.string().optional(),
});
export type Goal = z.infer<typeof GoalSchema>;

// ---------------------------------------------------------------------------
// Perfil de personaje
// ---------------------------------------------------------------------------

export const ResistancesSchema = z.object({
  /** null = desconocido (NUNCA convertir a 0; un desconocido no es "tienes 0%"). */
  fire: z.number().nullable().default(null),
  cold: z.number().nullable().default(null),
  lightning: z.number().nullable().default(null),
  chaos: z.number().nullable().default(null),
});
export type Resistances = z.infer<typeof ResistancesSchema>;

export type ResistanceKind = keyof Resistances;

/**
 * Nombres en español de las resistencias, para el TEXTO que lee el jugador.
 *
 * Las claves estructuradas del dominio siguen siendo `fire`/`cold`/`lightning`/
 * `chaos` y no cambian: este mapa existe para que el motor redacte en español
 * EN EL ORIGEN, en vez de que la interfaz parchee cadenas ya escritas en
 * inglés. En minúsculas porque siempre aparecen dentro de una frase
 * («Sube frío 61%…»); quien necesite capitalizarlas lo hace en su vista.
 */
export const RESISTANCE_LABELS: Record<ResistanceKind, string> = {
  fire: "fuego",
  cold: "frío",
  lightning: "rayo",
  chaos: "caos",
};

export const AttributesSchema = z.object({
  /** null = desconocido. */
  str: z.number().int().nullable().default(null),
  dex: z.number().int().nullable().default(null),
  int: z.number().int().nullable().default(null),
});
export type Attributes = z.infer<typeof AttributesSchema>;

export const CharacterProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  characterClass: z.string(), // p. ej. "Mercenary"; "Desconocida" si no verificable
  ascendancy: z.string().nullable().default(null), // nombre visible, p. ej. "Gemling Legionnaire"
  /** Id oficial de ascendencia del esquema GGG (p. ej. "Warrior1"). null = no verificado. */
  ascendancyId: z.string().nullable().default(null),
  level: z.number().int().min(1).max(100).default(1),
  /** Arquetipo opcional declarado por el usuario; NUNCA hardcodeado por defecto. */
  archetype: z.string().nullable().default(null),
  league: z.string(),
  patch: z.string(),
  items: z.array(ItemSchema).default([]),
  skills: z.array(SkillSetupSchema).default([]),
  passives: PassiveSelectionSchema.default({ allocated: [] }),
  attributes: AttributesSchema.default({ str: null, dex: null, int: null }),
  resistances: ResistancesSchema.default({
    fire: null,
    cold: null,
    lightning: null,
    chaos: null,
  }),
  life: z.number().int().optional(),
  energyShield: z.number().int().optional(),
  evasion: z.number().int().optional(),
  armour: z.number().int().optional(),
  notes: z.string().optional(),
  sources: z.array(SourceEvidenceSchema).default([]),
  importedAt: z.string(), // ISO 8601
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

// ---------------------------------------------------------------------------
// Build objetivo (referencia, nunca verdad absoluta)
// ---------------------------------------------------------------------------

export const BuildTargetSchema = z.object({
  name: z.string(),
  sourceUrl: z.string().optional(), // p. ej. enlace Mobalytics guardado como referencia
  summary: z.string().optional(),
  desiredMods: z.array(z.string()).default([]),
  referenceOnly: z.literal(true).default(true),
  /**
   * Plan oficial importado de un `.build` de GGG (Build Planner v1).
   * Se conserva crudo para reexportarlo con fidelidad. Es un PLAN,
   * no una captura del personaje: el motor no ejecuta reglas de equipo
   * sobre sus inventory_slots.
   */
  plan: BuildTargetPlanSchema.nullable().default(null),
});
export type BuildTarget = z.infer<typeof BuildTargetSchema>;

// ---------------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------------

export const PriceQuoteSchema = z.object({
  itemName: z.string(),
  currency: CurrencyKind,
  value: z.number().nullable(), // null = "No verificado"
  source: EvidenceSourceKind,
  league: z.string(),
  fetchedAt: z.string(), // ISO 8601
  fromCache: z.boolean().default(false),
  verified: z.boolean(),
  detail: z.string().optional(),
});
export type PriceQuote = z.infer<typeof PriceQuoteSchema>;

// ---------------------------------------------------------------------------
// Recomendaciones
// ---------------------------------------------------------------------------

export const ConfidenceLevel = z.enum(["low", "medium", "high"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const RiskLevel = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const CostEstimateSchema = z.object({
  min: z.number().nullable(), // null = "No verificado"
  max: z.number().nullable(),
  currency: CurrencyKind,
  known: z.boolean(), // false = estimado
});
export type CostEstimate = z.infer<typeof CostEstimateSchema>;

export const ExpectedImpactSchema = z.object({
  metric: z.string(), // p. ej. "resistencias", "daño del arma"
  description: z.string(),
  magnitude: z.enum(["low", "medium", "high"]),
  isPartialMetric: z.boolean().default(true), // nunca DPS ficticio
});
export type ExpectedImpact = z.infer<typeof ExpectedImpactSchema>;

export const RecommendationActionKind = z.enum([
  "game_change",
  "profile_sync",
  "session_gate",
]);
export type RecommendationActionKind = z.infer<typeof RecommendationActionKind>;

export const RecommendationSchema = z.object({
  id: z.string(),
  priority: z.number().int().min(1).max(3),
  title: z.string(),
  action: z.string(), // acción concreta
  reason: z.string(), // motivo
  /** `profile_sync` corrige datos de la app. `session_gate` es un freno de sesión (evidencia o restricción). Ninguna se exporta al `.build`. */
  actionKind: RecommendationActionKind.default("game_change"),
  cost: CostEstimateSchema,
  impact: ExpectedImpactSchema,
  risk: z.object({
    level: RiskLevel,
    description: z.string(),
  }),
  mayLoseValuableMods: z.boolean(),
  irreversible: z.boolean(),
  patch: z.string(),
  sources: z.array(SourceEvidenceSchema),
  dataUpdatedAt: z.string(), // ISO 8601 de los datos usados
  confidence: ConfidenceLevel,
  unverified: z.array(z.string()).default([]), // información que falta por verificar
  /**
   * Ids de objetos del perfil que la regla leyó REALMENTE para emitir esta
   * recomendación (vínculo estructurado, nunca inferido por texto). Vacío
   * cuando la recomendación no se refiere a una pieza equipada concreta.
   */
  relatedItemIds: z.array(z.string().min(1).max(200)).max(100).default([]),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

// ---------------------------------------------------------------------------
// Character Journal — memoria persistente del mentor
// ---------------------------------------------------------------------------

export const JournalEntryKind = z.enum([
  "decision",
  "experiment",
  "craft",
  "milestone",
  "note",
]);
export type JournalEntryKind = z.infer<typeof JournalEntryKind>;

export const JournalEntryStatus = z.enum([
  "active",
  "waiting_result",
  "completed",
  "cancelled",
]);
export type JournalEntryStatus = z.infer<typeof JournalEntryStatus>;

export const MAX_JOURNAL_TITLE_LENGTH = 160;

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

/**
 * Descarta un surrogate aislado al final del texto.
 *
 * Recortar por unidades UTF-16 puede partir un par (p. ej. un emoji) y dejar
 * el alto surrogate suelto. También se descarta un bajo surrogate final que no
 * venga precedido de su alto, que solo puede llegar de una entrada malformada.
 */
function dropLoneTrailingSurrogate(text: string): string {
  if (text.length === 0) return text;
  const last = text.charCodeAt(text.length - 1);
  if (last >= HIGH_SURROGATE_START && last <= HIGH_SURROGATE_END) {
    // Un alto surrogate al final siempre está suelto: su pareja iría después.
    return text.slice(0, -1);
  }
  if (last >= LOW_SURROGATE_START && last <= LOW_SURROGATE_END) {
    const previous = text.length >= 2 ? text.charCodeAt(text.length - 2) : 0;
    const emparejado = previous >= HIGH_SURROGATE_START && previous <= HIGH_SURROGATE_END;
    if (!emparejado) return text.slice(0, -1);
  }
  return text;
}

/**
 * Mantiene cualquier título generado dentro del contrato persistente
 * (máximo `MAX_JOURNAL_TITLE_LENGTH` unidades UTF-16, elipsis incluida) sin
 * dejar nunca un surrogate aislado al cortar.
 */
export function compactJournalTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_JOURNAL_TITLE_LENGTH) return trimmed;
  const cortado = dropLoneTrailingSurrogate(
    trimmed.slice(0, MAX_JOURNAL_TITLE_LENGTH - 1),
  );
  return `${cortado.trimEnd()}…`;
}

/**
 * Contexto congelado en el momento de tomar la decisión. No sustituye al
 * snapshot actual: permite recordar con qué nivel, liga, parche y presupuesto
 * se tomó una decisión aunque el personaje cambie después.
 */
export const JournalContextSchema = z.object({
  characterLevel: z.number().int().min(1).max(100).nullable().default(null),
  league: z.string().nullable().default(null),
  patch: z.string().nullable().default(null),
  budget: BudgetSchema.nullable().default(null),
  goal: GoalKind.nullable().default(null),
});
export type JournalContext = z.infer<typeof JournalContextSchema>;

/**
 * Una entrada es memoria, no una orden ejecutada. `nextAction` expresa el
 * único paso siguiente; `result` solo se rellena cuando el jugador informa de
 * lo ocurrido. Las recomendaciones se conservan como snapshot para no perder
 * coste, riesgo, confianza ni evidencia cuando el motor vuelva a ejecutarse.
 */
export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  characterId: z.string().min(1),
  kind: JournalEntryKind,
  status: JournalEntryStatus,
  title: z.string().trim().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  summary: z.string().trim().min(1).max(4000),
  nextAction: z.string().trim().min(1).max(2000).nullable().default(null),
  result: z.string().trim().min(1).max(4000).nullable().default(null),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(100).default([]),
  sources: z.array(SourceEvidenceSchema).max(50).default([]),
  context: JournalContextSchema,
  recommendationSnapshot: RecommendationSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

// ---------------------------------------------------------------------------
// Memoria estructural de la build — identidad que sobrevive a una sesión
// ---------------------------------------------------------------------------

export const BuildMemoryKind = z.enum([
  "core",
  "flexible",
  "experimental",
  "discarded",
]);
export type BuildMemoryKind = z.infer<typeof BuildMemoryKind>;

/**
 * Una regla declarada por el jugador. El texto es memoria, no una estadística:
 * el motor solo puede protegerla automáticamente por ids estructurados de
 * objetos o por una coincidencia textual explícita ya soportada por el freno.
 */
export const BuildMemoryEntrySchema = z.object({
  id: z.string().min(1).max(100),
  characterId: z.string().min(1),
  kind: BuildMemoryKind,
  label: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  reconsiderWhen: z.string().trim().min(1).max(1000).nullable().default(null),
  active: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BuildMemoryEntry = z.infer<typeof BuildMemoryEntrySchema>;

export const CharacterJournalSchema = z.object({
  characterId: z.string().min(1),
  primaryEntryId: z.string().nullable(),
  primaryEntry: JournalEntrySchema.nullable(),
  entries: z.array(JournalEntrySchema),
  buildMemory: z.array(BuildMemoryEntrySchema).max(100).default([]),
});
export type CharacterJournal = z.infer<typeof CharacterJournalSchema>;

/**
 * Vista mínima y acotada del diario que puede consumir el motor. El texto del
 * resultado se conserva como evidencia del usuario, pero el motor nunca lo
 * interpreta para deducir estadísticas, mods o cantidades.
 */
export const RecommendationMemoryEntrySchema = z.object({
  entryId: z.string().min(1),
  status: JournalEntryStatus,
  title: z.string().min(1).max(160),
  nextAction: z.string().min(1).max(2000).nullable(),
  result: z.string().min(1).max(4000).nullable(),
  recommendationId: z.string().min(1).nullable(),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(100),
  updatedAt: z.string(),
  patch: z.string().nullable(),
});
export type RecommendationMemoryEntry = z.infer<
  typeof RecommendationMemoryEntrySchema
>;

export const RecommendationMemorySchema = z.object({
  /** Revisión determinista para detectar que la interfaz usa memoria obsoleta. */
  revision: z.string().min(1).max(4000),
  primaryEntry: RecommendationMemoryEntrySchema.nullable(),
  recentCompleted: z.array(RecommendationMemoryEntrySchema).max(10),
  /** Identidad persistente de la build. Solo las entradas core frenan cambios. */
  build: z
    .object({
      entries: z.array(BuildMemoryEntrySchema).max(100),
      coreLabels: z.array(z.string().min(1).max(200)).max(30),
      coreItemIds: z.array(z.string().min(1).max(200)).max(100),
    })
    .default({ entries: [], coreLabels: [], coreItemIds: [] }),
  /**
   * Digest de la sesión adaptativa (Hito 6B). Vacío si no hay sesión.
   * Forma parte del fingerprint: un cambio de restricción invalida recomendaciones.
   */
  session: z
    .object({
      sessionId: z.string().min(1).nullable(),
      status: z.string().min(1).max(40).nullable(),
      constraintLabels: z.array(z.string()).max(20),
      constraintItemIds: z.array(z.string()).max(100),
      unresolvedBlockingUnknowns: z.array(z.string()).max(15),
      soonReplacedItemIds: z.array(z.string()).max(20),
      characterFingerprint: z.string().nullable(),
    })
    .optional(),
});
export type RecommendationMemory = z.infer<typeof RecommendationMemorySchema>;

export const RecommendationMemoryImpactSchema = z.object({
  revision: z.string().nullable(),
  blockedByPrimaryEntryId: z.string().nullable(),
  usedEntryIds: z.array(z.string()),
  repeatedRecommendationIds: z.array(z.string()),
});
export type RecommendationMemoryImpact = z.infer<
  typeof RecommendationMemoryImpactSchema
>;

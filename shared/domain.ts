import { z } from "zod";

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
  id: z.string(), // p. ej. "0.3.0"
  label: z.string(),
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

export const SkillSetupSchema = z.object({
  id: z.string(),
  label: z.string(),
  mainSkill: z.string(),
  supports: z.array(z.string()).default([]),
});
export type SkillSetup = z.infer<typeof SkillSetupSchema>;

export const PassiveSelectionSchema = z.object({
  allocated: z.array(z.string()).default([]), // nombres o ids de nodos
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
  fire: z.number().default(0),
  cold: z.number().default(0),
  lightning: z.number().default(0),
  chaos: z.number().default(0),
});
export type Resistances = z.infer<typeof ResistancesSchema>;

export const AttributesSchema = z.object({
  str: z.number().int().default(0),
  dex: z.number().int().default(0),
  int: z.number().int().default(0),
});
export type Attributes = z.infer<typeof AttributesSchema>;

export const CharacterProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  characterClass: z.string(), // p. ej. "Mercenary"
  ascendancy: z.string().optional(), // p. ej. "Gemling Legionnaire"
  level: z.number().int().min(1).max(100).default(1),
  archetype: z.string().default("mercenary-crossbow"), // arquetipo MVP
  league: z.string(),
  patch: z.string(),
  items: z.array(ItemSchema).default([]),
  skills: z.array(SkillSetupSchema).default([]),
  passives: PassiveSelectionSchema.default({ allocated: [] }),
  attributes: AttributesSchema.default({ str: 0, dex: 0, int: 0 }),
  resistances: ResistancesSchema.default({
    fire: 0,
    cold: 0,
    lightning: 0,
    chaos: 0,
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

export const RecommendationSchema = z.object({
  id: z.string(),
  priority: z.number().int().min(1).max(3),
  title: z.string(),
  action: z.string(), // acción concreta
  reason: z.string(), // motivo
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
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

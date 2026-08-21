import { z } from "zod";
import {
  BuildTargetSchema,
  BudgetSchema,
  CharacterJournalSchema,
  CharacterProfileSchema,
  CurrencyKind,
  GoalKind,
  GoalSchema,
  ItemSchema,
  JournalContextSchema,
  JournalEntryKind,
  JournalEntrySchema,
  JournalEntryStatus,
  MAX_JOURNAL_TITLE_LENGTH,
  PatchVersionSchema,
  PriceQuoteSchema,
  RecommendationSchema,
  RecommendationMemoryImpactSchema,
  SourceEvidenceSchema,
} from "./domain.js";
import {
  DecisionConclusionKind,
  DecisionSessionEventSchema,
  DecisionSessionKind,
  DecisionSessionSchema,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_SESSION_EVENTS,
  SessionEvidenceKind,
} from "./decisionSession.js";
import {
  BuildTargetPlanSchema,
  ExportReportSchema,
} from "./gggBuildPlanner.js";
import { PlanResolutionSchema } from "./passiveRegistry.js";

/**
 * Contrato de la API REST v1 (toda bajo /api).
 * Los esquemas validan tanto las peticiones como las respuestas.
 */

// GET /api/health — versión de contenido y hotfix por separado, con fuente y fecha.
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  patch: z.object({
    content: z.string(), // versión de contenido, p. ej. "0.5.0"
    hotfix: z.string().nullable(), // hotfix, p. ej. "f"
    asOf: z.string(), // fecha del dato
    source: z.string(), // fuente del dato
  }),
  dataUpdatedAt: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// GET /api/meta
export const MetaResponseSchema = z.object({
  leagues: z.array(z.string()),
  patches: z.array(PatchVersionSchema),
  goals: z.array(z.enum(["damage", "survival", "mapping", "bossing", "balanced"])),
  currencies: z.array(z.enum(["chaos", "exalted", "divine", "gold"])),
  archetypes: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

// POST /api/import/build
// Un `.build` oficial de GGG es un PLAN (BuildTargetPlan), no una captura del
// personaje: la respuesta lleva `plan` XOR `profile` según el formato detectado.
export const ImportBuildRequestSchema = z.object({
  content: z.string().min(1),
});
export const ImportBuildResponseSchema = z.object({
  warnings: z.array(z.string()),
  detectedFormat: z.enum(["ggg-build-planner-v1", "pob-code", "unknown"]),
  /** Presente cuando se importa un `.build` oficial: va a la sección Build objetivo. */
  plan: BuildTargetPlanSchema.optional(),
  /**
   * Resolución de los ids del plan contra el registro oficial de GGG.
   * Va en PARALELO al plan: el `.build` crudo nunca se modifica.
   */
  resolution: PlanResolutionSchema.optional(),
  /** Presente solo para importaciones parciales de personaje (p. ej. código PoB). */
  profile: CharacterProfileSchema.optional(),
});
export type ImportBuildRequest = z.infer<typeof ImportBuildRequestSchema>;
export type ImportBuildResponse = z.infer<typeof ImportBuildResponseSchema>;

// POST /api/import/item-text
export const ImportItemTextRequestSchema = z.object({
  text: z.string().min(1),
});
export const ImportItemTextResponseSchema = z.object({
  item: ItemSchema,
  warnings: z.array(z.string()),
});
export type ImportItemTextRequest = z.infer<typeof ImportItemTextRequestSchema>;
export type ImportItemTextResponse = z.infer<typeof ImportItemTextResponseSchema>;

// POST /api/character — guarda/actualiza el perfil (correcciones manuales)
export const SaveCharacterRequestSchema = z.object({
  profile: CharacterProfileSchema,
});
export const SaveCharacterResponseSchema = z.object({
  profile: CharacterProfileSchema,
});
export type SaveCharacterRequest = z.infer<typeof SaveCharacterRequestSchema>;

// GET /api/character/demo
export const DemoCharacterResponseSchema = z.object({
  profile: CharacterProfileSchema,
});
export type DemoCharacterResponse = z.infer<typeof DemoCharacterResponseSchema>;

// GET /api/character/:id
export const GetCharacterResponseSchema = z.object({
  profile: CharacterProfileSchema,
});
export type GetCharacterResponse = z.infer<typeof GetCharacterResponseSchema>;

// GET /api/market/prices?league=...&names=a,b,c
export const MarketPricesResponseSchema = z.object({
  quotes: z.array(PriceQuoteSchema),
  league: z.string(),
  updatedAt: z.string(),
  fromCache: z.boolean(),
  degraded: z.boolean(), // true si se usaron fixtures o caché antigua por fallo del servicio
  /** Moneda primaria de cotización de la liga (p. ej. "divine"). */
  primaryCurrency: CurrencyKind.nullable(),
  /**
   * Tasas de conversión contra la moneda primaria, con origen y estado de
   * verificación. null = sin conversión verificable: no se puede afirmar que
   * algo entra en presupuesto. Jamás se usan tasas de fixture o caché antigua
   * para afirmar que una compra entra o no en el presupuesto.
   */
  rates: z
    .object({
      values: z.record(z.string(), z.number()),
      origin: z.enum(["live", "cache-fresh", "cache-stale", "fixture"]),
      verified: z.boolean(),
      fetchedAt: z.string(),
    })
    .nullable(),
});
export type MarketPricesResponse = z.infer<typeof MarketPricesResponseSchema>;
export type MarketRates = NonNullable<MarketPricesResponse["rates"]>;

// POST /api/recommendations
export const RecommendationsRequestSchema = z.object({
  profile: CharacterProfileSchema,
  target: BuildTargetSchema.optional(),
  budget: BudgetSchema,
  goal: GoalSchema,
  league: z.string(),
  patch: z.string(),
  /** Revisión que vio la UI; el servidor carga el diario autoritativo. */
  journalRevision: z.string().min(1).max(4000).nullable().optional(),
});
export const RecommendationsResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).max(3),
  generatedAt: z.string(),
  engineVersion: z.string(),
  /** Huella de los inputs usados; el frontend invalida recomendaciones si cambia. */
  inputFingerprint: z.string(),
  memoryImpact: RecommendationMemoryImpactSchema,
});
export type RecommendationsRequest = z.infer<typeof RecommendationsRequestSchema>;
export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>;

// Character Journal — memoria persistente del mentor
export const CreateJournalEntryRequestSchema = z.object({
  kind: JournalEntryKind,
  title: z.string().trim().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  summary: z.string().trim().min(1).max(4000),
  nextAction: z.string().trim().min(1).max(2000).nullable().default(null),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(100).default([]),
  sources: z.array(SourceEvidenceSchema).max(50).default([]),
  context: JournalContextSchema,
  recommendationSnapshot: RecommendationSchema.nullable().default(null),
  makePrimary: z.boolean().default(false),
  journalRevision: z.string().min(1).max(4000).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH).optional(),
}).refine((value) => !value.makePrimary || value.nextAction !== null, {
  message: "Una entrada principal necesita una próxima acción.",
  path: ["nextAction"],
});
export type CreateJournalEntryRequest = z.infer<typeof CreateJournalEntryRequestSchema>;

export const UpdateJournalEntryRequestSchema = z
  .object({
    status: JournalEntryStatus.optional(),
    title: z.string().trim().min(1).max(MAX_JOURNAL_TITLE_LENGTH).optional(),
    summary: z.string().trim().min(1).max(4000).optional(),
    nextAction: z.string().trim().min(1).max(2000).nullable().optional(),
    result: z.string().trim().min(1).max(4000).nullable().optional(),
    makePrimary: z.boolean().optional(),
    journalRevision: z.string().min(1).max(4000).nullable().optional(),
    idempotencyKey: z.string().trim().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Incluye al menos un cambio.",
  });
export type UpdateJournalEntryRequest = z.infer<typeof UpdateJournalEntryRequestSchema>;

export const JournalResponseSchema = CharacterJournalSchema.extend({
  session: DecisionSessionSchema.nullable().default(null),
  sessionEvents: z.array(DecisionSessionEventSchema).max(MAX_SESSION_EVENTS).default([]),
});
export const JournalEntryResponseSchema = z.object({
  journal: JournalResponseSchema,
  entry: JournalEntrySchema,
});
export type JournalResponse = z.infer<typeof JournalResponseSchema>;
export type JournalEntryResponse = z.infer<typeof JournalEntryResponseSchema>;

const RevisionGuardSchema = z.object({
  journalRevision: z.string().min(1).max(4000),
  idempotencyKey: z.string().trim().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH),
});

export const StartDecisionSessionRequestSchema = RevisionGuardSchema.extend({
  kind: DecisionSessionKind,
  objective: z.string().trim().min(1).max(500),
  hypothesis: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().min(1).max(2000),
  observationMethod: z.string().trim().min(1).max(1000),
  unknowns: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(400),
        blockingIrreversible: z.boolean().default(true),
      }),
    )
    .max(15)
    .default([]),
  constraints: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        relatedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
      }),
    )
    .max(20)
    .default([]),
  soonReplacedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  protectedResources: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  recommendation: RecommendationSchema.nullable().default(null),
  profile: CharacterProfileSchema,
  budget: BudgetSchema,
  // Objetivo real del jugador, del enum del dominio. Antes era un string libre
  // que además el servidor descartaba: el cliente enviaba un dato que se perdía.
  goal: GoalKind,
});
export type StartDecisionSessionRequest = z.infer<typeof StartDecisionSessionRequestSchema>;

export const AddSessionConstraintRequestSchema = RevisionGuardSchema.extend({
  label: z.string().trim().min(1).max(200),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  profile: CharacterProfileSchema,
});
export type AddSessionConstraintRequest = z.infer<typeof AddSessionConstraintRequestSchema>;

/**
 * Retirar CONSCIENTEMENTE una protección. El texto del conflicto invita a
 * hacerlo, así que tiene que existir la acción correspondiente: sin ella el
 * jugador queda en un callejón sin salida.
 */
export const ReleaseSessionConstraintRequestSchema = RevisionGuardSchema.extend({
  constraintId: z.string().trim().min(1).max(80),
  profile: CharacterProfileSchema,
});
export type ReleaseSessionConstraintRequest = z.infer<
  typeof ReleaseSessionConstraintRequestSchema
>;

export const AddSessionEvidenceRequestSchema = RevisionGuardSchema.extend({
  kind: SessionEvidenceKind,
  text: z.string().trim().min(1).max(2000),
  resolvesUnknownLabel: z.string().trim().min(1).max(400).nullable().default(null),
  profile: CharacterProfileSchema,
});
export type AddSessionEvidenceRequest = z.infer<typeof AddSessionEvidenceRequestSchema>;

export const RecordSessionResultRequestSchema = RevisionGuardSchema.extend({
  result: z.string().trim().min(1).max(4000),
  subjective: z.boolean().default(false),
  unexpectedValuable: z.string().trim().min(1).max(400).nullable().default(null),
  conclusion: DecisionConclusionKind.optional(),
  reopenWhen: z.string().trim().min(1).max(1000).nullable().default(null),
  profile: CharacterProfileSchema,
});
export type RecordSessionResultRequest = z.infer<typeof RecordSessionResultRequestSchema>;

export const PauseSessionRequestSchema = RevisionGuardSchema.extend({
  reason: z.string().trim().min(1).max(2000),
  profile: CharacterProfileSchema,
});
export type PauseSessionRequest = z.infer<typeof PauseSessionRequestSchema>;

export const ReopenSessionRequestSchema = RevisionGuardSchema.extend({
  note: z.string().trim().min(1).max(2000),
  profile: CharacterProfileSchema,
});
export type ReopenSessionRequest = z.infer<typeof ReopenSessionRequestSchema>;

export const ReconcileSessionRequestSchema = RevisionGuardSchema.extend({
  profile: CharacterProfileSchema,
});
export type ReconcileSessionRequest = z.infer<typeof ReconcileSessionRequestSchema>;

// POST /api/export/build — archivo `.build` oficial (GGG Build Planner v1)
export const ExportBuildRequestSchema = z.object({
  profile: CharacterProfileSchema,
  target: BuildTargetSchema.optional(),
  appliedRecommendations: z.array(z.string()).optional(),
});
export const ExportBuildResponseSchema = z.object({
  /** Nombre del archivo descargable; termina en ".build". */
  fileName: z.string().endsWith(".build"),
  /** Contenido JSON del archivo (un único objeto Build del esquema oficial). */
  content: z.string(),
  /** Informe honesto: qué se exportó y qué no puede almacenar el formato oficial. */
  report: ExportReportSchema,
});
export type ExportBuildRequest = z.infer<typeof ExportBuildRequestSchema>;
export type ExportBuildResponse = z.infer<typeof ExportBuildResponseSchema>;

// Errores de API
export const ApiErrorSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

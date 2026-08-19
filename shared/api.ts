import { z } from "zod";
import {
  BuildTargetSchema,
  BudgetSchema,
  CharacterProfileSchema,
  CurrencyKind,
  GoalSchema,
  ItemSchema,
  PatchVersionSchema,
  PriceQuoteSchema,
  RecommendationSchema,
} from "./domain.js";
import { ExportReportSchema } from "./gggBuildPlanner.js";

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
export const ImportBuildRequestSchema = z.object({
  content: z.string().min(1),
});
export const ImportBuildResponseSchema = z.object({
  profile: CharacterProfileSchema,
  warnings: z.array(z.string()),
  detectedFormat: z.enum(["ggg-build-planner-v1", "pob-code", "unknown"]),
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
   * Tasas de conversión contra la moneda primaria, recibidas de poe.ninja
   * (core.rates: id de moneda → cuántas unidades valen 1 unidad de la primaria).
   * null = sin conversión verificable: no se puede afirmar que algo entra en presupuesto.
   */
  rates: z.record(z.string(), z.number()).nullable(),
});
export type MarketPricesResponse = z.infer<typeof MarketPricesResponseSchema>;

// POST /api/recommendations
export const RecommendationsRequestSchema = z.object({
  profile: CharacterProfileSchema,
  target: BuildTargetSchema.optional(),
  budget: BudgetSchema,
  goal: GoalSchema,
  league: z.string(),
  patch: z.string(),
});
export const RecommendationsResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).max(3),
  generatedAt: z.string(),
  engineVersion: z.string(),
  /** Huella de los inputs usados; el frontend invalida recomendaciones si cambia. */
  inputFingerprint: z.string(),
});
export type RecommendationsRequest = z.infer<typeof RecommendationsRequestSchema>;
export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>;

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

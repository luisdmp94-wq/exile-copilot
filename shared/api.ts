import { z } from "zod";
import {
  BuildTargetSchema,
  BudgetSchema,
  CharacterProfileSchema,
  GoalSchema,
  ItemSchema,
  PriceQuoteSchema,
  RecommendationSchema,
} from "./domain.js";

/**
 * Contrato de la API REST v1 (toda bajo /api).
 * Los esquemas validan tanto las peticiones como las respuestas.
 */

// GET /api/health
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  patch: z.string(),
  dataUpdatedAt: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// GET /api/meta
export const MetaResponseSchema = z.object({
  leagues: z.array(z.string()),
  patches: z.array(z.object({ id: z.string(), label: z.string() })),
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
  detectedFormat: z.enum(["build-json", "pob-code", "unknown"]),
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

// GET /api/market/prices?league=...&names=a,b,c
export const MarketPricesResponseSchema = z.object({
  quotes: z.array(PriceQuoteSchema),
  league: z.string(),
  updatedAt: z.string(),
  fromCache: z.boolean(),
  degraded: z.boolean(), // true si se usaron fixtures o caché antigua por fallo del servicio
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
});
export type RecommendationsRequest = z.infer<typeof RecommendationsRequestSchema>;
export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>;

// POST /api/export/build — devuelve un archivo .build (JSON versionado)
export const ExportBuildRequestSchema = z.object({
  profile: CharacterProfileSchema,
  appliedRecommendations: z.array(z.string()).optional(),
});
export type ExportBuildRequest = z.infer<typeof ExportBuildRequestSchema>;

// Errores de API
export const ApiErrorSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

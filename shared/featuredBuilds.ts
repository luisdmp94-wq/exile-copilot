import { z } from "zod";

/**
 * Catálogo editorial de builds de temporada.
 *
 * No representa una ladder ni datos extraídos de perfiles privados. Cada
 * entrada necesita procedencia visible y una revisión explícita del parche.
 */
export const FeaturedBuildCategorySchema = z.enum([
  "starter",
  "mapping",
  "bossing",
  "survival",
  "budget",
  "ssf",
]);
export type FeaturedBuildCategory = z.infer<typeof FeaturedBuildCategorySchema>;

export const FeaturedBuildStatusSchema = z.enum([
  "verified",
  "needs-review",
  "retired",
]);
export type FeaturedBuildStatus = z.infer<typeof FeaturedBuildStatusSchema>;

export const FeaturedBuildSchema = z.object({
  id: z.string().min(1),
  game: z.literal("poe2"),
  title: z.string().min(1),
  characterClass: z.string().min(1),
  ascendancy: z.string().nullable(),
  mainSkills: z.array(z.string().min(1)).min(1).max(4),
  league: z.string().min(1),
  patch: z.string().min(1),
  categories: z.array(FeaturedBuildCategorySchema).min(1),
  budgetBand: z.enum(["low", "medium", "high", "unknown"]),
  status: FeaturedBuildStatusSchema,
  verifiedAt: z.string().datetime().nullable(),
  source: z.object({
    label: z.string().min(1),
    author: z.string().min(1),
    url: z.string().url(),
    kind: z.enum(["official-build", "pob2", "community-guide", "opt-in"]),
  }),
  summary: z.string().min(1).max(500),
  whyFeatured: z.string().min(1).max(500),
  caveats: z.array(z.string().min(1).max(300)).min(1).max(5),
  desiredMods: z.array(z.string().min(1).max(200)).max(12),
});
export type FeaturedBuild = z.infer<typeof FeaturedBuildSchema>;

export const FeaturedBuildCatalogSchema = z.object({
  game: z.literal("poe2"),
  slots: z.literal(10),
  selectionAsOf: z.string().date(),
  methodology: z.array(z.string().min(1)).min(1).max(8),
  entries: z.array(FeaturedBuildSchema).max(10),
});
export type FeaturedBuildCatalog = z.infer<typeof FeaturedBuildCatalogSchema>;

export const FeaturedBuildsResponseSchema = z.object({
  league: z.string().min(1),
  patch: z.string().min(1),
  slots: z.literal(10),
  selectionAsOf: z.string().date(),
  methodology: z.array(z.string().min(1)),
  builds: z.array(FeaturedBuildSchema).max(10),
  pendingReview: z.number().int().nonnegative(),
});
export type FeaturedBuildsResponse = z.infer<typeof FeaturedBuildsResponseSchema>;

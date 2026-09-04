import { z } from "zod";
import { ItemSlot } from "./domain.js";

export const ItemTextCorpusLocaleSchema = z.enum(["es", "en"]);
export type ItemTextCorpusLocale = z.infer<typeof ItemTextCorpusLocaleSchema>;

export const ItemTextCorpusProvenanceMethodSchema = z.enum([
  "in-game-clipboard",
  "official-forum-derived-regression",
]);
export type ItemTextCorpusProvenanceMethod = z.infer<
  typeof ItemTextCorpusProvenanceMethodSchema
>;

export const ItemTextCorpusAuditCaseSchema = z.object({
  id: z.string().min(1),
  locale: ItemTextCorpusLocaleSchema,
  patch: z.string().min(1),
  provenance: z.object({
    method: ItemTextCorpusProvenanceMethodSchema,
    observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string().min(1),
  }),
  replayPassed: z.boolean(),
  issues: z.array(z.string()),
});
export type ItemTextCorpusAuditCase = z.infer<
  typeof ItemTextCorpusAuditCaseSchema
>;

export const ItemTextCorpusAuditSchema = z.object({
  schemaVersion: z.literal(1),
  supportedLocales: z
    .array(ItemTextCorpusLocaleSchema)
    .min(1)
    .refine((locales) => new Set(locales).size === locales.length, {
      message: "Los idiomas soportados deben ser únicos.",
    }),
  issues: z.array(z.string()),
  /** Puede quedar vacío si ni siquiera se pudo cargar el manifiesto: eso debe
   * llegar al informe como bloqueo, no hacer caer la propia auditoría. */
  cases: z.array(ItemTextCorpusAuditCaseSchema),
});
export type ItemTextCorpusAudit = z.infer<typeof ItemTextCorpusAuditSchema>;

export const DirectItemTextCorpusSubmissionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
    locale: ItemTextCorpusLocaleSchema,
    patch: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string().trim().min(12).max(500),
    expected: z
      .object({
        name: z.string().trim().min(1),
        baseType: z.string().trim().min(1),
        slot: ItemSlot,
        rarity: z.enum(["normal", "magic", "rare", "unique"]),
        itemLevel: z.number().int().nonnegative(),
        quality: z.number().int().nonnegative(),
        prefixCount: z.number().int().nonnegative(),
        suffixCount: z.number().int().nonnegative(),
        diagnosisState: z.enum(["complete", "partial", "blocked"]),
        specialStates: z
          .array(z.enum(["fractured", "desecrated", "mutated"]))
          .refine((states) => new Set(states).size === states.length, {
            message: "Los estados especiales deben ser únicos.",
          }),
      })
      .strict(),
  })
  .strict();
export type DirectItemTextCorpusSubmission = z.infer<
  typeof DirectItemTextCorpusSubmissionSchema
>;

export const DirectItemTextCorpusBatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    samples: z
      .array(
        z
          .object({
            submission: DirectItemTextCorpusSubmissionSchema,
            rawText: z
              .string()
              .min(40, "El texto copiado es demasiado corto para ser un tooltip reproducible."),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((batch, context) => {
    const ids = batch.samples.map((sample) => sample.submission.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["samples"],
        message: "Las muestras del lote deben tener ids únicos.",
      });
    }
  });
export type DirectItemTextCorpusBatch = z.infer<
  typeof DirectItemTextCorpusBatchSchema
>;

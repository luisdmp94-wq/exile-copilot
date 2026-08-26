import { z } from "zod";

/** Áreas cuyos datos pueden cambiar entre parches y deben revisarse por separado. */
export const PatchFeatureId = z.enum([
  "item-import",
  "basic-crafting",
  "advanced-crafting",
  "passive-tree",
  "market",
]);
export type PatchFeatureId = z.infer<typeof PatchFeatureId>;

/**
 * `covered` no significa que conozcamos todos los resultados posibles: solo que
 * el alcance descrito fue contrastado. `limited` obliga a conservar el aviso y
 * `review-required` impide dar instrucciones dependientes de ese parche.
 */
export const PatchCoverageStatus = z.enum([
  "covered",
  "limited",
  "review-required",
]);
export type PatchCoverageStatus = z.infer<typeof PatchCoverageStatus>;

export const PatchFeatureCoverageSchema = z.object({
  id: PatchFeatureId,
  label: z.string().min(1),
  status: PatchCoverageStatus,
  note: z.string().min(1),
  evidence: z.string().min(1),
  /** Identificadores concretos de snapshots, registros o pruebas que sostienen el alcance. */
  evidenceIds: z.array(z.string().min(1)),
});
export type PatchFeatureCoverage = z.infer<typeof PatchFeatureCoverageSchema>;

export const ReleaseTargetSchema = z.object({
  version: z.string().min(1),
  releaseDate: z.string().min(1),
  status: z.enum(["announced", "released"]),
  announcedAt: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
});
export type ReleaseTarget = z.infer<typeof ReleaseTargetSchema>;

export const PatchCompatibilityRecordSchema = z.object({
  patchId: z.string().min(1),
  status: PatchCoverageStatus,
  reviewedAt: z.string().nullable(),
  summary: z.string().min(1),
  features: z
    .array(PatchFeatureCoverageSchema)
    .length(PatchFeatureId.options.length)
    .refine(
      (features) => new Set(features.map((feature) => feature.id)).size === PatchFeatureId.options.length,
      "Cada área dependiente del parche debe aparecer exactamente una vez.",
    ),
});
export type PatchCompatibilityRecord = z.infer<typeof PatchCompatibilityRecordSchema>;

export const PatchCompatibilityRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  targetRelease: ReleaseTargetSchema,
  patches: z.array(PatchCompatibilityRecordSchema),
}).refine(
  (registry) =>
    new Set(registry.patches.map((record) => record.patchId)).size === registry.patches.length,
  "No puede haber dos coberturas para el mismo parche.",
);
export type PatchCompatibilityRegistry = z.infer<typeof PatchCompatibilityRegistrySchema>;

const REQUIRED_FEATURES: ReadonlyArray<{ id: PatchFeatureId; label: string }> = [
  { id: "item-import", label: "Importación de objetos" },
  { id: "basic-crafting", label: "Crafting básico guiado" },
  { id: "advanced-crafting", label: "Essences, Alloys y rutas avanzadas" },
  { id: "passive-tree", label: "Árbol de pasivas" },
  { id: "market", label: "Mercado" },
];

/**
 * Resolver conservador: un parche ausente del registro nunca hereda la
 * cobertura del anterior. Esta es la barrera que deberá proteger el salto a
 * 1.0 hasta que cada área se vuelva a contrastar.
 */
export function compatibilityForPatch(
  registry: PatchCompatibilityRegistry,
  patchId: string,
): PatchCompatibilityRecord {
  const known = registry.patches.find((candidate) => candidate.patchId === patchId);
  if (known) return known;

  return {
    patchId,
    status: "review-required",
    reviewedAt: null,
    summary: `El parche ${patchId} todavía no tiene una revisión de compatibilidad registrada.`,
    features: REQUIRED_FEATURES.map((feature) => ({
      ...feature,
      status: "review-required" as const,
      note: "Detenido hasta contrastar esta área con el parche seleccionado.",
      evidence: "No hay evidencia registrada para este parche.",
      evidenceIds: [],
    })),
  };
}

/** Solo una cobertura explícita permite dar instrucciones dependientes del parche. */
export function allowsPatchGuidance(record: PatchCompatibilityRecord): boolean {
  return record.status !== "review-required";
}

export function patchFeatureCoverage(
  record: PatchCompatibilityRecord,
  featureId: PatchFeatureId,
): PatchFeatureCoverage {
  const feature = record.features.find((candidate) => candidate.id === featureId);
  if (feature) return feature;
  // El esquema completo impide llegar aquí con datos válidos. La reserva sigue
  // fallando cerrada para que ni un objeto construido a mano pueda habilitarse.
  return {
    id: featureId,
    label: featureId,
    status: "review-required",
    note: "Esta área no aparece en la cobertura del parche.",
    evidence: "No hay evidencia registrada para esta área.",
    evidenceIds: [],
  };
}

export function allowsPatchFeature(
  record: PatchCompatibilityRecord,
  featureId: PatchFeatureId,
): boolean {
  return allowsPatchGuidance(record) &&
    patchFeatureCoverage(record, featureId).status !== "review-required";
}

import { z } from "zod";
import type { AuditedReleaseEvidence } from "./releaseEvidence.js";

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

export type PatchEvidenceIssueCode =
  | "missing-evidence"
  | "wrong-feature"
  | "wrong-patch"
  | "unverified-artifact"
  | "evidence-after-review";

export interface PatchEvidenceIssue {
  patchId: string;
  featureId: PatchFeatureId;
  evidenceId: string | null;
  code: PatchEvidenceIssueCode;
  detail: string;
}

/**
 * Coherencia exigida durante la ejecución, no solo al preparar un lanzamiento.
 *
 * Una cobertura `limited` puede conservar observaciones cuyo tooltip no muestra
 * el parche (`patch: null`), siempre que ese límite permanezca visible. Lo que
 * nunca puede hacer es heredar evidencia que declara explícitamente otra
 * versión. `covered` es más fuerte y exige que toda su evidencia declare el
 * parche exacto.
 */
export function auditPatchEvidence(
  registry: PatchCompatibilityRegistry,
  evidenceCatalog: readonly AuditedReleaseEvidence[],
): PatchEvidenceIssue[] {
  const catalog = new Map(evidenceCatalog.map((entry) => [entry.evidenceId, entry]));
  const issues: PatchEvidenceIssue[] = [];

  for (const record of registry.patches) {
    for (const feature of record.features) {
      if (feature.status === "review-required") continue;
      if (feature.evidenceIds.length === 0) {
        issues.push({
          patchId: record.patchId,
          featureId: feature.id,
          evidenceId: null,
          code: "missing-evidence",
          detail: "La capacidad habilitada no declara ninguna evidencia.",
        });
        continue;
      }

      for (const evidenceId of feature.evidenceIds) {
        const evidence = catalog.get(evidenceId);
        if (!evidence) {
          issues.push({
            patchId: record.patchId,
            featureId: feature.id,
            evidenceId,
            code: "missing-evidence",
            detail: `No existe ${evidenceId} en el catálogo auditado.`,
          });
          continue;
        }
        if (!evidence.artifactVerified) {
          issues.push({
            patchId: record.patchId,
            featureId: feature.id,
            evidenceId,
            code: "unverified-artifact",
            detail: evidence.artifactIssue ?? `No se pudo verificar ${evidenceId}.`,
          });
        }
        if (evidence.featureId !== feature.id) {
          issues.push({
            patchId: record.patchId,
            featureId: feature.id,
            evidenceId,
            code: "wrong-feature",
            detail: `${evidenceId} pertenece a ${evidence.featureId}, no a ${feature.id}.`,
          });
        }
        const exactPatchRequired = feature.status === "covered";
        if (
          evidence.patch !== record.patchId &&
          (exactPatchRequired || evidence.patch !== null)
        ) {
          issues.push({
            patchId: record.patchId,
            featureId: feature.id,
            evidenceId,
            code: "wrong-patch",
            detail: evidence.patch === null
              ? `${evidenceId} no declara el parche exacto exigido por una cobertura completa.`
              : `${evidenceId} declara ${evidence.patch}, no ${record.patchId}.`,
          });
        }
        if (record.reviewedAt !== null && evidence.asOf > record.reviewedAt) {
          issues.push({
            patchId: record.patchId,
            featureId: feature.id,
            evidenceId,
            code: "evidence-after-review",
            detail: `${evidenceId} es posterior a la fecha de revisión ${record.reviewedAt}.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Aplica la auditoría al registro que consume la API. Una inconsistencia solo
 * detiene el área afectada; no convierte un fallo de mercado en un bloqueo del
 * lector de objetos o de las pasivas.
 */
export function gatePatchCompatibilityByEvidence(
  registry: PatchCompatibilityRegistry,
  evidenceCatalog: readonly AuditedReleaseEvidence[],
): PatchCompatibilityRegistry {
  const issues = auditPatchEvidence(registry, evidenceCatalog);
  if (issues.length === 0) return registry;

  return {
    ...registry,
    patches: registry.patches.map((record) => ({
      ...record,
      features: record.features.map((feature) => {
        const featureIssues = issues.filter(
          (issue) => issue.patchId === record.patchId && issue.featureId === feature.id,
        );
        if (featureIssues.length === 0) return feature;
        return {
          ...feature,
          status: "review-required" as const,
          note: `Detenido por evidencia inconsistente: ${featureIssues
            .map((issue) => issue.detail)
            .join(" ")}`,
        };
      }),
    })),
  };
}

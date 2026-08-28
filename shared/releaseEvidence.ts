import { z } from "zod";
import { PatchFeatureId } from "./patchCompatibility.js";

/**
 * Evidencia que puede respaldar una cobertura de parche.
 *
 * El id escrito en patchCompatibility.json no basta por sí solo: debe resolver
 * a un artefacto local inmutable, declarar el área que respalda y decir qué
 * parche demuestra realmente. `patch: null` significa que el propio artefacto
 * no permite atribuirle una versión; nunca debe desbloquear un lanzamiento.
 */
export const ReleaseEvidenceRecordSchema = z.object({
  evidenceId: z.string().min(1).max(160),
  featureId: PatchFeatureId,
  patch: z.string().min(1).max(60).nullable(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum([
    "parser-regression",
    "in-game-observation",
    "official-source-review",
    "official-export",
    "live-service-contract",
  ]),
  artifactPath: z.string().min(1).max(300),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().min(1).max(800),
});

export type ReleaseEvidenceRecord = z.infer<typeof ReleaseEvidenceRecordSchema>;

export const ReleaseEvidenceCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    records: z.array(ReleaseEvidenceRecordSchema),
  })
  .superRefine((catalog, context) => {
    const seen = new Set<string>();
    for (const [index, record] of catalog.records.entries()) {
      if (seen.has(record.evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "evidenceId"],
          message: `Id de evidencia duplicado: ${record.evidenceId}`,
        });
      }
      seen.add(record.evidenceId);
    }
  });

export type ReleaseEvidenceCatalog = z.infer<typeof ReleaseEvidenceCatalogSchema>;

/** Registro enriquecido por el servidor después de comprobar ruta y SHA-256. */
export interface AuditedReleaseEvidence extends ReleaseEvidenceRecord {
  artifactVerified: boolean;
  artifactIssue: string | null;
}

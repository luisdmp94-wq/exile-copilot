import type { PatchVersion } from "./domain.js";
import {
  PatchFeatureId,
  type PatchCompatibilityRegistry,
  type PatchFeatureCoverage,
} from "./patchCompatibility.js";
import type { AuditedReleaseEvidence } from "./releaseEvidence.js";

export type ReleaseCheckStatus = "pass" | "fail";

export interface ReleaseReadinessCheck {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
}

export interface ReleaseReadinessInput {
  targetPatch: string;
  defaultPatch: string;
  patches: PatchVersion[];
  compatibility: PatchCompatibilityRegistry;
  passiveRegistry: {
    testedAgainstPatch: string;
    evidenceId: string;
  };
  evidenceCatalog: AuditedReleaseEvidence[];
}

export interface ReleaseReadinessReport {
  targetPatch: string;
  ready: boolean;
  checks: ReleaseReadinessCheck[];
}

function check(
  id: string,
  label: string,
  ok: boolean,
  passDetail: string,
  failDetail: string,
): ReleaseReadinessCheck {
  return {
    id,
    label,
    status: ok ? "pass" : "fail",
    detail: ok ? passDetail : failDetail,
  };
}

function freshEvidenceIds(
  feature: PatchFeatureCoverage,
  targetPatch: string,
  registry: PatchCompatibilityRegistry,
): string[] {
  const previous = new Set(
    registry.patches
      .filter((record) => record.patchId !== targetPatch)
      .flatMap((record) =>
        record.features
          .filter((candidate) => candidate.id === feature.id)
          .flatMap((candidate) => candidate.evidenceIds),
      ),
  );
  return feature.evidenceIds.filter((evidenceId) => !previous.has(evidenceId));
}

/**
 * Auditor puro del corte de datos de un lanzamiento. No activa nada: solo
 * demuestra si el target tiene metadatos, cobertura y evidencia propias.
 */
export function evaluateReleaseReadiness(
  input: ReleaseReadinessInput,
): ReleaseReadinessReport {
  const target = input.compatibility.targetRelease;
  const patchMetadata = input.patches.find((patch) => patch.id === input.targetPatch);
  const record = input.compatibility.patches.find(
    (candidate) => candidate.patchId === input.targetPatch,
  );
  const checks: ReleaseReadinessCheck[] = [];

  checks.push(
    check(
      "target-declared",
      "Objetivo de lanzamiento declarado",
      target.version === input.targetPatch,
      `El registro señala ${target.version} como objetivo.`,
      `El registro señala ${target.version}, no ${input.targetPatch}.`,
    ),
    check(
      "target-released",
      "Lanzamiento oficial confirmado",
      target.version === input.targetPatch && target.status === "released",
      `El lanzamiento ${input.targetPatch} figura como publicado.`,
      `El lanzamiento ${input.targetPatch} sigue anunciado, no publicado.`,
    ),
    check(
      "patch-metadata",
      "Metadatos exactos del parche",
      Boolean(patchMetadata?.asOf && patchMetadata.source),
      `${patchMetadata?.id} tiene fecha y fuente.`,
      `Falta ${input.targetPatch} en patches.json con fecha y fuente.`,
    ),
    check(
      "compatibility-record",
      "Cobertura explícita del parche",
      Boolean(record && record.status !== "review-required" && record.reviewedAt),
      `${record?.patchId} tiene revisión ${record?.status}.`,
      `Falta una revisión habilitable y fechada para ${input.targetPatch}.`,
    ),
  );

  for (const featureId of PatchFeatureId.options) {
    const feature = record?.features.find((candidate) => candidate.id === featureId);
    const fresh = feature
      ? freshEvidenceIds(feature, input.targetPatch, input.compatibility)
      : [];
    const catalogRecords = (feature?.evidenceIds ?? []).map((evidenceId) =>
      input.evidenceCatalog.find((candidate) => candidate.evidenceId === evidenceId),
    );
    const missing = (feature?.evidenceIds ?? []).filter(
      (_evidenceId, index) => catalogRecords[index] === undefined,
    );
    const wrongFeature = catalogRecords.filter(
      (candidate) => candidate !== undefined && candidate.featureId !== featureId,
    );
    const damaged = catalogRecords.filter(
      (candidate) => candidate !== undefined && !candidate.artifactVerified,
    );
    const targetEvidence = catalogRecords.filter(
      (candidate) =>
        candidate !== undefined &&
        candidate.featureId === featureId &&
        candidate.patch === input.targetPatch &&
        candidate.artifactVerified &&
        fresh.includes(candidate.evidenceId),
    );
    const ok = Boolean(
      feature &&
        feature.status !== "review-required" &&
        feature.evidenceIds.length > 0 &&
        fresh.length > 0 &&
        missing.length === 0 &&
        wrongFeature.length === 0 &&
        damaged.length === 0 &&
        targetEvidence.length > 0,
    );
    const problems = [
      missing.length > 0 ? `ids sin catálogo: ${missing.join(", ")}` : null,
      wrongFeature.length > 0
        ? `ids de otra área: ${wrongFeature.map((entry) => entry?.evidenceId).join(", ")}`
        : null,
      damaged.length > 0
        ? `artefactos no verificables: ${damaged.map((entry) => entry?.evidenceId).join(", ")}`
        : null,
      targetEvidence.length === 0
        ? `ningún artefacto íntegro declara el parche ${input.targetPatch}`
        : null,
    ].filter((problem): problem is string => problem !== null);
    checks.push(
      check(
        `feature-${featureId}`,
        `Cobertura propia: ${featureId}`,
        ok,
        `${feature?.status}; evidencia propia, íntegra y del parche: ${targetEvidence
          .map((entry) => entry?.evidenceId)
          .join(", ")}.`,
        feature
          ? `${feature.status}; ${problems.join("; ") || "necesita evidencia propia del parche"}.`
          : `El registro de ${input.targetPatch} no contiene esta área.`,
      ),
    );
  }

  const passiveFeature = record?.features.find(
    (feature) => feature.id === "passive-tree",
  );
  checks.push(
    check(
      "passive-registry",
      "Registro de pasivas del parche",
      input.passiveRegistry.testedAgainstPatch === input.targetPatch &&
        Boolean(passiveFeature?.evidenceIds.includes(input.passiveRegistry.evidenceId)),
      `El registro ${input.passiveRegistry.evidenceId} fue probado contra ${input.targetPatch}.`,
      `El registro activo fue probado contra ${input.passiveRegistry.testedAgainstPatch} o no está autorizado por la cobertura ${input.targetPatch}.`,
    ),
    check(
      "default-patch",
      "Parche activo del despliegue",
      input.defaultPatch === input.targetPatch,
      `DEFAULT_PATCH apunta exactamente a ${input.targetPatch}.`,
      `DEFAULT_PATCH sigue en ${input.defaultPatch}; no se debe cambiar hasta cerrar las evidencias anteriores.`,
    ),
  );

  return {
    targetPatch: input.targetPatch,
    ready: checks.every((candidate) => candidate.status === "pass"),
    checks,
  };
}

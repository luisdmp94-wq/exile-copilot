import type { PatchVersion } from "./domain.js";
import {
  PatchFeatureId,
  type PatchCompatibilityRegistry,
  type PatchFeatureCoverage,
} from "./patchCompatibility.js";
import type { AuditedReleaseEvidence } from "./releaseEvidence.js";
import type { ItemTextCorpusAudit } from "./itemTextCorpus.js";
import {
  REQUIRED_PLAYER_WALKTHROUGH_ROLES,
  PLAYER_WALKTHROUGH_ROLE_LABELS,
  walkthroughCheckpointsPassed,
  type PlayerWalkthroughAudit,
} from "./playerWalkthrough.js";

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
  /** Fecha real de ejecución (YYYY-MM-DD). Impide aprobar evidencias fechadas en el futuro. */
  auditDate: string;
  /**
   * Ciclo de vida del corte que se audita. Si se omite, se conserva el objetivo
   * principal declarado en patchCompatibility (actualmente 1.0). Esto permite
   * ensayar la misma barrera con un parche intermedio sin sustituir el objetivo
   * público del producto.
   */
  releaseTarget?: {
    version: string;
    releaseDate: string;
    status: "announced" | "released";
  };
  patches: PatchVersion[];
  compatibility: PatchCompatibilityRegistry;
  passiveRegistry: {
    testedAgainstPatch: string;
    evidenceId: string;
  };
  evidenceCatalog: AuditedReleaseEvidence[];
  itemTextCorpus: ItemTextCorpusAudit;
  /** Ausente en clientes antiguos: la barrera falla cerrada, nunca lo da por aprobado. */
  playerWalkthroughs?: PlayerWalkthroughAudit;
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

function isDateOnOrAfter(value: string | null | undefined, minimum: string): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= minimum);
}

function isDateOnOrBefore(value: string | null | undefined, maximum: string): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= maximum);
}

/**
 * Auditor puro del corte de datos de un lanzamiento. No activa nada: solo
 * demuestra si el target tiene metadatos, cobertura y evidencia propias.
 */
export function evaluateReleaseReadiness(
  input: ReleaseReadinessInput,
): ReleaseReadinessReport {
  const target = input.releaseTarget ?? input.compatibility.targetRelease;
  const releaseWindowOpen = isDateOnOrAfter(input.auditDate, target.releaseDate);
  const observationWindow = releaseWindowOpen
    ? `entre ${target.releaseDate} y ${input.auditDate}`
    : `desde ${target.releaseDate}; la auditoría actual (${input.auditDate}) aún es anterior al lanzamiento`;
  const playerWalkthroughs = input.playerWalkthroughs ?? {
    schemaVersion: 1 as const,
    issues: ["No se proporcionó el manifiesto de recorridos reales."],
    runs: [],
  };
  const patchMetadata = input.patches.find((patch) => patch.id === input.targetPatch);
  const record = input.compatibility.patches.find(
    (candidate) => candidate.patchId === input.targetPatch,
  );
  const checks: ReleaseReadinessCheck[] = [];

  const corpusTargetCases = input.itemTextCorpus.cases.filter(
    (entry) => entry.patch === input.targetPatch,
  );
  const failedTargetCases = corpusTargetCases.filter((entry) => !entry.replayPassed);
  const freshDirectLocales = new Set(
    corpusTargetCases
      .filter(
        (entry) =>
          entry.replayPassed &&
          entry.provenance.method === "in-game-clipboard" &&
          isDateOnOrAfter(entry.provenance.observedAt, target.releaseDate) &&
          isDateOnOrBefore(entry.provenance.observedAt, input.auditDate),
      )
      .map((entry) => entry.locale),
  );
  const missingCorpusLocales = input.itemTextCorpus.supportedLocales.filter(
    (locale) => !freshDirectLocales.has(locale),
  );
  const validWalkthroughRoles = new Set(
    playerWalkthroughs.runs
      .filter(
        (run) =>
          run.patch === input.targetPatch &&
          isDateOnOrAfter(run.observedAt, target.releaseDate) &&
          isDateOnOrBefore(run.observedAt, input.auditDate) &&
          run.outcome === "pass" &&
          run.blockers.length === 0 &&
          run.artifactVerified &&
          walkthroughCheckpointsPassed(run.checkpoints),
      )
      .map((run) => run.role),
  );
  const missingWalkthroughRoles = REQUIRED_PLAYER_WALKTHROUGH_ROLES.filter(
    (role) => !validWalkthroughRoles.has(role),
  );
  const targetWalkthroughProblems = playerWalkthroughs.runs.filter(
    (run) =>
      run.patch === input.targetPatch &&
      (!isDateOnOrAfter(run.observedAt, target.releaseDate) ||
        !isDateOnOrBefore(run.observedAt, input.auditDate) ||
        run.outcome !== "pass" ||
        run.blockers.length > 0 ||
        !run.artifactVerified ||
        !walkthroughCheckpointsPassed(run.checkpoints)),
  );
  const patchMetadataProblem = !patchMetadata
    ? `Falta ${input.targetPatch} en patches.json.`
    : !patchMetadata.source
      ? `${input.targetPatch} está registrado, pero no declara una fuente oficial.`
      : !isDateOnOrAfter(patchMetadata.asOf, target.releaseDate)
        ? `${input.targetPatch} solo tiene el anuncio del ${patchMetadata.asOf ?? "día desconocido"}; necesita una fuente publicada el ${target.releaseDate} o después.`
        : !isDateOnOrBefore(patchMetadata.asOf, input.auditDate)
          ? `${input.targetPatch} declara metadatos del ${patchMetadata.asOf}, posteriores a la auditoría del ${input.auditDate}.`
        : `Los metadatos de ${input.targetPatch} no cumplen el contrato de publicación.`;

  checks.push(
    check(
      "target-declared",
      "Objetivo de lanzamiento declarado",
      target.version === input.targetPatch,
      `El registro señala ${target.version} como objetivo.`,
      `El registro señala ${target.version}, no ${input.targetPatch}.`,
    ),
    check(
      "release-window",
      "Fecha de lanzamiento alcanzada",
      releaseWindowOpen,
      `La auditoría del ${input.auditDate} es posterior o igual al lanzamiento ${target.releaseDate}.`,
      `Hoy es ${input.auditDate}; no se puede aprobar ${input.targetPatch} antes del ${target.releaseDate}.`,
    ),
    check(
      "target-released",
      "Lanzamiento oficial confirmado",
      target.version === input.targetPatch && target.status === "released" && releaseWindowOpen,
      `El lanzamiento ${input.targetPatch} figura como publicado.`,
      target.status !== "released"
        ? `El lanzamiento ${input.targetPatch} sigue anunciado, no publicado.`
        : `El registro dice publicado, pero la fecha real ${input.auditDate} aún es anterior al lanzamiento ${target.releaseDate}.`,
    ),
    check(
      "patch-metadata",
      "Metadatos exactos del parche",
      Boolean(
        patchMetadata?.source &&
          isDateOnOrAfter(patchMetadata.asOf, target.releaseDate) &&
          isDateOnOrBefore(patchMetadata.asOf, input.auditDate),
      ),
      `${patchMetadata?.id} tiene fecha posterior al lanzamiento y fuente.`,
      patchMetadataProblem,
    ),
    check(
      "compatibility-record",
      "Cobertura explícita del parche",
      Boolean(
        record &&
          record.status !== "review-required" &&
          isDateOnOrAfter(record.reviewedAt, target.releaseDate) &&
          isDateOnOrBefore(record.reviewedAt, input.auditDate),
      ),
      `${record?.patchId} tiene revisión ${record?.status}.`,
      `Falta una revisión habilitable de ${input.targetPatch} fechada ${observationWindow}.`,
    ),
    check(
      "item-import-corpus",
      "Corpus real del importador de objetos",
      input.itemTextCorpus.issues.length === 0 &&
        failedTargetCases.length === 0 &&
        missingCorpusLocales.length === 0,
      `El parser reproduce copias directas de ${input.targetPatch} en ${[
        ...freshDirectLocales,
      ].join(", ")}.`,
      [
        input.itemTextCorpus.issues.length > 0
          ? `manifiesto inválido: ${input.itemTextCorpus.issues.join("; ")}`
          : null,
        failedTargetCases.length > 0
          ? `casos ${input.targetPatch} que ya no se reproducen: ${failedTargetCases
              .map((entry) => entry.id)
              .join(", ")}`
          : null,
        missingCorpusLocales.length > 0
          ? `faltan copias directas del juego en ${missingCorpusLocales.join(", ")}, fechadas ${observationWindow}`
          : null,
        "los ejemplos de otro parche o derivados del foro no desbloquean el lanzamiento",
      ]
        .filter((problem): problem is string => problem !== null)
        .join("; ") + ".",
    ),
    check(
      "player-walkthroughs",
      "Recorridos manuales de jugador nuevo y experto",
      playerWalkthroughs.issues.length === 0 &&
        missingWalkthroughRoles.length === 0,
      `Hay recorridos íntegros y posteriores al lanzamiento para ${[
        ...validWalkthroughRoles,
      ].map((role) => PLAYER_WALKTHROUGH_ROLE_LABELS[role]).join(" y ")}.`,
      [
        playerWalkthroughs.issues.length > 0
          ? `manifiesto inválido: ${playerWalkthroughs.issues.join("; ")}`
          : null,
        missingWalkthroughRoles.length > 0
          ? `faltan recorridos aprobados de ${missingWalkthroughRoles
              .map((role) => PLAYER_WALKTHROUGH_ROLE_LABELS[role])
              .join(" y ")}`
          : null,
        targetWalkthroughProblems.length > 0
          ? `recorridos del parche bloqueados, incompletos, antiguos o sin huella válida: ${targetWalkthroughProblems
              .map((run) => run.id)
              .join(", ")}`
          : null,
        `deben observarse ${observationWindow} y usar artefactos independientes`,
      ]
        .filter((problem): problem is string => problem !== null)
        .join("; ") + ".",
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
    const wrongPatch = catalogRecords.filter(
      (candidate) =>
        candidate !== undefined && candidate.patch !== input.targetPatch,
    );
    const observedBeforeRelease = catalogRecords.filter(
      (candidate) =>
        candidate !== undefined &&
        !isDateOnOrAfter(candidate.asOf, target.releaseDate),
    );
    const observedAfterAudit = catalogRecords.filter(
      (candidate) =>
        candidate !== undefined &&
        !isDateOnOrBefore(candidate.asOf, input.auditDate),
    );
    const reused = (feature?.evidenceIds ?? []).filter(
      (evidenceId) => !fresh.includes(evidenceId),
    );
    const targetEvidence = catalogRecords.filter(
      (candidate) =>
        candidate !== undefined &&
        candidate.featureId === featureId &&
        candidate.patch === input.targetPatch &&
        isDateOnOrAfter(candidate.asOf, target.releaseDate) &&
        isDateOnOrBefore(candidate.asOf, input.auditDate) &&
        candidate.artifactVerified &&
        fresh.includes(candidate.evidenceId),
    );
    const ok = Boolean(
      feature &&
        feature.status !== "review-required" &&
        feature.evidenceIds.length > 0 &&
        fresh.length === feature.evidenceIds.length &&
        missing.length === 0 &&
        wrongFeature.length === 0 &&
        damaged.length === 0 &&
        wrongPatch.length === 0 &&
        observedBeforeRelease.length === 0 &&
        observedAfterAudit.length === 0 &&
        targetEvidence.length === feature.evidenceIds.length,
    );
    const problems = [
      missing.length > 0 ? `ids sin catálogo: ${missing.join(", ")}` : null,
      wrongFeature.length > 0
        ? `ids de otra área: ${wrongFeature.map((entry) => entry?.evidenceId).join(", ")}`
        : null,
      damaged.length > 0
        ? `artefactos no verificables: ${damaged.map((entry) => entry?.evidenceId).join(", ")}`
        : null,
      wrongPatch.length > 0
        ? `ids que no declaran ${input.targetPatch}: ${wrongPatch
            .map((entry) => entry?.evidenceId)
            .join(", ")}`
        : null,
      observedBeforeRelease.length > 0
        ? `ids anteriores al lanzamiento: ${observedBeforeRelease
            .map((entry) => entry?.evidenceId)
            .join(", ")}`
        : null,
      observedAfterAudit.length > 0
        ? `ids posteriores a la auditoría ${input.auditDate}: ${observedAfterAudit
            .map((entry) => entry?.evidenceId)
            .join(", ")}`
        : null,
      reused.length > 0
        ? `ids reutilizados de otro parche: ${reused.join(", ")}`
        : null,
      targetEvidence.length !== (feature?.evidenceIds.length ?? 0)
        ? `toda evidencia debe ser íntegra, nueva y declarar el parche ${input.targetPatch}`
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
  const passiveEvidence = input.evidenceCatalog.find(
    (candidate) => candidate.evidenceId === input.passiveRegistry.evidenceId,
  );
  const passiveFresh = passiveFeature
    ? freshEvidenceIds(passiveFeature, input.targetPatch, input.compatibility).includes(
        input.passiveRegistry.evidenceId,
      )
    : false;
  checks.push(
    check(
      "passive-registry",
      "Registro de pasivas del parche",
      input.passiveRegistry.testedAgainstPatch === input.targetPatch &&
        Boolean(passiveFeature?.evidenceIds.includes(input.passiveRegistry.evidenceId)) &&
        passiveEvidence?.featureId === "passive-tree" &&
        passiveEvidence.patch === input.targetPatch &&
        passiveEvidence.artifactVerified &&
        isDateOnOrAfter(passiveEvidence.asOf, target.releaseDate) &&
        isDateOnOrBefore(passiveEvidence.asOf, input.auditDate) &&
        passiveFresh,
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

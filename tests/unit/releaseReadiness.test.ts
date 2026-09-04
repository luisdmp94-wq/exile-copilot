import { describe, expect, it } from "vitest";
import type { PatchVersion } from "../../shared/domain.js";
import {
  PatchCompatibilityRegistrySchema,
  PatchFeatureId,
} from "../../shared/patchCompatibility.js";
import type { AuditedReleaseEvidence } from "../../shared/releaseEvidence.js";
import type { ItemTextCorpusAudit } from "../../shared/itemTextCorpus.js";
import type { PlayerWalkthroughAudit } from "../../shared/playerWalkthrough.js";
import {
  evaluateReleaseReadiness as evaluateReleaseReadinessBase,
  type ReleaseReadinessInput,
} from "../../shared/releaseReadiness.js";

function evaluateReleaseReadiness(
  input: Omit<ReleaseReadinessInput, "auditDate"> & { auditDate?: string },
) {
  return evaluateReleaseReadinessBase({ auditDate: "2026-12-11", ...input });
}

function registry(options: { released?: boolean; copyEvidence?: boolean } = {}) {
  const oldFeatures = PatchFeatureId.options.map((id) => ({
    id,
    label: id,
    status: "limited" as const,
    note: "Alcance anterior.",
    evidence: "Evidencia anterior.",
    evidenceIds: [`${id}-0.5`],
  }));
  const targetFeatures = PatchFeatureId.options.map((id) => ({
    id,
    label: id,
    status: id === "item-import" ? ("covered" as const) : ("limited" as const),
    note: "Alcance revisado para 1.0.",
    evidence: "Evidencia propia de 1.0.",
    evidenceIds: [
      options.copyEvidence && id === "market" ? `${id}-0.5` : `${id}-1.0`,
    ],
  }));
  return PatchCompatibilityRegistrySchema.parse({
    schemaVersion: 1,
    targetRelease: {
      version: "1.0",
      releaseDate: "2026-12-11",
      status: options.released === false ? "announced" : "released",
      announcedAt: "2026-08-25",
      source: "GGG",
      sourceUrl: "https://www.pathofexile.com/",
    },
    patches: [
      {
        patchId: "0.5.4f",
        status: "limited",
        reviewedAt: "2026-08-22",
        summary: "Anterior",
        features: oldFeatures,
      },
      {
        patchId: "1.0",
        status: "limited",
        reviewedAt: "2026-12-11",
        summary: "Revisado para lanzamiento",
        features: targetFeatures,
      },
    ],
  });
}

const patches: PatchVersion[] = [
  {
    id: "1.0",
    label: "PoE2 1.0",
    content: "1.0",
    hotfix: null,
    asOf: "2026-12-11",
    source: "Notas oficiales de GGG",
  },
];

function evidenceCatalog(): AuditedReleaseEvidence[] {
  return PatchFeatureId.options.flatMap((featureId) => [
    {
      evidenceId: `${featureId}-0.5`,
      featureId,
      patch: "0.5.4f",
      asOf: "2026-08-22",
      method: "official-source-review" as const,
      artifactPath: `evidence/${featureId}-0.5.json`,
      artifactSha256: "a".repeat(64),
      note: "Evidencia anterior íntegra.",
      artifactVerified: true,
      artifactIssue: null,
    },
    {
      evidenceId: `${featureId}-1.0`,
      featureId,
      patch: "1.0",
      asOf: "2026-12-11",
      method: "official-source-review" as const,
      artifactPath: `evidence/${featureId}-1.0.json`,
      artifactSha256: "b".repeat(64),
      note: "Evidencia nueva e íntegra de 1.0.",
      artifactVerified: true,
      artifactIssue: null,
    },
  ]);
}

function itemTextCorpus(): ItemTextCorpusAudit {
  return {
    schemaVersion: 1,
    supportedLocales: ["es", "en"],
    issues: [],
    cases: (["es", "en"] as const).map((locale) => ({
      id: `item-${locale}-1.0`,
      locale,
      patch: "1.0",
      provenance: {
        method: "in-game-clipboard" as const,
        observedAt: "2026-12-11",
        source: `evidence/item-${locale}-1.0.txt`,
      },
      replayPassed: true,
      issues: [],
    })),
  };
}

function playerWalkthroughs(): PlayerWalkthroughAudit {
  return {
    schemaVersion: 1,
    issues: [],
    runs: (["new-player", "expert-player"] as const).map((role) => ({
      id: `${role}-1.0`,
      role,
      patch: "1.0",
      locale: "es",
      observedAt: "2026-12-11",
      outcome: "pass" as const,
      checkpoints: {
        foundStartingAction: true,
        importedGameItem: true,
        understoodInGameBoundary: true,
        returnedObservedResult: true,
        explainedStopDecision: true,
      },
      blockers: [],
      artifactPath: `evidence/${role}-1.0.md`,
      artifactSha256: role === "new-player" ? "c".repeat(64) : "d".repeat(64),
      artifactVerified: true,
      artifactIssue: null,
    })),
  };
}

describe("auditor de lanzamiento objetivo", () => {
  it("no acepta datos fechados en el futuro aunque el registro diga publicado", () => {
    const report = evaluateReleaseReadiness({
      auditDate: "2026-08-31",
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
      playerWalkthroughs: playerWalkthroughs(),
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "release-window")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "patch-metadata")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "item-import-corpus")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "player-walkthroughs")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "feature-item-import")?.detail).toContain(
      "posteriores a la auditoría",
    );
  });

  it("solo aprueba cuando target, evidencias, pasivas y despliegue coinciden", () => {
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
      playerWalkthroughs: playerWalkthroughs(),
    });
    expect(report.ready).toBe(true);
    expect(report.checks.every((item) => item.status === "pass")).toBe(true);
  });

  it("exige recorridos independientes de jugador nuevo y experto", () => {
    const walkthroughs = playerWalkthroughs();
    walkthroughs.runs = walkthroughs.runs.filter(
      (run) => run.role === "expert-player",
    );
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
      playerWalkthroughs: walkthroughs,
    });

    const check = report.checks.find((item) => item.id === "player-walkthroughs");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("faltan recorridos aprobados de jugador nuevo");
  });

  it("no acepta un recorrido bloqueado, incompleto o anterior al lanzamiento", () => {
    const walkthroughs = playerWalkthroughs();
    const novice = walkthroughs.runs.find((run) => run.role === "new-player");
    if (!novice) throw new Error("Fixture incompleta");
    novice.observedAt = "2026-12-10";
    novice.outcome = "blocked";
    novice.blockers = ["No encontró cómo volver con el resultado."];
    novice.checkpoints.returnedObservedResult = false;

    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
      playerWalkthroughs: walkthroughs,
    });

    const check = report.checks.find((item) => item.id === "player-walkthroughs");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("new-player-1.0");
  });

  it("exige una copia directa y posterior al lanzamiento por cada idioma soportado", () => {
    const corpus = itemTextCorpus();
    corpus.cases = corpus.cases.filter((entry) => entry.locale === "es");
    corpus.cases.push({
      id: "forum-en-1.0",
      locale: "en",
      patch: "1.0",
      provenance: {
        method: "official-forum-derived-regression",
        observedAt: "2026-12-12",
        source: "https://www.pathofexile.com/forum/view-thread/example",
      },
      replayPassed: true,
      issues: [],
    });
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: corpus,
    });

    const check = report.checks.find((item) => item.id === "item-import-corpus");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("faltan copias directas del juego en en");
  });

  it("no acepta una copia del juego observada antes del lanzamiento", () => {
    const corpus = itemTextCorpus();
    const english = corpus.cases.find((entry) => entry.locale === "en");
    if (!english) throw new Error("Fixture incompleta");
    english.provenance.observedAt = "2026-12-10";
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: corpus,
    });

    expect(report.checks.find((item) => item.id === "item-import-corpus")?.status).toBe("fail");
  });

  it("bloquea el lanzamiento si un caso del parche deja de reproducirse", () => {
    const corpus = itemTextCorpus();
    corpus.cases[0].replayPassed = false;
    corpus.cases[0].issues = ["El prefijo esperado ya no se clasificó."];
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: corpus,
    });

    const check = report.checks.find((item) => item.id === "item-import-corpus");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("casos 1.0 que ya no se reproducen: item-es-1.0");
  });

  it("convierte un manifiesto de corpus dañado en un bloqueo legible", () => {
    const corpus = itemTextCorpus();
    corpus.issues = ["No se pudo cargar un manifiesto de corpus válido."];
    corpus.cases = [];
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: corpus,
    });

    const check = report.checks.find((item) => item.id === "item-import-corpus");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("manifiesto inválido");
  });

  it("rechaza evidencia copiada de un parche anterior", () => {
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry({ copyEvidence: true }),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "feature-market")?.status).toBe("fail");
  });

  it("mantiene bloqueado un anuncio aunque el resto parezca preparado", () => {
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "0.5.4f",
      patches,
      compatibility: registry({ released: false }),
      passiveRegistry: {
        testedAgainstPatch: "0.5.4f",
        evidenceId: "passive-tree-0.5",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "target-released")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "passive-registry")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "default-patch")?.status).toBe("fail");
  });

  it("reutiliza la barrera para un parche intermedio sin cambiar el objetivo 1.0", () => {
    const compatibility = registry();
    compatibility.patches.push({
      patchId: "0.5.5",
      status: "review-required",
      reviewedAt: null,
      summary: "Anunciado y pendiente de evidencia.",
      features: PatchFeatureId.options.map((id) => ({
        id,
        label: id,
        status: "review-required" as const,
        note: "Pendiente.",
        evidence: "Sin evidencia propia.",
        evidenceIds: [],
      })),
    });
    const report = evaluateReleaseReadiness({
      targetPatch: "0.5.5",
      defaultPatch: "0.5.4f",
      releaseTarget: {
        version: "0.5.5",
        releaseDate: "2026-09-04",
        status: "announced",
      },
      patches: [{
        id: "0.5.5",
        label: "PoE2 0.5.5 · anunciado",
        status: "announced",
        releaseDate: "2026-09-04",
        asOf: "2026-08-27",
        source: "Anuncio oficial",
      }],
      compatibility,
      passiveRegistry: {
        testedAgainstPatch: "0.5.4f",
        evidenceId: "passive-tree-0.5",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });

    expect(compatibility.targetRelease.version).toBe("1.0");
    expect(report.targetPatch).toBe("0.5.5");
    expect(report.checks.find((item) => item.id === "target-declared")?.status).toBe("pass");
    expect(report.checks.find((item) => item.id === "target-released")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "patch-metadata")?.detail).toContain(
      "solo tiene el anuncio del 2026-08-27",
    );
    expect(report.checks.find((item) => item.id === "feature-item-import")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "default-patch")?.status).toBe("fail");
    expect(report.ready).toBe(false);
  });

  it("rechaza un id nuevo que no resuelve a ningún artefacto catalogado", () => {
    const compatibility = registry();
    const itemImport = compatibility.patches
      .find((patch) => patch.patchId === "1.0")
      ?.features.find((feature) => feature.id === "item-import");
    if (!itemImport) throw new Error("Fixture incompleta");
    itemImport.evidenceIds = ["id-inventado-1.0"];

    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility,
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });

    const check = report.checks.find((item) => item.id === "feature-item-import");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ids sin catálogo: id-inventado-1.0");
  });

  it("rechaza evidencia íntegra si no declara exactamente el parche objetivo", () => {
    const catalog = evidenceCatalog().map((entry) =>
      entry.evidenceId === "basic-crafting-1.0" ? { ...entry, patch: null } : entry,
    );
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: catalog,
      itemTextCorpus: itemTextCorpus(),
    });

    const check = report.checks.find((item) => item.id === "feature-basic-crafting");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ids que no declaran 1.0");
  });

  it("rechaza una mezcla de evidencia nueva y evidencia antigua en la misma área", () => {
    const compatibility = registry();
    const market = compatibility.patches
      .find((patch) => patch.patchId === "1.0")
      ?.features.find((feature) => feature.id === "market");
    if (!market) throw new Error("Fixture incompleta");
    market.evidenceIds = ["market-1.0", "market-0.5"];

    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility,
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });

    const check = report.checks.find((item) => item.id === "feature-market");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ids reutilizados de otro parche: market-0.5");
  });

  it("rechaza evidencia etiquetada 1.0 si fue observada antes del lanzamiento", () => {
    const catalog = evidenceCatalog().map((entry) =>
      entry.evidenceId === "item-import-1.0"
        ? { ...entry, asOf: "2026-12-10" }
        : entry,
    );
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: catalog,
      itemTextCorpus: itemTextCorpus(),
    });

    const check = report.checks.find((item) => item.id === "feature-item-import");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ids anteriores al lanzamiento: item-import-1.0");
  });

  it("rechaza metadatos o revisión fechados antes del lanzamiento", () => {
    const stalePatches = patches.map((patch) => ({
      ...patch,
      asOf: "2026-12-10",
    }));
    const compatibility = registry();
    const targetRecord = compatibility.patches.find(
      (patch) => patch.patchId === "1.0",
    );
    if (!targetRecord) throw new Error("Fixture incompleta");
    targetRecord.reviewedAt = "2026-12-10";

    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches: stalePatches,
      compatibility,
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });

    expect(report.checks.find((item) => item.id === "patch-metadata")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "compatibility-record")?.status).toBe("fail");
  });

  it("rechaza un registro activo de pasivas que no sea evidencia propia de 1.0", () => {
    const compatibility = registry();
    const passiveFeature = compatibility.patches
      .find((patch) => patch.patchId === "1.0")
      ?.features.find((feature) => feature.id === "passive-tree");
    if (!passiveFeature) throw new Error("Fixture incompleta");
    passiveFeature.evidenceIds = ["passive-tree-1.0", "passive-tree-0.5"];

    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility,
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-0.5",
      },
      evidenceCatalog: evidenceCatalog(),
      itemTextCorpus: itemTextCorpus(),
    });

    expect(report.checks.find((item) => item.id === "passive-registry")?.status).toBe("fail");
  });

  it("rechaza un artefacto cuya huella ya no coincide", () => {
    const catalog = evidenceCatalog().map((entry) =>
      entry.evidenceId === "advanced-crafting-1.0"
        ? {
            ...entry,
            artifactVerified: false,
            artifactIssue: "La huella no coincide.",
          }
        : entry,
    );
    const report = evaluateReleaseReadiness({
      targetPatch: "1.0",
      defaultPatch: "1.0",
      patches,
      compatibility: registry(),
      passiveRegistry: {
        testedAgainstPatch: "1.0",
        evidenceId: "passive-tree-1.0",
      },
      evidenceCatalog: catalog,
      itemTextCorpus: itemTextCorpus(),
    });

    const check = report.checks.find((item) => item.id === "feature-advanced-crafting");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("artefactos no verificables");
  });
});

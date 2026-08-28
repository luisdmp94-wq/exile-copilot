import { describe, expect, it } from "vitest";
import type { PatchVersion } from "../../shared/domain.js";
import {
  PatchCompatibilityRegistrySchema,
  PatchFeatureId,
} from "../../shared/patchCompatibility.js";
import type { AuditedReleaseEvidence } from "../../shared/releaseEvidence.js";
import { evaluateReleaseReadiness } from "../../shared/releaseReadiness.js";

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

describe("auditor de lanzamiento objetivo", () => {
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
    });
    expect(report.ready).toBe(true);
    expect(report.checks.every((item) => item.status === "pass")).toBe(true);
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
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "target-released")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "passive-registry")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "default-patch")?.status).toBe("fail");
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
    });

    const check = report.checks.find((item) => item.id === "feature-basic-crafting");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ningún artefacto íntegro declara el parche 1.0");
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
    });

    const check = report.checks.find((item) => item.id === "feature-advanced-crafting");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("artefactos no verificables");
  });
});

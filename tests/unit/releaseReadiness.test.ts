import { describe, expect, it } from "vitest";
import type { PatchVersion } from "../../shared/domain.js";
import {
  PatchCompatibilityRegistrySchema,
  PatchFeatureId,
} from "../../shared/patchCompatibility.js";
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
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "target-released")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "passive-registry")?.status).toBe("fail");
    expect(report.checks.find((item) => item.id === "default-patch")?.status).toBe("fail");
  });
});

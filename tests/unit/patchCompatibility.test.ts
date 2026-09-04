import { describe, expect, it } from "vitest";
import {
  PatchFeatureId,
  PatchCompatibilityRegistrySchema,
  allowsPatchFeature,
  allowsPatchGuidance,
  auditPatchEvidence,
  compatibilityForPatch,
  gatePatchCompatibilityByEvidence,
} from "../../shared/patchCompatibility.js";
import type { AuditedReleaseEvidence } from "../../shared/releaseEvidence.js";

const features = PatchFeatureId.options.map((id) => ({
  id,
  label: id,
  status: "limited" as const,
  note: "Alcance de prueba.",
  evidence: "Evidencia de prueba.",
  evidenceIds: ["test-evidence"],
}));

const registry = PatchCompatibilityRegistrySchema.parse({
  schemaVersion: 1,
  targetRelease: {
    version: "1.0",
    releaseDate: "2026-12-11",
    status: "announced",
    announcedAt: "2026-08-25",
    source: "Anuncio oficial",
    sourceUrl: "https://example.com/announcement",
  },
  patches: [
    {
      patchId: "0.5.4f",
      status: "limited",
      reviewedAt: "2026-08-22",
      summary: "Cobertura parcial y explícita.",
      features,
    },
  ],
});

describe("compatibilidad por parche", () => {
  it("conserva la cobertura explícita sin convertir «limitada» en «total»", () => {
    const result = compatibilityForPatch(registry, "0.5.4f");
    expect(result.status).toBe("limited");
    expect(allowsPatchGuidance(result)).toBe(true);
    expect(allowsPatchFeature(result, "basic-crafting")).toBe(true);
  });

  it("un parche desconocido falla cerrado en todas las áreas", () => {
    const result = compatibilityForPatch(registry, "1.0");
    expect(result.status).toBe("review-required");
    expect(result.reviewedAt).toBeNull();
    expect(result.features).toHaveLength(5);
    expect(result.features.every((feature) => feature.status === "review-required")).toBe(true);
    expect(allowsPatchGuidance(result)).toBe(false);
    expect(allowsPatchFeature(result, "basic-crafting")).toBe(false);
  });

  it("un parche anunciado puede estar registrado sin habilitar ninguna mecánica", () => {
    const announced = PatchCompatibilityRegistrySchema.parse({
      ...registry,
      patches: [
        ...registry.patches,
        {
          patchId: "0.5.5",
          status: "review-required",
          reviewedAt: null,
          summary: "Anunciado; notas y evidencias pendientes.",
          features: PatchFeatureId.options.map((id) => ({
            id,
            label: id,
            status: "review-required",
            note: "Pendiente de revisión propia.",
            evidence: "No hay evidencia del parche.",
            evidenceIds: [],
          })),
        },
      ],
    });

    const result = compatibilityForPatch(announced, "0.5.5");
    expect(result.status).toBe("review-required");
    expect(result.features.every((feature) => feature.evidenceIds.length === 0)).toBe(true);
    expect(allowsPatchGuidance(result)).toBe(false);
    expect(allowsPatchFeature(result, "item-import")).toBe(false);
  });

  it("una cobertura limitada admite parche no mostrado, pero nunca otro parche explícito", () => {
    const auditedRegistry = PatchCompatibilityRegistrySchema.parse({
      ...registry,
      patches: registry.patches.map((record) => ({
        ...record,
        features: record.features.map((feature) => ({
          ...feature,
          evidenceIds: [`${feature.id}-evidence`],
        })),
      })),
    });
    const catalog = PatchFeatureId.options.map<AuditedReleaseEvidence>((featureId) => ({
      evidenceId: `${featureId}-evidence`,
      featureId,
      patch: featureId === "advanced-crafting" ? "0.5.3" : null,
      asOf: "2026-08-20",
      method: "in-game-observation",
      artifactPath: `evidence/${featureId}.json`,
      artifactSha256: "a".repeat(64),
      note: "Evidencia de prueba.",
      artifactVerified: true,
      artifactIssue: null,
    }));

    const issues = auditPatchEvidence(auditedRegistry, catalog);
    expect(issues).toEqual([
      expect.objectContaining({
        featureId: "advanced-crafting",
        evidenceId: "advanced-crafting-evidence",
        code: "wrong-patch",
      }),
    ]);

    const gated = compatibilityForPatch(
      gatePatchCompatibilityByEvidence(auditedRegistry, catalog),
      "0.5.4f",
    );
    expect(allowsPatchFeature(gated, "basic-crafting")).toBe(true);
    expect(allowsPatchFeature(gated, "advanced-crafting")).toBe(false);
    expect(
      gated.features.find((feature) => feature.id === "advanced-crafting")?.note,
    ).toContain("declara 0.5.3, no 0.5.4f");
  });

  it("covered exige parche exacto y una huella verificable", () => {
    const strictRegistry = PatchCompatibilityRegistrySchema.parse({
      ...registry,
      patches: registry.patches.map((record) => ({
        ...record,
        features: record.features.map((feature) => ({
          ...feature,
          status: feature.id === "item-import" ? "covered" : "review-required",
          evidenceIds: feature.id === "item-import" ? ["item-evidence"] : [],
        })),
      })),
    });
    const catalog: AuditedReleaseEvidence[] = [{
      evidenceId: "item-evidence",
      featureId: "item-import",
      patch: null,
      asOf: "2026-08-20",
      method: "parser-regression",
      artifactPath: "evidence/item.json",
      artifactSha256: "b".repeat(64),
      note: "No muestra el parche.",
      artifactVerified: false,
      artifactIssue: "La huella no coincide.",
    }];

    expect(auditPatchEvidence(strictRegistry, catalog)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "wrong-patch" }),
        expect.objectContaining({ code: "unverified-artifact" }),
      ]),
    );
    const gated = compatibilityForPatch(
      gatePatchCompatibilityByEvidence(strictRegistry, catalog),
      "0.5.4f",
    );
    expect(allowsPatchFeature(gated, "item-import")).toBe(false);
  });
});

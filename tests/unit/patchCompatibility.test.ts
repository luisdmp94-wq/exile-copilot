import { describe, expect, it } from "vitest";
import {
  PatchFeatureId,
  PatchCompatibilityRegistrySchema,
  allowsPatchFeature,
  allowsPatchGuidance,
  compatibilityForPatch,
} from "../../shared/patchCompatibility.js";

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
});

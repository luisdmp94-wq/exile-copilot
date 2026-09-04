import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditReleaseEvidenceCatalog,
  loadReleaseEvidenceCatalog,
} from "../../server/releaseEvidenceCatalog.js";
import { ReleaseEvidenceCatalogSchema } from "../../shared/releaseEvidence.js";
import {
  PatchCompatibilityRegistrySchema,
  auditPatchEvidence,
} from "../../shared/patchCompatibility.js";

describe("catálogo real de evidencias de lanzamiento", () => {
  it("resuelve ids únicos a artefactos locales con la huella esperada", () => {
    const records = loadReleaseEvidenceCatalog();
    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((record) => record.evidenceId)).size).toBe(records.length);
    expect(records.every((record) => record.artifactVerified)).toBe(true);
    expect(records.every((record) => record.artifactIssue === null)).toBe(true);
  });

  it("conserva como parche desconocido las observaciones que no lo muestran", () => {
    const records = loadReleaseEvidenceCatalog();
    expect(
      records.find(
        (record) => record.evidenceId === "poe2-observed-currency-actions-2026-08-22",
      )?.patch,
    ).toBeNull();
    expect(
      records.find((record) => record.evidenceId === "passiveRegistry.1e9eb2d8")?.patch,
    ).toBe("0.5.4f");
  });

  it("el registro activo no habilita ninguna evidencia de otro parche", () => {
    const compatibility = PatchCompatibilityRegistrySchema.parse(
      JSON.parse(
        readFileSync(
          fileURLToPath(new URL("../../server/data/patchCompatibility.json", import.meta.url)),
          "utf8",
        ),
      ) as unknown,
    );
    expect(auditPatchEvidence(compatibility, loadReleaseEvidenceCatalog())).toEqual([]);
  });

  it("detecta bytes alterados y rutas que intentan salir del repositorio", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-evidence-catalog-"));
    try {
      const artifact = join(root, "evidence.txt");
      writeFileSync(artifact, "evidencia exacta", "utf8");
      const sha256 = createHash("sha256").update("evidencia exacta").digest("hex");
      const catalog = ReleaseEvidenceCatalogSchema.parse({
        schemaVersion: 1,
        records: [
          {
            evidenceId: "evidence-ok",
            featureId: "item-import",
            patch: "1.0",
            asOf: "2026-12-11",
            method: "parser-regression",
            artifactPath: "evidence.txt",
            artifactSha256: sha256,
            note: "Fixture local.",
          },
          {
            evidenceId: "evidence-escape",
            featureId: "item-import",
            patch: "1.0",
            asOf: "2026-12-11",
            method: "parser-regression",
            artifactPath: "../fuera.txt",
            artifactSha256: sha256,
            note: "Ruta inválida.",
          },
        ],
      });

      const firstAudit = auditReleaseEvidenceCatalog(catalog, root);
      expect(firstAudit.find((record) => record.evidenceId === "evidence-ok")?.artifactVerified).toBe(true);
      expect(firstAudit.find((record) => record.evidenceId === "evidence-escape")?.artifactIssue).toContain("sale del repositorio");

      writeFileSync(artifact, "evidencia manipulada", "utf8");
      const secondAudit = auditReleaseEvidenceCatalog(catalog, root);
      expect(secondAudit.find((record) => record.evidenceId === "evidence-ok")?.artifactVerified).toBe(false);
      expect(secondAudit.find((record) => record.evidenceId === "evidence-ok")?.artifactIssue).toContain("huella");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditReleaseEvidenceCatalog } from "../../server/releaseEvidenceCatalog.js";
import { registerReleaseEvidence } from "../../server/releaseEvidenceRegistration.js";
import { ReleaseEvidenceCatalogSchema } from "../../shared/releaseEvidence.js";

function projectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "exile-copilot-release-evidence-"));
  mkdirSync(join(root, "server/data"), { recursive: true });
  mkdirSync(join(root, "docs/evidence/raw"), { recursive: true });
  writeFileSync(
    join(root, "server/data/releaseEvidence.json"),
    `${JSON.stringify({ schemaVersion: 1, records: [] }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, "docs/evidence/raw/item-import.txt"),
    "PoE2 1.0 · copia directa observada el 2026-12-11",
  );
  return root;
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "item-import-1.0-es-2026-12-11",
    featureId: "item-import",
    patch: "1.0",
    asOf: "2026-12-11",
    method: "in-game-observation",
    subjectPath: "docs/evidence/raw/item-import.txt",
    note: "Copia directa en español observada dentro del cliente de PoE2 1.0.",
    ...overrides,
  };
}

function catalog(root: string) {
  return ReleaseEvidenceCatalogSchema.parse(
    JSON.parse(
      readFileSync(join(root, "server/data/releaseEvidence.json"), "utf8"),
    ) as unknown,
  );
}

describe("registro seguro de evidencias de lanzamiento", () => {
  it("vincula recibo y fuente mediante dos huellas auditables", () => {
    const root = projectRoot();
    const registered = registerReleaseEvidence(submission(), root);

    expect(registered.receiptPath).toBe(
      "docs/evidence/release/1.0/item-import-1.0-es-2026-12-11.md",
    );
    expect(readFileSync(join(root, registered.receiptPath), "utf8")).toContain(
      "Formato: EC-RELEASE-EVIDENCE-1",
    );
    expect(auditReleaseEvidenceCatalog(catalog(root), root)[0]).toMatchObject({
      artifactVerified: true,
      artifactIssue: null,
    });

    writeFileSync(
      join(root, "docs/evidence/raw/item-import.txt"),
      "fuente alterada",
    );
    expect(auditReleaseEvidenceCatalog(catalog(root), root)[0]).toMatchObject({
      artifactVerified: false,
      artifactIssue: expect.stringContaining("huella de la fuente"),
    });
  });

  it("rechaza un recibo incoherente aunque su propia huella coincida", () => {
    const root = projectRoot();
    const registered = registerReleaseEvidence(submission(), root);
    const receiptPath = join(root, registered.receiptPath);
    const altered = readFileSync(receiptPath, "utf8").replace(
      "Área: item-import",
      "Área: market",
    );
    writeFileSync(receiptPath, altered);
    const parsed = catalog(root);
    parsed.records[0]!.artifactSha256 = createHash("sha256")
      .update(altered)
      .digest("hex");

    expect(auditReleaseEvidenceCatalog(parsed, root)[0]).toMatchObject({
      artifactVerified: false,
      artifactIssue: expect.stringContaining("no coincide con los metadatos"),
    });
  });

  it("no sobrescribe evidencias ni acepta fuentes exteriores", () => {
    const root = projectRoot();
    const first = registerReleaseEvidence(submission(), root);
    const receipt = readFileSync(join(root, first.receiptPath), "utf8");

    expect(() => registerReleaseEvidence(submission(), root)).toThrow(
      "Ya existe la evidencia",
    );
    expect(readFileSync(join(root, first.receiptPath), "utf8")).toBe(receipt);
    expect(() =>
      registerReleaseEvidence(
        submission({ evidenceId: "fuera", subjectPath: "../fuera.txt" }),
        root,
      ),
    ).toThrow("fuente no existe dentro");
    expect(
      existsSync(join(root, "docs/evidence/release/1.0/fuera.md")),
    ).toBe(false);
  });
});

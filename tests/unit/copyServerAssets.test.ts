import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  copyCatalogEvidenceFiles,
  copyCorpusFixtureFiles,
} from "../../scripts/copy-server-assets.mjs";

describe("copia de evidencias al servidor de producción", () => {
  it("conserva juntos el recibo y su fuente", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copy-evidence-"));
    const dist = join(root, "dist-server");
    const receipt = "docs/evidence/release/1.0/item.md";
    const subject = "docs/evidence/raw/item.txt";
    mkdirSync(join(root, "docs/evidence/release/1.0"), { recursive: true });
    mkdirSync(join(root, "docs/evidence/raw"), { recursive: true });
    writeFileSync(join(root, receipt), "recibo");
    writeFileSync(join(root, subject), "fuente");

    copyCatalogEvidenceFiles(root, dist, {
      records: [{ artifactPath: receipt, subjectPath: subject }],
    });

    expect(existsSync(join(dist, receipt))).toBe(true);
    expect(existsSync(join(dist, subject))).toBe(true);
  });

  it("valida todas las rutas antes de copiar la primera", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copy-evidence-"));
    const dist = join(root, "dist-server");
    const receipt = "docs/evidence/release/1.0/item.md";
    mkdirSync(join(root, "docs/evidence/release/1.0"), { recursive: true });
    writeFileSync(join(root, receipt), "recibo");

    expect(() =>
      copyCatalogEvidenceFiles(root, dist, {
        records: [{ artifactPath: receipt, subjectPath: "../fuera.txt" }],
      }),
    ).toThrow("fuera del repositorio");
    expect(existsSync(join(dist, receipt))).toBe(false);
  });

  it("copia un fixture del corpus que vive fuera de server/fixtures", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copy-corpus-"));
    const dist = join(root, "dist-server");
    const corpusRoot = join(root, "server/fixtures/itemText");
    const external = join(root, "docs/evidence/crafting/item.es.txt");
    mkdirSync(corpusRoot, { recursive: true });
    mkdirSync(join(root, "docs/evidence/crafting"), { recursive: true });
    writeFileSync(external, "tooltip externo");

    copyCorpusFixtureFiles(root, dist, corpusRoot, {
      cases: [{ fixture: "../../../docs/evidence/crafting/item.es.txt" }],
    });

    expect(existsSync(join(dist, "docs/evidence/crafting/item.es.txt"))).toBe(
      true,
    );
  });

  it("rechaza todos los fixtures si uno intenta salir del repositorio", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copy-corpus-"));
    const dist = join(root, "dist-server");
    const corpusRoot = join(root, "server/fixtures/itemText");
    const safe = join(corpusRoot, "safe.txt");
    mkdirSync(corpusRoot, { recursive: true });
    writeFileSync(safe, "fixture seguro");

    expect(() =>
      copyCorpusFixtureFiles(root, dist, corpusRoot, {
        cases: [
          { fixture: "safe.txt" },
          { fixture: "../../../../fuera.txt" },
        ],
      }),
    ).toThrow("fuera del repositorio");
    expect(existsSync(join(dist, "server/fixtures/itemText/safe.txt"))).toBe(
      false,
    );
  });
});

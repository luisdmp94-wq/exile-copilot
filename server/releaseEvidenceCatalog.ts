import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import {
  ReleaseEvidenceCatalogSchema,
  type AuditedReleaseEvidence,
  type ReleaseEvidenceCatalog,
} from "../shared/releaseEvidence.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CATALOG_PATH = fileURLToPath(
  new URL("./data/releaseEvidence.json", import.meta.url),
);

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

/**
 * Comprueba que cada evidencia apunta a un fichero dentro del repositorio y
 * que sus bytes siguen siendo exactamente los que se auditaron.
 */
export function auditReleaseEvidenceCatalog(
  catalog: ReleaseEvidenceCatalog,
  projectRoot = PROJECT_ROOT,
): AuditedReleaseEvidence[] {
  const root = resolve(projectRoot);
  return catalog.records.map((record) => {
    const artifact = resolve(root, record.artifactPath);
    if (!isInside(root, artifact)) {
      return {
        ...record,
        artifactVerified: false,
        artifactIssue: "La ruta sale del repositorio autorizado.",
      };
    }
    if (!existsSync(artifact)) {
      return {
        ...record,
        artifactVerified: false,
        artifactIssue: `No existe ${record.artifactPath}.`,
      };
    }
    const actual = createHash("sha256").update(readFileSync(artifact)).digest("hex");
    if (actual !== record.artifactSha256) {
      return {
        ...record,
        artifactVerified: false,
        artifactIssue: `La huella de ${record.artifactPath} no coincide.`,
      };
    }
    return { ...record, artifactVerified: true, artifactIssue: null };
  });
}

export function loadReleaseEvidenceCatalog(): AuditedReleaseEvidence[] {
  const parsed = ReleaseEvidenceCatalogSchema.parse(
    JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as unknown,
  );
  return auditReleaseEvidenceCatalog(parsed);
}

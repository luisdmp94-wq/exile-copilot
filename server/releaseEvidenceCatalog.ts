import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import {
  buildReleaseEvidenceReceipt,
  RELEASE_EVIDENCE_RECEIPT_VERSION,
  ReleaseEvidenceCatalogSchema,
  type AuditedReleaseEvidence,
  type ReleaseEvidenceCatalog,
  type ReleaseEvidenceRecord,
} from "../shared/releaseEvidence.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CATALOG_PATH = fileURLToPath(
  new URL("./data/releaseEvidence.json", import.meta.url),
);

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function receiptIssues(record: ReleaseEvidenceRecord, content: string): string[] {
  if (!record.subjectPath || !record.subjectSha256) return [];
  const expected = buildReleaseEvidenceReceipt(
    {
      evidenceId: record.evidenceId,
      featureId: record.featureId,
      patch: record.patch,
      asOf: record.asOf,
      method: record.method,
      subjectPath: record.subjectPath,
      note: record.note,
    },
    record.subjectSha256,
  );
  if (content.replace(/\r\n?/g, "\n") === expected) return [];
  return [
    `El recibo ${RELEASE_EVIDENCE_RECEIPT_VERSION} no coincide con los metadatos del catálogo.`,
  ];
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
    const artifactBytes = readFileSync(artifact);
    const actual = createHash("sha256").update(artifactBytes).digest("hex");
    if (actual !== record.artifactSha256) {
      return {
        ...record,
        artifactVerified: false,
        artifactIssue: `La huella de ${record.artifactPath} no coincide.`,
      };
    }
    const semanticIssues = receiptIssues(record, artifactBytes.toString("utf8"));
    if (semanticIssues.length > 0) {
      return {
        ...record,
        artifactVerified: false,
        artifactIssue: semanticIssues.join(" "),
      };
    }
    if (record.subjectPath && record.subjectSha256) {
      const subject = resolve(root, record.subjectPath);
      if (!isInside(root, subject)) {
        return {
          ...record,
          artifactVerified: false,
          artifactIssue: "La ruta de la fuente sale del repositorio autorizado.",
        };
      }
      if (!existsSync(subject)) {
        return {
          ...record,
          artifactVerified: false,
          artifactIssue: `No existe la fuente ${record.subjectPath}.`,
        };
      }
      const subjectHash = createHash("sha256")
        .update(readFileSync(subject))
        .digest("hex");
      if (subjectHash !== record.subjectSha256) {
        return {
          ...record,
          artifactVerified: false,
          artifactIssue: `La huella de la fuente ${record.subjectPath} no coincide.`,
        };
      }
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
